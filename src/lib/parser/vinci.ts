import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { Person } from '../../types';
import { newId } from '../db/schema';

export interface ParseProgress {
  stage: 'reading' | 'text' | 'images' | 'classifying' | 'done';
  current: number;
  total: number;
  message: string;
}

export interface ParseResult {
  people: Person[];
  filename: string;
  stats: {
    total: number;
    withPhoto: number;
    withQr: number;
  };
}

type OnProgress = (p: ParseProgress) => void;

interface DrawingAnchor {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  rId: string;
}

const MIME_BY_EXT: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
};

function mimeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function getAllTags(doc: Document | Element, localName: string): Element[] {
  return Array.from(doc.getElementsByTagName('*')).filter(
    (el) => el.localName === localName,
  );
}

function firstChildByLocalName(parent: Element, localName: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (child.localName === localName) return child;
  }
  return null;
}

function textOf(parent: Element, localName: string): string {
  const el = firstChildByLocalName(parent, localName);
  return el?.textContent?.trim() ?? '';
}

async function parseDrawingAnchors(zip: JSZip, drawingPath: string): Promise<DrawingAnchor[]> {
  const file = zip.file(drawingPath);
  if (!file) return [];
  const xml = parseXml(await file.async('string'));
  const anchors = getAllTags(xml, 'twoCellAnchor');
  const out: DrawingAnchor[] = [];
  for (const anchor of anchors) {
    const from = firstChildByLocalName(anchor, 'from');
    const to = firstChildByLocalName(anchor, 'to');
    if (!from || !to) continue;
    const blip = getAllTags(anchor, 'blip')[0];
    if (!blip) continue;
    const rId =
      blip.getAttribute('r:embed') ??
      blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') ??
      '';
    if (!rId) continue;
    out.push({
      fromCol: parseInt(textOf(from, 'col'), 10) || 0,
      fromRow: parseInt(textOf(from, 'row'), 10) || 0,
      toCol: parseInt(textOf(to, 'col'), 10) || 0,
      toRow: parseInt(textOf(to, 'row'), 10) || 0,
      rId,
    });
  }
  return out;
}

async function parseRels(zip: JSZip, relsPath: string): Promise<Map<string, string>> {
  const file = zip.file(relsPath);
  if (!file) return new Map();
  const xml = parseXml(await file.async('string'));
  const rels = getAllTags(xml, 'Relationship');
  const map = new Map<string, string>();
  for (const r of rels) {
    const id = r.getAttribute('Id');
    const target = r.getAttribute('Target');
    if (id && target) map.set(id, target);
  }
  return map;
}

function resolveRelative(base: string, rel: string): string {
  const baseParts = base.split('/').slice(0, -1);
  const relParts = rel.split('/');
  for (const part of relParts) {
    if (part === '..') baseParts.pop();
    else if (part === '.' || part === '') continue;
    else baseParts.push(part);
  }
  return baseParts.join('/');
}

type ImageKind = 'photo' | 'qr' | 'other';

function classify(anchor: DrawingAnchor): ImageKind {
  const { fromCol, fromRow } = anchor;
  if (fromCol <= 1 && fromRow <= 5) return 'photo';
  if (fromCol >= 2 && fromCol <= 3 && fromRow >= 3 && fromRow <= 9) return 'qr';
  return 'other';
}

export async function parseVinciExcel(
  file: File,
  onProgress?: OnProgress,
): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();

  onProgress?.({ stage: 'reading', current: 0, total: 1, message: 'Lecture du fichier…' });

  const zip = await JSZip.loadAsync(buffer);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (e) {
    // ExcelJS may fail on drawings/anchors in certain VINCI files — continue anyway,
    // worksheets (text cells) are usually populated before the error is thrown.
    console.warn('ExcelJS partial load warning (drawings?):', e);
  }

  const sheets = wb.worksheets;
  const total = sheets.length;
  const people: Person[] = [];
  let withPhoto = 0;
  let withQr = 0;

  for (let i = 0; i < sheets.length; i++) {
    const ws = sheets[i];
    onProgress?.({
      stage: 'text',
      current: i + 1,
      total,
      message: `Lecture feuille ${i + 1}/${total}`,
    });

    const name = String(ws.getCell('A7').text ?? '').trim();
    const role = String(ws.getCell('A9').text ?? '').trim();
    const pin = String(ws.getCell('A12').text ?? '').trim();
    const slogan = String(ws.getCell('B11').text ?? '').trim();

    let photoBlob: Blob | null = null;
    let qrBlob: Blob | null = null;

    const sheetXmlPath = `xl/worksheets/sheet${i + 1}.xml`;
    const sheetRelsPath = `xl/worksheets/_rels/sheet${i + 1}.xml.rels`;
    const sheetRels = await parseRels(zip, sheetRelsPath);

    let drawingTarget: string | null = null;
    for (const target of sheetRels.values()) {
      if (target.includes('drawings/')) {
        drawingTarget = target;
        break;
      }
    }

    if (drawingTarget) {
      try {
        const drawingPath = resolveRelative(sheetXmlPath, drawingTarget);
        const drawingRelsPath = drawingPath.replace(
          /([^/]+\.xml)$/,
          '_rels/$1.rels',
        );
        const drawingRels = await parseRels(zip, drawingRelsPath);
        const anchors = await parseDrawingAnchors(zip, drawingPath);

        for (const anchor of anchors) {
          const kind = classify(anchor);
          if (kind === 'other') continue;
          const target = drawingRels.get(anchor.rId);
          if (!target) continue;
          const mediaPath = resolveRelative(drawingPath, target);
          const mediaFile = zip.file(mediaPath);
          if (!mediaFile) continue;
          const bytes = await mediaFile.async('uint8array');
          const blob = new Blob([bytes as BlobPart], { type: mimeForPath(mediaPath) });
          if (kind === 'photo' && !photoBlob) photoBlob = blob;
          else if (kind === 'qr' && !qrBlob) qrBlob = blob;
        }
      } catch (e) {
        console.warn(`Sheet ${i + 1}: drawing parse error, images skipped:`, e);
      }
    }

    if (photoBlob) withPhoto++;
    if (qrBlob) withQr++;

    people.push({
      id: newId(),
      name,
      role,
      pin,
      slogan,
      photoBlob,
      qrBlob,
      quality: null,
      modified: false,
    });
  }

  onProgress?.({ stage: 'done', current: total, total, message: 'Terminé' });

  return {
    filename: file.name,
    people,
    stats: { total, withPhoto, withQr },
  };
}
