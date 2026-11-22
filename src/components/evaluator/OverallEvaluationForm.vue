<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useEvaluatorFormsStore } from '@/stores/evaluatorFormsStore';
import type { FormTextField } from '@/data/evaluatorForms';

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{ submit: [data: Record<string, unknown>] }>();
const formsStore = useEvaluatorFormsStore();

const config = computed(() => formsStore.overallEvaluation);
const likertSections = computed(() => config.value.likertSections);
const evaluationTextFields = computed(() => config.value.evaluationTextFields || []);

const likert = ref<Record<string, number>>({});
const evaluationValues = ref<Record<string, string>>({});
const errorMsg = ref('');

const syncTextFieldKeys = () => {
  const next: Record<string, string> = { ...evaluationValues.value };
  for (const field of evaluationTextFields.value) {
    if (next[field.key] === undefined) next[field.key] = '';
  }
  for (const key of Object.keys(next)) {
    if (!evaluationTextFields.value.some((f) => f.key === key)) delete next[key];
  }
  evaluationValues.value = next;
};

watch(evaluationTextFields, syncTextFieldKeys, { immediate: true });

const allLikertKeys = computed(() => {
  const keys: string[] = [];
  likertSections.value.forEach((section) => {
    section.items.forEach((_, idx) => {
      keys.push(`${section.key}-${idx}`);
    });
  });
  return keys;
});

const likertKey = (sectionKey: string, idx: number) => `${sectionKey}-${idx}`;

const setLikert = (key: string, value: number) => {
  likert.value[key] = value;
};

const getLikert = (key: string) => likert.value[key];

const fieldRows = (field: FormTextField) => field.rows ?? 3;

const validateAndBuildPayload = (): Record<string, unknown> | null => {
  errorMsg.value = '';
  for (const key of allLikertKeys.value) {
    if (!likert.value[key]) {
      errorMsg.value = 'Evaluați toate itemii Likert (1–5).';
      return null;
    }
  }

  const textPayload: Record<string, string> = {};
  for (const field of evaluationTextFields.value) {
    textPayload[field.key] = evaluationValues.value[field.key] ?? '';
  }

  return {
    likert: { ...likert.value },
    ...textPayload
  };
};

const handleSubmit = () => {
  const payload = validateAndBuildPayload();
  if (!payload) return;
  emit('submit', payload);
};

defineExpose({ validateAndBuildPayload });

onMounted(() => formsStore.ensureLoadedForEvaluator());
</script>

<template>
  <div
    class="evaluator-form evaluator-card"
    :class="{ 'opacity-60 pointer-events-none': disabled }"
  >
    <h2 class="form-title">{{ config.title }}</h2>
    <p class="evaluator-subtle form-intro">{{ config.intro }}</p>

    <p v-if="likertSections.length" class="text-sm mb-4 likert-intro">{{ config.likertIntro }}</p>

    <div v-for="section in likertSections" :key="section.key" class="likert-section">
      <h3 v-if="section.title" class="font-semibold mb-2">{{ section.title }}</h3>
      <div v-for="(item, idx) in section.items" :key="idx" class="likert-row">
        <span class="likert-label">{{ idx + 1 }}. {{ item }}</span>
        <div class="likert-scale">
          <label v-for="n in 5" :key="n" class="scale-btn">
            <RadioButton
              :modelValue="getLikert(likertKey(section.key, idx))"
              :inputId="`${section.key}-${idx}-${n}`"
              :value="n"
              @update:modelValue="setLikert(likertKey(section.key, idx), n)"
            />
            <span>{{ n }}</span>
          </label>
        </div>
      </div>
    </div>

    <div v-for="field in evaluationTextFields" :key="field.key" class="field-group">
      <label class="font-semibold">{{ field.label }}</label>
      <Textarea
        v-model="evaluationValues[field.key]"
        :rows="fieldRows(field)"
        :placeholder="field.placeholder || ''"
        class="w-full eval-field"
      />
    </div>

    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <div class="flex justify-end mt-4">
      <Button
        :label="config.submitLabel"
        :disabled="disabled"
        @click="handleSubmit"
      />
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

.form-intro,
.likert-intro {
  margin-bottom: 1rem;
  white-space: pre-wrap;
  line-height: 1.45;
}

.field-group {
  margin-bottom: 1rem;
}

.likert-section {
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
}

.likert-row {
  margin-bottom: 0.75rem;
}

.likert-label {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 0.35rem;
}

.likert-scale {
  display: flex;
  gap: 0.75rem;
}

.scale-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.75rem;
}
</style>
