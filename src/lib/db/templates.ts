import type { Template } from '../../types';
import { getDb, newId } from './schema';

export async function createTemplate(name: string, frontHtml = '', backHtml: string | null = null): Promise<Template> {
  const db = await getDb();
  const template: Template = {
    id: newId(),
    name,
    frontHtml,
    backHtml,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.put('templates', template);
  return template;
}

export async function listTemplates(): Promise<Template[]> {
  const db = await getDb();
  const all = await db.getAll('templates');
  return all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  const db = await getDb();
  return db.get('templates', id);
}

export async function updateTemplate(template: Template): Promise<void> {
  const db = await getDb();
  template.updatedAt = new Date();
  await db.put('templates', template);
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('templates', id);
}
