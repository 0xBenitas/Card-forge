import type { PhotoQuality } from '../../types';

interface PendingRequest {
  resolve: (q: PhotoQuality) => void;
  reject: (e: unknown) => void;
}

let workerInstance: Worker | null = null;
const pending = new Map<string, PendingRequest>();

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });
    workerInstance.onmessage = (e: MessageEvent<{ id: string; quality: PhotoQuality }>) => {
      const { id, quality } = e.data;
      const p = pending.get(id);
      if (p) {
        pending.delete(id);
        p.resolve(quality);
      }
    };
    workerInstance.onerror = (e) => {
      for (const p of pending.values()) p.reject(e);
      pending.clear();
    };
  }
  return workerInstance;
}

export function analyzePhoto(blob: Blob): Promise<PhotoQuality> {
  return new Promise<PhotoQuality>((resolve, reject) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, blob });
  });
}

export function terminateWorker(): void {
  workerInstance?.terminate();
  workerInstance = null;
  pending.clear();
}
