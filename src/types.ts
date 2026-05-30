export interface PhotoQuality {
  score: number;
  grade: 'good' | 'warning' | 'critical';
  checks: {
    resolution: { value: string; pass: boolean };
    sharpness: { value: number; pass: boolean };
    brightness: { value: number; pass: boolean };
  };
}

export interface Person {
  id: string;
  name: string;
  role: string;
  pin: string;
  slogan: string;
  photoBlob: Blob | null;
  qrBlob: Blob | null;
  quality: PhotoQuality | null;
  modified: boolean;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  people: Person[];
}

export interface Template {
  id: string;
  name: string;
  frontHtml: string;
  backHtml: string | null;
  createdAt: Date;
  updatedAt: Date;
}
