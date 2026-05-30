import type { Person } from '../../types';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface BlobUrls {
  photo: string;
  qr: string;
}

export function renderTemplate(html: string, person: Person, urls: BlobUrls): string {
  return html
    .replace(/\{\{nom\}\}/g, escapeHtml(person.name))
    .replace(/\{\{fonction\}\}/g, escapeHtml(person.role))
    .replace(/\{\{pin\}\}/g, escapeHtml(person.pin))
    .replace(/\{\{slogan\}\}/g, escapeHtml(person.slogan))
    .replace(/\{\{photo\}\}/g, urls.photo)
    .replace(/\{\{qr\}\}/g, urls.qr);
}

const EMPTY_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export class BlobUrlCache {
  private cache = new Map<Blob, string>();

  urlFor(blob: Blob | null): string {
    if (!blob) return EMPTY_PIXEL;
    const cached = this.cache.get(blob);
    if (cached) return cached;
    const url = URL.createObjectURL(blob);
    this.cache.set(blob, url);
    return url;
  }

  urls(person: Person): BlobUrls {
    return {
      photo: this.urlFor(person.photoBlob),
      qr: this.urlFor(person.qrBlob),
    };
  }

  revokeUrl(blob: Blob | null): void {
    if (!blob) return;
    const url = this.cache.get(blob);
    if (url) {
      URL.revokeObjectURL(url);
      this.cache.delete(blob);
    }
  }

  revokeAll(): void {
    for (const url of this.cache.values()) URL.revokeObjectURL(url);
    this.cache.clear();
  }
}
