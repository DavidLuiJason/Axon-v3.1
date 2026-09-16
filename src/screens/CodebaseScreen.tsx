import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileJson,
  FileText,
  Image as ImageIcon,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  ShieldCheck,
  HardDrive,
  Code2,
  FolderTree,
  Eye,
  AlertCircle,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';

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

interface TreeStats {
  totalFiles: number;
  totalDirectories: number;
  totalBytes: number;
  scannedAt: string;
}

interface ActiveFileDetails {
  path: string;
  name: string;
  isBinary: boolean;
  content?: string;
  size: number;
  lineCount?: number;
  extension: string;
  lastModified?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function getFileIcon(ext?: string) {
  switch (ext?.toLowerCase()) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
    case 'json':
      return <FileJson className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'css':
      return <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />;
    case 'html':
      return <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'md':
      return <FileText className="w-4 h-4 text-purple-400 shrink-0" />;
    case 'svg':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'ico':
      return <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />;
    default:
      return <File className="w-4 h-4 text-neutral-400 shrink-0" />;
  }
}

export const CodebaseScreen: React.FC = () => {
  const [tree, setTree] = useState<CodebaseNode[]>([]);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(true);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Expanded directories set
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['src', 'src/components', 'src/screens']));

  // Active selected file
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>('src/App.tsx');
  const [activeFile, setActiveFile] = useState<ActiveFileDetails | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Mobile tab state: 'tree' | 'viewer'
  const [mobileActiveTab, setMobileActiveTab] = useState<'tree' | 'viewer'>('viewer');

  // Copy feedback states
  const [isCopiedContent, setIsCopiedContent] = useState<boolean>(false);
  const [isCopiedPath, setIsCopiedPath] = useState<boolean>(false);

  // Tree collapse state
  const [isTreeCollapsed, setIsTreeCollapsed] = useState<boolean>(false);

  // Load real tree from backend
  const fetchTree = useCallback(async () => {
    setIsLoadingTree(true);
    setTreeError(null);
    try {
      const res = await fetch('/api/codebase/tree');
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.tree)) {
        setTree(data.tree);
        setStats(data.stats);
      } else {
        throw new Error(data.error || 'Failed to parse codebase directory tree');
      }
    } catch (err: any) {
      console.error('[Codebase] Tree fetch error:', err);
      setTreeError(err?.message || 'Failed to scan repository filesystem');
    } finally {
      setIsLoadingTree(false);
    }
  }, []);

  // Fetch initial tree on mount
  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Load file content whenever selectedFilePath changes
  const fetchFileContent = useCallback(async (filePath: string) => {
    setIsLoadingFile(true);
    setFileError(null);
    try {
      const res = await fetch(`/api/codebase/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setActiveFile(data);
      } else {
        throw new Error(data.error || 'Could not read file contents');
      }
    } catch (err: any) {
      console.error('[Codebase] File fetch error:', err);
      setFileError(err?.message || 'Failed to load file contents');
    } finally {
      setIsLoadingFile(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFilePath) {
      fetchFileContent(selectedFilePath);
    }
  }, [selectedFilePath, fetchFileContent]);

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Expand all folders
  const handleExpandAll = () => {
    const allDirs = new Set<string>();
    function collectDirs(nodes: CodebaseNode[]) {
      for (const node of nodes) {
        if (node.type === 'directory') {
          allDirs.add(node.path);
          if (node.children) collectDirs(node.children);
        }
      }
    }
    collectDirs(tree);
    setExpandedPaths(allDirs);
  };

  // Collapse all folders
  const handleCollapseAll = () => {
    setExpandedPaths(new Set());
  };

  // Copy file content handler
  const handleCopyContent = async () => {
    if (!activeFile?.content) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setIsCopiedContent(true);
      setTimeout(() => setIsCopiedContent(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  // Copy file path handler
  const handleCopyPath = async () => {
    if (!activeFile?.path) return;
    try {
      await navigator.clipboard.writeText(activeFile.path);
      setIsCopiedPath(true);
      setTimeout(() => setIsCopiedPath(false), 2000);
    } catch (err) {
      console.warn('Copy path failed:', err);
    }
  };

  // Filtered tree calculation based on searchQuery
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;

    const query = searchQuery.trim().toLowerCase();

    function filterNodes(nodes: CodebaseNode[]): CodebaseNode[] {
      const result: CodebaseNode[] = [];
      for (const node of nodes) {
        if (node.type === 'file') {
          if (node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)) {
            result.push(node);
          }
        } else if (node.type === 'directory' && node.children) {
          const matchedChildren = filterNodes(node.children);
          if (matchedChildren.length > 0 || node.name.toLowerCase().includes(query)) {
            result.push({
              ...node,
              children: matchedChildren,
            });
          }
        }
      }
      return result;
    }

    return filterNodes(tree);
  }, [tree, searchQuery]);

  // Automatically expand folders when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const matchingDirs = new Set<string>();
      function expandMatching(nodes: CodebaseNode[]) {
        for (const node of nodes) {
          if (node.type === 'directory') {
            matchingDirs.add(node.path);
            if (node.children) expandMatching(node.children);
          }
        }
      }
      expandMatching(filteredTree);
      setExpandedPaths(matchingDirs);
    }
  }, [searchQuery, filteredTree]);

  // Recursive tree renderer
  const renderTreeNodes = (nodes: CodebaseNode[], depth: number = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedPaths.has(node.path);
      const isSelected = selectedFilePath === node.path;

      if (node.type === 'directory') {
        return (
          <div key={node.path} className="select-none">
            <button
              type="button"
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
              className="w-full text-left py-1.5 pr-2 rounded-lg hover:bg-neutral-900/80 text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors group text-xs font-medium"
            >
              <span className="text-neutral-500 group-hover:text-neutral-300 transition-transform">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                )}
              </span>
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <span className="truncate flex-1">{node.name}</span>
              {typeof node.fileCount === 'number' && (
                <span className="text-[10px] text-neutral-500 font-mono group-hover:text-neutral-400">
                  {node.fileCount}
                </span>
              )}
            </button>

            {isExpanded && node.children && (
              <div className="relative">
                {/* Visual guide line */}
                <div
                  className="absolute top-0 bottom-0 border-l border-neutral-800/80 pointer-events-none"
                  style={{ left: `${depth * 14 + 14}px` }}
                />
                {renderTreeNodes(node.children, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      // File node
      return (
        <button
          key={node.path}
          type="button"
          onClick={() => {
            setSelectedFilePath(node.path);
            setMobileActiveTab('viewer');
          }}
          style={{ paddingLeft: `${Math.max(8, depth * 14 + 24)}px` }}
          className={`w-full text-left py-1.5 pr-2 rounded-lg flex items-center justify-between gap-2 text-xs transition-all ${
            isSelected
              ? 'bg-neutral-800 text-white font-medium shadow-sm border border-neutral-700/80'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {getFileIcon(node.extension)}
            <span className="truncate">{node.name}</span>
          </div>
          <span className="text-[10px] text-neutral-500 font-mono shrink-0">
            {formatBytes(node.size)}
          </span>
        </button>
      );
    });
  };

  return (
    <div
      id="codebase-screen-container"
      className="flex-1 min-h-0 flex flex-col bg-neutral-950 text-white overflow-hidden select-none"
    >
      {/* Top Banner: Real-time scan indicator & repository telemetry */}
      <div className="shrink-0 bg-neutral-900/90 border-b border-neutral-800/80 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-neutral-800 text-sky-400 border border-neutral-700/80">
            <FolderTree className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-white tracking-wide uppercase">AXON Source Codebase</h2>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">
                <ShieldCheck className="w-3 h-3" />
                STRICTLY READ-ONLY
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Live filesystem inspection of AXON's internal repository code
            </p>
          </div>
        </div>

        {/* Telemetry Stats Pill */}
        <div className="flex items-center gap-2 text-[11px] text-neutral-400">
          {stats && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-neutral-950/80 border border-neutral-800 text-[11px] font-mono">
              <span>{stats.totalFiles} files</span>
              <span className="text-neutral-600">•</span>
              <span>{stats.totalDirectories} folders</span>
              <span className="text-neutral-600">•</span>
              <span className="text-neutral-300">{formatBytes(stats.totalBytes)}</span>
            </div>
          )}

          <button
            type="button"
            onClick={fetchTree}
            disabled={isLoadingTree}
            title="Re-scan real filesystem"
            className="p-1.5 rounded-lg bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 active:scale-95 transition-all flex items-center gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? 'animate-spin text-sky-400' : ''}`} />
            <span className="hidden md:inline text-[11px]">Rescan</span>
          </button>
        </div>
      </div>

      {/* Mobile Tab Switcher (Visible on small screens only) */}
      <div className="sm:hidden shrink-0 flex border-b border-neutral-800 bg-neutral-900/60 px-2 pt-1 gap-1">
        <button
          type="button"
          onClick={() => setMobileActiveTab('tree')}
          className={`flex-1 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            mobileActiveTab === 'tree'
              ? 'border-white text-white bg-neutral-800/50'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Repository Files ({stats?.totalFiles || 0})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileActiveTab('viewer')}
          className={`flex-1 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            mobileActiveTab === 'viewer'
              ? 'border-white text-white bg-neutral-800/50'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Code Viewer</span>
        </button>
      </div>

      {/* Main Workspace Body (Split view on desktop, tabbed on mobile) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT PANE: File Tree Browser */}
        <aside
          className={`shrink-0 flex flex-col bg-neutral-950 border-r border-neutral-800/80 transition-all duration-200 ${
            // Mobile visibility
            mobileActiveTab === 'tree' ? 'w-full flex' : 'hidden sm:flex'
          } ${
            // Desktop width / collapse
            isTreeCollapsed ? 'sm:w-12' : 'sm:w-72 md:w-80'
          }`}
        >
          {/* Tree Header & Actions */}
          <div className="shrink-0 p-2.5 border-b border-neutral-800/80 flex flex-col gap-2">
            {!isTreeCollapsed && (
              <>
                {/* Search / filter input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter files or folders..."
                    className="w-full pl-8 pr-7 py-1.5 bg-neutral-900 text-white rounded-lg text-xs placeholder:text-neutral-500 border border-neutral-800 focus:border-neutral-600 focus:outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Tree controls */}
                <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 pt-0.5">
                  <span className="font-semibold text-neutral-300 text-[10px] tracking-wider uppercase">
                    Filesystem Tree
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExpandAll}
                      className="hover:text-white transition-colors"
                    >
                      Expand All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleCollapseAll}
                      className="hover:text-white transition-colors"
                    >
                      Collapse
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Desktop Collapse / Expand Toggle */}
            <div className="hidden sm:flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsTreeCollapsed((prev) => !prev)}
                title={isTreeCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-850 text-[11px] flex items-center gap-1"
              >
                {isTreeCollapsed ? (
                  <Maximize2 className="w-3.5 h-3.5" />
                ) : (
                  <Minimize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Scrollable Tree Container */}
          {!isTreeCollapsed ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
              {isLoadingTree && (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
                  <span className="text-xs">Scanning real repository...</span>
                </div>
              )}

              {treeError && (
                <div className="p-3 m-1 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Filesystem Scan Error</p>
                    <p className="text-[11px] mt-0.5 opacity-90">{treeError}</p>
                    <button
                      type="button"
                      onClick={fetchTree}
                      className="mt-2 px-2 py-1 bg-rose-900 hover:bg-rose-800 text-white rounded text-[10px] font-medium"
                    >
                      Retry Scan
                    </button>
                  </div>
                </div>
              )}

              {!isLoadingTree && !treeError && filteredTree.length === 0 && (
                <div className="text-center py-10 px-3 text-neutral-500 text-xs">
                  No files found matching "{searchQuery}"
                </div>
              )}

              {!isLoadingTree && !treeError && renderTreeNodes(filteredTree)}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center py-3 text-neutral-500 gap-4">
              <FolderTree className="w-4 h-4" />
            </div>
          )}
        </aside>

        {/* RIGHT PANE: Code Viewer (Read-Only) */}
        <section
          className={`flex-1 min-h-0 flex flex-col bg-neutral-950 overflow-hidden ${
            mobileActiveTab === 'viewer' ? 'flex' : 'hidden sm:flex'
          }`}
        >
          {/* File Viewer Sub-header */}
          <div className="shrink-0 bg-neutral-900/70 border-b border-neutral-800/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Mobile Back to Tree Button */}
              <button
                type="button"
                onClick={() => setMobileActiveTab('tree')}
                className="sm:hidden p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white flex items-center gap-1 text-xs"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                <span>Tree</span>
              </button>

              <div className="flex items-center gap-2 min-w-0">
                {getFileIcon(activeFile?.extension)}
                <div className="min-w-0">
                  <div className="text-xs font-mono font-bold text-white truncate flex items-center gap-1.5">
                    <span>{activeFile ? activeFile.path : selectedFilePath || 'Select a file'}</span>
                  </div>
                  {activeFile && (
                    <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono mt-0.5">
                      <span>{formatBytes(activeFile.size)}</span>
                      {typeof activeFile.lineCount === 'number' && (
                        <>
                          <span>•</span>
                          <span>{activeFile.lineCount} lines</span>
                        </>
                      )}
                      {activeFile.lastModified && (
                        <>
                          <span className="hidden md:inline">•</span>
                          <span className="hidden md:inline opacity-70">
                            Modified: {new Date(activeFile.lastModified).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar (Strictly Non-Destructive / Inspection Only) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {activeFile && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyPath}
                    title="Copy relative file path"
                    className="px-2.5 py-1 rounded-lg bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 text-xs flex items-center gap-1 active:scale-95 transition-all"
                  >
                    {isCopiedPath ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 text-[11px]">Path Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span className="text-[11px]">Copy Path</span>
                      </>
                    )}
                  </button>

                  {!activeFile.isBinary && (
                    <button
                      type="button"
                      onClick={handleCopyContent}
                      title="Copy complete file contents"
                      className="px-2.5 py-1 rounded-lg bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 text-xs flex items-center gap-1 active:scale-95 transition-all"
                    >
                      {isCopiedContent ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Content Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="text-[11px]">Copy Source</span>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Code Viewer Viewport */}
          <div className="flex-1 min-h-0 flex flex-col bg-[#0d1117] overflow-hidden relative">
            {isLoadingFile && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 z-20 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                <span className="text-xs text-neutral-400 font-mono">Reading real file from disk...</span>
              </div>
            )}

            {fileError && (
              <div className="m-4 p-4 rounded-xl bg-rose-950/30 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Error Reading File</h4>
                  <p className="mt-1 opacity-90">{fileError}</p>
                </div>
              </div>
            )}

            {!isLoadingFile && !fileError && activeFile && (
              <>
                {/* Binary file preview */}
                {activeFile.isBinary ? (
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
                    {['png', 'jpg', 'jpeg', 'svg', 'ico', 'webp'].includes(activeFile.extension) ? (
                      <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 max-w-sm flex flex-col items-center gap-3">
                        <img
                          src={`/${activeFile.path.replace(/^public\//, '')}`}
                          alt={activeFile.name}
                          className="max-h-64 object-contain rounded-lg"
                        />
                        <div className="text-xs text-neutral-400 font-mono">
                          {activeFile.name} ({formatBytes(activeFile.size)})
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 text-center space-y-2">
                        <HardDrive className="w-8 h-8 text-neutral-400 mx-auto" />
                        <h4 className="text-sm font-bold text-white">{activeFile.name}</h4>
                        <p className="text-xs text-neutral-400">
                          Binary asset ({formatBytes(activeFile.size)}) — direct source preview not available
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Text Code Content with Line Numbers */
                  <div className="flex-1 min-h-0 overflow-auto text-xs font-mono leading-relaxed flex select-text">
                    {/* Line numbers gutter */}
                    <div className="shrink-0 py-3 pl-3 pr-3 text-right bg-[#090d13] text-neutral-600 select-none border-r border-neutral-800/60 font-mono text-[11px]">
                      {(activeFile.content || '').split('\n').map((_, idx) => (
                        <div key={idx} className="h-5 leading-5">
                          {idx + 1}
                        </div>
                      ))}
                    </div>

                    {/* Code lines */}
                    <div className="flex-1 py-3 pl-4 pr-6 min-w-0 text-neutral-200 font-mono whitespace-pre overflow-x-auto text-[12px]">
                      {(activeFile.content || '').split('\n').map((line, idx) => (
                        <div key={idx} className="h-5 leading-5 hover:bg-neutral-800/30 px-1 -mx-1 rounded">
                          {line || '\n'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!isLoadingFile && !fileError && !activeFile && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-500 text-xs gap-2">
                <Code2 className="w-8 h-8 opacity-40" />
                <span>Select a file from the tree to inspect its real contents</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
