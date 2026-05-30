# CardForge

Outil web **100 % client-side** qui transforme un export Excel VINCI en **cartes PDF prêtes à imprimer**.

> Pipeline : **Excel VINCI → personnes en IndexedDB → rendu via template HTML → PDF via `window.print()`**

## Principes

- **Tout dans le navigateur** — aucune donnée n'est envoyée à un serveur, aucun backend.
- **Zéro dégradation photo** — les octets extraits de l'Excel traversent toute l'app (stockage, affichage, export) sans jamais être ré-encodés. Le canvas ne sert qu'à l'analyse qualité, en lecture seule.
- **Aucune marque codée en dur** — le design de la carte vit entièrement dans le HTML du template que tu écris.

## Stack

React 19 · Vite 6 · TypeScript · Tailwind — avec [ExcelJS](https://github.com/exceljs/exceljs) + [JSZip](https://stuk.github.io/jszip/) (parsing), [idb](https://github.com/jakearchibald/idb) (IndexedDB) et lucide-react.

## Démarrer

```sh
npm install
npm run dev        # serveur de dev Vite
npm run build      # build statique → dist/  (à servir en static)
```

## Comment ça marche

1. **Importe** un export Excel VINCI (dropzone) — personnes + photos sont parsées et stockées en IndexedDB.
2. **Photos** : liste triée par qualité (🔴 à corriger → 🟢 OK), avec lightbox d'agrandissement.
3. **Template** : choisis ou écris un template HTML — c'est lui qui porte tout le design de la carte.
4. **Export** : rendu recto/verso puis PDF via l'impression du navigateur (Chrome recommandé).

## Doc

Spec complète et à jour : [`cardforge-spec-v7.md`](./cardforge-spec-v7.md).

## Licence

[MIT](./LICENSE)
