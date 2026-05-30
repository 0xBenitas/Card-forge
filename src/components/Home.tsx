import { useEffect, useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';
import type { Folder } from '../types';
import { listFolders } from '../lib/db/folders';

interface HomeProps {
  onImport: () => void;
  onOpenFolder: (id: string) => void;
}

export function Home({ onImport, onOpenFolder }: HomeProps) {
  const [folders, setFolders] = useState<Folder[]>([]);

  useEffect(() => {
    listFolders().then(setFolders);
  }, []);

  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">CardForge</h1>
        <p className="mt-1 text-sm text-slate-500">
          Excel VINCI → cartes prêtes à imprimer
        </p>

        <button
          type="button"
          onClick={onImport}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Upload size={16} />
          Importer un Excel VINCI
        </button>

        {folders.length > 0 && (
          <div className="mt-8">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Dossiers précédents
            </div>
            <ul className="mt-3 divide-y divide-slate-100">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => onOpenFolder(f.id)}
                    className="flex w-full items-center justify-between py-2 text-left hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2 text-sm text-slate-900">
                      <FolderOpen size={14} className="text-slate-400" />
                      {f.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {f.people.length} personnes
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
