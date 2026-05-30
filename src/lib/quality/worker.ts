import type { PhotoQuality } from '../../types';

interface WorkerRequest {
  id: string;
  blob: Blob;
}

interface WorkerResponse {
  id: string;
  quality: PhotoQuality;
}

function computeGrayscale(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] =
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return gray;
}

function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap =
        -4 * gray[y * w + x] +
        gray[(y - 1) * w + x] +
        gray[(y + 1) * w + x] +
        gray[y * w + x - 1] +
        gray[y * w + x + 1];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

function averageLuminance(gray: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return sum / gray.length;
}

async function analyze(blob: Blob): Promise<PhotoQuality> {
  const bitmap = await createImageBitmap(blob);
  const w = bitmap.width;
  const h = bitmap.height;

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = computeGrayscale(data, w, h);

  // Resolution check : ≥ 300×400 px (portrait) or ≥ 400×300 (landscape)
  const resPass = (w >= 300 && h >= 400) || (w >= 400 && h >= 300);

  // Sharpness check : Laplacian variance ≥ 100 (skip if < 200×200)
  const sharpnessValue =
    w >= 200 && h >= 200 ? Math.round(laplacianVariance(gray, w, h)) : 999;
  const sharpnessPass = sharpnessValue >= 100;

  // Brightness check : mean luminance 60–220
  const brightnessValue = Math.round(averageLuminance(gray));
  const brightnessPass = brightnessValue >= 60 && brightnessValue <= 220;

  // Weighted score
  const score =
    (resPass ? 50 : 0) + (sharpnessPass ? 30 : 0) + (brightnessPass ? 20 : 0);

  const grade: PhotoQuality['grade'] =
    score >= 70 ? 'good' : score >= 40 ? 'warning' : 'critical';

  return {
    score,
    grade,
    checks: {
      resolution: { value: `${w}×${h}`, pass: resPass },
      sharpness: { value: sharpnessValue, pass: sharpnessPass },
      brightness: { value: brightnessValue, pass: brightnessPass },
    },
  };
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, blob } = e.data;
  try {
    const quality = await analyze(blob);
    const response: WorkerResponse = { id, quality };
    self.postMessage(response);
  } catch {
    const fallback: PhotoQuality = {
      score: 0,
      grade: 'critical',
      checks: {
        resolution: { value: '?', pass: false },
        sharpness: { value: 0, pass: false },
        brightness: { value: 0, pass: false },
      },
    };
    const response: WorkerResponse = { id, quality: fallback };
    self.postMessage(response);
  }
};
