import { useEffect, useRef, useState } from 'react';
import { Download, Image as ImageIcon, IdCard, Layout, ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react';
import type { Folder, Template } from '../types';
import { listFolders, updateFolder, deleteFolder } from '../lib/db/folders';
import { clsx } from 'clsx';

export type Tab = 'photos' | 'cards';

interface HeaderProps {
  folder: Folder;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  activeTemplate: Template | null;
  onOpenTemplatePanel: () => void;
  onExport: () => void;
  onSwitchFolder: (id: string) => void;
  onNewImport: () => void;
  onFolderUpdated: (f: Folder) => void;
}

export function Header({
  folder, tab, onTabChange, activeTemplate,
  onOpenTemplatePanel, onExport,
  onSwitchFolder, onNewImport, onFolderUpdated,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dropdownOpen) listFolders().then(setFolders);
  }, [dropdownOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const startRename = () => {
    setRenameValue(folder.name);
    setRenaming(true);
    setDropdownOpen(false);
  };

  const commitRename = async () => {
    if (!renameValue.trim()) { setRenaming(false); return; }
    const updated = { ...folder, name: renameValue.trim() };
    await updateFolder(updated);
    onFolderUpdated(updated);
    setRenaming(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer le dossier "${folder.name}" et toutes ses données ?`)) return;
    await deleteFolder(folder.id);
    const remaining = await listFolders();
    if (remaining.length > 0) onSwitchFolder(remaining[0].id);
    else onNewImport();
  };

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
      {/* Folder dropdown */}
      <div className="relative" ref={dropdownRef}>
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') void commitRename(); if (e.key === 'Escape') setRenaming(false); }}
            className="rounded border border-blue-300 px-2 py-1 text-sm outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-slate-900 hover:bg-slate-100"
          >
            {folder.name}
            <span className="text-xs text-slate-400">{folder.people.length}p</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
        )}

        {dropdownOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { onSwitchFolder(f.id); setDropdownOpen(false); }}
                className={clsx(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50',
                  f.id === folder.id && 'font-medium text-blue-600',
                )}
              >
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-slate-400">{f.people.length}p</span>
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              onClick={() => { onNewImport(); setDropdownOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              <Plus size={13} /> Nouvel import
            </button>
            <button
              type="button"
              onClick={() => { startRename(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              <Pencil size={13} /> Renommer
            </button>
            <button
              type="button"
              onClick={() => { setDropdownOpen(false); void handleDelete(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
            >
              <Trash2 size={13} /> Supprimer ce dossier
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-slate-200">
          <TabButton active={tab === 'photos'} onClick={() => onTabChange('photos')}>
            <ImageIcon size={14} /> Photos
          </TabButton>
          <TabButton active={tab === 'cards'} onClick={() => onTabChange('cards')}>
            <IdCard size={14} /> Cartes
          </TabButton>
        </div>

        <button
          type="button"
          onClick={onOpenTemplatePanel}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          <Layout size={14} />
          {activeTemplate ? activeTemplate.name : 'Aucun template'}
        </button>

        <button
          type="button"
          onClick={onExport}
          disabled={!activeTemplate}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Download size={14} /> Exporter
        </button>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 text-xs first:rounded-l-md last:rounded-r-md',
        active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}
