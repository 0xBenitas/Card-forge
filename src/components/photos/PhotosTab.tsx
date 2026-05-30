import { useEffect, useState } from 'react';
import type { Person } from '../../types';
import type { BlobUrlCache } from '../../lib/template/render';
import { PhotoRow } from './PhotoRow';

type SortMode = 'worst-first' | 'az' | 'original';

interface PhotosTabProps {
  people: Person[];
  cache: BlobUrlCache;
  analyzing: boolean;
  onUpdatePeople: (updater: (people: Person[]) => Person[]) => void;
}

function gradeOrder(p: Person): number {
  if (!p.quality) return 1;
  if (p.quality.grade === 'critical') return 0;
  if (p.quality.grade === 'warning') return 1;
  return 2;
}

function sortPeople(people: Person[], mode: SortMode): Person[] {
  const copy = [...people];
  if (mode === 'worst-first') {
    copy.sort((a, b) => {
      const go = gradeOrder(a) - gradeOrder(b);
      if (go !== 0) return go;
      return (a.quality?.score ?? 50) - (b.quality?.score ?? 50);
    });
  } else if (mode === 'az') {
    copy.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  return copy;
}

export function PhotosTab({ people, cache, analyzing, onUpdatePeople }: PhotosTabProps) {
  const [sort, setSort] = useState<SortMode>('worst-first');
  const [filterReview, setFilterReview] = useState(false);
  const [sorted, setSorted] = useState<Person[]>(people);

  useEffect(() => {
    if (!analyzing) {
      setSorted(sortPeople(people, sort));
    } else {
      setSorted(people);
    }
  }, [analyzing, people, sort]);

  const displayed = filterReview
    ? sorted.filter((p) => !p.quality || p.quality.grade !== 'good')
    : sorted;

  const critical = people.filter((p) => p.quality?.grade === 'critical').length;
  const warning = people.filter((p) => p.quality?.grade === 'warning').length;
  const good = people.filter((p) => p.quality?.grade === 'good').length;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-3 flex items-center gap-3">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
        >
          <option value="worst-first">Pires d'abord</option>
          <option value="az">A → Z</option>
          <option value="original">Ordre Excel</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={filterReview}
            onChange={(e) => setFilterReview(e.target.checked)}
            className="rounded"
          />
          Seulement à revoir
        </label>
        <div className="ml-auto text-xs text-slate-500">
          {analyzing ? (
            <span className="text-slate-400">⚪ Analyse en cours…</span>
          ) : (
            <>
              {people.length} · {critical > 0 && <span className="text-red-600">{critical}🔴 </span>}
              {warning > 0 && <span className="text-orange-500">{warning}🟠 </span>}
              {good > 0 && <span className="text-green-600">{good}🟢</span>}
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {displayed.map((p) => (
          <PhotoRow
            key={p.id}
            person={p}
            cache={cache}
            onUpdate={(updated) =>
              onUpdatePeople((people) =>
                people.map((x) => (x.id === updated.id ? updated : x)),
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
