# CardForge — Spec v7

## TL;DR

Outil web **perso** (un seul utilisateur : Bastou) qui transforme un export Excel VINCI en PDF de cartes prêtes à imprimer.

**Pipeline : Excel VINCI → dossier de personnes en IndexedDB → rendu via template HTML custom → PDF via `window.print()`.**

100% client-side. Self-host en static sur VPS Hetzner. Aucun asset embarqué, aucune marque codée en dur — le design de la carte vit entièrement dans le HTML du template que l'utilisateur écrit.

**Principe central : zéro dégradation des photos**. Les bytes extraits de l'Excel traversent toute l'app (storage, affichage, export) sans jamais être ré-encodés. Le canvas est utilisé uniquement en lecture pour l'analyse qualité.

---

## Stack

```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "exceljs": "^4.4",
    "jszip": "^3.10",
    "idb": "^8",
    "lucide-react": "^0.468",
    "clsx": "^2.1"
  },
  "devDependencies": {
    "vite": "^6",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5.6",
    "tailwindcss": "^3.4",
    "autoprefixer": "^10",
    "postcss": "^8"
  }
}
```

**Pas** de Next.js (surpoids pour un outil 1-page static). **Pas** de pdf-lib (Chrome print suffit). **Pas** de react-easy-crop en phase 1 (crop pas nécessaire, remplacement direct). **Pas** de fichiers de fonts bundle (stack système OU le template importe ses fonts).

Build : `vite build` → dossier `dist/` statique à servir sur VPS.

---

## Architecture fichiers

```
cardforge/
├── src/
│   ├── main.tsx
│   ├── App.tsx                      # Router simple (folder selector → import → édition)
│   ├── index.css                    # Tailwind
│   ├── components/
│   │   ├── Home.tsx                 # Écran d'accueil (liste dossiers + import)
│   │   ├── Header.tsx               # Sticky bar : switcher dossier + onglets + template + export
│   │   ├── ImportFlow.tsx           # Dropzone + progression + résumé
│   │   ├── photos/
│   │   │   ├── PhotosTab.tsx        # Liste triée par qualité
│   │   │   ├── PhotoRow.tsx         # Ligne personne (étendue si 🔴🟠, compacte si 🟢)
│   │   │   └── PhotoLightbox.tsx    # Agrandissement photo
│   │   ├── cards/
│   │   │   ├── CardsTab.tsx         # Grid + toggle recto/verso + sélection
│   │   │   └── Card.tsx             # Rendu d'une carte en Shadow DOM
│   │   ├── templates/
│   │   │   └── TemplatePanel.tsx    # Panneau latéral : picker + éditeur + preview
│   │   └── export/
│   │       └── ExportDropdown.tsx   # Menu export + guide inline
│   ├── lib/
│   │   ├── parser/
│   │   │   └── vinci.ts             # ExcelJS + JSZip → ParsedPerson[]
│   │   ├── db/
│   │   │   ├── schema.ts            # Types IndexedDB
│   │   │   └── folders.ts           # CRUD dossiers + templates
│   │   ├── template/
│   │   │   ├── render.ts            # Injection placeholders dans HTML
│   │   │   └── placeholders.ts      # Liste des placeholders dispo
│   │   ├── quality/
│   │   │   ├── analyze.ts           # Interface worker
│   │   │   └── worker.ts            # Web Worker : calcul 3 checks
│   │   └── export/
│   │       └── print.ts             # window.print via iframe + CSS @page
│   └── types.ts
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Phase 1 — Import (flow séparé)

L'import est une opération technique ponctuelle sur le format VINCI spécifique. Une fois fait, on oublie l'Excel et on bosse uniquement sur le dossier en base.

### Parser VINCI

Structure d'une feuille VINCI (1 feuille = 1 salarié) :
- **A7** → Nom complet
- **A9** → Fonction
- **A12** → Code PIN
- **B11** → Slogan
- Images ancrées :
  - `col ≤ 1 && row ≤ 5` → photo
  - `col 2-3 && row 3-9` → QR
  - autres → ignoré (logo, bandeau)

**Technique :**
- ExcelJS pour le texte (API cellules fiable en browser)
- JSZip pour les images (l'API images d'ExcelJS est buggée en browser)
  - `xl/media/` → bytes bruts
  - `xl/drawings/` + `_rels/` → positionnement (mapping sheet → drawing → image)

**Non-dégradation :**
```typescript
const bytes = await zip.file('xl/media/image1.jpeg').async('uint8array');
const blob = new Blob([bytes], { type: 'image/jpeg' });
// blob est stockable direct en IndexedDB, zéro décode
```

### Flow UI

**État 1 — Accueil (app vide ou pas de dossier actif)**

```
┌────────────────────────────────────────┐
│ CardForge                              │
│                                        │
│   Aucun dossier actif                  │
│                                        │
│   [ 📥 Importer un Excel VINCI ]       │
│                                        │
│   Dossiers précédents :                │
│   • Batch mars 2026 · 43p    →         │
│   • Batch janvier 2026 · 28p →         │
└────────────────────────────────────────┘
```

**État 2 — Import en cours**

```
✓ Parsing cellules texte (43 feuilles)
✓ Extraction images (86 images)
⏳ Classification photo/QR (12/43)
⏸ Analyse qualité photos
```

**État 3 — Résumé post-import**

```
Import réussi ✓
43 personnes importées
├─ 41 avec photo
├─ 2 sans photo ⚠
└─ 43 avec QR

[ Voir les photos → ]   [ Annuler ]
```

Au clic "Voir les photos" → création du dossier en IndexedDB + navigation vers `Photos`. L'Excel n'est plus jamais touché.

### Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Fichier non-xlsx | "Format non supporté. Attendu : .xlsx" |
| Fichier xlsx mais structure non-VINCI | "Format non reconnu. Attendu : export VINCI (1 feuille/salarié, nom A7, fonction A9, PIN A12)" |
| Feuille sans photo | Personne créée avec `photoBlob: null` |
| Feuille sans QR | Personne créée avec `qrBlob: null` |
| Cellule A7/A9/A12 vide | Champ = `""`, éditable après en inline |

---

## Phase 2 — Édition (travail sur le dossier)

Tout le travail se fait sur `Person` objects en IndexedDB, sans aucun lien au fichier Excel d'origine.

### Notion de dossier

Chaque import crée un **dossier** (nommé automatiquement par date, renommable). Multiples dossiers coexistent. Switcher dans le header.

```typescript
// src/lib/db/schema.ts

interface Folder {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  people: Person[];
}

interface Person {
  id: string;
  name: string;
  role: string;
  pin: string;
  slogan: string;
  photoBlob: Blob | null;    // Blob direct, JAMAIS base64
  qrBlob: Blob | null;
  quality: PhotoQuality | null;
  modified: boolean;          // true si user a édité qqch
}

interface Template {
  id: string;
  name: string;
  frontHtml: string;
  backHtml: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

IndexedDB : 2 stores — `folders` et `templates`. Les templates sont globaux (partagés entre dossiers).

### Header sticky

```
┌──────────────────────────────────────────────────────────────┐
│ CardForge  [📁 Batch mars 2026 ▼]  [Photos][Cartes]          │
│            Template: Mon template ▼        [Exporter ▼]      │
└──────────────────────────────────────────────────────────────┘
```

**Dropdown dossier :**
- Liste des dossiers existants
- Renommer le dossier actif
- Supprimer le dossier actif (avec confirm)
- **+ Nouvel import** (relance le flow Phase 1)

**Sélecteur template :**
- Liste des templates existants + "Créer un nouveau template"
- Clic sur le nom du template actif → ouvre le panneau latéral d'édition

**Export :** dropdown avec format + guide + bouton

### Onglet Photos (écran critique)

Liste verticale, triée par score qualité **pires d'abord** par défaut.

**Ligne étendue (🔴 ou 🟠) :**

```
┌────────────────────────────────────────────────────────────────┐
│ [photo    ]  Jean DUPONT                              🔴 32    │
│ 80×120 px    Chef de chantier                                  │
│ 28 KB JPEG                                                     │
│              Résolution  120×180  ✗  (min 300×400 recommandé)  │
│              Netteté     42       ✗  floue                     │
│              Luminosité  180      ✓                            │
│              [ Glisser une photo ici, ou cliquer ]             │
└────────────────────────────────────────────────────────────────┘
```

**Ligne compactée (🟢) :**

```
┌────────────────────────────────────────────────────────────────┐
│ [photo] Marc BERNARD · Électricien                    🟢 89    │
│         480×640 · 247 KB · Netteté 210 · Lumi 140 [Remplacer]  │
└────────────────────────────────────────────────────────────────┘
```

**Barre d'outils :**
```
[Tri: pires d'abord ▼] [☐ Seulement à revoir]  43 · 2🔴 3🟠 38🟢
```

**Interactions :**
- Drop fichier sur une ligne → remplace la photo (recalcul score en live)
- Clic sur la ligne → file picker
- Clic sur la mini-photo → lightbox (voir en grand avant de juger)
- **Clic sur le nom, fonction, PIN** → input inline, Enter valide, Escape annule, save auto en IndexedDB
- Le poids + MIME visibles agissent comme **canari** : si un jour un poids bouge bizarrement, c'est qu'un truc a touché aux bytes

**Analyse qualité :**
- Lignes apparaissent immédiatement avec ⚪ "analyse..."
- Scores arrivent progressivement (Web Worker en arrière-plan)
- Re-tri unique à la fin de l'analyse (pas pendant, pour éviter les sauts)

### Onglet Cartes

Grid 3 colonnes, cartes à taille réelle (~86×54mm à l'écran).

```
┌──────────────────────────────────────────────────────┐
│ [◉ Recto  ○ Verso]   35/43 sélectionnées  [Tout/Rien]│
├──────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │ ☑ Carte │  │ ☑ Carte │  │ ☐ Carte │              │
│  │ rendue  │  │ rendue  │  │ rendue  │              │
│  └─────────┘  └─────────┘  └─────────┘              │
│   Jean D.     Sophie M.    Marc B.                   │
└──────────────────────────────────────────────────────┘
```

- Toggle recto/verso **global** (pas par carte)
- Checkbox par carte, tout sélectionné par défaut
- Nom sous la carte
- Pas de badge qualité ici (c'est dans Photos)

**Rendu :** chaque carte dans un **Shadow DOM** pour isoler le CSS du template de l'UI de l'app. Composant React `<Card>` qui crée un shadow root et y injecte le HTML rendu + les styles du template.

```typescript
// Shadow DOM, ~15 lignes
useEffect(() => {
  const shadow = ref.current.attachShadow({ mode: 'open' });
  shadow.innerHTML = renderTemplate(template.frontHtml, person);
}, [template, person]);
```

Pas de virtualisation. 43 cartes en Shadow DOM c'est parfaitement gérable.

### Panneau Template (slide-in depuis la droite, ~60% largeur)

```
┌──────────────────────────────────────────┐
│ Templates                   [×]          │
├──────────────────────────────────────────┤
│ ◉ Mon template Omexom                    │
│ ○ Carte visiteur                         │
│ [+ Nouveau]  [Dupliquer]  [Supprimer]    │
├──────────────────────────────────────────┤
│ [Recto] [Verso]            [Sauver]      │
│                                          │
│ ┌───────────┐  ┌──────────────────────┐  │
│ │ <div...   │  │                      │  │
│ │ {{nom}}   │  │   [preview live]     │  │
│ │ ...       │  │   (1er salarié)      │  │
│ │           │  │                      │  │
│ └───────────┘  └──────────────────────┘  │
│ Placeholders (clic = copier) :           │
│ {{nom}} {{fonction}} {{pin}} {{slogan}}  │
│ {{photo}} {{qr}}                         │
└──────────────────────────────────────────┘
```

**Pas de modal bloquant :** panneau latéral, tu vois tes cartes derrière.

**Comportement au premier lancement :**
Aucun template par défaut bundlé. Le sélecteur affiche "Aucun template · Créer le premier". Au clic, l'éditeur s'ouvre vide :

```html
<!-- Colle ton HTML ici. Placeholders dispo : {{nom}}, {{fonction}}, {{pin}}, {{slogan}}, {{photo}}, {{qr}} -->
```

Tu y colles ton HTML Omexom (logo Omexom inclus en base64 ou SVG inline dans *ton* HTML, l'app n'a aucun asset Omexom).

**Preview live :** rendu via Shadow DOM, avec les données du 1er salarié du dossier actif (ou données fictives "Nom Prénom / Fonction / 1234 / slogan test" si pas de dossier).

---

## Placeholders (à mettre dans les templates)

Liste exhaustive des placeholders que tu peux utiliser dans ton HTML de template. Simple string-replace, pas de framework de templating.

| Placeholder    | Contenu                                     | Utilisation typique                        |
|----------------|---------------------------------------------|--------------------------------------------|
| `{{nom}}`      | Nom complet (ex: "Jean DUPONT")             | Texte brut dans une balise                 |
| `{{fonction}}` | Fonction / poste (ex: "Chef de chantier")   | Texte brut dans une balise                 |
| `{{pin}}`      | Code PIN (ex: "1234")                       | Texte brut dans une balise                 |
| `{{slogan}}`   | Slogan (ex: "La sécurité est...")           | Texte brut dans une balise                 |
| `{{photo}}`    | Blob URL de la photo de la personne         | Dans `src="..."` d'un `<img>`              |
| `{{qr}}`       | Blob URL du QR code                         | Dans `src="..."` d'un `<img>`              |

**Exemple minimal de template :**

```html
<div style="width:86mm; height:54mm; background:#fff; position:relative; overflow:hidden;">
  <img src="{{photo}}" style="width:30mm; height:40mm; object-fit:cover;" />
  <div style="font-size:14pt; font-weight:bold;">{{nom}}</div>
  <div style="font-size:10pt;">{{fonction}}</div>
  <img src="{{qr}}" style="width:20mm; height:20mm;" />
  <div>PIN : {{pin}}</div>
  <div style="font-style:italic;">{{slogan}}</div>
</div>
```

**Conventions :**
- Dimensions cibles : **86mm × 54mm** (format CR80) sur le `<div>` racine
- Le template gère lui-même l'overflow (nom long, etc.) via CSS (`overflow:hidden`, `text-overflow:ellipsis`, etc.)
- Images statiques (logo Omexom, fonds, déco) : **inclure en base64 inline** dans le HTML du template pour qu'il soit autoportant
- Fonts : utiliser la stack système par défaut, OU importer via `<link>` Google Fonts dans le HTML, OU inclure un `@font-face` avec data-URL
- CSS : `<style>` et `<link>` dans le HTML fonctionnent (isolation via Shadow DOM)

**Textes échappés automatiquement :** `{{nom}}`, `{{fonction}}`, `{{pin}}`, `{{slogan}}` sont passés par `escapeHtml()` pour éviter qu'un contenu Excel foireux (caractères `<>&`) casse le rendu. `{{photo}}` et `{{qr}}` sont des blob URLs app-générées, pas d'échappement.

---

## Non-dégradation des images — chaîne garantie

Règles absolues qui traversent toute l'app :

1. **Import** : JSZip → `Uint8Array` brut → `new Blob([bytes], {type})`. Zéro décode.
2. **Storage** : IndexedDB stocke le **Blob direct** (pas base64). Natif, 1:1.
3. **Récup** : lecture IndexedDB → même Blob → `URL.createObjectURL(blob)` pour affichage.
4. **Affichage** : `<img src="{blobUrl}">`. Chrome décode pour rendre, Blob source intact.
5. **Analyse qualité** : Worker + OffscreenCanvas en **lecture seule** (`getImageData`). Interdit : `toBlob()`, `toDataURL()`, `convertToBlob()`. Le canvas est jetable, le Blob source ne change jamais.
6. **Remplacement photo** : `file.arrayBuffer()` → `new Blob([bytes], {type})` → IndexedDB. Pareil, zéro canvas.
7. **Export PDF** : `window.print()` sur iframe avec `<img src="{blobUrl}">`. Chrome embarque dans le PDF avec sa recompression interne (perceptuellement invisible, actée).

**Canari visuel** : le poids original + MIME sont affichés dans l'écran Photos. Si un jour un poids bouge bizarrement après une action, bug détecté.

**Cas limites :**
- JPEG CMYK : détecter, ne rien toucher, afficher un warning "CMYK, rendu altéré probable". L'user décide.
- Rotation EXIF : navigateurs respectent nativement, on touche à rien.

---

## Qualité photo — 3 checks

Calcul en Web Worker + OffscreenCanvas, ~5ms/photo.

```typescript
interface PhotoQuality {
  score: number;       // 0-100
  grade: 'good' | 'warning' | 'critical';   // 🟢 🟠 🔴
  checks: {
    resolution: { value: string; pass: boolean };   // "480×640"
    sharpness:  { value: number; pass: boolean };   // variance Laplacien
    brightness: { value: number; pass: boolean };   // 0-255
  };
}
```

| Check       | Méthode                          | Seuil pass    | Poids |
|-------------|----------------------------------|---------------|-------|
| Résolution  | `width × height`                 | ≥ 300×400 px  | 50%   |
| Netteté     | variance Laplacien sur luminance | ≥ 100         | 30%   |
| Luminosité  | moyenne luminance                | 60 ≤ x ≤ 220  | 20%   |

Seuils de grade :
- 🟢 `good` : score ≥ 70
- 🟠 `warning` : 40 ≤ score < 70
- 🔴 `critical` : score < 40

---

## Export PDF

`window.print()` sur un iframe caché, avec CSS `@page`.

```typescript
// src/lib/export/print.ts

export function exportPdf(
  people: Person[],
  template: Template,
  mode: 'individual' | 'batch-a4'
) {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  
  const html = buildPrintHtml(people, template, mode);
  iframe.srcdoc = html;
  
  iframe.onload = () => {
    iframe.contentWindow!.print();
    setTimeout(() => iframe.remove(), 2000);
  };
  
  document.body.appendChild(iframe);
}
```

**`srcdoc` et pas `document.write()`** : moins d'edge cases, meilleur attachement de la load event.

**Deux modes :**

- **Individuel CR80** : `@page { size: 86mm 54mm; margin: 0 }`, une carte par page (pour imprimante carte PVC directe)
- **Batch A4** : 8 cartes par page (2×4 grid), `@page { size: A4; margin: 10mm }`, pour imprimer et découper

**Guide inline dans le dropdown export :**

```
Format :
  ○ Individuel CR80 (86×54mm)
  ○ Batch A4 (8 cartes/page)

Dans Chrome :
  • Destination → Enregistrer en PDF
  • Marges → Aucune
  • Mise à l'échelle → 100%
  • Activer "Graphiques d'arrière-plan"

[ Exporter 35 cartes ]
```

---

## Moteur de rendu template

```typescript
// src/lib/template/render.ts

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderTemplate(html: string, person: Person, blobUrls: { photo: string; qr: string }): string {
  return html
    .replace(/\{\{nom\}\}/g,      escapeHtml(person.name))
    .replace(/\{\{fonction\}\}/g, escapeHtml(person.role))
    .replace(/\{\{pin\}\}/g,      escapeHtml(person.pin))
    .replace(/\{\{slogan\}\}/g,   escapeHtml(person.slogan))
    .replace(/\{\{photo\}\}/g,    blobUrls.photo)
    .replace(/\{\{qr\}\}/g,       blobUrls.qr);
}
```

Les blob URLs sont générées une fois à l'entrée de l'écran (`URL.createObjectURL` sur les Blobs du store) et cachées dans un Map. Revoke au démontage / changement de dossier pour éviter les fuites mémoire.

---

## Plan d'exécution

### Phase 1 — "Import → PDF"

Pipeline minimal bout en bout. Valider que les photos sortent intactes.

1. Setup Vite + React + Tailwind + deps
2. Parser VINCI (ExcelJS + JSZip)
3. IndexedDB schema + CRUD dossiers
4. UI accueil + flow import (dropzone, progression, résumé)
5. Écran Photos minimaliste (liste avec blob URLs, sans qualité ni édition)
6. Écran Cartes minimaliste (Shadow DOM + moteur de rendu)
7. Panneau template (éditeur textarea + preview)
8. Export PDF via `window.print()` mode individuel

**Test de vérité** : importer un Excel VINCI réel, coller le HTML Omexom dans l'éditeur, exporter le PDF, zoomer 400% sur une photo → comparer à l'originale.

### Phase 2 — "Qualité + remplacement"

1. Web Worker + OffscreenCanvas pour les 3 checks qualité
2. Affichage scores + stats dans l'écran Photos
3. Tri pires-d'abord + filtre "seulement à revoir"
4. Remplacement photo : drag & drop + file picker
5. Lightbox photo
6. Édition inline texte (nom, fonction, PIN)

### Phase 3 — "Polish"

1. Multi-dossiers (switcher dans header)
2. Multi-templates + dupliquer
3. Export batch A4
4. Toggle recto/verso cartes
5. Renommer / supprimer dossier
6. Canari poids/MIME visible

---

## Hors scope (définitif)

- IA intégrée pour générer les templates (colle-coller depuis Claude/ChatGPT)
- Éditeur visuel drag & drop de blocs
- Multi-format input (uniquement Excel VINCI)
- Auth / comptes / cloud / partage
- Upscale IA des photos
- Crop photo avec rognage (remplacement direct uniquement)
- Virtualisation grid (pas nécessaire à cette échelle)
- Template par défaut bundlé (l'app démarre vide)
- Assets Omexom embarqués (tout vit dans le HTML du template)
- pdf-lib / export direct HD (recompression Chrome actée)

---

## Récap contraintes vs solutions

| Contrainte             | Solution                                                    |
|------------------------|-------------------------------------------------------------|
| Flexibilité templates  | Éditeur HTML libre + multi-templates en IndexedDB           |
| Flexibilité données    | Multi-dossiers + remplacement photo + édition inline texte  |
| Légèreté               | Vite (~300KB gzipped), aucun asset embarqué                 |
| Non-dégradation        | Blob pur + canvas read-only + canari visuel                 |
| Isolation CSS          | Shadow DOM (pas iframes, pas leakage sur l'app)             |
| Perf 40+ cartes        | Shadow DOM léger + Web Worker pour la qualité               |
| Persistance            | IndexedDB (dossiers + templates)                            |
| Self-host              | `dist/` statique sur VPS, zéro backend                      |
| RGPD                   | 100% client-side, rien ne quitte le navigateur              |
