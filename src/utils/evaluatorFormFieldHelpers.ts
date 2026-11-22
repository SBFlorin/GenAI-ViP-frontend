import type { ChoiceFormField, ProfileFormField } from '@/data/evaluatorForms';

export function isOtherOption(opt: string, otherLabel = 'Other') {
  const o = opt.toLowerCase();
  return o === 'other' || o.includes('other') || o === otherLabel.toLowerCase();
}

export function fieldUsesOther(
  field: ProfileFormField,
  selected: string | string[] | undefined
) {
  if (!field.otherFieldKey) return false;
  const label = field.otherOptionLabel || 'Other';
  if (field.type === 'checkbox') {
    const list = Array.isArray(selected) ? selected : [];
    return list.some((v) => isOtherOption(v, label));
  }
  return typeof selected === 'string' && isOtherOption(selected, label);
}

export function emptyProfileField(prefix: string): ProfileFormField {
  return {
    key: `${prefix}_${Date.now()}`,
    type: 'radio',
    label: 'Câmp nou',
    options: ['Da', 'Nu'],
    required: true
  };
}

export function emptyChoiceField(prefix: string): ChoiceFormField {
  return {
    key: `${prefix}_${Date.now()}`,
    label: 'Câmp nou',
    options: ['Opțiune 1', 'Opțiune 2'],
    required: true
  };
}
