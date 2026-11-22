<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useEvaluatorFormsStore } from '@/stores/evaluatorFormsStore';
import type { ProfileFormField } from '@/data/evaluatorForms';
import { fieldUsesOther } from '@/utils/evaluatorFormFieldHelpers';

const emit = defineEmits<{ submit: [data: Record<string, unknown>] }>();
const formsStore = useEvaluatorFormsStore();

const config = computed(() => formsStore.expertProfile);
const profileFields = computed(() => config.value.profileFields || []);

const fieldValues = ref<Record<string, string | string[]>>({});
const otherValues = ref<Record<string, string>>({});
const errorMsg = ref('');

const syncFieldKeys = () => {
  const next: Record<string, string | string[]> = { ...fieldValues.value };
  for (const field of profileFields.value) {
    if (next[field.key] === undefined) {
      next[field.key] = field.type === 'checkbox' ? [] : '';
    }
  }
  for (const key of Object.keys(next)) {
    if (!profileFields.value.some((f) => f.key === key)) delete next[key];
  }
  fieldValues.value = next;

  const nextOther: Record<string, string> = { ...otherValues.value };
  for (const field of profileFields.value) {
    if (field.otherFieldKey && nextOther[field.otherFieldKey] === undefined) {
      nextOther[field.otherFieldKey] = '';
    }
  }
  for (const key of Object.keys(nextOther)) {
    if (!profileFields.value.some((f) => f.otherFieldKey === key)) delete nextOther[key];
  }
  otherValues.value = nextOther;
};

watch(profileFields, syncFieldKeys, { immediate: true });

const toggleCheckbox = (fieldKey: string, value: string) => {
  const list = Array.isArray(fieldValues.value[fieldKey])
    ? [...(fieldValues.value[fieldKey] as string[])]
    : [];
  const idx = list.indexOf(value);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(value);
  fieldValues.value[fieldKey] = list;
};

const isChecked = (fieldKey: string, value: string) => {
  const v = fieldValues.value[fieldKey];
  return Array.isArray(v) && v.includes(value);
};

const setRadio = (fieldKey: string, value: string) => {
  fieldValues.value[fieldKey] = value;
};

const getRadio = (fieldKey: string) => {
  const v = fieldValues.value[fieldKey];
  return typeof v === 'string' ? v : '';
};

const handleSubmit = () => {
  errorMsg.value = '';
  for (const field of profileFields.value) {
    if (!field.required) continue;
    if (field.type === 'checkbox') {
      const list = fieldValues.value[field.key];
      if (!Array.isArray(list) || !list.length) {
        errorMsg.value = 'Completați toate câmpurile obligatorii.';
        return;
      }
    } else if (!fieldValues.value[field.key]) {
      errorMsg.value = 'Completați toate câmpurile obligatorii.';
      return;
    }
  }

  const payload: Record<string, unknown> = { ...otherValues.value };
  for (const field of profileFields.value) {
    payload[field.key] = fieldValues.value[field.key];
  }
  emit('submit', payload);
};

onMounted(() => formsStore.ensureLoadedForEvaluator());
</script>

<template>
  <div class="evaluator-form evaluator-card">
    <h2 class="form-title">{{ config.title }}</h2>
    <p class="evaluator-subtle form-intro">{{ config.intro }}</p>

    <div v-for="field in profileFields" :key="field.key" class="field-group">
      <label class="font-semibold">{{ field.label }}</label>

      <div v-if="field.type === 'checkbox'" class="checkbox-grid">
        <label v-for="opt in field.options" :key="opt" class="checkbox-row">
          <input
            type="checkbox"
            :checked="isChecked(field.key, opt)"
            @change="toggleCheckbox(field.key, opt)"
          />
          <span>{{ opt }}</span>
        </label>
      </div>

      <div v-else class="radio-col">
        <label v-for="opt in field.options" :key="opt" class="radio-row">
          <RadioButton
            :modelValue="getRadio(field.key)"
            :inputId="`${field.key}-${opt}`"
            :value="opt"
            @update:modelValue="setRadio(field.key, opt)"
          />
          <span>{{ opt }}</span>
        </label>
      </div>

      <InputText
        v-if="field.otherFieldKey && fieldUsesOther(field, fieldValues[field.key])"
        v-model="otherValues[field.otherFieldKey]"
        :placeholder="field.otherOptionLabel || 'Other'"
        class="mt-2 w-full eval-field"
      />
    </div>

    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <div class="flex justify-end mt-6">
      <Button :label="config.submitLabel" @click="handleSubmit" />
    </div>
  </div>
</template>

<style scoped>
:deep(.eval-field.p-inputtext),
:deep(.eval-field.p-textarea),
:deep(textarea.eval-field),
:deep(input.eval-field) {
  background: #ffffff !important;
  color: #000000 !important;
  -webkit-text-fill-color: #000000 !important;
  border: 1px solid #2f5597 !important;
}

.evaluator-form {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.form-title {
  font-size: 1.2rem;
  margin-bottom: 0.35rem;
}

.form-intro {
  margin-bottom: 1.25rem;
}

.field-group {
  margin-bottom: 1.25rem;
}
.checkbox-grid,
.radio-col {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.checkbox-row,
.radio-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
