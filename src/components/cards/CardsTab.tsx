import { useState } from 'react';
import type { Person, Template } from '../../types';
import type { BlobUrlCache } from '../../lib/template/render';
import { Card } from './Card';

interface CardsTabProps {
  people: Person[];
  template: Template;
  cache: BlobUrlCache;
}

type Side = 'front' | 'back';

export function CardsTab({ people, template, cache }: CardsTabProps) {
  const [side, setSide] = useState<Side>('front');
  const hasBack = !!template.backHtml;
  const activeHtml = side === 'front' ? template.frontHtml : (template.backHtml ?? '');

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => setSide('front')}
            className={`px-3 py-1.5 text-xs first:rounded-l-md last:rounded-r-md ${
              side === 'front' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            ◉ Recto
          </button>
          <button
            type="button"
            onClick={() => hasBack && setSide('back')}
            disabled={!hasBack}
            className={`px-3 py-1.5 text-xs first:rounded-l-md last:rounded-r-md ${
              side === 'back'
                ? 'bg-slate-900 text-white'
                : hasBack
                ? 'text-slate-700 hover:bg-slate-50'
                : 'cursor-not-allowed text-slate-300'
            }`}
            title={!hasBack ? 'Aucun verso défini dans le template' : undefined}
          >
            ○ Verso
          </button>
        </div>
        <span className="text-xs text-slate-500">{people.length} cartes</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <div key={p.id} className="flex flex-col items-center">
            <Card
              person={p}
              urls={cache.urls(p)}
              html={activeHtml}
              className="h-[54mm] w-[86mm] overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
            />
            <div className="mt-2 truncate text-xs text-slate-600">
              {p.name || '— sans nom —'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
