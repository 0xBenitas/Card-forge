import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Folder, Template } from '../../types';

interface CardForgeDB extends DBSchema {
  folders: {
    key: string;
    value: Folder;
  };
  templates: {
    key: string;
    value: Template;
  };
}

const DB_NAME = 'cardforge';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CardForgeDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<CardForgeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CardForgeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (HTTP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
