import { ChatMessage, NoteItem, ProjectItem } from '../types';
import { stripMarkdown } from './markdownUtils';

export const DEFAULT_PROJECTS: ProjectItem[] = [
  {
    id: 'proj-general',
    name: 'General Workspace',
    description: 'Main default workspace for broad tasks, questions, and research.',
    systemContext: 'Standard AXON Assistant personality: fast, concise, offline-safe, and structured.',
    color: '#ffffff',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'proj-app-dev',
    name: 'AXON Mobile App',
    description: 'Architecture, state models, offline tools, and performance telemetry.',
    systemContext: 'Focus strictly on mobile React/Tailwind frontend, 4GB RAM budget, and offline reliability.',
    color: '#60a5fa',
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  },
  {
    id: 'proj-bible-study',
    name: 'Scripture & Historical Research',
    description: 'Concordance research, Greek & Hebrew cross-referencing, and note synthesis.',
    systemContext: 'Scholarly, respectful, and deeply grounded in historical textual analysis.',
    color: '#fbbf24',
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
  },
];

export const DEFAULT_NOTES: NoteItem[] = [
  {
    id: 'note-spec-arch',
    title: 'AXON System Architecture Spec',
    content: `# AXON Architecture Specification\n\n- **Dual-Pane Full-Screen Navigation**: Drag gesture swipe between 100% full-screen Chat and Workspace screens.\n- **App-Shell Constraint**: Fixed pinned top header, fixed pinned bottom input bar, internally contained scroll middle.\n- **Project Memory Isolation**: Chat logs and notes scoped strictly to the active project context.\n- **15GB Storage Manifest**: Proactive memory budgeting, archive lossless vs. space-saver quantization, and trim optimizer.`,
    projectId: 'proj-app-dev',
    category: 'spec',
    tags: ['architecture', 'mobile', 'spec'],
    isPinned: true,
    createdAt: '2026-09-03T10:00:00.000Z',
    updatedAt: '2026-09-03T10:00:00.000Z',
  },
  {
    id: 'note-welcome',
    title: 'Getting Started with AXON Notes & Memory',
    content: `AXON Notes provides context-isolated memory for your projects. Notes can be categorized into General, Chat Extracts, Code, Prompts, or Specs, and tagged for fast retrieval.\n\nUse the export button in the chat or notes view to export your conversation directly to Markdown, Text, JSON, or formatted PDF.`,
    projectId: 'proj-general',
    category: 'general',
    tags: ['guide', 'notes', 'getting-started'],
    isPinned: false,
    createdAt: '2026-09-03T11:00:00.000Z',
    updatedAt: '2026-09-03T11:00:00.000Z',
  },
];

export function formatConversationAsMarkdown(
  messages: ChatMessage[],
  projectName: string,
  projectDescription?: string
): string {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let md = `# Conversation Export: ${projectName}\n\n`;
  if (projectDescription) {
    md += `*${projectDescription}*\n\n`;
  }
  md += `**Exported On**: ${dateStr}  \n`;
  md += `**Total Messages**: ${messages.length}\n\n`;
  md += `---\n\n`;

  for (const msg of messages) {
    const senderTitle = msg.sender === 'user' ? '👤 User' : '⚡ AXON';
    md += `### ${senderTitle} [${msg.timestamp || 'Recent'}]\n`;
    if (msg.modelUsed) {
      md += `*Model: ${msg.modelUsed}*\n\n`;
    }
    md += `${msg.text}\n\n`;
    if (msg.attachment) {
      md += `📎 *Attachment: ${msg.attachment.name} (${msg.attachment.size || 'file'})*\n\n`;
    }
    md += `---\n\n`;
  }

  return md;
}

export function formatConversationAsPlainText(
  messages: ChatMessage[],
  projectName: string
): string {
  let text = `=== AXON CONVERSATION LOG: ${projectName.toUpperCase()} ===\n`;
  text += `Timestamp: ${new Date().toISOString()}\n`;
  text += `Total Messages: ${messages.length}\n\n`;

  for (const msg of messages) {
    const sender = msg.sender === 'user' ? 'USER' : 'AXON';
    text += `[${msg.timestamp || ''}] ${sender}:\n`;
    text += `${stripMarkdown(msg.text)}\n\n`;
  }

  return text;
}

export function formatConversationAsJson(
  messages: ChatMessage[],
  projectName: string,
  projectId: string
): string {
  const cleanMessages = messages.map((m) => ({
    ...m,
    text: stripMarkdown(m.text),
  }));

  return JSON.stringify(
    {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      projectId,
      projectName,
      totalMessages: cleanMessages.length,
      messages: cleanMessages,
    },
    null,
    2
  );
}

export function synthesizeExecutiveSummary(
  messages: ChatMessage[],
  projectName: string,
  projectDescription?: string
): string {
  const userMessages = messages.filter((m) => m.sender === 'user');
  const axonMessages = messages.filter((m) => m.sender === 'axon');

  let summary = `# Executive Summary: ${projectName}\n\n`;
  if (projectDescription) {
    summary += `**Context**: ${projectDescription}\n\n`;
  }
  summary += `**Generated**: ${new Date().toLocaleDateString()} | **Dialogue Depth**: ${messages.length} exchanges\n\n`;
  summary += `## Core Themes & Objectives\n`;

  if (userMessages.length > 0) {
    summary += `- Primary topics explored: ${userMessages
      .slice(-3)
      .map((m) => `"${m.text.slice(0, 60)}${m.text.length > 60 ? '...' : ''}"`)
      .join(', ')}\n`;
  } else {
    summary += `- General workspace initialization and inquiry.\n`;
  }

  summary += `\n## Key Conclusions & Solutions\n`;
  if (axonMessages.length > 0) {
    const latest = axonMessages[axonMessages.length - 1];
    summary += `- Latest resolution: ${latest.text.slice(0, 180)}${latest.text.length > 180 ? '...' : ''}\n`;
  }
  summary += `- System operating at optimal telemetry within active project scope.\n`;

  return summary;
}

export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
