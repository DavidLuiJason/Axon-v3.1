import React, { useState } from 'react';
import {
  Folder,
  Plus,
  Check,
  X,
  Edit3,
  Trash2,
  FileText,
  MessageSquare,
  Sparkles,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProjectItem } from '../types';
import { ModalOverlayContainer } from './ModalOverlayContainer';

interface ProjectSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROJECT_COLOR_OPTIONS = [
  '#ffffff', // White
  '#a3a3a3', // Neutral light
  '#737373', // Neutral mid
  '#60a5fa', // Subtle blue
  '#34d399', // Subtle emerald
  '#fbbf24', // Subtle amber
  '#f87171', // Subtle rose
  '#c084fc', // Subtle purple
];

export const ProjectSwitcherModal: React.FC<ProjectSwitcherModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    createProject,
    updateProject,
    deleteProject,
    messages,
    notes,
  } = useApp();

  const [isCreating, setIsCreating] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Form fields
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [contextInput, setContextInput] = useState('');
  const [colorInput, setColorInput] = useState('#ffffff');

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setNameInput('');
    setDescInput('');
    setContextInput('');
    setColorInput('#ffffff');
    setEditingProjectId(null);
    setIsCreating(true);
  };

  const handleStartEdit = (p: ProjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setNameInput(p.name);
    setDescInput(p.description || '');
    setContextInput(p.systemContext || '');
    setColorInput(p.color || '#ffffff');
    setEditingProjectId(p.id);
    setIsCreating(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    if (editingProjectId) {
      updateProject(editingProjectId, {
        name: nameInput.trim(),
        description: descInput.trim(),
        systemContext: contextInput.trim(),
        color: colorInput,
      });
    } else {
      createProject(
        nameInput.trim(),
        descInput.trim(),
        contextInput.trim(),
        colorInput
      );
    }

    setIsCreating(false);
    setEditingProjectId(null);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingProjectId(null);
  };

  const getStats = (projectId: string) => {
    const projMsgs = messages.filter((m) => (m.projectId || 'proj-general') === projectId).length;
    const projNotes = notes.filter((n) => (n.projectId || 'proj-general') === projectId).length;
    return { msgs: projMsgs, notes: projNotes };
  };

  // Sort projects so newest is always at the top
  const sortedProjects = [...projects].sort((a, b) => {
    const getTimestamp = (id: string, createdAt?: string) => {
      if (id.startsWith('proj-')) {
        const num = parseInt(id.replace('proj-', ''), 10);
        if (!isNaN(num)) return num;
      }
      if (createdAt) {
        const t = new Date(createdAt).getTime();
        if (!isNaN(t)) return t;
      }
      return 0;
    };
    const tA = getTimestamp(a.id, a.createdAt);
    const tB = getTimestamp(b.id, b.createdAt);
    if (tA && tB) return tB - tA;
    if (tA) return -1;
    if (tB) return 1;
    return 0;
  });

  return (
    <ModalOverlayContainer
      isOpen={isOpen}
      onClose={onClose}
      id="project-switcher-modal"
      maxWidth="md"
      ariaLabel="Project Workspaces"
    >
      {/* Modal Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
            <Folder className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Project Workspaces</h2>
            <p className="text-[11px] text-neutral-400">
              Isolated context and memory scoping
            </p>
          </div>
        </div>
        <button
          id="close-project-modal-btn"
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* Info pill about memory isolation */}
          <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Each project maintains its own isolated conversation history, notes, and custom AI prompt instructions. Work done here will not bleed into other projects.
            </p>
          </div>

          {/* Form when creating or editing */}
          {isCreating ? (
            <form onSubmit={handleSave} className="space-y-3.5 p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  {editingProjectId ? 'Edit Project' : 'New Project'}
                </span>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Project Name *
                </label>
                <input
                  id="project-name-input"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Mobile Banking App, Thesis, AI Engine..."
                  required
                  autoFocus
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Description
                </label>
                <input
                  id="project-desc-input"
                  type="text"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  placeholder="Brief summary of project goals..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Custom AI Project Prompt / Memory Instructions
                </label>
                <textarea
                  id="project-context-input"
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                  placeholder="Instructions specific to this project (e.g. Always respond in TypeScript. Tone: formal engineer.)..."
                  rows={3}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1.5">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  {PROJECT_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorInput(c)}
                      className={`w-6 h-6 rounded-full border transition-all flex items-center justify-center ${
                        colorInput === c ? 'border-white scale-110' : 'border-neutral-700 opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {colorInput === c && (
                        <Check className="w-3 h-3 text-black stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-3 py-1.5 rounded-xl bg-neutral-800 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="save-project-btn"
                  type="submit"
                  disabled={!nameInput.trim()}
                  className="px-4 py-1.5 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  {editingProjectId ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400">
                {projects.length} {projects.length === 1 ? 'Workspace' : 'Workspaces'}
              </span>
              <button
                id="create-project-trigger-btn"
                type="button"
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black hover:bg-neutral-200 active:scale-95 text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
            </div>
          )}

          {/* Project List */}
          <div className="space-y-2">
            {sortedProjects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              const stats = getStats(proj.id);

              return (
                <div
                  key={proj.id}
                  id={`project-card-${proj.id}`}
                  onClick={() => {
                    setActiveProjectId(proj.id);
                    onClose();
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isActive
                      ? 'bg-neutral-900 border-white/40 shadow-sm'
                      : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: proj.color || '#ffffff' }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-semibold text-white truncate">
                            {proj.name}
                          </h3>
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded bg-white text-black text-[10px] font-bold">
                              ACTIVE
                            </span>
                          )}
                          {proj.isDefault && (
                            <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px]">
                              Default
                            </span>
                          )}
                        </div>
                        {proj.description && (
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {proj.description}
                          </p>
                        )}
                        {proj.systemContext && (
                          <p className="text-[10px] text-neutral-500 italic truncate mt-0.5 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 shrink-0" />
                            <span>Memory prompt configured</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleStartEdit(proj, e)}
                        title="Edit Project"
                        className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {!proj.isDefault && (
                        <button
                          type="button"
                          onClick={() => deleteProject(proj.id)}
                          title="Delete Project"
                          className="p-1 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats footer */}
                  <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-neutral-800/60 text-[10px] text-neutral-500">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>{stats.msgs} {stats.msgs === 1 ? 'chat message' : 'chat messages'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>{stats.notes} {stats.notes === 1 ? 'note' : 'notes'}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400 shrink-0">
          <span>Click any project to switch workspace</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-neutral-800 text-white text-xs font-medium hover:bg-neutral-700 transition-colors"
          >
            Done
          </button>
        </div>
    </ModalOverlayContainer>
  );
};
