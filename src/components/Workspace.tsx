import { useEffect, useMemo, useRef, useState } from 'react';
import type { Folder, Person, Template } from '../types';
import { getFolder, updateFolder } from '../lib/db/folders';
import { createTemplate, listTemplates } from '../lib/db/templates';
import { BlobUrlCache } from '../lib/template/render';
import { analyzePhoto } from '../lib/quality/analyze';
import { Header, type Tab } from './Header';
import { PhotosTab } from './photos/PhotosTab';
import { CardsTab } from './cards/CardsTab';
import { TemplatePanel } from './templates/TemplatePanel';
import { ExportDropdown } from './export/ExportDropdown';

interface WorkspaceProps {
  folderId: string;
  onNewImport: () => void;
  onSwitchFolder: (id: string) => void;
}

export function Workspace({ folderId, onNewImport, onSwitchFolder }: WorkspaceProps) {
  const [folder, setFolder] = useState<Folder | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [tab, setTab] = useState<Tab>('photos');
  const [panelOpen, setPanelOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const cache = useMemo(() => new BlobUrlCache(), []);
  const folderRef = useRef<Folder | null>(null);

  useEffect(() => () => cache.revokeAll(), [cache]);

  useEffect(() => {
    setFolder(null);
    setAnalyzing(false);
    void (async () => {
      const [f, templates] = await Promise.all([getFolder(folderId), listTemplates()]);
      const loadedFolder = f ?? null;
      folderRef.current = loadedFolder;
      setFolder(loadedFolder);

      if (templates.length > 0) setTemplate(templates[0]);
      else setTemplate(await createTemplate('Mon template', ''));

      if (!loadedFolder) return;
      const toAnalyze = loadedFolder.people.filter((p) => p.photoBlob !== null && p.quality === null);
      if (toAnalyze.length === 0) return;

      setAnalyzing(true);
      let done = 0;
      await Promise.all(
        toAnalyze.map(async (person) => {
          const quality = await analyzePhoto(person.photoBlob!);
          done++;
          setFolder((prev) => {
            if (!prev) return prev;
            const people = prev.people.map((p) => p.id === person.id ? { ...p, quality } : p);
            const updated = { ...prev, people };
            folderRef.current = updated;
            return updated;
          });
          if (done === toAnalyze.length) {
            setAnalyzing(false);
            if (folderRef.current) void updateFolder(folderRef.current);
          }
        }),
      );
    })();
  }, [folderId]);

  const updatePeople = (updater: (people: Person[]) => Person[]) => {
    setFolder((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, people: updater(prev.people) };
      folderRef.current = updated;
      void updateFolder(updated);
      return updated;
    });
  };

  if (!folder || !template) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <Header
        folder={folder}
        tab={tab}
        onTabChange={setTab}
        activeTemplate={template}
        onOpenTemplatePanel={() => setPanelOpen(true)}
        onExport={() => setExportOpen(true)}
        onSwitchFolder={onSwitchFolder}
        onNewImport={onNewImport}
        onFolderUpdated={setFolder}
      />
      <div className="flex-1 overflow-auto">
        {tab === 'photos' && (
          <PhotosTab
            people={folder.people}
            cache={cache}
            analyzing={analyzing}
            onUpdatePeople={updatePeople}
          />
        )}
        {tab === 'cards' && (
          <CardsTab people={folder.people} template={template} cache={cache} />
        )}
      </div>

      {panelOpen && (
        <TemplatePanel
          template={template}
          sampleFolderPerson={folder.people[0] ?? null}
          onClose={() => setPanelOpen(false)}
          onSaved={setTemplate}
        />
      )}

      {exportOpen && (
        <ExportDropdown
          people={folder.people}
          template={template}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
