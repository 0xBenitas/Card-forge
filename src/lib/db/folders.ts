import type { Folder, Person } from '../../types';
import { getDb, newId } from './schema';

export async function createFolder(name: string, people: Person[]): Promise<Folder> {
  const db = await getDb();
  const folder: Folder = {
    id: newId(),
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    people,
  };
  await db.put('folders', folder);
  return folder;
}

export async function listFolders(): Promise<Folder[]> {
  const db = await getDb();
  const all = await db.getAll('folders');
  return all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  const db = await getDb();
  return db.get('folders', id);
}

export async function updateFolder(folder: Folder): Promise<void> {
  const db = await getDb();
  folder.updatedAt = new Date();
  await db.put('folders', folder);
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('folders', id);
}

export async function updatePerson(folderId: string, person: Person): Promise<void> {
  const folder = await getFolder(folderId);
  if (!folder) return;
  const idx = folder.people.findIndex((p) => p.id === person.id);
  if (idx === -1) return;
  folder.people[idx] = { ...person, modified: true };
  await updateFolder(folder);
}
