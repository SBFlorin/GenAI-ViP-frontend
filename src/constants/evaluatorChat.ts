export const MEDIC_ADDRESSING_OPTIONS = ['Domnul doctor', 'Doamna doctor'] as const;

export type MedicAddressingOption = (typeof MEDIC_ADDRESSING_OPTIONS)[number];

export const EVALUATOR_MEDIC_ADDRESSING_PROMPT =
  'Vă rugăm să precizati in campul de mai jos forma de adresare corespunzătoare sexului dumneavoastră: (Domnul doctor sau Doamna doctor).';
