import { useCallback, useRef, useState } from 'react';
import { ImageOff, Upload } from 'lucide-react';
import type { Person } from '../../types';
import type { BlobUrlCache } from '../../lib/template/render';
import { analyzePhoto } from '../../lib/quality/analyze';
import { PhotoLightbox } from './PhotoLightbox';

interface PhotoRowProps {
  person: Person;
  cache: BlobUrlCache;
  onUpdate: (p: Person) => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function GradeBadge({ person }: { person: Person }) {
  if (!person.photoBlob) return null;
  if (!person.quality) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400">
        ⚪ …
      </span>
    );
  }
  const { grade, score } = person.quality;
  const colors = {
    good: 'bg-green-50 text-green-700',
    warning: 'bg-orange-50 text-orange-700',
    critical: 'bg-red-50 text-red-700',
  };
  const emoji = { good: '🟢', warning: '🟠', critical: '🔴' };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[grade]}`}>
      {emoji[grade]} {score}
    </span>
  );
}

function QualityDetails({ person }: { person: Person }) {
  if (!person.quality || person.quality.grade === 'good') return null;
  const { checks } = person.quality;
  return (
    <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
      <div>
        {checks.resolution.pass ? '✅' : '❌'} Résolution : {checks.resolution.value}
        {!checks.resolution.pass && ' (min 300×400 recommandé)'}
      </div>
      <div>
        {checks.sharpness.pass ? '✅' : '❌'} Netteté : {checks.sharpness.value}
        {!checks.sharpness.pass && ' (floue, seuil 100)'}
      </div>
      <div>
        {checks.brightness.pass ? '✅' : '❌'} Luminosité : {checks.brightness.value}
        {!checks.brightness.pass && ' (trop sombre ou surexposé)'}
      </div>
    </div>
  );
}

export function PhotoRow({ person, cache, onUpdate }: PhotoRowProps) {
  const photoBlob = person.photoBlob;
  const url = photoBlob ? cache.urlFor(photoBlob) : null;
  const isExpanded = person.quality && person.quality.grade !== 'good';
  const [dragOver, setDragOver] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      const quality = await analyzePhoto(blob);
      cache.revokeUrl(photoBlob);
      onUpdate({ ...person, photoBlob: blob, quality, modified: true });
    },
    [person, photoBlob, cache, onUpdate],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  // Inline text editing
  const [editField, setEditField] = useState<'name' | 'role' | 'pin' | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (field: 'name' | 'role' | 'pin') => {
    setEditField(field);
    setEditValue(person[field]);
  };

  const commitEdit = () => {
    if (editField) {
      onUpdate({ ...person, [editField]: editValue.trim(), modified: true });
    }
    setEditField(null);
  };

  const cancelEdit = () => setEditField(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <>
      <div
        className={`rounded-md border bg-white p-3 transition ${
          dragOver ? 'border-blue-400 bg-blue-50' : isExpanded ? 'border-orange-200' : 'border-slate-200'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => url && setLightboxOpen(true)}
            className="flex h-16 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded bg-slate-100 hover:opacity-80"
            title="Agrandir"
          >
            {url ? (
              <img src={url} alt={person.name} className="h-full w-full object-cover" />
            ) : (
              <ImageOff size={20} className="text-slate-300" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <EditableText
                value={person.name}
                placeholder="— sans nom —"
                editing={editField === 'name'}
                editValue={editValue}
                onStartEdit={() => startEdit('name')}
                onEditChange={setEditValue}
                onKeyDown={onKeyDown}
                onBlur={commitEdit}
                className="text-sm font-medium text-slate-900"
              />
              {person.modified && (
                <span className="shrink-0 rounded bg-blue-50 px-1 py-0.5 text-[10px] text-blue-600">
                  modifié
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <EditableText
                value={person.role}
                placeholder="—"
                editing={editField === 'role'}
                editValue={editValue}
                onStartEdit={() => startEdit('role')}
                onEditChange={setEditValue}
                onKeyDown={onKeyDown}
                onBlur={commitEdit}
                className="text-xs text-slate-500"
              />
              {person.pin && (
                <>
                  <span>· PIN</span>
                  <EditableText
                    value={person.pin}
                    placeholder="—"
                    editing={editField === 'pin'}
                    editValue={editValue}
                    onStartEdit={() => startEdit('pin')}
                    onEditChange={setEditValue}
                    onKeyDown={onKeyDown}
                    onBlur={commitEdit}
                    className="text-xs text-slate-500 font-mono"
                  />
                </>
              )}
            </div>
            {photoBlob && (
              <div className="mt-0.5 text-[11px] text-slate-400">
                {photoBlob.type || 'unknown'} · {formatBytes(photoBlob.size)}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <GradeBadge person={person} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50"
            >
              <Upload size={10} /> Remplacer
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        {isExpanded && <QualityDetails person={person} />}
      </div>

      {lightboxOpen && url && (
        <PhotoLightbox
          url={url}
          name={person.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

interface EditableTextProps {
  value: string;
  placeholder: string;
  editing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  className: string;
}

function EditableText({
  value, placeholder, editing, editValue,
  onStartEdit, onEditChange, onKeyDown, onBlur, className,
}: EditableTextProps) {
  if (editing) {
    return (
      <input
        autoFocus
        value={editValue}
        onChange={(e) => onEditChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className={`rounded border border-blue-300 bg-white px-1 outline-none ${className}`}
        style={{ minWidth: '4rem', maxWidth: '16rem' }}
      />
    );
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onStartEdit}
      onKeyDown={(e) => e.key === 'Enter' && onStartEdit()}
      className={`cursor-text rounded px-0.5 hover:bg-slate-100 ${className}`}
      title="Cliquer pour éditer"
    >
      {value || <span className="text-slate-400">{placeholder}</span>}
    </span>
  );
}
