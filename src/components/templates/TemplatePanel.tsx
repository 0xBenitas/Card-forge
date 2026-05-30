import { useEffect, useMemo, useState } from 'react';
import { X, Copy, Save, Plus, Trash2, CopyIcon } from 'lucide-react';
import type { Person, Template } from '../../types';
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from '../../lib/db/templates';
import { PLACEHOLDERS } from '../../lib/template/placeholders';
import { BlobUrlCache } from '../../lib/template/render';
import { Card } from '../cards/Card';

const STUB_PERSON: Person = {
  id: 'stub',
  name: 'Nom Prénom',
  role: 'Fonction',
  pin: '1234',
  slogan: "La sécurité est l'affaire de tous !",
  photoBlob: null,
  qrBlob: null,
  quality: null,
  modified: false,
};

type Side = 'front' | 'back';

interface TemplatePanelProps {
  template: Template;
  sampleFolderPerson: Person | null;
  onClose: () => void;
  onSaved: (t: Template) => void;
}

export function TemplatePanel({ template, sampleFolderPerson, onClose, onSaved }: TemplatePanelProps) {
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [active, setActive] = useState<Template>(template);
  const [name, setName] = useState(template.name);
  const [frontHtml, setFrontHtml] = useState(template.frontHtml);
  const [backHtml, setBackHtml] = useState(template.backHtml ?? '');
  const [side, setSide] = useState<Side>('front');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    listTemplates().then(setAllTemplates);
  }, []);

  // Sync editor state when active template changes
  useEffect(() => {
    setName(active.name);
    setFrontHtml(active.frontHtml);
    setBackHtml(active.backHtml ?? '');
    setDirty(false);
  }, [active]);

  const cache = useMemo(() => new BlobUrlCache(), []);
  useEffect(() => () => cache.revokeAll(), [cache]);

  const sample = sampleFolderPerson ?? STUB_PERSON;
  const urls = cache.urls(sample);
  const activeHtml = side === 'front' ? frontHtml : backHtml;
  const setActiveHtml = (v: string) => {
    if (side === 'front') setFrontHtml(v);
    else setBackHtml(v);
    setDirty(true);
  };

  const save = async () => {
    const updated: Template = {
      ...active,
      name,
      frontHtml,
      backHtml: backHtml.trim() || null,
    };
    await updateTemplate(updated);
    setDirty(false);
    setActive(updated);
    setAllTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    onSaved(updated);
  };

  const handleNew = async () => {
    const t = await createTemplate('Nouveau template');
    setAllTemplates((prev) => [t, ...prev]);
    setActive(t);
    onSaved(t);
  };

  const handleDuplicate = async () => {
    const t = await createTemplate(`${name} (copie)`, frontHtml, backHtml.trim() || null);
    setAllTemplates((prev) => [t, ...prev]);
    setActive(t);
    onSaved(t);
  };

  const handleDelete = async () => {
    if (allTemplates.length <= 1) return;
    if (!confirm(`Supprimer "${active.name}" ?`)) return;
    await deleteTemplate(active.id);
    const remaining = allTemplates.filter((t) => t.id !== active.id);
    setAllTemplates(remaining);
    setActive(remaining[0]);
    onSaved(remaining[0]);
  };

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30">
      <div className="flex h-full w-full max-w-[70%] flex-col bg-white">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">Templates</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              <Save size={12} /> Sauver
            </button>
            <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Template list */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {allTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t)}
                className={`rounded-full px-3 py-1 text-xs ${
                  t.id === active.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t.name}
              </button>
            ))}
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={handleNew}
                title="Nouveau template"
                className="rounded border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                title="Dupliquer"
                className="rounded border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <CopyIcon size={13} />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={allTemplates.length <= 1}
                title="Supprimer"
                className="rounded border border-slate-200 bg-white p-1.5 text-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Nom :</span>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setDirty(true); }}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs"
            />
          </div>
        </div>

        {/* Recto / Verso tabs */}
        <div className="flex border-b border-slate-200">
          {(['front', 'back'] as Side[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`px-4 py-2 text-xs font-medium ${
                side === s
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {s === 'front' ? 'Recto' : 'Verso'}
              {s === 'back' && !backHtml.trim() && (
                <span className="ml-1 text-[10px] text-slate-400">(vide)</span>
              )}
            </button>
          ))}
        </div>

        {/* Editor + Preview */}
        <div className="flex min-h-0 flex-1">
          <div className="flex w-1/2 flex-col border-r border-slate-200">
            <textarea
              value={activeHtml}
              onChange={(e) => setActiveHtml(e.target.value)}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-slate-900 p-3 font-mono text-xs text-slate-100 outline-none"
              placeholder={
                side === 'front'
                  ? '<!-- HTML recto. Placeholders : {{nom}}, {{fonction}}, {{pin}}, {{slogan}}, {{photo}}, {{qr}} -->'
                  : '<!-- HTML verso (optionnel). Laisser vide = pas de verso. -->'
              }
            />
            <div className="border-t border-slate-200 bg-white p-2">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                Placeholders (clic = copier)
              </div>
              <div className="flex flex-wrap gap-1">
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(p.token)}
                    title={p.description}
                    className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-mono hover:bg-slate-100"
                  >
                    <Copy size={10} /> {p.token}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex w-1/2 flex-col items-center justify-center gap-3 overflow-auto bg-slate-100 p-6">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
              Aperçu {side === 'front' ? 'recto' : 'verso'}
            </div>
            <Card
              person={sample}
              urls={urls}
              html={activeHtml}
              className="h-[54mm] w-[86mm] overflow-hidden rounded-md border border-slate-200 bg-white shadow"
            />
            {!activeHtml.trim() && side === 'back' && (
              <div className="text-center text-xs text-slate-400">
                Laisser vide = cartes recto uniquement
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
