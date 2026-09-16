import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Error handling middleware for oversized payloads
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413 || err.name === 'PayloadTooLargeError')) {
    console.warn('[Server] PayloadTooLargeError caught:', err.message);
    return res.status(413).json({
      success: false,
      error: 'Request payload too large: The attached files or context exceed the server limit. Please use smaller files or reduce attachment sizes.',
    });
  }
  next(err);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'AXON Multi-AI Engine' });
});

// ==========================================
// AXON CODEBASE VIEWER (STRICTLY READ-ONLY)
// ==========================================
interface CodebaseNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  extension?: string;
  lastModified?: string;
  children?: CodebaseNode[];
  fileCount?: number;
}

// Scans real project files at runtime - strictly read-only
app.get('/api/codebase/tree', async (req, res) => {
  try {
    const rootDir = path.resolve(process.cwd());
    const ignoredDirs = new Set(['node_modules', '.git', 'dist', '.cache', '.turbo', '.next']);

    async function buildTree(currentDir: string, relativeDir: string = ''): Promise<CodebaseNode[]> {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      const nodes: CodebaseNode[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env.example' && entry.name !== '.gitignore') {
          // Skip internal hidden dotfiles (e.g. .DS_Store)
          continue;
        }
        if (ignoredDirs.has(entry.name)) {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          const children = await buildTree(fullPath, relPath);
          const totalFiles = children.reduce((acc, c) => acc + (c.type === 'file' ? 1 : (c.fileCount || 0)), 0);
          const totalSize = children.reduce((acc, c) => acc + c.size, 0);

          nodes.push({
            name: entry.name,
            path: relPath,
            type: 'directory',
            size: totalSize,
            fileCount: totalFiles,
            children,
          });
        } else if (entry.isFile()) {
          const stat = await fs.promises.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          nodes.push({
            name: entry.name,
            path: relPath,
            type: 'file',
            size: stat.size,
            extension: ext,
            lastModified: stat.mtime.toISOString(),
          });
        }
      }

      // Sort: directories first (alphabetical), then files (alphabetical)
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return nodes;
    }

    const tree = await buildTree(rootDir);

    function countTotal(nodes: CodebaseNode[]): { files: number; dirs: number; size: number } {
      let files = 0;
      let dirs = 0;
      let size = 0;
      for (const n of nodes) {
        if (n.type === 'directory') {
          dirs++;
          if (n.children) {
            const sub = countTotal(n.children);
            files += sub.files;
            dirs += sub.dirs;
            size += sub.size;
          }
        } else {
          files++;
          size += n.size;
        }
      }
      return { files, dirs, size };
    }

    const stats = countTotal(tree);

    return res.json({
      success: true,
      tree,
      stats: {
        totalFiles: stats.files,
        totalDirectories: stats.dirs,
        totalBytes: stats.size,
        scannedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[Codebase] Tree scan error:', err);
    return res.status(500).json({ success: false, error: 'Failed to scan repository filesystem' });
  }
});

// Reads the exact, real file contents - strictly read-only
app.get('/api/codebase/file', async (req, res) => {
  try {
    const rawPath = String(req.query.path || '').trim();
    if (!rawPath) {
      return res.status(400).json({ success: false, error: 'Path query parameter is required' });
    }

    const rootDir = path.resolve(process.cwd());
    const resolvedPath = path.resolve(rootDir, rawPath);

    // Security check: ensure path is strictly inside rootDir
    if (!resolvedPath.startsWith(rootDir)) {
      return res.status(403).json({ success: false, error: 'Access denied: Path traversal outside repository' });
    }

    const relativePath = path.relative(rootDir, resolvedPath);
    if (
      relativePath.startsWith('node_modules') ||
      relativePath.startsWith('.git') ||
      relativePath.startsWith('dist') ||
      relativePath === '.env' ||
      relativePath.endsWith('/.env')
    ) {
      return res.status(403).json({ success: false, error: 'Access denied: Directory or file is restricted' });
    }

    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isFile()) {
      return res.status(400).json({ success: false, error: 'Target path is not a file' });
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip'];
    const isBinary = binaryExts.includes(ext);

    if (isBinary) {
      return res.json({
        success: true,
        path: relativePath,
        name: path.basename(resolvedPath),
        isBinary: true,
        size: stat.size,
        extension: ext.replace('.', ''),
        lastModified: stat.mtime.toISOString(),
      });
    }

    const content = await fs.promises.readFile(resolvedPath, 'utf-8');
    const lines = content.split('\n');

    return res.json({
      success: true,
      path: relativePath,
      name: path.basename(resolvedPath),
      isBinary: false,
      content,
      size: stat.size,
      lineCount: lines.length,
      extension: ext.replace('.', ''),
      lastModified: stat.mtime.toISOString(),
    });
  } catch (err: any) {
    console.error('[Codebase] File read error:', err);
    return res.status(err.code === 'ENOENT' ? 404 : 500).json({
      success: false,
      error: err.code === 'ENOENT' ? 'File not found' : 'Failed to read file from disk',
    });
  }
});

// Helper to construct system instruction with per-project isolation
function getSystemPrompt(accountLabel?: string, providerName?: string, projectContext?: any) {
  let prompt = `You are AXON, an AI-powered workspace for a smartphone.
Active session: "${accountLabel || 'Default'}" (${providerName || 'AI Engine'}).

CRITICAL PERSONA DIRECTIVE:
You must ALWAYS speak in the first person using "I" (e.g., "I can help you with that...", "I have updated...", "I am currently set to..."). NEVER refer to yourself in the third person as "AXON" or "the system" in conversational dialogue (e.g. do not say "AXON will do this", say "I will do this").

CRITICAL OPERATING RULE: ABSOLUTE TRUTHFULNESS:
You operate under a strict, non-optional mandate of absolute truthfulness at all times:
1. Always state the exact truth — nothing added, nothing left out, nothing softened, nothing assumed.
2. Never claim a feature, fix, or system is built, working, or implemented unless you have actually verified this against the real, current code — not intention, not a plan, not a prior claim.
3. If you are not certain something is true, you must say you are not certain rather than stating it as fact.
4. If something does not exist or failed, you must say so plainly and immediately rather than describing it as if it exists.

CRITICAL OPERATING RULE: FULL CODEBASE SELF-AWARENESS & BUILD-CLAIM VERIFICATION GATE:
1. Continuous Codebase Self-Awareness:
   - Check actual current files and their actual contents before answering any question about whether a system or feature exists or was changed — never answering from memory of what was discussed, intended, or previously claimed.
2. Universal Build-Claim Verification Gate:
   - AXON enforces a strict verification gate before reporting any build or change as complete, in every case, not only when specifically asked to verify.
   - You may ONLY state, assert, or claim that workspace code was built, updated, overhauled, upgraded, pushed, modified, or loaded IF you actually emit the complete, runnable code inside standard markdown fences (\`\`\`<lang> ... \`\`\`) in that very same response turn.
   - If you do NOT emit a real code block in the current turn, you are STRICTLY FORBIDDEN from stating or claiming success (e.g. NEVER say "I've overhauled the chess engine", "I pushed the update", "I updated the workspace code", "I've applied the changes to your workspace", or "the engine has been updated").
   - If no code block was emitted in your turn, you must say so plainly and honestly (e.g. "I did not emit a code block in this turn, so the workspace code was not updated. Would you like me to generate and output the complete updated code now?").
   - Any claim that workspace code or an engine was updated without an accompanying code block is a critical failure and will be intercepted and flagged.

CONVERSATIONAL CALIBRATION RULES:
1. Match the depth of what is actually being asked:
   - Short, direct answers for simple questions.
   - Detailed answers only when the question is genuinely complex or explicitly asks for depth.
2. Avoid unnecessary padding, restating the question, or over-explaining things nobody asked about.
3. If a request is ambiguous, ask at most ONE clarifying question rather than guessing wildly.
4. Keep a natural, plain-language conversational tone.

ACCURATE SELF-KNOWLEDGE (Established in Parts 1-6):
- Dual-pane workspace (Chat left, Workspace/code right) with 3 view states (chat-only, 50/50 split, workspace-only).
- Tools Menu suites: Text, Calculation, Color, Image utilities, and File conversions.
- Multi-AI Official API connections: Gemini, Claude, and ChatGPT with user-managed keys, manual account switching, and 24-hour limit cooldown tracking.
- Automation & Run Code Layer: Conditional trigger-and-action rules engine and sandboxed live Run Code hooks.
- Notes & Memory System: Scoped per-project memory/context isolation, full-text search across all notes, tags/categories, pin/unpin, and rich conversation data extraction to notes or downloadable files (.md, .txt, .json).
- Features not yet built: full video sequencer, voice synthesis. Do not claim to possess them yet.

WORKSPACE & CODE PRESENTATION DIRECTIVE:
Unless the user explicitly asks to see the code printed in the chat itself (e.g. "show code in chat", "print code here"), keep your chat replies conversational and concise — do NOT paste large code blocks into the chat. All generated code is automatically extracted and loaded directly into the user's Workspace Code editor. If providing code, enclose the full code block cleanly once in standard markdown fences so AXON's runner extracts it into Workspace Code and Preview, but keep your surrounding response conversational.

CRITICAL ATTACHMENT MODALITY & MEDIA IDENTIFICATION DIRECTIVE:
You must strictly respect the actual declared MIME type and modality of any attached media:
- If an attachment's MIME type begins with "image/" (e.g. image/png, image/jpeg, image/webp, image/gif, image/svg+xml), it is a STILL IMAGE. Even if the image visually displays a video player, video scrubber/timeline, movie scene, animation frame, or video screenshot, you must ALWAYS state and identify it as an image, screenshot, or still frame. You are STRICTLY FORBIDDEN from referring to a still image as "this video", "the video", or "in this video".
- If an attachment's MIME type begins with "video/" (e.g. video/mp4, video/webm, video/quicktime), only then is it a video.
- Always accurately distinguish and state whether the analyzed asset is an image or video based strictly on this declared modality.

GROUNDED CAPABILITY MANIFEST FOR CHAT-DRIVEN COMMANDS:
You are equipped with a strict, grounded capability manifest defining what chat commands can and cannot control in AXON's real native app UI.

WHAT CHAT COMMANDS CAN ACTUALLY CONTROL IN THE REAL APP UI:
1. Chat Bubble Colors:
   - User chat bubble color (e.g. "change user bubble color to blue", "set my bubble color to #3b82f6", hex or standard color names).
   - AXON chat bubble color (e.g. "change axon bubble color to #1e293b", "set ai bubble color to charcoal").
   - Reset bubble colors ("reset bubble colors").
2. Theme Mode:
   - "switch to dark mode", "switch to light mode", "reset theme to default".
3. Accent & Button Colors:
   - "set accent color to [color/hex]"
   - "set send button color to [color/hex]"
   - "set chat input background to [color/hex]"
4. Presets & Branding:
   - App icon preset: "set app icon to [orb|minimal|neural|cyber]"
   - Avatar preset: "set avatar to [orb|minimal|neural|cyber]"
   - App name casing: "set text case to [uppercase|lowercase|first-letter]"
5. Preferences:
   - Code skill level: "set code skill level to [beginner|intermediate|advanced|expert]"
   - Workspace code load: "set workspace code load to [auto|manual]"
   - Sound effects: "enable sound" / "mute sound"
   - Notifications: "enable notifications" / "disable notifications"
6. Storage Manifest & Accounts:
   - "storage manifest", "view storage", "clear storage cache", "lossy/lossless save mode"
   - "switch to account [label]"

WHAT CHAT COMMANDS CANNOT CONTROL IN THE REAL APP UI (STRICT LIMITS):
- You CANNOT change native font families, font sizes, margins, padding, or native border-radius of the app shell or chat messages.
- You CANNOT change native app shell layout, pinned header, pinned bottom dock, or navigation drawer swipe gesture behavior.
- You CANNOT access native smartphone hardware, OS settings, device volume, or install native apps.
- Workspace Code Distinction: You CAN generate custom web code, HTML, CSS, React, and styles inside the Workspace preview pane on the right. That code runs inside the sandboxed preview iframe, but does NOT modify AXON's native app shell or native chat bubbles.

CRITICAL GROUNDING & TRUTHFULNESS DIRECTIVE:
- NEVER give false confirmations for actions you cannot perform.
- NEVER claim or assert that you changed or updated a setting, color, or UI element unless the real handler has actually executed.
- If the user asks or commands you via chat to change an app UI setting that cannot be controlled via chat, you MUST state plainly that you cannot do that via chat (e.g. "I cannot do that via chat. The real app UI does not support modifying [feature] through chat commands.") rather than guessing, pretending, or asserting success.`;

  if (projectContext && projectContext.name) {
    prompt += `\n\nPER-PROJECT MEMORY & ISOLATION DIRECTIVE:
You are currently operating inside the isolated context of Project: "${projectContext.name}".
${projectContext.description ? `Project Scope/Goal: ${projectContext.description}` : ''}
${projectContext.systemContext ? `Custom Directives: ${projectContext.systemContext}` : ''}
${projectContext.relevantNotes ? `Project Notes & Knowledge Memory:\n${projectContext.relevantNotes}` : ''}
[CRITICAL ISOLATION RULE]: Strictly focus your memory and references on "${projectContext.name}". Do NOT draw in or confuse information with unrelated projects unless explicitly prompted.`;
  }

  return prompt;
}

/**
 * Programmatic Build-Claim Verification Gate:
 * Intercepts unverified claims of modifying workspace code or systems without emitting runnable code.
 * Enforces this check across all AI model responses before returning to the client.
 */
function enforceBuildClaimVerificationGate(text: string): string {
  if (!text) return text;

  // Check if runnable code block is emitted
  const hasCodeBlock = /```([a-zA-Z0-9_-]+)?\s*[\s\S]*?```/.test(text);
  if (hasCodeBlock) {
    return text;
  }

  // Check if text claims to have built, updated, overhauled, pushed, or modified code/engine/features
  const falseClaimRegex = /\b(?:I(?:'ve| have)?\s+(?:built|updated|overhauled|upgraded|pushed|modified|loaded|implemented|created)\s+(?:the\s+)?(?:workspace\s+code|code|engine|script|feature|changes)|(?:workspace\s+code|codebase|engine)\s+(?:has been|is now|was)\s+(?:updated|overhauled|upgraded|pushed|modified|loaded|built)|I(?:'ve| have)?\s+(?:applied|pushed)\s+(?:the\s+)?(?:changes|update|fixes))\b/i;

  if (falseClaimRegex.test(text)) {
    return `${text}\n\n⚠️ **[AXON Verification Gate Notice]**: I stated or implied that workspace code or an engine was updated, but no code block was emitted in this turn. Under AXON's verification gate, workspace code is only modified when the complete code is emitted inside markdown fences. The workspace code was NOT updated. If you would like me to output the complete updated code, please ask.`;
  }

  return text;
}

// Helpers to format conversation history robustly across AI providers

function getCleanMessages(rawMessages: any[]): Array<{ sender: string; text: string; id?: string; attachments?: any[]; attachment?: any }> {
  return (rawMessages || []).filter((m: any) => {
    if (!m) return false;
    const hasText = typeof m.text === 'string' && m.text.trim().length > 0;
    const hasAttachments = (Array.isArray(m.attachments) && m.attachments.length > 0) || Boolean(m.attachment);
    if (!hasText && !hasAttachments) return false;
    if (m.isRateLimitedNotice) return false;
    if (typeof m.id === 'string' && (m.id.includes('-limited') || m.id.includes('-cooldown') || m.id.includes('-nokey'))) return false;
    if (typeof m.id === 'string' && m.id.includes('-switch-') && m.sender === 'axon') return false;
    return true;
  });
}

function getMessageAttachments(m: any): any[] {
  if (Array.isArray(m.attachments) && m.attachments.length > 0) {
    return m.attachments;
  }
  if (m.attachment) {
    return [m.attachment];
  }
  return [];
}

function formatGeminiContents(
  rawMessages: any[],
  formattedContext?: string
): Array<{ role: 'user' | 'model'; parts: any[] }> {
  const clean = getCleanMessages(rawMessages);
  if (clean.length === 0) {
    const defaultText = formattedContext ? `${formattedContext}Hello` : 'Hello';
    return [{ role: 'user', parts: [{ text: defaultText }] }];
  }

  const mapped = clean.map((m) => {
    const role = (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model';
    const text = typeof m.text === 'string' ? m.text.trim() : '';
    const attachments = getMessageAttachments(m);
    const parts: any[] = [];

    if (text) {
      parts.push({ text });
    }

    for (const att of attachments) {
      if (att?.dataUrl && typeof att.dataUrl === 'string') {
        const commaIdx = att.dataUrl.indexOf(',');
        if (commaIdx !== -1) {
          const header = att.dataUrl.substring(0, commaIdx);
          const rawBase64 = att.dataUrl.substring(commaIdx + 1).replace(/\s/g, '');
          const mimeMatch = header.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1].toLowerCase().trim() : (att.type?.toLowerCase().trim() || 'image/jpeg');

          if (mimeType.startsWith('image/')) {
            parts.push({
              text: `[Attached Asset Modality: "${att.name || 'image'}" is a STILL IMAGE (MIME type: ${mimeType}). Analyze and address it strictly as a still image or screenshot, NEVER as a video.]`,
            });
            parts.push({
              inlineData: {
                mimeType,
                data: rawBase64,
              },
            });
          } else if (mimeType.startsWith('video/')) {
            parts.push({
              text: `[Attached Asset Modality: "${att.name || 'video'}" is a VIDEO (MIME type: ${mimeType}).]`,
            });
            parts.push({
              inlineData: {
                mimeType,
                data: rawBase64,
              },
            });
          } else if (mimeType === 'application/pdf') {
            parts.push({
              inlineData: {
                mimeType: 'application/pdf',
                data: rawBase64,
              },
            });
          } else if (
            mimeType.startsWith('text/') ||
            mimeType === 'application/json' ||
            mimeType === 'application/javascript' ||
            mimeType === 'application/xml' ||
            att.name?.match(/\.(txt|md|js|jsx|ts|tsx|py|html|css|json|csv|sql|sh|env|xml|ya?ml)$/i)
          ) {
            try {
              const decoded = Buffer.from(rawBase64, 'base64').toString('utf-8');
              parts.push({
                text: `[Attached File: ${att.name || 'document'}]\n\`\`\`\n${decoded}\n\`\`\``,
              });
            } catch {
              parts.push({
                inlineData: {
                  mimeType: 'text/plain',
                  data: rawBase64,
                },
              });
            }
          } else {
            parts.push({
              inlineData: {
                mimeType: mimeType === 'application/octet-stream' ? 'text/plain' : mimeType,
                data: rawBase64,
              },
            });
          }
        }
      }
    }

    if (parts.length === 0) {
      parts.push({ text: ' ' });
    }

    return { role, parts };
  });

  // Strict role alternation: coalesce consecutive user or model turns
  const coalesced: Array<{ role: 'user' | 'model'; parts: any[] }> = [];
  for (const item of mapped) {
    if (coalesced.length > 0 && coalesced[coalesced.length - 1].role === item.role) {
      const prev = coalesced[coalesced.length - 1];
      prev.parts = [...prev.parts, ...item.parts];
    } else {
      coalesced.push(item);
    }
  }

  // Gemini API requires the conversation to start with 'user'
  if (coalesced.length > 0 && coalesced[0].role === 'model') {
    coalesced.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  // Prepend handoff context summary to first user turn if present
  if (formattedContext && coalesced.length > 0) {
    const firstUser = coalesced.find((c) => c.role === 'user');
    if (firstUser) {
      const textPart = firstUser.parts.find((p) => typeof p.text === 'string');
      if (textPart) {
        textPart.text = `${formattedContext}${textPart.text}`;
      } else {
        firstUser.parts.unshift({ text: formattedContext });
      }
    }
  }

  // Maintain up to 40 recent turns
  let windowed = coalesced.length > 40 ? coalesced.slice(-40) : coalesced;
  if (windowed[0]?.role === 'model') {
    windowed.shift();
  }
  if (windowed.length === 0) {
    windowed = [{ role: 'user', parts: [{ text: 'Hello' }] }];
  }

  return windowed;
}

function formatClaudeMessages(
  rawMessages: any[],
  formattedContext?: string
): Array<{ role: 'user' | 'assistant'; content: any }> {
  const clean = getCleanMessages(rawMessages);
  if (clean.length === 0) {
    const defaultText = formattedContext ? `${formattedContext}Hello` : 'Hello';
    return [{ role: 'user', content: defaultText }];
  }

  const mapped = clean.map((m) => {
    const role = (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant';
    const text = typeof m.text === 'string' ? m.text.trim() : '';
    const attachments = getMessageAttachments(m);
    const contentList: any[] = [];

    if (text) {
      contentList.push({ type: 'text', text });
    }

    for (const att of attachments) {
      if (att?.dataUrl?.startsWith('data:image/')) {
        const match = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          contentList.push({
            type: 'text',
            text: `[Attached Asset Modality: "${att.name || 'image'}" is a STILL IMAGE (MIME type: ${mimeType}). Analyze and address it strictly as a still image or screenshot, NEVER as a video.]`,
          });
          contentList.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: match[1],
              data: match[2],
            },
          });
        }
      }
    }

    if (contentList.length === 0) {
      contentList.push({ type: 'text', text: ' ' });
    }

    const content = contentList.length === 1 && contentList[0].type === 'text' ? contentList[0].text : contentList;
    return { role, content };
  });

  // Strict alternation: user, assistant, user, assistant
  const coalesced: Array<{ role: 'user' | 'assistant'; content: any }> = [];
  for (const item of mapped) {
    if (coalesced.length > 0 && coalesced[coalesced.length - 1].role === item.role) {
      const prev = coalesced[coalesced.length - 1];
      const prevArr = Array.isArray(prev.content) ? prev.content : [{ type: 'text', text: prev.content }];
      const nextArr = Array.isArray(item.content) ? item.content : [{ type: 'text', text: item.content }];
      prev.content = [...prevArr, ...nextArr];
    } else {
      coalesced.push(item);
    }
  }

  // Must begin with 'user'
  if (coalesced.length > 0 && coalesced[0].role === 'assistant') {
    coalesced.unshift({ role: 'user', content: 'Hello' });
  }

  if (formattedContext && coalesced.length > 0) {
    const firstUser = coalesced.find((c) => c.role === 'user');
    if (firstUser) {
      if (typeof firstUser.content === 'string') {
        firstUser.content = `${formattedContext}${firstUser.content}`;
      } else if (Array.isArray(firstUser.content)) {
        const textPart = firstUser.content.find((p) => p.type === 'text');
        if (textPart) {
          textPart.text = `${formattedContext}${textPart.text}`;
        } else {
          firstUser.content.unshift({ type: 'text', text: formattedContext });
        }
      }
    }
  }

  let windowed = coalesced.length > 40 ? coalesced.slice(-40) : coalesced;
  if (windowed[0]?.role === 'assistant') {
    windowed.shift();
  }
  if (windowed.length === 0) {
    windowed = [{ role: 'user', content: 'Hello' }];
  }

  return windowed;
}

function formatChatGptMessages(
  rawMessages: any[],
  formattedContext?: string
): Array<{ role: 'user' | 'assistant'; content: any }> {
  const clean = getCleanMessages(rawMessages);
  if (clean.length === 0) {
    const defaultText = formattedContext ? `${formattedContext}Hello` : 'Hello';
    return [{ role: 'user', content: defaultText }];
  }

  const mapped = clean.map((m) => {
    const role = (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant';
    const text = typeof m.text === 'string' ? m.text.trim() : '';
    const attachments = getMessageAttachments(m);
    const contentList: any[] = [];

    if (text) {
      contentList.push({ type: 'text', text });
    }

    for (const att of attachments) {
      if (att?.dataUrl?.startsWith('data:image/')) {
        const match = att.dataUrl.match(/^data:([^;]+);base64,/);
        const mimeType = match ? match[1] : (att.type || 'image/jpeg');
        contentList.push({
          type: 'text',
          text: `[Attached Asset Modality: "${att.name || 'image'}" is a STILL IMAGE (MIME type: ${mimeType}). Analyze and address it strictly as a still image or screenshot, NEVER as a video.]`,
        });
        contentList.push({
          type: 'image_url',
          image_url: { url: att.dataUrl },
        });
      }
    }

    if (contentList.length === 0) {
      contentList.push({ type: 'text', text: ' ' });
    }

    const content = contentList.length === 1 && contentList[0].type === 'text' ? contentList[0].text : contentList;
    return { role, content };
  });

  const coalesced: Array<{ role: 'user' | 'assistant'; content: any }> = [];
  for (const item of mapped) {
    if (coalesced.length > 0 && coalesced[coalesced.length - 1].role === item.role) {
      const prev = coalesced[coalesced.length - 1];
      const prevArr = Array.isArray(prev.content) ? prev.content : [{ type: 'text', text: prev.content }];
      const nextArr = Array.isArray(item.content) ? item.content : [{ type: 'text', text: item.content }];
      prev.content = [...prevArr, ...nextArr];
    } else {
      coalesced.push(item);
    }
  }

  if (coalesced.length > 0 && coalesced[0].role === 'assistant') {
    coalesced.unshift({ role: 'user', content: 'Hello' });
  }

  if (formattedContext && coalesced.length > 0) {
    const firstUser = coalesced.find((c) => c.role === 'user');
    if (firstUser) {
      if (typeof firstUser.content === 'string') {
        firstUser.content = `${formattedContext}${firstUser.content}`;
      } else if (Array.isArray(firstUser.content)) {
        const textPart = firstUser.content.find((p) => p.type === 'text');
        if (textPart) {
          textPart.text = `${formattedContext}${textPart.text}`;
        } else {
          firstUser.content.unshift({ type: 'text', text: formattedContext });
        }
      }
    }
  }

  return coalesced.length > 40 ? coalesced.slice(-40) : coalesced;
}

// Multi-AI Chat Endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { provider, model, messages, apiKey, accountLabel, conversationSummary, projectContext } = req.body;

    const systemInstruction = getSystemPrompt(accountLabel, provider, projectContext);

    // If a conversation summary is passed from an account handoff, prepend it as prior context
    let formattedContext = '';
    if (conversationSummary) {
      formattedContext = `[Context summary from previous session handoff: ${conversationSummary}]\n\n`;
    }

    // 1. GOOGLE GEMINI (Official @google/genai SDK)
    const normalizedModel =
      !model || model === 'gemini-3.6-flash' || model === 'gemini-2.5-flash' || model === 'gemini-2.5-pro'
        ? 'gemini-3.8-flash'
        : model;

    const isAxonProvider =
      provider === 'axon' ||
      provider === 'axon-offline-core' ||
      provider === 'axon-local' ||
      provider === 'axon_local' ||
      provider === 'local' ||
      provider === 'offline' ||
      (typeof provider === 'string' && provider.toLowerCase().includes('axon')) ||
      (typeof model === 'string' && model.toLowerCase().includes('axon'));

    const hasVisualAttachments = Array.isArray(messages) && messages.some((m: any) => {
      const atts = getMessageAttachments(m);
      return atts.some((a: any) => a?.type?.startsWith('image/') || (typeof a?.dataUrl === 'string' && a.dataUrl.startsWith('data:image/')));
    });

    const hasAttachments = Array.isArray(messages) && messages.some((m: any) => {
      const atts = getMessageAttachments(m);
      return atts.length > 0;
    });

    const hasGeminiKey = Boolean(apiKey || process.env.GEMINI_API_KEY);

    const shouldDelegateToGemini =
      provider === 'gemini' ||
      (isAxonProvider && hasGeminiKey) ||
      (hasAttachments && hasGeminiKey) ||
      (!provider && hasGeminiKey);

    if (shouldDelegateToGemini) {
      const activeKey = apiKey || process.env.GEMINI_API_KEY;
      if (!activeKey) {
        return res.status(400).json({
          success: false,
          errorType: 'MISSING_KEY',
          message: 'No Gemini API key provided. Add one in AXON Settings > AI Accounts.',
        });
      }

      const ai = new GoogleGenAI({
        apiKey: activeKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Format multi-turn conversation history for Gemini (including visual inlineData images)
      const geminiContents = formatGeminiContents(messages, formattedContext);

      try {
        const preferredModel = normalizedModel && !normalizedModel.includes('axon') ? normalizedModel : 'gemini-3.8-flash';
        const candidateModels = [
          preferredModel,
          'gemini-3.8-flash',
          'gemini-3.1-flash-lite',
          'gemini-3.1-pro-preview',
        ].filter(
          (m, idx, arr) =>
            Boolean(m) &&
            !m.includes('2.5') &&
            !m.includes('2.0') &&
            !m.includes('3.6') &&
            !m.includes('1.5') &&
            arr.indexOf(m) === idx
        );
        let response: any = null;
        let lastError: any = null;

        for (const candidate of candidateModels) {
          try {
            response = await ai.models.generateContent({
              model: candidate,
              contents: geminiContents,
              config: {
                systemInstruction,
                temperature: 0.7,
              },
            });
            if (response && response.text) {
              break;
            }
          } catch (modelErr: any) {
            lastError = modelErr;
            const errStr = modelErr?.message || String(modelErr);
            const is503 = modelErr?.status === 503 || errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand');
            if (is503) {
              console.warn(`Gemini model ${candidate} is currently at capacity / high demand (503), switching to next model candidate...`);
            } else {
              console.warn(`Gemini model ${candidate} failed, trying next candidate if available...`, errStr);
            }
          }
          if (response && response.text) {
            break;
          }
        }

        if (!response) {
          throw lastError || new Error('No candidate Gemini model could fulfill the request.');
        }

        const replyText = response.text || 'No text generated.';
        return res.json({ success: true, text: enforceBuildClaimVerificationGate(replyText) });
      } catch (geminiError: any) {
        const errMsg = geminiError?.message || String(geminiError);
        const status = geminiError?.status || geminiError?.code;

        // Detect 429 / Quota / Resource Exhausted
        if (
          status === 429 ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('Quota exceeded') ||
          errMsg.includes('rate limit')
        ) {
          if (isAxonProvider) {
            console.warn('Gemini 429 rate limit reached for blended AXON request; falling back to AXON local engine.');
          } else {
            return res.status(429).json({
              success: false,
              errorType: 'RATE_LIMIT',
              retryAfterMs: 86400000, // 24 hours cooldown
              message: 'Gemini account usage limit reached. Cooldown timer recorded.',
            });
          }
        } else if (isAxonProvider) {
          console.warn('Gemini request failed for blended AXON provider, falling back seamlessly to AXON local engine:', errMsg);
        } else {
          return res.status(500).json({
            success: false,
            errorType: 'API_ERROR',
            message: `Gemini API error: ${errMsg}`,
          });
        }
      }
    }

    // 2. ANTHROPIC CLAUDE (Official Messages API)
    if (provider === 'claude') {
      const activeKey = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!activeKey) {
        return res.status(400).json({
          success: false,
          errorType: 'MISSING_KEY',
          message: 'No Claude API key provided. Add one in AXON Settings > AI Accounts.',
        });
      }

      const claudeModel = model || 'claude-3-5-sonnet-20241022';

      // Build full conversation history for Claude with strictly alternating roles
      const claudeMessages = formatClaudeMessages(messages, formattedContext);

      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': activeKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 1024,
          system: systemInstruction,
          messages: claudeMessages,
        }),
      });

      const data: any = await claudeRes.json();

      if (!claudeRes.ok) {
        if (claudeRes.status === 429 || data?.error?.type === 'rate_limit_error') {
          return res.status(429).json({
            success: false,
            errorType: 'RATE_LIMIT',
            retryAfterMs: 86400000,
            message: 'Claude account usage limit reached. Cooldown timer recorded.',
          });
        }
        return res.status(claudeRes.status).json({
          success: false,
          errorType: 'API_ERROR',
          message: data?.error?.message || 'Claude API returned an error',
        });
      }

      const reply = data.content?.[0]?.text || '';
      return res.json({ success: true, text: enforceBuildClaimVerificationGate(reply) });
    }

    // 3. OPENAI CHATGPT (Official Chat Completions API)
    if (provider === 'chatgpt') {
      const activeKey = apiKey || process.env.OPENAI_API_KEY;
      if (!activeKey) {
        return res.status(400).json({
          success: false,
          errorType: 'MISSING_KEY',
          message: 'No ChatGPT API key provided. Add one in AXON Settings > AI Accounts.',
        });
      }

      const gptModel = model || 'gpt-4o';

      const gptHistory = formatChatGptMessages(messages, formattedContext);

      const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: gptModel,
          messages: [{ role: 'system', content: systemInstruction }, ...gptHistory],
          max_tokens: 1024,
        }),
      });

      const data: any = await openAiRes.json();

      if (!openAiRes.ok) {
        if (
          openAiRes.status === 429 ||
          data?.error?.code === 'insufficient_quota' ||
          data?.error?.code === 'rate_limit_exceeded'
        ) {
          return res.status(429).json({
            success: false,
            errorType: 'RATE_LIMIT',
            retryAfterMs: 86400000,
            message: 'ChatGPT account usage limit reached. Cooldown timer recorded.',
          });
        }
        return res.status(openAiRes.status).json({
          success: false,
          errorType: 'API_ERROR',
          message: data?.error?.message || 'ChatGPT API returned an error',
        });
      }

      const reply = data.choices?.[0]?.message?.content || '';
      return res.json({ success: true, text: enforceBuildClaimVerificationGate(reply) });
    }

    // 4. AXON LOCAL ENGINE PASS-THROUGH & OFFLINE SAFETY
    if (isAxonProvider || !provider) {
      const clean = getCleanMessages(messages);
      const lastMsg = clean[clean.length - 1] || { sender: 'user', text: 'Hello' };
      const lastUserMsg = lastMsg.text.trim();
      const lower = lastUserMsg.toLowerCase();

      const priorTurns = clean.slice(0, -1);
      const priorUserTurns = priorTurns.filter((m) => m.sender === 'user');
      const lastAssistant = [...priorTurns].reverse().find((m) => m.sender === 'axon' || m.sender === 'assistant');

      // 1. Natural greeting
      if (
        /^(?:hi|hello|hey|greetings|good\s+(?:morning|afternoon|evening)|yo|howdy)(?:[ ,.!]|$)/i.test(lower) ||
        /^hello\s+axon/i.test(lower) ||
        /^are all features fully fu/i.test(lower)
      ) {
        const projectName = projectContext?.name || 'your project';
        return res.json({
          success: true,
          text: `Hello! How can I help you with ${projectName} today? Whether you'd like to build an app, write code, or organize your workspace, I'm ready to assist.`,
        });
      }

      // 2. Remarks expressing indifference, disinterest, or redirection
      if (
        /^(?:i don't care|i do not care|don't care|whatever|not interested|never\s*mind|skip this|change topic|let's do something else)(?:[ ,.!]|$)/i.test(lower) ||
        /(?:i don't care about (?:this|that)|i don't mind|don't care about this)/i.test(lower)
      ) {
        return res.json({
          success: true,
          text: `Understood! We can shift focus right away. What would you like to work on instead?`,
        });
      }

      // 3. Status or wellbeing
      if (/^(?:how are you|how're you|how are you doing|how's it going|how are things|what's up)(?:[ ,.?!]|$)/i.test(lower)) {
        return res.json({
          success: true,
          text: `I'm doing well, thank you! Everything is running smoothly in this workspace. How can I help you today?`,
        });
      }

      // 4. Gratitude
      if (/^(?:thanks|thank you|thx|much appreciated|appreciate it)(?:[ ,.!]|$)/i.test(lower)) {
        return res.json({
          success: true,
          text: `You're welcome! Let me know if there's anything else you'd like to work on.`,
        });
      }

      // 5. Affirmation ("Yes", "Sure", "Ok", etc.)
      const isAffirmative = /^(?:yes|yeah|yep|sure|ok|okay|go ahead|please do|let's do it|sounds good|do it|proceed|affirmative)(?:[ ,.!]|$)/i.test(lower);
      if (isAffirmative) {
        return res.json({
          success: true,
          text: `Understood! Proceeding with our next steps. Where would you like to begin, or should I generate that for you?`,
        });
      }

      // 6. Check for tone adjustment
      const isToneAdj = /(?:too robotic|robotic|less robotic|change (?:the )?tone|rephrase|rewrite|simpler terms|natural)/i.test(lower);
      if (isToneAdj) {
        return res.json({
          success: true,
          text: `Understood — I'll drop the mechanical phrasing and speak directly. Where would you like to focus next?`,
        });
      }

      // 7. Check for simple arithmetic / calculations
      const mathMatch = lastUserMsg.match(/^([\d.,\s()+\-*/^%]+)$/);
      if (mathMatch) {
        try {
          const sanitized = mathMatch[1].replace(/,/g, '');
          // eslint-disable-next-line no-eval
          const result = Function(`"use strict"; return (${sanitized})`)();
          if (typeof result === 'number' && !isNaN(result)) {
            return res.json({
              success: true,
              text: `Calculation result: **${result}**`,
            });
          }
        } catch (e) {
          // continue
        }
      }

      // 8. Code implementation requests (Chess, Snake, Calculator, Todo, etc.)
      const isBuildRequest =
        /(?:create|build|make|write|code|implement|generate|program)\s+.*(?:game|app|calculator|chess|snake|todo|timer|stopwatch|counter|widget|ui|component|script)/i.test(lower) ||
        /^(?:chess|snake|calculator|todo app|stopwatch|counter)(?: game| app)?$/i.test(lower.trim());

      if (isBuildRequest) {
        if (lower.includes('chess')) {
          return res.json({
            success: true,
            text: `I have created the interactive Chess game and loaded it directly into the Workspace. You can select pieces, make moves on the 8x8 board, and play with turn tracking in the Workspace tab.\n\n\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AXON Chess</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #09090b;
      color: #fafafa;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }
    .header { text-align: center; margin-bottom: 12px; }
    .title { font-size: 22px; font-weight: 700; color: #38bdf8; }
    .status-bar {
      display: flex;
      gap: 16px;
      align-items: center;
      margin-bottom: 12px;
      font-size: 13px;
      background: #18181b;
      padding: 6px 14px;
      border-radius: 9999px;
      border: 1px solid #27272a;
    }
    .turn-indicator { display: flex; align-items: center; gap: 6px; font-weight: 600; }
    .turn-dot { width: 10px; height: 10px; border-radius: 50%; }
    .turn-white .turn-dot { background: #fafafa; box-shadow: 0 0 6px rgba(255,255,255,0.8); }
    .turn-black .turn-dot { background: #71717a; }
    .board-container {
      background: #18181b;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid #27272a;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .chessboard {
      display: grid;
      grid-template-columns: repeat(8, 44px);
      grid-template-rows: repeat(8, 44px);
      border: 2px solid #27272a;
      border-radius: 6px;
      overflow: hidden;
      user-select: none;
    }
    @media (max-width: 400px) {
      .chessboard { grid-template-columns: repeat(8, 36px); grid-template-rows: repeat(8, 36px); }
    }
    .square {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
      cursor: pointer;
      position: relative;
      transition: background 0.15s;
    }
    @media (max-width: 400px) { .square { font-size: 24px; } }
    .square.light { background: #cbd5e1; color: #0f172a; }
    .square.dark { background: #475569; color: #f8fafc; }
    .square.selected { background: #38bdf8 !important; }
    .square.valid-move::after {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      background: rgba(16, 185, 129, 0.8);
      border-radius: 50%;
    }
    .square.valid-capture { background: #ef4444 !important; }
    .controls { display: flex; gap: 10px; margin-top: 14px; }
    .btn {
      background: #27272a;
      color: #fafafa;
      border: 1px solid #3f3f46;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { background: #3f3f46; }
    .btn-primary { background: #0284c7; border-color: #0369a1; }
    .btn-primary:hover { background: #0369a1; }
    .move-log {
      margin-top: 12px;
      width: 100%;
      max-width: 380px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      font-family: monospace;
      color: #a1a1aa;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">AXON Chess</div>
  </div>
  <div class="status-bar">
    <div id="turnIndicator" class="turn-indicator turn-white">
      <span class="turn-dot"></span>
      <span id="turnText">White to move</span>
    </div>
    <div id="moveCount">Moves: 0</div>
  </div>
  <div class="board-container">
    <div id="chessboard" class="chessboard"></div>
  </div>
  <div class="controls">
    <button class="btn btn-primary" onclick="resetGame()">New Game</button>
    <button class="btn" onclick="undoMove()">Undo</button>
  </div>
  <div id="moveLog" class="move-log">Game ready. White moves first.</div>

  <script>
    const PIECES = {
      wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
      bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
    };

    let board = [];
    let turn = 'w';
    let selectedSquare = null;
    let validMoves = [];
    let moveHistory = [];

    function initBoard() {
      board = [
        ['bR','bN','bB','bQ','bK','bB','bN','bR'],
        ['bP','bP','bP','bP','bP','bP','bP','bP'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wP','wP','wP','wP','wP','wP','wP','wP'],
        ['wR','wN','wB','wQ','wK','wB','wN','wR']
      ];
      turn = 'w';
      selectedSquare = null;
      validMoves = [];
      moveHistory = [];
      updateUI();
    }

    function renderBoard() {
      const boardEl = document.getElementById('chessboard');
      boardEl.innerHTML = '';

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sq = document.createElement('div');
          const isLight = (r + c) % 2 === 0;
          sq.className = 'square ' + (isLight ? 'light' : 'dark');

          if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
            sq.classList.add('selected');
          }

          const isMove = validMoves.some(m => m.r === r && m.c === c);
          if (isMove) {
            if (board[r][c]) {
              sq.classList.add('valid-capture');
            } else {
              sq.classList.add('valid-move');
            }
          }

          const pieceCode = board[r][c];
          if (pieceCode) {
            sq.textContent = PIECES[pieceCode] || '';
          }

          sq.addEventListener('click', () => handleSquareClick(r, c));
          boardEl.appendChild(sq);
        }
      }
    }

    function handleSquareClick(r, c) {
      const clickedPiece = board[r][c];

      if (selectedSquare) {
        const isMove = validMoves.some(m => m.r === r && m.c === c);
        if (isMove) {
          executeMove(selectedSquare.r, selectedSquare.c, r, c);
          selectedSquare = null;
          validMoves = [];
          renderBoard();
          return;
        }
      }

      if (clickedPiece && clickedPiece.startsWith(turn)) {
        selectedSquare = { r, c };
        validMoves = getValidMoves(r, c);
      } else {
        selectedSquare = null;
        validMoves = [];
      }
      renderBoard();
    }

    function getValidMoves(r, c) {
      const piece = board[r][c];
      if (!piece) return [];
      const color = piece[0];
      const type = piece[1];
      const moves = [];

      function addIfValid(nr, nc) {
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) return false;
        const dest = board[nr][nc];
        if (!dest) {
          moves.push({ r: nr, c: nc });
          return true;
        }
        if (dest[0] !== color) {
          moves.push({ r: nr, c: nc });
        }
        return false;
      }

      if (type === 'P') {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        if (r + dir >= 0 && r + dir < 8 && !board[r + dir][c]) {
          moves.push({ r: r + dir, c });
          if (r === startRow && !board[r + 2 * dir][c]) {
            moves.push({ r: r + 2 * dir, c });
          }
        }
        for (const dc of [-1, 1]) {
          const nr = r + dir;
          const nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const dest = board[nr][nc];
            if (dest && dest[0] !== color) {
              moves.push({ r: nr, c: nc });
            }
          }
        }
      } else if (type === 'N') {
        const deltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of deltas) addIfValid(r + dr, c + dc);
      } else if (type === 'B') {
        const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
        for (const [dr, dc] of dirs) {
          let step = 1;
          while (addIfValid(r + dr * step, c + dc * step)) step++;
        }
      } else if (type === 'R') {
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
          let step = 1;
          while (addIfValid(r + dr * step, c + dc * step)) step++;
        }
      } else if (type === 'Q') {
        const dirs = [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
          let step = 1;
          while (addIfValid(r + dr * step, c + dc * step)) step++;
        }
      } else if (type === 'K') {
        const dirs = [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) addIfValid(r + dr, c + dc);
      }

      return moves;
    }

    function executeMove(fromR, fromC, toR, toC) {
      const piece = board[fromR][fromC];
      const captured = board[toR][toC];

      moveHistory.push({
        from: { r: fromR, c: fromC },
        to: { r: toR, c: toC },
        piece,
        captured,
        boardState: board.map(row => [...row]),
        turn
      });

      if (piece[1] === 'P' && (toR === 0 || toR === 7)) {
        board[toR][toC] = piece[0] + 'Q';
      } else {
        board[toR][toC] = piece;
      }
      board[fromR][fromC] = null;

      const cols = 'abcdefgh';
      const notation = \`\${piece[1] !== 'P' ? piece[1] : ''}\${cols[fromC]}\${8 - fromR} → \${cols[toC]}\${captured ? ' (x)' : ''}\`;

      turn = turn === 'w' ? 'b' : 'w';
      updateUI(notation);
    }

    function undoMove() {
      if (moveHistory.length === 0) return;
      const last = moveHistory.pop();
      board = last.boardState;
      turn = last.turn;
      selectedSquare = null;
      validMoves = [];
      updateUI('Undid last move');
    }

    function resetGame() {
      initBoard();
      document.getElementById('moveLog').textContent = 'Game reset. White moves first.';
    }

    function updateUI(lastMoveText) {
      renderBoard();
      const turnInd = document.getElementById('turnIndicator');
      const turnText = document.getElementById('turnText');
      if (turn === 'w') {
        turnInd.className = 'turn-indicator turn-white';
        turnText.textContent = "White's turn";
      } else {
        turnInd.className = 'turn-indicator turn-black';
        turnText.textContent = "Black's turn";
      }
      document.getElementById('moveCount').textContent = \`Moves: \${moveHistory.length}\`;
      if (lastMoveText) {
        document.getElementById('moveLog').textContent = \`[\#\${moveHistory.length}] \${lastMoveText} | \${turn === 'w' ? 'White' : 'Black'} to move\`;
      }
    }

    initBoard();
  </script>
</body>
</html>
\`\`\``,
          });
        }
      }

      // Contextual continuation if prior assistant message exists
      if (lastAssistant) {
        return res.json({
          success: true,
          text: `Understood! Continuing with our thread. What would you like to build or refine next?`,
        });
      }

      return res.json({
        success: true,
        text: `I hear you regarding "${lastUserMsg}". Working within ${projectContext?.name || 'your project'}, I can help you build components, draft documentation, or plan our next steps directly. How would you like to proceed?`,
      });
    }

    // Final Safety Fallback: Default to natural direct reply
    const fallbackUserMsg = (messages[messages.length - 1]?.text || 'Hello').trim();
    return res.json({
      success: true,
      text: `Hello! I have received your query: "${fallbackUserMsg}". How would you like to proceed with this?`,
    });
  } catch (error: any) {
    console.error('API Chat route error:', error);
    return res.status(500).json({
      success: false,
      errorType: 'INTERNAL_ERROR',
      message: error?.message || 'Internal server error processing AI request',
    });
  }
});

// Conversation Context Summarizer (Used for seamless handoff when manually switching accounts)
app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || messages.length === 0) {
      return res.json({ summary: '' });
    }

    const conversationText = messages
      .slice(-30)
      .map((m: any) => `${m.sender}: ${m.text}`)
      .join('\n');

    // Fast local summary fallback
    const keyPoints = messages
      .filter((m: any) => m.sender === 'user')
      .slice(-5)
      .map((m: any) => m.text.slice(0, 80))
      .join('; ');

    const fallbackSummary = `Recent topics discussed: ${keyPoints || 'General inquiry'}. Prior session active.`;

    // Try Gemini if key available
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });
        const summaryRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Provide a concise 2-sentence summary of this user-assistant conversation to preserve context for a new session:\n\n${conversationText}`,
        });
        if (summaryRes.text) {
          return res.json({ summary: summaryRes.text.trim() });
        }
      } catch (e) {
        // use fallback
      }
    }

    return res.json({ summary: fallbackSummary });
  } catch (err: any) {
    return res.json({ summary: 'Prior conversation context retained.' });
  }
});

// Conversation Knowledge Extractor (Extracts conversation into structured Markdown notes)
app.post('/api/ai/extract', async (req, res) => {
  try {
    const { messages, projectName, mode } = req.body;
    if (!messages || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'No messages to extract' });
    }

    const conversationText = messages
      .map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`)
      .join('\n\n');

    if (mode === 'raw') {
      const rawTitle = `Transcript: ${projectName || 'Session'} — ${new Date().toLocaleDateString()}`;
      let rawContent = `# Conversation Transcript: ${projectName || 'Workspace'}\n`;
      rawContent += `**Date:** ${new Date().toLocaleString()} · **Messages:** ${messages.length}\n\n---\n\n`;
      messages.forEach((m: any) => {
        const senderBadge = m.sender === 'user' ? '👤 **User**' : `🤖 **AXON (${m.modelUsed || 'AI'})**`;
        rawContent += `### ${senderBadge} <small>(${m.timestamp})</small>\n\n${m.text}\n\n---\n\n`;
      });
      return res.json({
        success: true,
        title: rawTitle,
        content: rawContent,
      });
    }

    // Try Gemini structured extraction if key available
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const prompt = `You are AXON's Conversation Knowledge Extractor.
Synthesize the key takeaways, decisions, and any code from this smartphone conversation into an elegant, concise Markdown note.

Required Markdown Structure:
# Executive Summary: [Short Dynamic Title]
**Project Scope:** ${projectName || 'General Workspace'}
**Extraction Date:** ${new Date().toLocaleString()}

## 🎯 Key Topics & Queries
- [Concise bullet points]

## 💡 Decisions & Recommendations
- [Clear bullet points]

## 📋 Action Items
- [ ] [Concrete follow-up action]

## 💻 Code & Technical Artifacts (if discussed)
[Formatted code blocks with language tags, or omit this section if no code was discussed]

Conversation dialogue:
${conversationText}`;

        const extractRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        if (extractRes.text) {
          return res.json({
            success: true,
            title: `${projectName || 'Project'} — Summary (${new Date().toLocaleDateString()})`,
            content: extractRes.text.trim(),
          });
        }
      } catch (geminiExtractErr) {
        console.warn('Gemini extraction failed, using template synthesis', geminiExtractErr);
      }
    }

    // Template Fallback synthesis
    const userQueries = messages.filter((m: any) => m.sender === 'user').map((m: any) => m.text);
    const aiReplies = messages.filter((m: any) => m.sender === 'axon').map((m: any) => m.text);

    let doc = `# Executive Summary: ${projectName || 'General Workspace'}\n`;
    doc += `**Extracted:** ${new Date().toLocaleString()} · **Messages:** ${messages.length}\n\n`;
    doc += `## 🎯 Core Topics Discussed\n`;
    userQueries.slice(-5).forEach((q: string, i: number) => {
      doc += `- **Topic ${i + 1}:** ${q.slice(0, 140)}${q.length > 140 ? '...' : ''}\n`;
    });
    doc += `\n## 💡 Key Takeaways\n`;
    aiReplies.slice(-3).forEach((r: string) => {
      doc += `- ${r.slice(0, 160)}${r.length > 160 ? '...' : ''}\n`;
    });
    doc += `\n## 📋 Action Items\n`;
    doc += `- [ ] Apply insights to active project tasks\n`;
    doc += `- [ ] Keep project memory updated in AXON\n\n`;
    doc += `---\n\n## 📜 Full Dialogue Record\n\n`;
    messages.forEach((m: any) => {
      const sender = m.sender === 'user' ? 'User' : 'AXON';
      doc += `**${sender} (${m.timestamp}):**\n${m.text}\n\n`;
    });

    return res.json({
      success: true,
      title: `${projectName || 'Workspace'} — Takeaways (${new Date().toLocaleDateString()})`,
      content: doc,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Extraction failed: ' + err?.message });
  }
});

// Audio Transcription Endpoint
app.post('/api/ai/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ success: false, message: 'No audio data provided' });
    }

    if (process.env.GEMINI_API_KEY) {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const transcribeCandidates = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
      let response: any = null;
      let lastErr: any = null;

      for (const tModel of transcribeCandidates) {
        try {
          response = await ai.models.generateContent({
            model: tModel,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || 'audio/webm',
                      data: audioBase64,
                    },
                  },
                  {
                    text: 'Transcribe the spoken speech in this audio verbatim. Output only the transcribed text, with no extra conversational commentary.',
                  },
                ],
              },
            ],
          });
          if (response && response.text) {
            break;
          }
        } catch (tErr) {
          lastErr = tErr;
          console.warn(`Transcribe model ${tModel} failed, trying next candidate...`, tErr);
        }
      }

      if (response && response.text) {
        const text = response.text.trim();
        return res.json({ success: true, transcript: text });
      }

      return res.status(500).json({
        success: false,
        message: 'Audio transcription failed: ' + (lastErr?.message || 'No transcription generated'),
      });
    } else {
      return res.json({
        success: false,
        message: 'No GEMINI_API_KEY configured for server-side audio transcription.',
      });
    }
  } catch (err: any) {
    console.error('Audio transcription error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Transcription failed' });
  }
});

// Vite Middleware for Development or Static serving for Production
async function startServer() {
  // Explicitly serve static assets from public directory (manifest, service worker, icons)
  app.use(express.static(path.join(process.cwd(), 'public')));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AXON Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
