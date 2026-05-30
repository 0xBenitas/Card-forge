import type { Person, Template } from '../../types';
import { BlobUrlCache, renderTemplate } from '../template/render';

export type PrintMode = 'individual' | 'batch-a4';

function buildPrintHtml(
  people: Person[],
  template: Template,
  cache: BlobUrlCache,
  mode: PrintMode,
): string {
  const hasBack = !!template.backHtml;
  let pages: string[] = [];

  if (mode === 'individual') {
    for (const p of people) {
      const urls = cache.urls(p);
      pages.push(`<div class="page">${renderTemplate(template.frontHtml, p, urls)}</div>`);
      if (hasBack) {
        pages.push(`<div class="page">${renderTemplate(template.backHtml!, p, urls)}</div>`);
      }
    }
  } else {
    // batch-a4: recto page(s), then verso page(s) if back exists
    const chunks = chunkArray(people, 8);
    for (const chunk of chunks) {
      const cells = chunk
        .map((p) => `<div class="cell">${renderTemplate(template.frontHtml, p, cache.urls(p))}</div>`)
        .join('');
      pages.push(`<div class="page a4">${cells}</div>`);
    }
    if (hasBack) {
      for (const chunk of chunks) {
        const cells = chunk
          .map((p) => `<div class="cell">${renderTemplate(template.backHtml!, p, cache.urls(p))}</div>`)
          .join('');
        pages.push(`<div class="page a4">${cells}</div>`);
      }
    }
  }

  const individualCss = `
    @page { size: 86mm 54mm; margin: 0; }
    .page { width: 86mm; height: 54mm; overflow: hidden; page-break-after: always; }
    .page:last-child { page-break-after: auto; }`;

  const batchCss = `
    @page { size: A4; margin: 10mm; }
    .page.a4 { width: 100%; page-break-after: always; display: grid;
      grid-template-columns: repeat(2, 86mm); grid-template-rows: repeat(4, 54mm);
      gap: 3mm; justify-content: center; }
    .page.a4:last-child { page-break-after: auto; }
    .cell { width: 86mm; height: 54mm; overflow: hidden; }`;

  const pageCss = mode === 'individual' ? individualCss : batchCss;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>CardForge — export</title>
<style>
  html, body { margin: 0; padding: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${pageCss}
</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function waitImages(doc: Document): Promise<void> {
  const imgs = Array.from(doc.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
}

export async function exportPdf(
  people: Person[],
  template: Template,
  mode: PrintMode = 'individual',
): Promise<void> {
  const cache = new BlobUrlCache();
  const html = buildPrintHtml(people, template, cache, mode);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  iframe.setAttribute('aria-hidden', 'true');

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) { iframe.remove(); cache.revokeAll(); return; }

  await waitImages(doc);
  await new Promise((r) => setTimeout(r, 150));

  win.focus();
  win.print();

  setTimeout(() => { iframe.remove(); cache.revokeAll(); }, 3000);
}
