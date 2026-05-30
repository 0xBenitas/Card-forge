import { useState, useCallback } from 'react';
import { Upload, ArrowLeft, AlertTriangle } from 'lucide-react';
import { parseVinciExcel, type ParseProgress, type ParseResult } from '../lib/parser/vinci';
import { createFolder } from '../lib/db/folders';

interface ImportFlowProps {
  onBack: () => void;
  onDone: (folderId: string) => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'parsing'; progress: ParseProgress }
  | { kind: 'done'; result: ParseResult }
  | { kind: 'error'; message: string };

function defaultFolderName(): string {
  const now = new Date();
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
  return `Batch ${months[now.getMonth()]} ${now.getFullYear()}`;
}

export function ImportFlow({ onBack, onDone }: ImportFlowProps) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setState({ kind: 'error', message: 'Format non supporté. Attendu : .xlsx' });
      return;
    }
    setState({
      kind: 'parsing',
      progress: { stage: 'reading', current: 0, total: 1, message: 'Lecture…' },
    });
    try {
      const result = await parseVinciExcel(file, (progress) => {
        setState({ kind: 'parsing', progress });
      });
      if (result.people.length === 0) {
        setState({
          kind: 'error',
          message:
            'Format non reconnu. Attendu : export VINCI (1 feuille/salarié, nom A7, fonction A9, PIN A12).',
        });
        return;
      }
      setState({ kind: 'done', result });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const saveAndGo = useCallback(async () => {
    if (state.kind !== 'done') return;
    const folder = await createFolder(defaultFolderName(), state.result.people);
    onDone(folder.id);
  }, [state, onDone]);

  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={14} />
          Retour
        </button>

        {state.kind === 'idle' && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-16 text-center transition ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
            }`}
          >
            <Upload size={32} className="text-slate-400" />
            <div className="mt-4 text-sm font-medium text-slate-900">
              Glisser un .xlsx ici
            </div>
            <div className="mt-1 text-xs text-slate-500">ou cliquer pour choisir</div>
            <input
              type="file"
              accept=".xlsx"
              onChange={onChange}
              className="hidden"
            />
          </label>
        )}

        {state.kind === 'parsing' && (
          <div>
            <div className="text-sm font-medium text-slate-900">Import en cours…</div>
            <div className="mt-4 space-y-1 text-xs text-slate-600">
              <div>{state.progress.message}</div>
              <div className="mt-2 h-1 overflow-hidden rounded bg-slate-200">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{
                    width: `${Math.round(
                      (state.progress.current / Math.max(state.progress.total, 1)) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {state.kind === 'done' && (
          <div>
            <div className="text-sm font-medium text-slate-900">Import réussi ✓</div>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              <li>{state.result.stats.total} personnes importées</li>
              <li>├─ {state.result.stats.withPhoto} avec photo</li>
              <li>
                ├─ {state.result.stats.total - state.result.stats.withPhoto} sans photo
                {state.result.stats.total - state.result.stats.withPhoto > 0 && ' ⚠'}
              </li>
              <li>└─ {state.result.stats.withQr} avec QR</li>
            </ul>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={saveAndGo}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Voir les photos →
              </button>
              <button
                type="button"
                onClick={onBack}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {state.kind === 'error' && (
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-red-700">
              <AlertTriangle size={16} />
              Erreur
            </div>
            <p className="mt-2 text-sm text-slate-600">{state.message}</p>
            <button
              type="button"
              onClick={() => setState({ kind: 'idle' })}
              className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
