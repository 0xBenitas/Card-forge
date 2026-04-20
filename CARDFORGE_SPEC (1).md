# CardForge — Spec Projet

## Contexte

Outil web de génération de cartes professionnelles (badges, cartes QHSE, cartes de sécurité) à partir d'un fichier Excel. Remplace un script Python desktop (CustomTkinter + xhtml2pdf) qui dégradait les photos à l'export PDF.

Le premier use-case est Omexom (VINCI Energies) : générer des cartes QHSE à partir d'un export Excel VINCI (1 feuille = 1 salarié).

L'architecture est pensée modulaire pour évoluer en SaaS multi-clients avec bibliothèque de templates.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** + composants custom (pas de shadcn pour le moment, on reste léger)
- **ExcelJS** (`exceljs`) côté client pour parser le **texte** des cellules Excel
- **JSZip** (`jszip`) côté client pour extraire les **images** brutes du .xlsx (plus fiable que l'API images d'ExcelJS côté navigateur, qui est buggée/incomplète)
- **pdf-lib** côté client pour l'export PDF (injection bytes photo bruts, ZÉRO recompression)
- **Font Unicode** : Noto Sans embedée dans le PDF (supporte accents, caractères arabes, turcs, etc. — nécessaire vu les noms BTP en France : BEN DAALI, ELHADOUCHI, NJOYA MOUMIE...)
- **Lucide React** pour les icônes
- 100% client-side (aucune donnée ne quitte le navigateur → RGPD friendly)

### Dual rendering (preview ≠ export)

L'outil utilise **deux moteurs de rendu distincts** :

1. **Preview écran** → composant React/Tailwind classique (rapide, interactif, live)
2. **Export PDF** → pdf-lib (positionnement programmatique, bytes photos injectés sans décodage/ré-encodage)

Pourquoi : `window.print()` et les lib HTML→PDF (xhtml2pdf, wkhtmltopdf, etc.) **ré-encodent les images** à l'export, ce qui dégrade la qualité. Avec pdf-lib on injecte les bytes JPEG/PNG originaux tels quels dans le PDF → qualité identique à la source.

Chaque template a donc **deux implémentations** :
- `OmexomQHSE.tsx` → composant React pour le preview
- `omexom-qhse-pdf.ts` → fonction pdf-lib pour l'export

## Architecture fichiers

```
cardforge/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Page principale (upload → preview → export)
│   │   └── globals.css
│   ├── components/
│   │   ├── upload/
│   │   │   └── ExcelDropzone.tsx  # Drag & drop zone pour l'Excel
│   │   ├── preview/
│   │   │   ├── CardGrid.tsx       # Grid de preview avec checkboxes de sélection
│   │   │   └── CardPreview.tsx    # Preview individuelle d'une carte (wrapper)
│   │   ├── templates/
│   │   │   └── TemplatePicker.tsx  # Sélecteur visuel de template (thumbnails)
│   │   ├── quality/
│   │   │   └── QualityBadge.tsx   # Badge visuel 🔴🟠🟢 selon DPI photo
│   │   └── export/
│   │       └── ExportButton.tsx   # Bouton export PDF (individuels / batch A4)
│   ├── lib/
│   │   ├── parsers/
│   │   │   ├── types.ts           # Types partagés (ParsedPerson, ParsedExcel)
│   │   │   └── vinci-excel.ts     # Parser spécifique format VINCI
│   │   ├── templates/
│   │   │   ├── registry.ts        # Registry centralisé des templates
│   │   │   └── omexom-qhse/
│   │   │       ├── layout.ts            # Constantes positionnement (partagées React + pdf-lib)
│   │   │       ├── Front.tsx            # Preview React recto
│   │   │       ├── Back.tsx             # Preview React verso
│   │   │       ├── front-pdf.ts         # Export pdf-lib recto
│   │   │       ├── back-pdf.ts          # Export pdf-lib verso
│   │   │       └── thumbnail.png        # Thumbnail pour le picker
│   │   ├── quality/
│   │   │   └── photo-check.ts     # Calcul DPI réel + seuils qualité
│   │   └── renderer/
│   │       ├── pdf-export.ts      # Export PDF individuel via pdf-lib
│   │       └── batch-export.ts    # Export batch A4 (8 cartes/page) via pdf-lib
│   └── types/
│       └── index.ts               # Types globaux
├── public/
│   ├── logos/
│   │   └── omexom-white.png       # Logo Omexom blanc (pour le template Omexom)
│   └── fonts/
│       ├── NotoSans-Regular.ttf   # Font Unicode pour l'export PDF
│       └── NotoSans-Bold.ttf
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.ts
└── README.md
```

## Zones d'impression (gabarit imprimeur PVC)

Standard industrie pour carte PVC 86×54mm. Trois zones concentriques :

```
┌─────────────────────────────────────────────────────────┐ ← Fond perdu 90.3 × 58.3 mm
│  ┌──────────────────────────────────────────────────┐   │
│  │  ╭────────────────────────────────────────────╮   │   │ ← Coupe 86 × 54 mm (coins R=3mm)
│  │  │  ┌─────────────────────────────────────┐   │   │   │
│  │  │  │                                     │   │   │   │ ← Zone sécurité 80 × 48 mm
│  │  │  │   TOUT CONTENU IMPORTANT ICI        │   │   │   │
│  │  │  │                                     │   │   │   │
│  │  │  └─────────────────────────────────────┘   │   │   │
│  │  ╰────────────────────────────────────────────╯   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
     2mm          3mm
   ← fond perdu → ← marge sécurité →
```

**Implications pour les templates :**
- Le PDF d'export doit mesurer **90.3 × 58.3 mm** (fond perdu inclus)
- Les fonds colorés (header bleu, bandeau bas) doivent s'étendre jusqu'au fond perdu
- Texte, photos, QR, PIN doivent rester dans la **zone sécurité** (80 × 48 mm)
- Les coins de la carte sont arrondis (rayon ~3mm) — le preview React doit utiliser `rounded-lg`

**Constantes à ajouter dans `layout.ts` de chaque template :**
```typescript
export const PRINT_ZONES = {
  bleed:    { width: 90.3, height: 58.3 },  // fond perdu total
  trim:     { width: 86,   height: 54   },   // trait de coupe
  safe:     { width: 80,   height: 48   },   // zone sécurité
  bleed_mm: 2,      // fond perdu au-delà de la coupe
  safe_margin_mm: 3, // marge sécurité depuis la coupe
  corner_radius_mm: 3,
};
```

## Types de données

```typescript
// src/lib/parsers/types.ts

export interface ParsedPerson {
  id: string;              // index unique (sheet index)
  name: string;            // ex: "Bastien VIGNE"
  role: string;            // ex: "Chargé QHSE"
  pin: string;             // ex: "9P5EQL"
  slogan: string;          // ex: "LA SECURITE EST L'AFFAIRE DE TOUS !"
  photo: {
    dataUrl: string;               // blob URL pour preview React (léger)
    zipPath: string | null;        // "xl/media/image5.jpeg" (lazy-load pour export)
    overrideBuffer: Uint8Array | null;  // non-null si l'user a remplacé la photo
    format: 'jpeg' | 'png';
    width: number;
    height: number;
    sizeBytes: number;
    quality: PhotoQuality;         // analyse multi-critères
  };
  qrCode: {
    dataUrl: string;
    zipPath: string | null;
    overrideBuffer: Uint8Array | null;
    format: 'jpeg' | 'png';
  };
}

export interface ParsedExcel {
  filename: string;
  people: ParsedPerson[];
  parseDate: Date;
}
```

## Parser VINCI Excel

Le fichier Excel VINCI a cette structure (1 feuille par salarié) :

- **Cellule A7** → Nom complet (ex: "Bastien VIGNE")
- **Cellule A9** → Fonction (ex: "Chargé QHSE")
- **Cellule A12** → Code PIN (ex: "9P5EQL")
- **Cellule B11** → Slogan sécurité
- **Images ancrées** dans chaque feuille :
  - Photo salarié : ancre col ≤ 1, row ≤ 5
  - QR code : ancre col 2-3, row 3-9
  - Logo Omexom : ancre col 2-3, row 0-2 (ignoré)
  - Bandeau bas : ancre col 0, row ≥ 14 (ignoré)

### Stratégie de parsing : ExcelJS (texte) + JSZip (images)

**Pourquoi deux libs** : l'API `worksheet.getImages()` d'ExcelJS est buggée côté navigateur (problème connu depuis des années, images manquantes ou corrompues). Le parsing texte marche parfaitement par contre. Donc :

- **ExcelJS** : lit les cellules texte (A7, A9, A12, B11) par feuille
- **JSZip** : ouvre le .xlsx en tant que zip et extrait les bytes bruts des images depuis `xl/media/`

Un fichier .xlsx est un zip avec cette structure :
```
xl/
  media/
    image1.jpeg    ← bytes bruts des photos/QR (NOTRE SOURCE DE VÉRITÉ)
    image2.png
    ...
  worksheets/
    sheet1.xml     ← contenu cellules
    ...
  drawings/
    drawing1.xml   ← positionnement des images dans les feuilles
    _rels/
      drawing1.xml.rels  ← mapping imageId → fichier dans xl/media/
  worksheets/
    _rels/
      sheet1.xml.rels    ← mapping sheetId → drawingId
```

### Mapping images → feuilles

Pour savoir quelle image appartient à quelle feuille et à quelle position :

1. Lire `xl/worksheets/_rels/sheetN.xml.rels` → trouver le `drawingN.xml` lié à la feuille
2. Lire `xl/drawings/drawingN.xml` → trouver les ancres `<xdr:twoCellAnchor>` avec les positions (col, row) et l'ID image (`rId`)
3. Lire `xl/drawings/_rels/drawingN.xml.rels` → mapper `rId` → `../media/imageX.jpeg`
4. Classifier par position : col ≤ 1, row ≤ 5 = photo ; col 2-3, row 3-9 = QR

```typescript
// src/lib/parsers/vinci-excel.ts — logique simplifiée

async function parseVinciExcel(file: ArrayBuffer): Promise<ParsedExcel> {
  const zip = await JSZip.loadAsync(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file);
  
  // 1. Extraire TOUS les fichiers media d'un coup (bytes bruts)
  const mediaFiles = new Map<string, Uint8Array>();
  for (const [path, entry] of Object.entries(zip.files)) {
    if (path.startsWith('xl/media/')) {
      mediaFiles.set(path, new Uint8Array(await entry.async('arraybuffer')));
    }
  }
  
  // 2. Pour chaque feuille, lire texte (ExcelJS) + mapper images (JSZip XML)
  const people: ParsedPerson[] = [];
  for (const ws of wb.worksheets) {
    const person = {
      name: ws.getCell('A7').text,
      role: ws.getCell('A9').text,
      pin: ws.getCell('A12').text,
      // ... + mapper les images depuis le XML de drawings
    };
    people.push(person);
  }
  
  return { filename: '...', people, parseDate: new Date() };
}
```

## ⚠️ Pipeline qualité image — RÈGLES CRITIQUES

Ce document définit les règles **inviolables** pour garantir zéro dégradation des photos entre l'Excel source et le PDF final. Tout développeur travaillant sur ce projet DOIT respecter ces règles.

### Principe fondamental

**Les bytes d'une image ne doivent JAMAIS être décodés puis ré-encodés dans le pipeline principal (Excel → PDF).** Les bytes passent du zip Excel au PDF tels quels, comme un transfert de fichier.

### Le pipeline garanti

```
EXCEL (.xlsx = zip)
  │
  ├─ xl/media/image5.jpeg ──────── bytes bruts JPEG (SOURCE DE VÉRITÉ)
  │                                     │
  │   [JSZip.loadAsync → entry.async('arraybuffer')]
  │                                     │
  │                              Uint8Array ◄── ON NE TOUCHE PLUS À ÇA
  │                                     │
  │                         ┌───────────┴───────────┐
  │                         │                       │
  │                    PREVIEW                   EXPORT PDF
  │                         │                       │
  │              URL.createObjectURL()      pdf.embedJpg(buffer)
  │                         │               pdf.embedPng(buffer)
  │                         │                       │
  │                   <img src={url}>        page.drawImage(img)
  │                         │                       │
  │                     ÉCRAN                    FICHIER PDF
  │                  (affichage)             (impression)
  │
  └─ AUCUN canvas, AUCUN Pillow, AUCUN re-encode sur ce chemin
```

### Ce qui est INTERDIT sur le chemin principal

❌ `canvas.toBlob()` ou `canvas.toDataURL()` sur une photo pour l'export
❌ `createImageBitmap()` → `drawImage()` → `getImageData()` → re-encode pour l'export
❌ Resize/thumbnail de la photo avant injection dans le PDF
❌ Conversion de format (JPEG→PNG ou PNG→JPEG) pour l'export
❌ Passage par une lib de traitement d'image (sharp, jimp, Pillow) sur le chemin d'export
❌ `new Blob([buffer], {type})` puis re-lecture — utiliser le buffer original directement

### Ce qui est AUTORISÉ

✅ `URL.createObjectURL(new Blob([buffer]))` pour le preview écran (affichage seulement, pas d'export)
✅ Canvas pour l'**analyse qualité** uniquement (blur, luminosité, contraste) — ces calculs ne touchent pas au buffer d'export
✅ Canvas pour le **crop photo** quand l'utilisateur drop une nouvelle photo — le crop produit un NOUVEAU buffer qui devient la nouvelle source de vérité
✅ `pdf.embedJpg(buffer)` / `pdf.embedPng(buffer)` — pdf-lib injecte les bytes tels quels dans le flux PDF

### Cas du remplacement de photo (drag & drop)

Quand l'utilisateur drop une nouvelle photo sur une carte :

```
NOUVELLE PHOTO (fichier du user)
  │
  [FileReader.readAsArrayBuffer()]
  │
  Uint8Array ◄── NOUVEAU buffer = NOUVELLE source de vérité
  │
  ├─ Si crop nécessaire (ratio incompatible) :
  │    │
  │    canvas.drawImage() → canvas.toBlob('image/jpeg', 0.95)
  │    │
  │    Nouveau Uint8Array ◄── Ce blob croppé DEVIENT la source de vérité
  │    │                      (le crop est une action utilisateur volontaire,
  │    │                       pas une dégradation silencieuse du pipeline)
  │
  ├─ Stocké dans person.photo.buffer (remplace l'ancien)
  ├─ Preview via URL.createObjectURL()
  └─ Export via pdf.embedJpg(buffer)
```

**Règle du crop** : si un crop est appliqué, le re-encode en JPEG qualité **0.95** (quasi lossless). Le user a choisi de cropper → il accepte un re-encode minimal. Mais le pipeline ne fait JAMAIS ça de lui-même sans action explicite du user.

### Cas de la photo CMYK

Rare mais possible si un graphiste drop une photo CMYK. pdf-lib `embedJpg()` crashera silencieusement.

**Détection** : lire les 2 premiers bytes du JPEG. Si le marqueur SOF contient `numComponents = 4` → CMYK.
**Fix** : convertir en RGB via canvas (c'est le seul cas où le pipeline touche aux pixels sans action user). Logger un warning dans la console.

```typescript
function isCMYK(buffer: Uint8Array): boolean {
  // Parser le header JPEG pour trouver le marqueur SOF0/SOF2
  // et vérifier si numComponents === 4
  // ... (implémentation détaillée dans le code)
}
```

### Gestion mémoire — lazy loading des buffers

Pour 200+ salariés, garder tous les buffers photo en mémoire = 100-200MB → crash potentiel.

**Stratégie** :
- **Au parsing** : extraire seulement les **dataUrls** (via `URL.createObjectURL`) pour le preview. Stocker les **chemins** vers les images dans le zip (ex: `xl/media/image5.jpeg`), pas les buffers.
- **L'objet JSZip reste en mémoire** (~10MB pour un Excel de 43 personnes) — il sert de source pour les buffers.
- **À l'export** : charger les buffers **à la volée** depuis le JSZip, un par un, au moment de `pdf.embedJpg()`. Pas de chargement batch.
- **Exception** : les photos remplacées par l'utilisateur (drag & drop) → leur buffer est gardé en mémoire car il n'existe pas dans le zip original.

```typescript
export interface ParsedPerson {
  // ...
  photo: {
    dataUrl: string;           // pour le preview React (léger, blob URL)
    zipPath: string | null;    // "xl/media/image5.jpeg" (pour lazy-load depuis le zip)
    overrideBuffer: Uint8Array | null;  // non-null seulement si l'user a remplacé la photo
    format: 'jpeg' | 'png';
    width: number;
    height: number;
    sizeBytes: number;
    quality: PhotoQuality;
  };
}

// Au moment de l'export, récupérer le buffer de la bonne source
async function getPhotoBuffer(person: ParsedPerson, zip: JSZip): Promise<Uint8Array> {
  if (person.photo.overrideBuffer) {
    return person.photo.overrideBuffer;  // photo remplacée par l'user
  }
  // Lazy-load depuis le zip original
  const entry = zip.file(person.photo.zipPath!);
  return new Uint8Array(await entry!.async('arraybuffer'));
}
```

### Vérification qualité pipeline (pour les devs)

Pour s'assurer que le pipeline ne dégrade rien, implémenter un **test de vérification** :

```typescript
// En dev uniquement : vérifier que les bytes dans le PDF sont identiques à la source
async function verifyPdfIntegrity(pdfBytes: Uint8Array, sourceBuffers: Map<string, Uint8Array>) {
  // Extraire les images du PDF généré
  // Comparer hash MD5 avec les buffers source
  // Si mismatch → ERREUR, le pipeline a dégradé quelque chose
}
```

### Évaluation qualité photo (multi-critères, 100% client-side)

Au-delà du simple DPI, l'outil analyse chaque photo sur **6 critères** via un canvas invisible. Ça prend ~5ms par photo, transparent pour l'utilisateur.

```typescript
// src/lib/quality/photo-check.ts

export interface PhotoQuality {
  score: number;          // 0-100, note globale
  grade: 'good' | 'warning' | 'critical';
  checks: {
    dpi:         { value: number; pass: boolean; label: string };
    blur:        { value: number; pass: boolean; label: string };
    brightness:  { value: number; pass: boolean; label: string };
    contrast:    { value: number; pass: boolean; label: string };
    compression: { value: number; pass: boolean; label: string };
    ratio:       { value: number; pass: boolean; label: string };
  };
}

export function analyzePhoto(
  buffer: Uint8Array,
  width: number,
  height: number,
  sizeBytes: number,
  targetMM: number = 40,
  targetRatio: number = 1.0  // ratio cible du cadre photo dans le template
): PhotoQuality {
  
  // 1. DPI — résolution à la taille d'impression
  const dpi = Math.round(width / (targetMM / 25.4));
  const dpiPass = dpi >= 250;
  
  // 2. FLOU — variance du Laplacien (plus c'est haut, plus c'est net)
  //    ATTENTION : ne calculer que si l'image fait au moins 200×200 px.
  //    En dessous, trop peu de pixels pour un résultat fiable.
  //    Seuil : < 100 = flou, 100-300 = OK, > 300 = net
  const blurScore = (width >= 200 && height >= 200) 
    ? computeLaplacianVariance(buffer, width, height) 
    : null;  // null = check non applicable, pas compté dans le score
  const blurPass = blurScore === null ? true : blurScore >= 100;
  
  // 3. LUMINOSITÉ — moyenne des pixels en luminance (0-255)
  //    Trop sombre (< 60) = mal exposé, trop clair (> 220) = cramé
  const brightness = computeAverageLuminance(buffer, width, height);
  const brightnessPass = brightness >= 60 && brightness <= 220;
  
  // 4. CONTRASTE — écart-type de la luminance
  //    < 30 = image plate/voilée, > 30 = OK
  const contrast = computeLuminanceStdDev(buffer, width, height);
  const contrastPass = contrast >= 30;
  
  // 5. COMPRESSION — bytes par pixel
  //    < 0.1 = JPEG surcompressé (artefacts visibles)
  //    0.1-0.3 = compressé, 0.3+ = bonne qualité
  const bpp = sizeBytes / (width * height);
  const compressionPass = bpp >= 0.08;
  
  // 6. RATIO — compatibilité avec le cadre du template
  //    Tolérance ±30% par rapport au ratio cible
  const actualRatio = width / height;
  const ratioDiff = Math.abs(actualRatio - targetRatio) / targetRatio;
  const ratioPass = ratioDiff <= 0.3;
  
  // Score global (pondéré)
  const weights = { dpi: 30, blur: 25, brightness: 10, contrast: 10, compression: 15, ratio: 10 };
  const checks = { dpi: dpiPass, blur: blurPass, brightness: brightnessPass, 
                   contrast: contrastPass, compression: compressionPass, ratio: ratioPass };
  const score = Object.entries(weights).reduce((sum, [key, w]) => 
    sum + (checks[key as keyof typeof checks] ? w : 0), 0);
  
  const grade = score >= 75 ? 'good' : score >= 45 ? 'warning' : 'critical';
  
  return { score, grade, checks: { /* ... détails par check */ } };
}
```

**Implémentation du détecteur de flou (Laplacien) :**

```typescript
function computeLaplacianVariance(buffer: Uint8Array, w: number, h: number): number {
  // Créer un canvas (avec fallback si OffscreenCanvas pas dispo — Safari < 16.4)
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  try {
    canvas = new OffscreenCanvas(w, h);
  } catch {
    // Fallback : canvas DOM caché (pour Safari/anciens navigateurs)
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d')!;
  // Dessiner l'image depuis le buffer
  // ... (via createImageBitmap ou blob)
  const imageData = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  
  // Convertir en grayscale
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * imageData.data[i*4] + 0.587 * imageData.data[i*4+1] + 0.114 * imageData.data[i*4+2];
  }
  
  // Appliquer le Laplacien 3×3 : [[0,1,0],[1,-4,1],[0,1,0]]
  let sum = 0, sumSq = 0, count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap = -4 * gray[y*w+x] + gray[(y-1)*w+x] + gray[(y+1)*w+x] + gray[y*w+x-1] + gray[y*w+x+1];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return (sumSq / count) - (mean * mean);  // variance
}
```

**Affichage dans l'UI :**

Le badge qualité sur chaque carte affiche le **score global** (0-100) avec couleur :
- 🟢 75-100 → "Prête à imprimer"
- 🟠 45-74 → hover pour voir quel check échoue
- 🔴 0-44 → hover pour voir les problèmes

Au hover/clic, tooltip détaillé :
```
Photo 800×800 — Score 62/100
✅ Résolution : 510 DPI
❌ Netteté : floue (score 45, seuil 100)
✅ Luminosité : OK (128)
✅ Contraste : OK (67)
✅ Compression : bonne (0.27 bpp)
✅ Ratio : compatible
```

Ça permet à l'utilisateur de savoir **exactement pourquoi** une photo est flaggée et **quoi corriger** (refaire la photo, augmenter l'éclairage, envoyer une version non compressée, etc.).

## Système de Templates

### Concept

Un template = le **design complet** de la carte. Tout est dedans : layout, couleurs, logo, slogan, positionnement des éléments, face recto ET verso. Les données variables (nom, fonction, PIN, photo, QR) sont injectées dans le template.

Quand l'utilisateur change de template, TOUT le visuel change (palette, typo, disposition, slogan, verso). Le template est le produit.

### Registry

```typescript
// src/lib/templates/registry.ts

export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;               // preview recto pour le picker
  
  // Preview écran (React)
  front: React.ComponentType<CardTemplateProps>;   // RECTO
  back?: React.ComponentType<CardTemplateProps>;    // VERSO (optionnel)
  
  // Export PDF (pdf-lib)
  renderFrontPdf: RenderPdfFn;
  renderBackPdf?: RenderPdfFn;     // si défini, le PDF alterne recto/verso
  
  // Dimensions d'impression (avec fond perdu)
  width_mm: number;    // 90.3 (fond perdu inclus)
  height_mm: number;   // 58.3
  
  // Assets propres au template (logo, images déco...)
  assets: string[];    // chemins vers public/templates/{id}/
}

type RenderPdfFn = (
  page: PDFPage,
  person: ParsedPerson,
  assets: PdfAssets,
  offset?: { x: number; y: number }
) => Promise<void>;

export interface CardTemplateProps {
  person: ParsedPerson;
  side: 'front' | 'back';
}

export interface PdfAssets {
  templateImages: Map<string, PDFImage>;  // images propres au template (logo, etc.)
  font: PDFFont;         // Noto Sans Regular (Unicode, chargé depuis public/fonts/)
  fontBold: PDFFont;     // Noto Sans Bold
}

// Registry — built-in templates
export const TEMPLATES: CardTemplate[] = [
  // ... templates enregistrés ici
];
```

### Structure fichiers d'un template

```
src/lib/templates/omexom-qhse/
├── layout.ts              # Constantes positionnement (partagées React + pdf-lib)
├── Front.tsx              # Composant React recto
├── Back.tsx               # Composant React verso
├── front-pdf.ts           # Rendu pdf-lib recto
├── back-pdf.ts            # Rendu pdf-lib verso
├── thumbnail.png          # Preview pour le template picker
└── assets/
    └── omexom-white.png   # Logo blanc (propre à ce template)
```

Pour ajouter un template : créer un dossier, implémenter les composants, enregistrer dans le registry. Le reste du pipeline (parser, preview, export) s'en fout.

### Convention de rendu

**Preview React** (Front.tsx / Back.tsx) :
- `div` racine : `w-[86mm] h-[54mm]` avec `rounded-[3mm]` et `overflow-hidden`
- Utiliser `person.photo.dataUrl` pour les `<img src>`
- Tout le style en Tailwind, composant autonome

**Export pdf-lib** (front-pdf.ts / back-pdf.ts) :
- Dessiner sur la page aux dimensions fond perdu (90.3 × 58.3 mm)
- **Photos : bytes bruts injectés via `pdf.embedJpg(person.photo.buffer)`** — ZÉRO recompression
- Constantes de positionnement importées depuis `layout.ts`

### Template Omexom QHSE (premier template)

**RECTO** — design basé sur les cartes existantes :

```
┌──────────────────────────────────────────────────────┐
│ [LOGO OMEXOM blanc] │ NOM PRÉNOM (bold, blanc)       │ ← header bleu foncé #0F4070
│                     │ Fonction (light, gris clair)    │   séparateur fin #3B8FD4
├──────────────────────────────────────────────────────┤
│                     │                                 │
│   ┌───────────┐     │     ┌─────────┐                │ ← fond blanc
│   │  PHOTO    │     │     │ QR CODE │                │
│   │           │     │     └─────────┘                │
│   └───────────┘     │      Code PIN                   │
│                     │    ┌──────────┐                │
│                     │    │  PIN     │                │
│         LA SÉCURITÉ EST L'AFFAIRE DE TOUS !          │ ← slogan hardcodé dans le template
├──────────────────────────────────────────────────────┤
│████████████████████████│██████████│█████│             │ ← bandeau tricolore
└──────────────────────────────────────────────────────┘
```

**VERSO** — simple, sobre :

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                                                      │ ← fond bleu foncé #0F4070 uni
│              [LOGO OMEXOM blanc centré]               │
│                                                      │
│              www.omexom.com                           │ ← URL en blanc
│                                                      │
├──────────────────────────────────────────────────────┤
│████████████████████████│██████████│█████│             │ ← même bandeau tricolore
└──────────────────────────────────────────────────────┘
```

Palette Omexom :
- Bleu foncé : `#0F4070`
- Bleu principal : `#1E6FB7`
- Séparateur : `#3B8FD4`
- Cyan : `#27A8C7`
- Jaune/or : `#F6B21A`
- Gris clair (box PIN) : `#F5F7FA`
- Gris texte : `#55657A`
- Bordure : `#D9DEE5`

## UI — Page principale

### Layout global

```
┌─────────────────────────────────────────────────────────┐
│  STICKY BAR                                             │
│  43 cartes | 35 sélectionnées | 5 ⚠️ | 2 ❌  [Export ▼] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [1] UPLOAD — drag & drop .xlsx                         │
│                                                         │
│  [2] TEMPLATE — picker recto/verso                      │
│                                                         │
│  [3] PREVIEW GRID                                       │
│      🔍 Recherche    [Tri: A-Z | Qualité | Défaut]     │
│      ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                         │
│      │  │ │  │ │  │ │  │ │  │  ...                     │
│      └──┘ └──┘ └──┘ └──┘ └──┘                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Étape 1 — Upload
- Zone drag & drop (ou clic pour browse)
- Accepte `.xlsx` uniquement
- Affiche le nom du fichier + nombre de salariés détectés après parse
- Loading state pendant le parsing
- **Gestion d'erreurs** :
  - Feuille sans photo → carte générée avec placeholder gris + icône "photo manquante"
  - Cellule nom/fonction vide → texte "—" + badge "données incomplètes"
  - Fichier non-VINCI → message clair avec le format attendu

### Étape 2 — Template picker
- Grille de thumbnails des templates dispo
- Chaque thumbnail montre le **recto** de la carte
- Sélection par clic (bordure active)
- Indicateur si le template a un verso

### Étape 3 — Preview + Édition + Export

#### Barre de recherche + tri (au-dessus de la grid)
- Input search : filtre par nom en temps réel
- Boutons tri : alphabétique | qualité photo (pires d'abord) | défaut (ordre Excel)
- Clic sur les compteurs ⚠️/❌ du sticky bar → filtre direct les cas problématiques

#### Grid de cartes
- Toutes les cartes rendues avec le template choisi
- Chaque carte a une **checkbox** de sélection (cochée par défaut)
- **Badge qualité** sur chaque carte (coin supérieur droit) : 🟢 / 🟠 / 🔴
- Hover badge → tooltip "Photo 800×800, 510 DPI ✅"
- **Toggle recto/verso** : un bouton global ou hover pour flipper et voir le verso

#### Preview fullscreen
- Clic sur une carte → modal plein écran, carte taille réelle (ou 2x)
- Toggle recto ↔ verso dans la modal
- Navigation ← → entre les cartes
- Édition inline active aussi dans la modal

#### Édition inline des données

Chaque carte dans la preview est **éditable** :

- **Photo** : drag & drop sur la photo OU clic → file picker
  - Remplacement immédiat dans le preview
  - Badge qualité mis à jour en temps réel
  - **Crop basique** : si le ratio de la photo droppée est trop différent du cadre cible, afficher une modal de crop simple (cadre draggable). Lib légère type `react-easy-crop` (~15KB) ou crop maison en canvas.

- **Nom / Fonction / PIN** : clic sur le texte → input inline
  - Enter ou blur → valide
  - Escape → annule

```typescript
const [people, setPeople] = useState<ParsedPerson[]>([]);

function replacePhoto(personId: string, file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const buffer = new Uint8Array(reader.result as ArrayBuffer);
    const dataUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const quality = analyzePhoto(buffer, img.width, img.height, file.size);
      const format = file.type === 'image/png' ? 'png' : 'jpeg';
      setPeople(prev => prev.map(p => 
        p.id === personId 
          ? { ...p, photo: { 
              ...p.photo, 
              dataUrl,
              overrideBuffer: buffer,  // cette photo n'est plus dans le zip → garder en mémoire
              zipPath: null,           // invalider le chemin zip
              format,
              width: img.width, 
              height: img.height, 
              sizeBytes: file.size, 
              quality 
            }}
          : p
      ));
    };
    img.src = dataUrl;
  };
  reader.readAsArrayBuffer(file);
}

function updateField(personId: string, field: 'name' | 'role' | 'pin', value: string) {
  setPeople(prev => prev.map(p => p.id === personId ? { ...p, [field]: value } : p));
}
```

#### Résumé sticky (toujours visible en haut)
- `"{n} cartes | {selected} sélectionnées | {warnings} ⚠️ | {critical} ❌"`
- Cliquable : clic sur "❌" → filtre les critiques uniquement
- Boutons "Tout sélectionner" / "Tout désélectionner"

#### Boutons export
- "Exporter PDF individuels" → PDF multi-pages (recto page 1, verso page 2, recto page 3...), download `Cartes_{template}_{Nselected}sur{Ntotal}_{date}.pdf`
- "Exporter PDF batch A4" → 8 cartes/page A4 (recto uniquement, ou option recto + verso sur pages alternées), download `Batch_A4_{template}_{Nselected}sur{Ntotal}_{date}.pdf`

### Export PDF — pdf-lib (zéro perte qualité photo)

L'export utilise **pdf-lib** côté client. Les bytes des photos sont injectés directement dans le PDF sans décodage/ré-encodage.

```typescript
// src/lib/renderer/pdf-export.ts
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';  // nécessaire pour les fonts custom

const MM_TO_PT = 2.83465;  // 1mm = 2.83465 points PDF
// Dimensions AVEC fond perdu (ce que l'imprimeur attend)
const CARD_W = 90.3 * MM_TO_PT;  // fond perdu inclus
const CARD_H = 58.3 * MM_TO_PT;
const BLEED = 2 * MM_TO_PT;      // 2mm de fond perdu de chaque côté

export async function exportCardPdf(
  people: ParsedPerson[],
  template: CardTemplate,
  zip: JSZip,           // le zip Excel original (pour lazy-load des photos)
  logoBytes: Uint8Array
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  
  // Enregistrer fontkit pour supporter les fonts .ttf custom
  pdf.registerFontkit(fontkit);
  
  // Charger les fonts Unicode (une seule fois pour tout le batch)
  const fontRegularBytes = await fetch('/fonts/NotoSans-Regular.ttf').then(r => r.arrayBuffer());
  const fontBoldBytes = await fetch('/fonts/NotoSans-Bold.ttf').then(r => r.arrayBuffer());
  
  const assets: PdfAssets = {
    templateImages: new Map([['logo', await pdf.embedPng(logoBytes)]]),
    font: await pdf.embedFont(fontRegularBytes),
    fontBold: await pdf.embedFont(fontBoldBytes),
  };
  
  for (const person of people) {
    // RECTO
    const frontPage = pdf.addPage([CARD_W, CARD_H]);
    
    // Lazy-load du buffer photo depuis le zip (ou override si l'user a remplacé)
    const photoBuffer = await getPhotoBuffer(person, zip);
    const photoImage = person.photo.format === 'jpeg'
      ? await pdf.embedJpg(photoBuffer)   // bytes bruts injectés tels quels
      : await pdf.embedPng(photoBuffer);
    
    await template.renderFrontPdf(frontPage, person, assets, photoImage);
    
    // VERSO (si le template en a un)
    if (template.renderBackPdf) {
      const backPage = pdf.addPage([CARD_W, CARD_H]);
      await template.renderBackPdf(backPage, person, assets);
    }
  }
  
  return await pdf.save();
}
```

```typescript
// src/lib/renderer/batch-export.ts
// Export batch A4 : 8 cartes par page (2 colonnes × 4 rangées)

export async function exportBatchA4(
  people: ParsedPerson[],
  template: CardTemplate,
  logoBytes: Uint8Array
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const A4_W = 210 * MM_TO_PT;
  const A4_H = 297 * MM_TO_PT;
  const MARGIN = 10 * MM_TO_PT;
  const GAP = 3 * MM_TO_PT;
  const COLS = 2;
  const ROWS = 4;
  const CARDS_PER_PAGE = COLS * ROWS;

  const assets = { /* charger fonts + logo une seule fois */ };
  
  for (let i = 0; i < people.length; i += CARDS_PER_PAGE) {
    const page = pdf.addPage([A4_W, A4_H]);
    const batch = people.slice(i, i + CARDS_PER_PAGE);
    
    for (let j = 0; j < batch.length; j++) {
      const col = j % COLS;
      const row = Math.floor(j / COLS);
      const x = MARGIN + col * (CARD_W + GAP);
      const y = A4_H - MARGIN - (row + 1) * (CARD_H + GAP) + GAP;
      
      // Dessiner la carte à la position (x, y) sur la page A4
      // pdf-lib permet de translater le contexte de dessin
      await template.renderPdf(page, batch[j], assets, { x, y });
    }
  }
  
  return await pdf.save();
}
```

**Boutons export dans l'UI :**
- "Exporter PDF individuels" → génère un PDF multi-pages (1 carte par page CR80), download direct
- "Exporter PDF batch A4" → génère un PDF multi-pages A4 avec 8 cartes/page, download direct

Le download se fait via `URL.createObjectURL(new Blob([pdfBytes]))` + un lien `<a>` temporaire.

## Design UI (hors cartes)

Style sobre, utilitaire, pas de fioritures. L'UI est un OUTIL, pas un portfolio.

- **Background** : `#F8FAFC` (gris très clair)
- **Cards UI** (les containers, pas les cartes imprimables) : blanc, border `#E2E8F0`, radius 8px, shadow-sm
- **Accent** : bleu Omexom `#1E6FB7` pour les boutons/actions
- **Typo** : system font stack (pas besoin de charger des fonts custom pour l'UI)
- **Icônes** : Lucide React (`Upload`, `Printer`, `Check`, `AlertTriangle`, `X`)

## Priorités de développement

1. **Setup projet** : Next.js + Tailwind + structure fichiers + deps (exceljs, pdf-lib, lucide)
2. **Parser VINCI** : lecture Excel + extraction images (dataUrl + buffer brut) + calcul qualité
3. **Template Omexom QHSE — preview React** : composant écran fidèle au design existant
4. **Template Omexom QHSE — export pdf-lib** : rendu PDF avec bytes photos non recompressés
5. **Constantes layout partagées** : fichier `layout.ts` utilisé par React et pdf-lib
6. **Registry templates** : système pour lister/sélectionner les templates
7. **UI upload + preview** : drag & drop → grid de cartes avec badges qualité
8. **Export** : boutons download PDF (individuels multi-pages + batch A4)
9. **Sélection** : checkboxes sur les cartes, tout sélectionner/désélectionner

## Notes techniques

- **ExcelJS** : utilisé uniquement pour le parsing texte (`getCell().text`). Fiable côté navigateur pour ça.
- **JSZip** : utilisé pour l'extraction images et le lazy-loading des buffers. L'objet JSZip reste en mémoire pendant toute la session (~10MB pour un Excel typique). Les buffers photo sont lus à la volée à l'export, pas tous chargés d'un coup.
- **pdf-lib + fontkit** : fontkit nécessaire pour embedder les .ttf custom (Noto Sans). Sans fontkit, pdf-lib ne supporte que les 14 StandardFonts (Latin-1 seulement → caractères spéciaux manquants).
- **Noto Sans** : choisie car elle couvre Latin, Arabe, Cyrillique, Turc — couvre les noms BTP France. Télécharger Regular + Bold depuis Google Fonts, placer dans `public/fonts/`.
- **Images CMYK** : détecter via parsing header JPEG (SOF marker, numComponents=4). Si CMYK détecté → convertir en RGB via canvas + warning console. C'est le seul cas où le pipeline touche aux pixels sans action user.
- **Mémoire** : pour 200+ salariés, ne PAS charger tous les buffers photo en mémoire. Garder les blob URLs (preview) + les zipPaths (lazy-load). Seules les photos remplacées par l'user (drag & drop) ont leur buffer en mémoire (`overrideBuffer`).
- **Compat navigateurs** : OffscreenCanvas non dispo sur Safari < 16.4. Fallback sur canvas DOM caché pour l'analyse qualité. Le reste (JSZip, pdf-lib, ExcelJS) est compatible tous navigateurs modernes.
- **Pas de state management lourd** : React useState/useReducer suffit. L'objet JSZip est passé via un contexte React ou un ref.
- **Pas d'auth, pas de DB, pas d'API** : tout est client-side, stateless.

## Dépendances

```json
{
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "exceljs": "^4.4.0",
    "jszip": "^3.10.1",
    "pdf-lib": "^1.17.1",
    "@pdf-lib/fontkit": "^1.1.1",
    "react-easy-crop": "^5.1.0",
    "lucide-react": "^0.468.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0"
  }
}
```

**Font Unicode** : télécharger Noto Sans Regular + Bold (.ttf) depuis Google Fonts et les placer dans `public/fonts/`. Chargés au moment de l'export via `fetch('/fonts/NotoSans-Regular.ttf')` puis `pdf.embedFont(fontBytes)`. Poids : ~200KB par style, chargé une seule fois par session d'export.

## Plan d'exécution pour Claude Code

⚠️ **NE PAS TOUT IMPLÉMENTER D'UN COUP.** Suivre les phases ci-dessous dans l'ordre. Chaque phase doit être fonctionnelle et testable avant de passer à la suivante.

### Phase 1 — "Ça marche" (parser + preview + export basique)

**Objectif** : upload un Excel VINCI → voir les cartes → télécharger un PDF propre.

1. Setup projet Next.js + Tailwind + deps
2. Parser VINCI : ExcelJS (texte) + JSZip (images via `xl/media/` + XML drawings)
3. Template Omexom QHSE **recto seulement** : composant React `Front.tsx` + `front-pdf.ts`
4. UI minimale : dropzone → grid de cartes en preview → bouton export PDF
5. Export pdf-lib avec font Noto Sans + bytes photos injectés tels quels
6. Vérifier : ouvrir le PDF, zoomer sur une photo, confirmer qu'elle est nette (pas de recompression)

**Ne PAS faire en phase 1** : verso, qualité photo, édition inline, crop, recherche, fullscreen, batch A4.

### Phase 2 — "C'est utilisable" (UX + qualité)

1. Analyse qualité photo multi-critères (DPI, blur, luminosité, contraste, compression, ratio)
2. Badges qualité sur chaque carte (🟢🟠🔴) + tooltip détaillé
3. Sticky bar compteurs
4. Recherche par nom + tri (alphabétique / qualité / défaut)
5. Checkboxes de sélection + tout sélectionner/désélectionner
6. Export batch A4 (8 cartes/page)
7. Gestion erreurs parsing (photo manquante → placeholder, fichier non-VINCI → message)

### Phase 3 — "C'est pro" (édition + verso + polish)

1. Template verso `Back.tsx` + `back-pdf.ts`
2. Toggle recto/verso dans la preview
3. Export PDF recto-verso (pages alternées)
4. Édition inline texte (nom, fonction, PIN)
5. Drag & drop remplacement photo + crop basique (`react-easy-crop`)
6. Preview fullscreen avec navigation ← →
7. Lazy loading buffers (zipPath + overrideBuffer) pour gestion mémoire 200+ personnes

## Points d'attention techniques

### 1. Blob URL memory leak
Chaque `URL.createObjectURL()` crée un blob en mémoire qui persiste jusqu'à `revokeObjectURL()`. Pour 43+ photos :
```typescript
// À l'upload d'un nouveau fichier ou au démontage du composant
useEffect(() => {
  return () => {
    people.forEach(p => {
      if (p.photo.dataUrl.startsWith('blob:')) URL.revokeObjectURL(p.photo.dataUrl);
      if (p.qrCode.dataUrl.startsWith('blob:')) URL.revokeObjectURL(p.qrCode.dataUrl);
    });
  };
}, [people]);
```

### 2. Dual rendering = double maintenance
Le preview React et l'export pdf-lib doivent être visuellement identiques. Le fichier `layout.ts` partage les constantes (positions, tailles en mm) mais les deux implémentations peuvent dériver silencieusement. **Règle : modifier `layout.ts`, jamais hardcoder une position dans un seul des deux renderers.**

### 3. Noms longs dans pdf-lib
pdf-lib ne fait pas de text wrapping. Si un nom dépasse la largeur dispo (ex: "DAGNIEUX-KERMARC Charles-Alexandre"), il déborde. Implémenter un helper :
```typescript
function fitText(text: string, font: PDFFont, maxWidth: number, startSize: number): { text: string; size: number } {
  let size = startSize;
  while (font.widthOfTextAtSize(text, size) > maxWidth && size > 6) {
    size -= 0.5;
  }
  return { text, size };
}
```

### 4. Analyse qualité photo = async
Le blur check nécessite de créer un `<img>`, attendre son `onload`, dessiner sur canvas, analyser. C'est asynchrone. Ne pas bloquer le parsing initial — afficher les cartes d'abord avec `quality: null` (badge gris "analyse..."), puis mettre à jour au fur et à mesure que les analyses terminent.
```typescript
// Parsing initial : rapide, sans analyse qualité
const people = parseExcel(file);  // texte + images, pas de canvas
setPeople(people);

// Puis en background : analyse qualité progressive
for (const person of people) {
  const quality = await analyzePhoto(person.photo);
  setPeople(prev => prev.map(p => 
    p.id === person.id ? { ...p, photo: { ...p.photo, quality } } : p
  ));
}
```

## Ce qui est HORS SCOPE (toutes phases)

- Éditeur de template visuel (drag & drop de zones sur la carte)
- IA parsing / auto-mapping colonnes Excel
- White-label / multi-tenant / portail imprimeur
- Auth / comptes utilisateurs
- Stockage cloud / base de données
- Upscale IA des photos (Real-ESRGAN)
- Export PNG/ZIP des cartes individuelles
- Sauvegarde des modifications dans l'Excel source (les édits inline sont en mémoire seulement)
