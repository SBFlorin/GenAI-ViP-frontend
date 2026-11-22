<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useEvaluatorFormsStore } from '@/stores/evaluatorFormsStore';
import type { FormTextField } from '@/data/evaluatorForms';

const props = defineProps<{
  sessionId: number | string | null;
  sessionDate: string;
  personaName: string;
  personaScenarioId: number | string;
  defaultScenario?: string;
  disabled?: boolean;
}>();

const formsStore = useEvaluatorFormsStore();

const config = computed(() => formsStore.sessionEvaluation);
const likertSections = computed(() => config.value.likertSections);
const choiceFields = computed(() =>
  config.value.showChoiceFieldsSection === false ? [] : config.value.choiceFields || []
);
const showOverallQuality = computed(() => config.value.showOverallQuality !== false);
const showErrorReportSection = computed(() => config.value.showErrorReportSection !== false);
const showErrorIssuesSection = computed(() => config.value.showErrorIssuesSection === true);
const evaluationTextFields = computed(() =>
  config.value.showEvaluationTextFieldsSection === false
    ? []
    : config.value.evaluationTextFields || []
);
const errorReportTextFields = computed(() =>
  config.value.showErrorReportTextFieldsSection === false
    ? []
    : config.value.errorReportTextFields || []
);
const errorIssueOptions = computed(() => config.value.errorIssueOptions || []);
const errorSeverityOptions = computed(() => config.value.errorSeverityOptions || []);
const showErrorIssues = computed(
  () => config.value.showErrorIssueOptions !== false && errorIssueOptions.value.length > 0
);
const showErrorSeverity = computed(
  () => config.value.showErrorSeverityOptions !== false && errorSeverityOptions.value.length > 0
);
const otherErrorIssue = computed(
  () =>
    errorIssueOptions.value.find((o) => o.toLowerCase().includes('alt răspuns problematic')) ??
    errorIssueOptions.value.find((o) => o.toLowerCase().includes('other')) ??
    'Alt răspuns problematic'
);

const choiceValues = ref<Record<string, string>>({});
const likert = ref<Record<string, number>>({});
const overallQuality = ref<number | null>(null);
const evaluationValues = ref<Record<string, string>>({});
const reportError = ref(false);
const errorIssues = ref<string[]>([]);
const errorIssueOther = ref('');
const errorSeverity = ref('');
const errorTextValues = ref<Record<string, string>>({});
const errorMsg = ref('');

const syncTextFieldKeys = () => {
  const nextEval: Record<string, string> = { ...evaluationValues.value };
  for (const field of evaluationTextFields.value) {
    if (nextEval[field.key] === undefined) nextEval[field.key] = '';
  }
  for (const key of Object.keys(nextEval)) {
    if (!evaluationTextFields.value.some((f) => f.key === key)) delete nextEval[key];
  }
  evaluationValues.value = nextEval;

  const nextErr: Record<string, string> = { ...errorTextValues.value };
  for (const field of errorReportTextFields.value) {
    if (nextErr[field.key] === undefined) nextErr[field.key] = '';
  }
  for (const key of Object.keys(nextErr)) {
    if (!errorReportTextFields.value.some((f) => f.key === key)) delete nextErr[key];
  }
  errorTextValues.value = nextErr;
};

watch(evaluationTextFields, syncTextFieldKeys, { immediate: true });
watch(errorReportTextFields, syncTextFieldKeys, { immediate: true });

const syncChoiceKeys = () => {
  const next = { ...choiceValues.value };
  for (const field of choiceFields.value) {
    if (next[field.key] === undefined) next[field.key] = '';
  }
  for (const key of Object.keys(next)) {
    if (!choiceFields.value.some((f) => f.key === key)) delete next[key];
  }
  choiceValues.value = next;
};

watch(choiceFields, syncChoiceKeys, { immediate: true });

watch(
  () => props.defaultScenario,
  (v) => {
    if (v && choiceFields.value.some((f) => f.key === 'scenarioTested') && !choiceValues.value.scenarioTested) {
      choiceValues.value.scenarioTested = v;
    }
  },
  { immediate: true }
);

const setChoice = (key: string, value: string) => {
  choiceValues.value[key] = value;
};

const getChoice = (key: string) => choiceValues.value[key] ?? '';

const allLikertKeys = computed(() => {
  const keys: string[] = [];
  likertSections.value.forEach((section) => {
    section.items.forEach((item, idx) => {
      keys.push(`${section.key}-${idx}`);
    });
  });
  return keys;
});

const toggleErrorIssue = (value: string) => {
  const idx = errorIssues.value.indexOf(value);
  if (idx >= 0) errorIssues.value.splice(idx, 1);
  else errorIssues.value.push(value);
};

const likertKey = (sectionKey: string, idx: number) => `${sectionKey}-${idx}`;

const setLikert = (key: string, value: number) => {
  likert.value[key] = value;
};

const getLikert = (key: string) => likert.value[key];

const fieldRows = (field: FormTextField) => field.rows ?? 3;

const buildEvaluationPayload = () => {
  const out: Record<string, string> = {};
  for (const field of evaluationTextFields.value) {
    out[field.key] = evaluationValues.value[field.key] ?? '';
  }
  return out;
};

const buildErrorReportPayload = () => {
  const out: Record<string, unknown> = {
    issues: errorIssues.value,
    issueOther: errorIssueOther.value,
    severity: errorSeverity.value
  };
  for (const field of errorReportTextFields.value) {
    out[field.key] = errorTextValues.value[field.key] ?? '';
  }
  return out;
};

const validateAndBuildPayload = (): Record<string, unknown> | null => {
  errorMsg.value = '';
  for (const field of choiceFields.value) {
    if (field.required && !choiceValues.value[field.key]) {
      errorMsg.value = 'Completați informațiile sesiunii.';
      return null;
    }
  }
  for (const key of allLikertKeys.value) {
    if (!likert.value[key]) {
      errorMsg.value = 'Evaluați toate itemii Likert (1–5).';
      return null;
    }
  }
  if (showOverallQuality.value && !overallQuality.value) {
    errorMsg.value = 'Selectați calitatea generală.';
    return null;
  }

  const evaluationPayload = buildEvaluationPayload();
  const choicePayload: Record<string, string> = {};
  for (const field of choiceFields.value) {
    choicePayload[field.key] = choiceValues.value[field.key] ?? '';
  }

  return {
    sessionId: props.sessionId,
    sessionDate: props.sessionDate,
    personaName: props.personaName,
    personaScenarioId: props.personaScenarioId,
    scenarioTested: choicePayload.scenarioTested ?? '',
    approxExchanges: choicePayload.approxExchanges ?? '',
    ...choicePayload,
    likert: { ...likert.value },
    overallQuality: showOverallQuality.value ? overallQuality.value : null,
    improvementSuggestions: evaluationPayload.improvementSuggestions ?? '',
    successComments: evaluationPayload.successComments ?? '',
    improvementComments: evaluationPayload.improvementComments ?? '',
    ...evaluationPayload,
    errorReport:
      showErrorIssuesSection.value || reportError.value
        ? buildErrorReportPayload()
        : null
  };
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
    <p class="evaluator-subtle form-intro">
      {{ config.intro }}
      <br />
      {{ personaName }}
    </p>

    <div v-for="field in choiceFields" :key="field.key" class="field-group">
      <label class="font-semibold">{{ field.label }}</label>
      <div class="radio-col">
        <label v-for="opt in field.options" :key="opt" class="radio-row">
          <RadioButton
            :modelValue="getChoice(field.key)"
            :inputId="`${field.key}-${opt}`"
            :value="opt"
            @update:modelValue="setChoice(field.key, opt)"
          />
          <span>{{ opt }}</span>
        </label>
      </div>
    </div>

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

    <div v-if="showOverallQuality" class="field-group">
      <label class="font-semibold">{{ config.overallQualityLabel }}</label>
      <div class="radio-row gap-4 flex-wrap">
        <label v-for="n in 5" :key="n">
          <RadioButton v-model="overallQuality" :inputId="'oq-' + n" :value="n" />
          {{ n }}
        </label>
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

    <div v-if="showErrorIssuesSection && showErrorIssues" class="field-group error-block">
      <label class="font-semibold error-section-label">{{ config.errorReportLabel }}</label>
      <div class="checkbox-grid">
        <label v-for="opt in errorIssueOptions" :key="opt" class="checkbox-row">
          <input type="checkbox" :checked="errorIssues.includes(opt)" @change="toggleErrorIssue(opt)" />
          <span>{{ opt }}</span>
        </label>
      </div>
      <InputText
        v-if="errorIssues.includes(otherErrorIssue)"
        v-model="errorIssueOther"
        placeholder="Descrieți alt răspuns problematic"
        class="w-full eval-field mt-2"
      />
    </div>

    <div v-else-if="showErrorReportSection" class="field-group">
      <label class="checkbox-row">
        <input v-model="reportError" type="checkbox" />
        <span>{{ config.errorReportLabel }}</span>
      </label>
    </div>

    <div v-if="showErrorReportSection && reportError && !showErrorIssuesSection" class="error-block">
      <div v-if="showErrorIssues" class="checkbox-grid">
        <label v-for="opt in errorIssueOptions" :key="opt" class="checkbox-row">
          <input type="checkbox" :checked="errorIssues.includes(opt)" @change="toggleErrorIssue(opt)" />
          <span>{{ opt }}</span>
        </label>
      </div>
      <InputText
        v-if="showErrorIssues && errorIssues.includes(otherErrorIssue)"
        v-model="errorIssueOther"
        placeholder="Other issue"
        class="w-full eval-field mt-2"
      />
      <div v-if="showErrorSeverity" class="radio-row gap-4 mt-2">
        <label v-for="s in errorSeverityOptions" :key="s">
          <RadioButton v-model="errorSeverity" :value="s" /> {{ s }}
        </label>
      </div>
      <div v-for="field in errorReportTextFields" :key="field.key" class="mt-2">
        <label class="font-semibold field-label-sm">{{ field.label }}</label>
        <Textarea
          v-model="errorTextValues[field.key]"
          :rows="fieldRows(field)"
          :placeholder="field.placeholder || field.label"
          class="w-full eval-field"
        />
      </div>
    </div>

    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
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

:deep(.eval-field.p-inputtext[readonly]) {
  background: #bdd7ee !important;
  color: #000000 !important;
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
  margin-bottom: 1rem;
  white-space: pre-wrap;
}

.likert-intro {
  white-space: pre-wrap;
  line-height: 1.45;
}

.error-section-label {
  display: block;
  margin-bottom: 0.75rem;
  line-height: 1.45;
}

.field-group {
  margin-bottom: 1rem;
}

.field-label-sm {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 0.35rem;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
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
.checkbox-row,
.radio-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.radio-col,
.checkbox-grid {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.error-block {
  padding: 1rem;
  margin-top: 0.5rem;
}
</style>
