import { useState } from 'react';
import { Home } from './components/Home';
import { ImportFlow } from './components/ImportFlow';
import { Workspace } from './components/Workspace';

type View =
  | { name: 'home' }
  | { name: 'import' }
  | { name: 'workspace'; folderId: string };

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' });

  if (view.name === 'home') {
    return (
      <Home
        onImport={() => setView({ name: 'import' })}
        onOpenFolder={(id) => setView({ name: 'workspace', folderId: id })}
      />
    );
  }

  if (view.name === 'import') {
    return (
      <ImportFlow
        onBack={() => setView({ name: 'home' })}
        onDone={(id) => setView({ name: 'workspace', folderId: id })}
      />
    );
  }

  return (
    <Workspace
      folderId={view.folderId}
      onNewImport={() => setView({ name: 'import' })}
      onSwitchFolder={(id) => setView({ name: 'workspace', folderId: id })}
    />
  );
}
