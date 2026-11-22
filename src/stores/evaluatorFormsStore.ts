import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiRequest } from '../apiRequest';
import {
  DEFAULT_EVALUATOR_FORMS,
  type EvaluatorFormsConfig,
  type ExpertProfileFormConfig,
  type SessionEvaluationFormConfig,
  type OverallEvaluationFormConfig
} from '@/data/evaluatorForms';

export type EvaluatorFormKey = 'expertProfile' | 'sessionEvaluation' | 'overallEvaluation';

function cloneForms(forms: EvaluatorFormsConfig): EvaluatorFormsConfig {
  return JSON.parse(JSON.stringify(forms)) as EvaluatorFormsConfig;
}

export const useEvaluatorFormsStore = defineStore('evaluatorFormsStore', () => {
  const forms = ref<EvaluatorFormsConfig>(cloneForms(DEFAULT_EVALUATOR_FORMS));
  const loaded = ref(false);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  const expertProfile = computed(() => forms.value.expertProfile);
  const sessionEvaluation = computed(() => forms.value.sessionEvaluation);
  const overallEvaluation = computed(() => forms.value.overallEvaluation);
  const likertSections = computed(() => forms.value.sessionEvaluation.likertSections);

  const applyForms = (next: Partial<EvaluatorFormsConfig>) => {
    if (next.expertProfile) {
      forms.value.expertProfile = next.expertProfile;
    }
    if (next.sessionEvaluation) {
      forms.value.sessionEvaluation = next.sessionEvaluation;
    }
    if (next.overallEvaluation) {
      forms.value.overallEvaluation = next.overallEvaluation;
    }
  };

  const fetchForEvaluator = async () => {
    loading.value = true;
    error.value = null;
    try {
      const data = await apiRequest('/evaluator/forms');
      if (data.forms) {
        applyForms(data.forms);
      }
      loaded.value = true;
    } catch (e: any) {
      error.value = e.message || 'Nu s-au putut încărca formularele';
      forms.value = cloneForms(DEFAULT_EVALUATOR_FORMS);
    } finally {
      loading.value = false;
    }
  };

  const fetchForAdmin = async () => {
    loading.value = true;
    error.value = null;
    try {
      const data = await apiRequest('/settings/evaluator-forms');
      if (data.forms) {
        applyForms(data.forms);
      }
      loaded.value = true;
    } catch (e: any) {
      error.value = e.message || 'Nu s-au putut încărca formularele';
      forms.value = cloneForms(DEFAULT_EVALUATOR_FORMS);
    } finally {
      loading.value = false;
    }
  };

  const ensureLoadedForEvaluator = async () => {
    if (loaded.value) return;
    await fetchForEvaluator();
  };

  const ensureLoadedForAdmin = async () => {
    if (loaded.value) return;
    await fetchForAdmin();
  };

  const updateForm = async (
    formKey: EvaluatorFormKey,
    form: ExpertProfileFormConfig | SessionEvaluationFormConfig | OverallEvaluationFormConfig
  ) => {
    saving.value = true;
    error.value = null;
    try {
      const data = await apiRequest(`/settings/evaluator-forms/${formKey}`, {
        method: 'POST',
        body: JSON.stringify({ form })
      });
      if (data.forms) {
        applyForms(data.forms);
      } else if (formKey === 'expertProfile') {
        forms.value.expertProfile = form as ExpertProfileFormConfig;
      } else if (formKey === 'sessionEvaluation') {
        forms.value.sessionEvaluation = form as SessionEvaluationFormConfig;
      } else {
        forms.value.overallEvaluation = form as OverallEvaluationFormConfig;
      }
      loaded.value = true;
      return data;
    } catch (e: any) {
      error.value = e.message || 'Salvarea a eșuat';
      throw e;
    } finally {
      saving.value = false;
    }
  };

  const likertLabel = (sectionKey: string, idx: number) => {
    const section = forms.value.sessionEvaluation.likertSections.find((s) => s.key === sectionKey);
    return section?.items[idx] ?? `Item ${idx + 1}`;
  };

  return {
    forms,
    loaded,
    loading,
    saving,
    error,
    expertProfile,
    sessionEvaluation,
    overallEvaluation,
    likertSections,
    fetchForEvaluator,
    fetchForAdmin,
    ensureLoadedForEvaluator,
    ensureLoadedForAdmin,
    updateForm,
    likertLabel,
    cloneForms
  };
});
