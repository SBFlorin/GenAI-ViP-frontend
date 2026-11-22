<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useAppStore } from '@/stores/appStore';
import { useEvaluatorFormsStore } from '@/stores/evaluatorFormsStore';
import type {
  ChoiceFormField,
  ExpertProfileFormConfig,
  FormTextField,
  LikertSection,
  OverallEvaluationFormConfig,
  ProfileFormField,
  SessionEvaluationFormConfig
} from '@/data/evaluatorForms';
import { DEFAULT_EVALUATOR_FORMS } from '@/data/evaluatorForms';
import { emptyChoiceField, emptyProfileField } from '@/utils/evaluatorFormFieldHelpers';
import type { EvaluatorFormKey } from '@/stores/evaluatorFormsStore';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const appStore = useAppStore();
const formsStore = useEvaluatorFormsStore();

const formKey = computed(() => route.params.formKey as EvaluatorFormKey);

const isExpert = computed(() => formKey.value === 'expertProfile');
const isSession = computed(() => formKey.value === 'sessionEvaluation');
const isOverall = computed(() => formKey.value === 'overallEvaluation');

const pageTitle = computed(() => {
  if (isExpert.value) return 'Editare: Profil expert (Study 4.0)';
  if (isSession.value) return 'Editare: Evaluare sesiune (Study 4.A)';
  if (isOverall.value) return 'Editare: Evaluare finală (după toate scenariile)';
  return 'Editare formular';
});

const draftExpert = ref<ExpertProfileFormConfig | null>(null);
const draftSession = ref<SessionEvaluationFormConfig | null>(null);
const draftOverall = ref<OverallEvaluationFormConfig | null>(null);

const optionsToText = (opts: string[]) => opts.join('\n');
const textToOptions = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const ensureExpertProfileFields = (expert: ExpertProfileFormConfig) => {
  if (!expert.profileFields?.length) {
    expert.profileFields = JSON.parse(
      JSON.stringify(DEFAULT_EVALUATOR_FORMS.expertProfile.profileFields)
    );
  }
};

const ensureSessionStructure = (session: SessionEvaluationFormConfig) => {
  if (!session.choiceFields) {
    session.choiceFields = [];
  }
  if (session.showSessionMeta === undefined) session.showSessionMeta = false;
  if (session.showChoiceFieldsSection === undefined) session.showChoiceFieldsSection = false;
  if (session.showOverallQuality === undefined) session.showOverallQuality = false;
  if (session.showEvaluationTextFieldsSection === undefined) {
    session.showEvaluationTextFieldsSection = true;
  }
  if (session.showErrorReportSection === undefined) session.showErrorReportSection = true;
  if (session.showErrorIssuesSection === undefined) session.showErrorIssuesSection = true;
  if (session.showErrorIssueOptions === undefined) session.showErrorIssueOptions = true;
  if (session.showErrorSeverityOptions === undefined) session.showErrorSeverityOptions = false;
  if (session.showErrorReportTextFieldsSection === undefined) {
    session.showErrorReportTextFieldsSection = true;
  }
  ensureSessionTextFields(session);
};

type SessionSectionFlag =
  | 'showChoiceFieldsSection'
  | 'showEvaluationTextFieldsSection'
  | 'showErrorIssueOptions'
  | 'showErrorSeverityOptions'
  | 'showErrorReportTextFieldsSection';

const SESSION_HIDDEN_SECTIONS: { flag: SessionSectionFlag; label: string }[] = [
  { flag: 'showChoiceFieldsSection', label: 'Câmpuri cu opțiuni (radio)' },
  { flag: 'showEvaluationTextFieldsSection', label: 'Câmpuri text (evaluare generală)' },
  { flag: 'showErrorIssueOptions', label: 'Tipuri probleme (raport eroare AI)' },
  { flag: 'showErrorSeverityOptions', label: 'Severitate (raport eroare AI)' },
  { flag: 'showErrorReportTextFieldsSection', label: 'Câmpuri text (raport eroare AI)' }
];

const hideSessionSection = (flag: SessionSectionFlag) => {
  if (draftSession.value) draftSession.value[flag] = false;
};

const restoreSessionSection = (flag: SessionSectionFlag) => {
  if (draftSession.value) draftSession.value[flag] = true;
};

const hiddenSessionSections = computed(() => {
  const session = draftSession.value;
  if (!session) return [];
  return SESSION_HIDDEN_SECTIONS.filter((s) => session[s.flag] === false);
});

const ensureSessionTextFields = (session: SessionEvaluationFormConfig) => {
  if (!session.evaluationTextFields?.length) {
    session.evaluationTextFields = JSON.parse(
      JSON.stringify(DEFAULT_EVALUATOR_FORMS.sessionEvaluation.evaluationTextFields)
    );
    if (session.successCommentsLabel) {
      const success = session.evaluationTextFields.find((f) => f.key === 'successComments');
      if (success) success.label = session.successCommentsLabel;
    }
    if (session.improvementCommentsLabel) {
      const imp = session.evaluationTextFields.find((f) => f.key === 'improvementComments');
      if (imp) imp.label = session.improvementCommentsLabel;
    }
  }
  if (!session.errorReportTextFields?.length) {
    session.errorReportTextFields = JSON.parse(
      JSON.stringify(DEFAULT_EVALUATOR_FORMS.sessionEvaluation.errorReportTextFields)
    );
  }
};

const ensureOverallStructure = (overall: OverallEvaluationFormConfig) => {
  if (!overall.likertSections?.length) {
    overall.likertSections = JSON.parse(
      JSON.stringify(DEFAULT_EVALUATOR_FORMS.overallEvaluation.likertSections)
    );
  }
  if (!overall.evaluationTextFields) {
    overall.evaluationTextFields = JSON.parse(
      JSON.stringify(DEFAULT_EVALUATOR_FORMS.overallEvaluation.evaluationTextFields)
    );
  }
};

const loadDraft = () => {
  if (isExpert.value) {
    draftExpert.value = JSON.parse(JSON.stringify(formsStore.expertProfile));
    ensureExpertProfileFields(draftExpert.value!);
    draftSession.value = null;
    draftOverall.value = null;
  } else if (isSession.value) {
    draftSession.value = JSON.parse(JSON.stringify(formsStore.sessionEvaluation));
    ensureSessionStructure(draftSession.value!);
    draftExpert.value = null;
    draftOverall.value = null;
  } else if (isOverall.value) {
    draftOverall.value = JSON.parse(JSON.stringify(formsStore.overallEvaluation));
    ensureOverallStructure(draftOverall.value!);
    draftExpert.value = null;
    draftSession.value = null;
  }
};

const removeProfileField = (index: number) => {
  draftExpert.value?.profileFields.splice(index, 1);
};

const removeChoiceField = (index: number) => {
  draftSession.value?.choiceFields.splice(index, 1);
};

const addTextField = (list: FormTextField[], prefix: string) => {
  list.push({
    key: `${prefix}_${Date.now()}`,
    label: 'Câmp text nou',
    placeholder: '',
    rows: 3
  });
};

const removeTextField = (list: FormTextField[], index: number) => {
  list.splice(index, 1);
};

const addLikertSection = () => {
  const target = isOverall.value ? draftOverall.value : draftSession.value;
  if (!target) return;
  const idx = target.likertSections.length;
  const key = String.fromCharCode(65 + idx);
  target.likertSections.push({
    key,
    title: `Secțiune ${key}`,
    items: ['Enunț nou']
  });
};

const removeLikertSection = (index: number) => {
  const target = isOverall.value ? draftOverall.value : draftSession.value;
  if (!target || target.likertSections.length <= 1) return;
  target.likertSections.splice(index, 1);
};

const updateSectionItems = (section: LikertSection, text: string) => {
  section.items = textToOptions(text);
};

const saving = ref(false);
const loadError = ref('');

const handleSave = async () => {
  saving.value = true;
  loadError.value = '';
  try {
    if (isExpert.value && draftExpert.value) {
      await formsStore.updateForm('expertProfile', draftExpert.value);
    } else if (isSession.value && draftSession.value) {
      await formsStore.updateForm('sessionEvaluation', draftSession.value);
    } else if (isOverall.value && draftOverall.value) {
      await formsStore.updateForm('overallEvaluation', draftOverall.value);
    } else {
      throw new Error('Formular invalid.');
    }
    toast.add({
      severity: 'success',
      summary: 'Salvat',
      detail: 'Formularul a fost actualizat.',
      life: 3000
    });
    router.push({ name: 'admin.evaluatorForms' });
  } catch (e: any) {
    const msg = e.message || 'Salvarea a eșuat';
    loadError.value =
      msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('permisi')
        ? 'Permisiuni insuficiente. Deconectați-vă și autentificați-vă din nou cu contul de administrator.'
        : msg;
  } finally {
    saving.value = false;
  }
};

const goBack = () => router.push({ name: 'admin.evaluatorForms' });

onMounted(async () => {
  appStore.breadcrumb = [
    { label: 'admin', route: '/admin' },
    { label: 'formulare evaluatori', route: '/admin/formulare-evaluatori' },
    { label: 'editare formular' }
  ];
  appStore.topButtons.forEach((btn) => {
    btn.isActive = btn.routeName === 'admin.evaluatorForms';
  });

  if (
    formKey.value !== 'expertProfile' &&
    formKey.value !== 'sessionEvaluation' &&
    formKey.value !== 'overallEvaluation'
  ) {
    loadError.value = 'Cheie formular necunoscută.';
    return;
  }

  try {
    await formsStore.fetchForAdmin();
    loadDraft();
  } catch (e: any) {
    loadError.value = e.message || 'Nu s-a putut încărca formularul';
  }
});

watch(formKey, () => loadDraft());
</script>

<template>
  <div class="form-editor">
    <div class="editor-header">
      <Button label="Înapoi la formulare" icon="pi pi-arrow-left" text @click="goBack" />
      <h1 class="page-title">{{ pageTitle }}</h1>
      <p class="page-intro">
        Modificările se aplică tuturor evaluatorilor la următoarea deschidere a formularului.
        Răspunsurile deja trimise păstrează etichetele din momentul completării.
      </p>
    </div>

    <p v-if="loadError" class="error-banner">{{ loadError }}</p>
    <p v-else-if="formsStore.loading && !draftExpert && !draftSession && !draftOverall" class="loading-text">
      Se încarcă...
    </p>

    <form v-else-if="draftExpert && isExpert" class="editor-form" @submit.prevent="handleSave">
      <div class="field-block">
        <label>Titlu formular</label>
        <InputText v-model="draftExpert.title" class="w-full" />
      </div>
      <div class="field-block">
        <label>Text introductiv</label>
        <Textarea v-model="draftExpert.intro" rows="2" class="w-full" />
      </div>
      <div class="likert-editor">
        <div class="likert-editor-head">
          <h2>Câmpuri formular (profil expert)</h2>
          <Button
            type="button"
            label="Adaugă câmp"
            size="small"
            outlined
            @click="draftExpert.profileFields.push(emptyProfileField('field'))"
          />
        </div>
        <p class="editor-hint">
          Bifați tip radio sau checkbox, editați opțiunile (câte una pe linie). Ștergeți un câmp cu
          coșul — nu va mai apărea evaluatorilor.
        </p>
        <div
          v-for="(field, fIdx) in draftExpert.profileFields"
          :key="'pf-' + field.key + fIdx"
          class="likert-section-card"
        >
          <div class="likert-section-head">
            <InputText v-model="field.key" class="key-input-wide" placeholder="Cheie (ex. experience)" />
            <Select
              v-model="field.type"
              :options="[
                { label: 'Radio (o singură alegere)', value: 'radio' },
                { label: 'Checkbox (mai multe)', value: 'checkbox' }
              ]"
              optionLabel="label"
              optionValue="value"
              class="type-select"
            />
            <Button
              type="button"
              icon="pi pi-trash"
              severity="danger"
              text
              @click="removeProfileField(fIdx)"
            />
          </div>
          <label class="sub-label">Etichetă</label>
          <InputText v-model="field.label" class="w-full" />
          <label class="sub-label">Opțiuni (câte una pe linie)</label>
          <Textarea
            :modelValue="optionsToText(field.options)"
            rows="5"
            class="w-full"
            @update:modelValue="(v: string) => (field.options = textToOptions(v))"
          />
          <div class="toggle-row">
            <Checkbox v-model="field.required" :binary="true" inputId="req-pf" />
            <label for="req-pf">Obligatoriu</label>
          </div>
          <div v-if="field.type === 'checkbox'" class="other-config">
            <label class="sub-label">Câmp „Altul” (opțional)</label>
            <InputText
              v-model="field.otherFieldKey"
              placeholder="Cheie salvare (ex. professionOther)"
              class="w-full"
            />
            <InputText v-model="field.otherOptionLabel" placeholder="Etichetă opțiune Other" class="w-full mt-1" />
          </div>
        </div>
      </div>
      <div class="field-block">
        <label>Text buton trimitere</label>
        <InputText v-model="draftExpert.submitLabel" class="w-full" />
      </div>
      <div class="actions">
        <Button type="submit" label="Salvează formularul" :loading="saving" />
        <Button label="Anulează" severity="secondary" outlined @click="goBack" />
      </div>
    </form>

    <form v-else-if="draftSession && isSession" class="editor-form" @submit.prevent="handleSave">
      <div class="field-block">
        <label>Titlu formular</label>
        <InputText v-model="draftSession.title" class="w-full" />
      </div>
      <div class="field-block">
        <label>Text introductiv (evaluator)</label>
        <Textarea v-model="draftSession.intro" rows="2" class="w-full" />
      </div>
      <div class="field-block toggle-list">
        <label class="toggle-row">
          <Checkbox v-model="draftSession.showSessionMeta" :binary="true" inputId="show-meta" />
          <span>Afișează Session ID și dată</span>
        </label>
        <label class="toggle-row">
          <Checkbox v-model="draftSession.showOverallQuality" :binary="true" inputId="show-oq" />
          <span>Afișează calitatea generală (1–5)</span>
        </label>
        <label class="toggle-row">
          <Checkbox
            v-model="draftSession.showErrorIssuesSection"
            :binary="true"
            inputId="show-err-issues"
          />
          <span>Afișează direct tipurile de răspunsuri problematice (fără bifă opțională)</span>
        </label>
        <label class="toggle-row">
          <Checkbox
            v-model="draftSession.showErrorReportSection"
            :binary="true"
            inputId="show-err"
          />
          <span>Afișează secțiunea raport eroare AI (mod vechi, opțional)</span>
        </label>
      </div>

      <div v-if="hiddenSessionSections.length" class="hidden-sections">
        <span class="hidden-sections-label">Secțiuni ascunse (nu apar evaluatorilor):</span>
        <Button
          v-for="section in hiddenSessionSections"
          :key="section.flag"
          type="button"
          :label="'Restaurează: ' + section.label"
          size="small"
          severity="secondary"
          outlined
          @click="restoreSessionSection(section.flag)"
        />
      </div>

      <div v-if="draftSession.showChoiceFieldsSection !== false" class="likert-editor">
        <div class="likert-editor-head">
          <h2>Câmpuri cu opțiuni (radio)</h2>
          <div class="head-actions">
            <Button
              type="button"
              label="Șterge secțiunea"
              size="small"
              severity="danger"
              outlined
              @click="hideSessionSection('showChoiceFieldsSection')"
            />
            <Button
              type="button"
              label="Adaugă câmp"
              size="small"
              outlined
              @click="draftSession.choiceFields.push(emptyChoiceField('choice'))"
            />
          </div>
        </div>
        <p class="editor-hint">
          Ex.: scenariu testat, număr schimburi. Ștergeți un câmp dacă nu mai este necesar.
        </p>
        <div
          v-for="(field, cIdx) in draftSession.choiceFields"
          :key="'ch-' + field.key + cIdx"
          class="likert-section-card"
        >
          <div class="likert-section-head">
            <InputText v-model="field.key" class="key-input-wide" placeholder="Cheie (ex. scenarioTested)" />
            <Button
              type="button"
              icon="pi pi-trash"
              severity="danger"
              text
              @click="removeChoiceField(cIdx)"
            />
          </div>
          <label class="sub-label">Etichetă</label>
          <InputText v-model="field.label" class="w-full" />
          <label class="sub-label">Opțiuni (câte una pe linie)</label>
          <Textarea
            :modelValue="optionsToText(field.options)"
            rows="5"
            class="w-full"
            @update:modelValue="(v: string) => (field.options = textToOptions(v))"
          />
          <div class="toggle-row">
            <Checkbox v-model="field.required" :binary="true" :inputId="'req-ch-' + cIdx" />
            <label :for="'req-ch-' + cIdx">Obligatoriu</label>
          </div>
        </div>
      </div>

      <div class="field-block">
        <label>Instrucțiuni Likert</label>
        <InputText v-model="draftSession.likertIntro" class="w-full" />
      </div>

      <div class="likert-editor">
        <div class="likert-editor-head">
          <h2>Secțiuni Likert</h2>
          <Button type="button" label="Adaugă secțiune" size="small" outlined @click="addLikertSection" />
        </div>
        <div
          v-for="(section, sIdx) in draftSession.likertSections"
          :key="section.key + sIdx"
          class="likert-section-card"
        >
          <div class="likert-section-head">
            <InputText v-model="section.key" class="key-input" placeholder="Cheie (A, B…)" />
            <InputText v-model="section.title" class="flex-1" placeholder="Titlu secțiune" />
            <Button
              type="button"
              icon="pi pi-trash"
              severity="danger"
              text
              :disabled="draftSession.likertSections.length <= 1"
              @click="removeLikertSection(sIdx)"
            />
          </div>
          <label class="sub-label">Enunțuri (câte unul pe linie)</label>
          <Textarea
            :modelValue="optionsToText(section.items)"
            rows="6"
            class="w-full"
            @update:modelValue="(v: string) => updateSectionItems(section, v)"
          />
        </div>
      </div>

      <div class="field-block">
        <label>Calitate generală — etichetă</label>
        <InputText v-model="draftSession.overallQualityLabel" class="w-full" />
      </div>

      <div
        v-if="draftSession.showEvaluationTextFieldsSection !== false"
        class="likert-editor"
      >
        <div class="likert-editor-head">
          <h2>Câmpuri text (evaluare generală)</h2>
          <div class="head-actions">
            <Button
              type="button"
              label="Șterge secțiunea"
              size="small"
              severity="danger"
              outlined
              @click="hideSessionSection('showEvaluationTextFieldsSection')"
            />
            <Button
              type="button"
              label="Adaugă câmp"
              size="small"
              outlined
              @click="addTextField(draftSession.evaluationTextFields, 'comment')"
            />
          </div>
        </div>
        <p class="editor-hint">
          Câmpurile afișate după calitatea generală. Ștergeți un câmp cu coșul — nu va mai apărea
          evaluatorilor.
        </p>
        <div
          v-for="(field, fIdx) in draftSession.evaluationTextFields"
          :key="field.key + fIdx"
          class="likert-section-card"
        >
          <div class="likert-section-head">
            <InputText v-model="field.key" class="key-input-wide" placeholder="Cheie (ex. successComments)" />
            <Button
              type="button"
              icon="pi pi-trash"
              severity="danger"
              text
              @click="removeTextField(draftSession.evaluationTextFields, fIdx)"
            />
          </div>
          <label class="sub-label">Etichetă</label>
          <InputText v-model="field.label" class="w-full" />
          <label class="sub-label">Placeholder (opțional)</label>
          <InputText v-model="field.placeholder" class="w-full" />
          <label class="sub-label">Rânduri textarea</label>
          <InputNumber v-model="field.rows" :min="2" :max="12" class="w-full" />
        </div>
      </div>

      <div class="field-block">
        <label>Raport erori AI — etichetă checkbox</label>
        <InputText v-model="draftSession.errorReportLabel" class="w-full" />
      </div>

      <div
        v-if="draftSession.showErrorIssueOptions !== false"
        class="likert-editor section-card"
      >
        <div class="likert-editor-head">
          <h2>Tipuri probleme (raport eroare AI)</h2>
          <Button
            type="button"
            label="Șterge secțiunea"
            size="small"
            severity="danger"
            outlined
            @click="hideSessionSection('showErrorIssueOptions')"
          />
        </div>
        <label class="sub-label">Opțiuni (câte una pe linie)</label>
        <Textarea
          :modelValue="optionsToText(draftSession.errorIssueOptions)"
          rows="8"
          class="w-full"
          @update:modelValue="(v: string) => (draftSession!.errorIssueOptions = textToOptions(v))"
        />
      </div>

      <div
        v-if="draftSession.showErrorSeverityOptions !== false"
        class="likert-editor section-card"
      >
        <div class="likert-editor-head">
          <h2>Severitate (raport eroare AI)</h2>
          <Button
            type="button"
            label="Șterge secțiunea"
            size="small"
            severity="danger"
            outlined
            @click="hideSessionSection('showErrorSeverityOptions')"
          />
        </div>
        <label class="sub-label">Opțiuni (câte una pe linie)</label>
        <Textarea
          :modelValue="optionsToText(draftSession.errorSeverityOptions)"
          rows="3"
          class="w-full"
          @update:modelValue="
            (v: string) => (draftSession!.errorSeverityOptions = textToOptions(v))
          "
        />
      </div>

      <div
        v-if="draftSession.showErrorReportTextFieldsSection !== false"
        class="likert-editor"
      >
        <div class="likert-editor-head">
          <h2>Câmpuri text (raport eroare AI)</h2>
          <div class="head-actions">
            <Button
              type="button"
              label="Șterge secțiunea"
              size="small"
              severity="danger"
              outlined
              @click="hideSessionSection('showErrorReportTextFieldsSection')"
            />
            <Button
              type="button"
              label="Adaugă câmp"
              size="small"
              outlined
              @click="addTextField(draftSession.errorReportTextFields, 'error')"
            />
          </div>
        </div>
        <p class="editor-hint">
          Câmpuri din secțiunea de raport (ex. Description, Illustrative example). Evaluatorii le
          văd doar dacă bifează raportul de eroare.
        </p>
        <div
          v-for="(field, fIdx) in draftSession.errorReportTextFields"
          :key="'err-' + field.key + fIdx"
          class="likert-section-card"
        >
          <div class="likert-section-head">
            <InputText v-model="field.key" class="key-input-wide" placeholder="Cheie (ex. description)" />
            <Button
              type="button"
              icon="pi pi-trash"
              severity="danger"
              text
              @click="removeTextField(draftSession.errorReportTextFields, fIdx)"
            />
          </div>
          <label class="sub-label">Etichetă</label>
          <InputText v-model="field.label" class="w-full" />
          <label class="sub-label">Placeholder (opțional)</label>
          <InputText v-model="field.placeholder" class="w-full" />
          <label class="sub-label">Rânduri textarea</label>
          <InputNumber v-model="field.rows" :min="2" :max="12" class="w-full" />
        </div>
      </div>

      <div class="field-block">
        <label>Text buton trimitere</label>
        <InputText v-model="draftSession.submitLabel" class="w-full" />
      </div>
      <div class="actions">
        <Button type="submit" label="Salvează formularul" :loading="saving" />
        <Button label="Anulează" severity="secondary" outlined @click="goBack" />
      </div>
    </form>

    <form v-else-if="draftOverall && isOverall" class="editor-form" @submit.prevent="handleSave">
      <div class="field-block">
        <label>Titlu formular</label>
        <InputText v-model="draftOverall.title" class="w-full" />
      </div>
      <div class="field-block">
        <label>Text introductiv (evaluator)</label>
        <Textarea v-model="draftOverall.intro" rows="3" class="w-full" />
      </div>
      <div class="field-block">
        <label>Instrucțiuni Likert</label>
        <Textarea v-model="draftOverall.likertIntro" rows="3" class="w-full" />
      </div>

      <div class="likert-editor">
        <div class="likert-editor-head">
          <h2>Secțiuni Likert</h2>
          <Button type="button" label="Adaugă secțiune" size="small" outlined @click="addLikertSection" />
        </div>
        <div
          v-for="(section, sIdx) in draftOverall.likertSections"
          :key="section.key + sIdx"
          class="likert-section-card"
        >
          <div class="likert-section-head">
            <InputText v-model="section.key" class="key-input" placeholder="Cheie (overall…)" />
            <InputText v-model="section.title" class="flex-1" placeholder="Titlu secțiune (opțional)" />
            <Button
              type="button"
              icon="pi pi-trash"
              severity="danger"
              text
              :disabled="draftOverall.likertSections.length <= 1"
              @click="removeLikertSection(sIdx)"
            />
          </div>
          <label class="sub-label">Enunțuri (câte unul pe linie)</label>
          <Textarea
            :modelValue="optionsToText(section.items)"
            rows="8"
            class="w-full"
            @update:modelValue="(v: string) => updateSectionItems(section, v)"
          />
        </div>
      </div>

      <div class="likert-editor">
        <div class="likert-editor-head">
          <h2>Câmpuri text</h2>
          <Button
            type="button"
            label="Adaugă câmp"
            size="small"
            outlined
            @click="addTextField(draftOverall.evaluationTextFields, 'overall')"
          />
        </div>
        <p class="editor-hint">
          Întrebări deschise la finalul studiului (ex. puncte forte, îmbunătățiri).
        </p>
        <div
          v-for="(field, fIdx) in draftOverall.evaluationTextFields"
          :key="field.key + fIdx"
          class="likert-section-card"
        >
          <div class="likert-section-head">
            <InputText v-model="field.key" class="key-input-wide" placeholder="Cheie (ex. strengths)" />
            <Button
              type="button"
              icon="pi pi-trash"
              severity="danger"
              text
              @click="removeTextField(draftOverall.evaluationTextFields, fIdx)"
            />
          </div>
          <label class="sub-label">Etichetă</label>
          <InputText v-model="field.label" class="w-full" />
          <label class="sub-label">Placeholder (opțional)</label>
          <InputText v-model="field.placeholder" class="w-full" />
          <label class="sub-label">Rânduri textarea</label>
          <InputNumber v-model="field.rows" :min="2" :max="12" class="w-full" />
        </div>
      </div>

      <div class="field-block">
        <label>Text buton trimitere</label>
        <InputText v-model="draftOverall.submitLabel" class="w-full" />
      </div>
      <div class="actions">
        <Button type="submit" label="Salvează formularul" :loading="saving" />
        <Button label="Anulează" severity="secondary" outlined @click="goBack" />
      </div>
    </form>
  </div>
</template>

<style scoped>
.form-editor {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem 0 2rem;
  color: #000;
}

.page-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #2f5597;
  margin: 0.5rem 0;
}

.page-intro {
  font-size: 0.9rem;
  color: #333;
  margin-bottom: 1rem;
}

.error-banner {
  color: #000;
  font-weight: 700;
  padding: 0.5rem;
  border: 2px solid #c00;
  margin-bottom: 1rem;
}

.loading-text {
  padding: 1rem 0;
}

.editor-form {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-block {
  margin-bottom: 1rem;
}

.field-block label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.35rem;
  font-size: 0.9rem;
}

.sub-label {
  display: block;
  font-size: 0.8rem;
  color: #555;
  margin: 0.35rem 0;
}

.likert-editor {
  border: 2px solid #2f5597;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
  background: #fff;
}

.likert-editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.head-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.hidden-sections {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
  border: 1px dashed #c9a227;
  border-radius: 4px;
  background: #fffdf5;
}

.hidden-sections-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
}

.likert-editor-head h2 {
  font-size: 1rem;
  font-weight: 700;
  color: #2f5597;
  margin: 0;
}

.likert-section-card {
  border: 1px solid #bdd7ee;
  border-radius: 4px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: #f8fbfd;
}

.likert-section-head {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.key-input {
  width: 4rem;
}

.key-input-wide {
  flex: 1;
  min-width: 10rem;
}

.editor-hint {
  font-size: 0.85rem;
  color: #555;
  margin: 0 0 0.75rem;
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #bdd7ee;
  border-radius: 4px;
  background: #f8fbfd;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.other-config {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #bdd7ee;
}

.type-select {
  min-width: 12rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}
</style>
