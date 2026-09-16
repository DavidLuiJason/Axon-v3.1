import {
  FileIndexEntry,
  FileIntelligenceType,
  FileSearchQuery,
  FileSearchResult,
} from '../types';

export interface FileSearchHook {
  id: string;
  name: string;
  supportedTypes: FileIntelligenceType[];
  priority: number; // Lower = evaluated first
  search: (query: FileSearchQuery, candidateFiles: FileIndexEntry[]) => Promise<FileSearchResult[]>;
}

export interface FileIndexerHook {
  id: string;
  name: string;
  supportedTypes: FileIntelligenceType[];
  extractMetadata: (file: {
    name: string;
    mimeType: string;
    dataUrl?: string;
    content?: string;
  }) => Promise<Partial<FileIndexEntry>>;
}

/**
 * Initial seed catalog of files known across default projects and system storage
 */
export const DEFAULT_INDEXED_FILES: FileIndexEntry[] = [
  {
    id: 'file-doc-arch-spec',
    name: 'AXON-System-Architecture.md',
    fileType: 'document',
    mimeType: 'text/markdown',
    sizeBytes: 14200,
    projectId: 'proj-app-dev',
    createdAt: '2026-09-03T10:00:00.000Z',
    updatedAt: '2026-09-03T10:00:00.000Z',
    metadata: {
      linesOfCode: 120,
      language: 'markdown',
    },
    extractedSummary: 'System architecture document for AXON mobile app covering dual-pane UX and storage budgeting.',
    keywords: ['architecture', 'mobile', 'spec', 'ram-budget', 'shell-layout'],
    tags: ['spec', 'system'],
  },
  {
    id: 'file-code-telemetry',
    name: 'telemetry_check.js',
    fileType: 'code',
    mimeType: 'application/javascript',
    sizeBytes: 4500,
    projectId: 'proj-app-dev',
    createdAt: '2026-09-05T16:00:00.000Z',
    updatedAt: '2026-09-05T16:00:00.000Z',
    metadata: {
      language: 'javascript',
      linesOfCode: 85,
    },
    extractedSummary: 'Automated telemetry validation script measuring React render times and memory usage under load.',
    keywords: ['telemetry', 'benchmark', 'javascript', 'performance'],
    tags: ['code', 'telemetry'],
  },
  {
    id: 'file-doc-scripture',
    name: 'Genesis_Greek_Hebrew_Concordance.txt',
    fileType: 'document',
    mimeType: 'text/plain',
    sizeBytes: 88000,
    projectId: 'proj-bible-study',
    createdAt: '2026-09-03T15:00:00.000Z',
    updatedAt: '2026-09-03T15:00:00.000Z',
    metadata: {
      pageCount: 32,
    },
    extractedSummary: 'Comparative linguistic concordance mapping early Genesis verses between ancient Hebrew and Septuagint Greek.',
    keywords: ['bible', 'scripture', 'hebrew', 'greek', 'concordance', 'genesis'],
    tags: ['research', 'scripture'],
  },
  {
    id: 'file-img-orb-logo',
    name: 'axon_orb_launcher.png',
    fileType: 'image',
    mimeType: 'image/png',
    sizeBytes: 245000,
    projectId: 'proj-app-dev',
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    metadata: {
      dimensions: { width: 512, height: 512 },
    },
    extractedSummary: 'Official AXON glowing orb launcher icon graphic with dark background.',
    keywords: ['icon', 'logo', 'orb', 'launcher', 'asset'],
    tags: ['asset', 'image'],
  },
];

/**
 * Baseline keyword/token matching search hook.
 * Future phases will register semantic embeddings, OCR, or multimodal hooks.
 */
const baselineSearchHook: FileSearchHook = {
  id: 'baseline-token-search',
  name: 'AXON Baseline Token Search Engine',
  supportedTypes: ['document', 'image', 'video', 'audio', 'code'],
  priority: 100,
  search: async (query: FileSearchQuery, candidateFiles: FileIndexEntry[]): Promise<FileSearchResult[]> => {
    let pool = [...candidateFiles];

    if (query.fileTypes && query.fileTypes.length > 0) {
      pool = pool.filter((f) => query.fileTypes!.includes(f.fileType));
    }

    if (query.projectId) {
      pool = pool.filter((f) => !f.projectId || f.projectId === query.projectId);
    }

    const q = query.naturalLanguageQuery.toLowerCase();
    const stopWords = new Set(['find', 'search', 'for', 'where', 'is', 'my', 'the', 'file', 'files', 'in', 'of', 'show']);
    const tokens = q
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    if (tokens.length === 0) {
      return pool.slice(0, query.limit || 10).map((entry) => ({
        entry,
        matchScore: 0.5,
        matchedReasons: ['Default match'],
      }));
    }

    const results: FileSearchResult[] = [];

    for (const file of pool) {
      let score = 0;
      const reasons: string[] = [];

      const nameLower = file.name.toLowerCase();
      const summaryLower = (file.extractedSummary || '').toLowerCase();
      const tags = (file.tags || []).map((t) => t.toLowerCase());
      const keywords = (file.keywords || []).map((k) => k.toLowerCase());

      for (const token of tokens) {
        if (nameLower.includes(token)) {
          score += 40;
          reasons.push(`Filename contains "${token}"`);
        }
        if (keywords.includes(token)) {
          score += 25;
          reasons.push(`Keyword match "${token}"`);
        }
        if (tags.includes(token)) {
          score += 20;
          reasons.push(`Tag match "${token}"`);
        }
        if (summaryLower.includes(token)) {
          score += 15;
          reasons.push(`Summary contains "${token}"`);
        }
      }

      if (score > (query.minScore || 10)) {
        results.push({
          entry: file,
          matchScore: score,
          matchedReasons: Array.from(new Set(reasons)),
          excerpt: file.extractedSummary,
        });
      }
    }

    results.sort((a, b) => b.matchScore - a.matchScore);
    return query.limit ? results.slice(0, query.limit) : results;
  },
};

export class FileIntelligenceService {
  private files: Map<string, FileIndexEntry> = new Map();
  private searchHooks: FileSearchHook[] = [];
  private indexerHooks: FileIndexerHook[] = [];

  constructor(initialFiles: FileIndexEntry[] = DEFAULT_INDEXED_FILES) {
    for (const f of initialFiles) {
      this.files.set(f.id, f);
    }
    // Register baseline search hook
    this.registerSearchHook(baselineSearchHook);
  }

  public registerSearchHook(hook: FileSearchHook): void {
    this.searchHooks = this.searchHooks.filter((h) => h.id !== hook.id);
    this.searchHooks.push(hook);
    this.searchHooks.sort((a, b) => a.priority - b.priority);
  }

  public unregisterSearchHook(hookId: string): void {
    this.searchHooks = this.searchHooks.filter((h) => h.id !== hookId);
  }

  public registerIndexerHook(hook: FileIndexerHook): void {
    this.indexerHooks = this.indexerHooks.filter((h) => h.id !== hook.id);
    this.indexerHooks.push(hook);
  }

  public indexFile(entry: FileIndexEntry): void {
    this.files.set(entry.id, {
      ...entry,
      updatedAt: new Date().toISOString(),
    });
  }

  public indexFiles(entries: FileIndexEntry[]): void {
    for (const entry of entries) {
      this.indexFile(entry);
    }
  }

  public removeFile(fileId: string): boolean {
    return this.files.delete(fileId);
  }

  public getAllFiles(fileTypes?: FileIntelligenceType[], projectId?: string): FileIndexEntry[] {
    let list = Array.from(this.files.values());
    if (fileTypes && fileTypes.length > 0) {
      list = list.filter((f) => fileTypes.includes(f.fileType));
    }
    if (projectId) {
      list = list.filter((f) => !f.projectId || f.projectId === projectId);
    }
    return list;
  }

  /**
   * Executes multi-hook natural-language file search.
   * Runs registered search hooks in priority order.
   */
  public async search(query: FileSearchQuery): Promise<FileSearchResult[]> {
    const candidates = Array.from(this.files.values());
    for (const hook of this.searchHooks) {
      try {
        const results = await hook.search(query, candidates);
        if (results && results.length > 0) {
          return results;
        }
      } catch (err) {
        console.warn(`FileSearchHook "${hook.id}" encountered error`, err);
      }
    }
    return [];
  }

  /**
   * Evaluates if a user's prompt is a natural language file query
   * e.g. "Find the architecture document", "Where is the scripture concordance", "Show me the logo image"
   */
  public isNaturalLanguageFileQuery(prompt: string): boolean {
    const p = prompt.toLowerCase().trim();
    return (
      /(?:find|search for|locate|where is|show me|look up)(?: (?:the|a|my))? (?:file|document|image|video|audio|code|script|spec|notes|concordance)/i.test(
        p
      ) ||
      /(?:which file contains|what files are in)/i.test(p)
    );
  }

  /**
   * Formats search results into a clean user-facing response.
   */
  public formatSearchResultsForResponse(
    query: string,
    results: FileSearchResult[]
  ): string {
    if (results.length === 0) {
      return `I searched the AXON File Intelligence index for "${query}", but found no matching documents, code, images, audio, or video files.`;
    }

    const lines: string[] = [
      `Found **${results.length}** relevant file${results.length === 1 ? '' : 's'} matching "${query}":`,
      '',
    ];

    for (const res of results) {
      const icon =
        res.entry.fileType === 'image'
          ? '🖼️'
          : res.entry.fileType === 'code'
          ? '💻'
          : res.entry.fileType === 'video'
          ? '🎥'
          : res.entry.fileType === 'audio'
          ? '🎵'
          : '📄';

      lines.push(`${icon} **${res.entry.name}** (${(res.entry.sizeBytes / 1024).toFixed(1)} KB)`);
      if (res.entry.extractedSummary) {
        lines.push(`   ${res.entry.extractedSummary}`);
      }
      if (res.matchedReasons.length > 0) {
        lines.push(`   *Match context: ${res.matchedReasons.join(', ')}*`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

export const fileIntelligence = new FileIntelligenceService();
