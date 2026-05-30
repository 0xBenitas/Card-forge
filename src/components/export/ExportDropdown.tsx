import { useState } from 'react';
import { Download, Info } from 'lucide-react';
import type { Person, Template } from '../../types';
import { exportPdf, type PrintMode } from '../../lib/export/print';

interface ExportDropdownProps {
  people: Person[];
  template: Template | null;
  onClose: () => void;
}

export function ExportDropdown({ people, template, onClose }: ExportDropdownProps) {
  const [mode, setMode] = useState<PrintMode>('individual');
  const [running, setRunning] = useState(false);
  const hasBack = !!template?.backHtml;

  const run = async () => {
    if (!template) return;
    setRunning(true);
    try {
      await exportPdf(people, template, mode);
    } finally {
      setRunning(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 pt-16">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Exporter le PDF</div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-900">×</button>
        </div>

        {hasBack && (
          <div className="mt-2 rounded bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
            Template avec verso — pages alternées recto/verso
          </div>
        )}

        <div className="mt-4 space-y-2">
          {([
            { value: 'individual', label: 'Individuel CR80 (86×54mm)', sub: '1 carte par page' },
            { value: 'batch-a4', label: 'Batch A4', sub: '8 cartes par page, à découper' },
          ] as { value: PrintMode; label: string; sub: string }[]).map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-3 hover:bg-slate-50">
              <input
                type="radio"
                name="mode"
                value={opt.value}
                checked={mode === opt.value}
                onChange={() => setMode(opt.value)}
                className="mt-0.5"
              />
              <div>
                <div className="text-xs font-medium text-slate-900">{opt.label}</div>
                <div className="text-[11px] text-slate-500">{opt.sub}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div className="flex items-center gap-1 font-medium text-slate-700">
            <Info size={12} /> Dans Chrome :
          </div>
          <ul className="mt-2 space-y-0.5 pl-4">
            <li>• Destination → <b>Enregistrer en PDF</b></li>
            <li>• Marges → <b>Aucune</b></li>
            <li>• Mise à l'échelle → <b>100%</b></li>
            <li>• Activer <b>Graphiques d'arrière-plan</b></li>
          </ul>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={running || !template}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
        >
          <Download size={14} />
          {running ? 'Préparation…' : `Exporter ${people.length} cartes`}
        </button>
      </div>
    </div>
  );
}
