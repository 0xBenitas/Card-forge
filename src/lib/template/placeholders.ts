export interface PlaceholderDef {
  token: string;
  label: string;
  description: string;
}

export const PLACEHOLDERS: PlaceholderDef[] = [
  { token: '{{nom}}', label: 'Nom', description: 'Nom complet de la personne' },
  { token: '{{fonction}}', label: 'Fonction', description: 'Poste / fonction' },
  { token: '{{pin}}', label: 'PIN', description: 'Code PIN' },
  { token: '{{slogan}}', label: 'Slogan', description: 'Slogan Excel (B11)' },
  { token: '{{photo}}', label: 'Photo', description: 'Blob URL — à mettre dans <img src>' },
  { token: '{{qr}}', label: 'QR', description: 'Blob URL — à mettre dans <img src>' },
];
