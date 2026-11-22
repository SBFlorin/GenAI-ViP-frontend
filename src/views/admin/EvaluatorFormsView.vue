<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/appStore';
import { apiRequest } from '@/apiRequest';
import { downloadAuthenticatedCsv } from '@/downloadCsv';
import { DEFAULT_EVALUATOR_CONSENT_TEXT } from '@/data/defaultEvaluatorConsent';
import { useEvaluatorFormsStore } from '@/stores/evaluatorFormsStore';

const appStore = useAppStore();
const router = useRouter();
const formsStore = useEvaluatorFormsStore();

const breadcrumbData = [
  { label: 'admin', route: '/admin' },
  { label: 'formulare evaluatori' }
];
appStore.breadcrumb = breadcrumbData;

type AttemptRow = {
  id: number;
  participantName: string;
  statusLabel: string;
  profileCompleted: boolean;
  studyCompleted: boolean;
  currentPersonaIndex: number;
  totalPersonas: number;
  completedEvaluations: number;
  updatedAt: string;
  accountLabel: string;
  accountEmail: string | null;
};

const attempts = ref<AttemptRow[]>([]);
const selectedId = ref<number | null>(null);
const detail = ref<any>(null);
const loading = ref(false);
const detailLoading = ref(false);
const error = ref('');
const exportAllLoading = ref(false);
const exportOneLoading = ref<number | null>(null);
const consentText = ref('');
const consentSaving = ref(false);
const consentLoading = ref(false);

const selectedAttempt = computed(() =>
  attempts.value.find((a) => a.id === selectedId.value) ?? null
);

const completedSessions = computed(() =>
  (detail.value?.sessions || []).filter((s: any) => s.hasEvaluation)
);

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('ro-RO');
  } catch {
    return iso;
  }
};

const loadConsent = async () => {
  consentLoading.value = true;
  try {
    const data = await apiRequest('/settings/evaluator-consent');
    consentText.value = data.consentText || DEFAULT_EVALUATOR_CONSENT_TEXT;
  } catch (e: any) {
    error.value = e.message || 'Nu s-a putut încărca textul de consimțământ';
    consentText.value = DEFAULT_EVALUATOR_CONSENT_TEXT;
  } finally {
    consentLoading.value = false;
  }
};

const saveConsent = async () => {
  consentSaving.value = true;
  error.value = '';
  try {
    const data = await apiRequest('/settings/evaluator-consent', {
      method: 'PUT',
      body: JSON.stringify({ consentText: consentText.value })
    });
    consentText.value = data.consentText || consentText.value;
  } catch (e: any) {
    error.value = e.message || 'Salvarea consimțământului a eșuat';
  } finally {
    consentSaving.value = false;
  }
};

const loadAttempts = async () => {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiRequest('/admin/evaluator-attempts');
    attempts.value = data.attempts ?? [];
    if (attempts.value.length && !selectedId.value) {
      await selectAttempt(attempts.value[0].id);
    }
  } catch (e: any) {
    error.value = e.message || 'Nu s-au putut încărca sesiunile';
  } finally {
    loading.value = false;
  }
};

const selectAttempt = async (id: number) => {
  selectedId.value = id;
  detailLoading.value = true;
  error.value = '';
  try {
    detail.value = await apiRequest(`/admin/evaluator-attempts/${id}`);
  } catch (e: any) {
    error.value = e.message || 'Nu s-au putut încărca detaliile';
    detail.value = null;
  } finally {
    detailLoading.value = false;
  }
};

const formatList = (arr: unknown) => {
  if (!Array.isArray(arr) || !arr.length) return '—';
  return arr.join(', ');
};

const likertLabel = (sectionKey: string, idx: number) => formsStore.likertLabel(sectionKey, idx);

const openFormEditor = (formKey: 'expertProfile' | 'sessionEvaluation' | 'overallEvaluation') => {
  router.push({ name: 'admin.evaluatorFormEdit', params: { formKey } });
};

const downloadAllCsv = async () => {
  exportAllLoading.value = true;
  error.value = '';
  try {
    await downloadAuthenticatedCsv(
      '/admin/evaluator-attempts/export/all.csv',
      'evaluator-responses-all.csv'
    );
  } catch (e: any) {
    error.value = e.message || 'Exportul CSV a eșuat';
  } finally {
    exportAllLoading.value = false;
  }
};

const downloadAttemptCsv = async (row: AttemptRow) => {
  exportOneLoading.value = row.id;
  error.value = '';
  try {
    const safeName = row.participantName.replace(/[^\w\-]+/g, '_').slice(0, 40);
    await downloadAuthenticatedCsv(
      `/admin/evaluator-attempts/${row.id}/export.csv`,
      `evaluator-${safeName}-${row.id}.csv`
    );
  } catch (e: any) {
    error.value = e.message || 'Exportul CSV a eșuat';
  } finally {
    exportOneLoading.value = null;
  }
};

const likertEntries = (evaluationData: Record<string, unknown>) => {
  const likert = (evaluationData?.likert as Record<string, number>) || {};
  return Object.entries(likert).map(([key, value]) => {
    const [sectionKey, idxStr] = key.split('-');
    const idx = parseInt(idxStr, 10);
    return {
      key,
      value,
      label: likertLabel(sectionKey, idx)
    };
  });
};

onMounted(() => {
  appStore.topButtons.forEach((btn) => {
    btn.isActive = btn.routeName === 'admin.evaluatorForms';
  });
  formsStore.fetchForAdmin();
  loadConsent();
  loadAttempts();
});
</script>

<template>
  <div class="admin-eval-forms">
    <h1 class="page-title">Formulare evaluatori</h1>
    <p class="page-intro">
      Toate sesiunile deschise pe conturile de evaluator și formularele completate (profil expert + evaluări
      per personaj).
    </p>

    <p v-if="error" class="error-banner">{{ error }}</p>

    <section class="config-section">
      <h2 class="section-title">Configurare formulare (evaluatori)</h2>
      <p class="config-intro">
        Editați textele, opțiunile și secțiunile Likert afișate evaluatorilor în studiu.
      </p>
      <div class="config-buttons">
        <Button
          label="Profil expert (Study 4.0)"
          icon="pi pi-pencil"
          @click="openFormEditor('expertProfile')"
        />
        <Button
          label="Evaluare sesiune (Study 4.A)"
          icon="pi pi-pencil"
          outlined
          @click="openFormEditor('sessionEvaluation')"
        />
        <Button
          label="Evaluare finală (după toate scenariile)"
          icon="pi pi-pencil"
          outlined
          @click="openFormEditor('overallEvaluation')"
        />
      </div>
    </section>

    <section class="config-section">
      <h2 class="section-title">Consimțământ informat (evaluatori)</h2>
      <p class="config-intro">
        Textul afișat evaluatorilor înainte de începerea studiului. Modificările se aplică imediat
        pentru noile sesiuni.
      </p>
      <p v-if="consentLoading" class="loading-text">Se încarcă textul...</p>
      <template v-else>
        <Textarea
          v-model="consentText"
          class="consent-editor w-full"
          rows="14"
          auto-resize
        />
        <div class="config-buttons mt-3">
          <Button
            label="Salvează consimțământul"
            icon="pi pi-save"
            :loading="consentSaving"
            @click="saveConsent"
          />
        </div>
      </template>
    </section>

    <p v-if="loading" class="loading-text">Se încarcă lista...</p>

    <section v-else class="sessions-section">
      <div class="section-head">
        <h2 class="section-title">Sesiuni deschise (toți evaluatorii)</h2>
        <Button
          label="Descarcă toate răspunsurile (CSV)"
          icon="pi pi-download"
          size="small"
          :loading="exportAllLoading"
          :disabled="!attempts.length"
          @click="downloadAllCsv"
        />
      </div>
      <div class="table-wrap">
        <table class="attempts-table">
          <thead>
            <tr>
              <th>Evaluator</th>
              <th>Cont login</th>
              <th>Status</th>
              <th>Evaluări</th>
              <th>Actualizat</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in attempts"
              :key="row.id"
              :class="{ 'row-selected': row.id === selectedId }"
            >
              <td><strong>{{ row.participantName }}</strong></td>
              <td class="cell-small">{{ row.accountLabel }}</td>
              <td>{{ row.statusLabel }}</td>
              <td>{{ row.completedEvaluations }} / {{ row.totalPersonas }}</td>
              <td class="cell-small">{{ formatDate(row.updatedAt) }}</td>
              <td>
                <Button
                  label="Detalii"
                  size="small"
                  :outlined="row.id !== selectedId"
                  @click="selectAttempt(row.id)"
                />
              </td>
              <td>
                <Button
                  label="CSV"
                  icon="pi pi-download"
                  size="small"
                  severity="secondary"
                  outlined
                  :loading="exportOneLoading === row.id"
                  @click="downloadAttemptCsv(row)"
                />
              </td>
            </tr>
            <tr v-if="!attempts.length">
              <td colspan="7" class="empty-cell">Nu există sesiuni salvate.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="selectedId" class="detail-section">
      <div v-if="detailLoading" class="loading-text">Se încarcă formularele...</div>

      <template v-else-if="detail">
        <h2 class="section-title">
          Detalii: {{ detail.participantName }}
          <span v-if="detail.studyCompleted" class="badge-done">Studiu finalizat</span>
        </h2>
        <p class="meta-line">
          Cont: {{ detail.accountLabel }} · Creat: {{ formatDate(detail.createdAt) }} · Actualizat:
          {{ formatDate(detail.updatedAt) }}
        </p>
        <p v-if="detail.consentAcceptedAt" class="meta-line">
          Consimțământ acceptat: {{ formatDate(detail.consentAcceptedAt) }}
        </p>
        <div class="detail-actions">
          <Button
            v-if="selectedAttempt"
            label="Descarcă răspunsurile acestui respondent (CSV)"
            icon="pi pi-download"
            size="small"
            :loading="exportOneLoading === selectedAttempt.id"
            @click="downloadAttemptCsv(selectedAttempt)"
          />
        </div>

        <div class="detail-card">
          <h3>Profil expert (Study 4.0)</h3>
          <template v-if="detail.profileCompleted">
            <dl class="detail-dl">
              <dt>Profesie</dt>
              <dd>{{ formatList(detail.profileData?.professions) }}</dd>
              <dt v-if="detail.profileData?.professionOther">Altă profesie</dt>
              <dd v-if="detail.profileData?.professionOther">
                {{ detail.profileData.professionOther }}
              </dd>
              <dt>Experiență</dt>
              <dd>{{ detail.profileData?.experience || '—' }}</dd>
              <dt>Consiliere renunțare</dt>
              <dd>{{ detail.profileData?.cessationCounselling || '—' }}</dd>
              <dt>Predare</dt>
              <dd>{{ detail.profileData?.teaching || '—' }}</dd>
              <dt>Afilieri</dt>
              <dd>{{ formatList(detail.profileData?.affiliations) }}</dd>
              <dt v-if="detail.profileData?.affiliationOther">Altă afiliere</dt>
              <dd v-if="detail.profileData?.affiliationOther">
                {{ detail.profileData.affiliationOther }}
              </dd>
            </dl>
          </template>
          <p v-else class="muted">Profilul expert nu a fost completat.</p>
        </div>

        <div class="detail-card">
          <h3>Evaluări sesiune completate (Study 4.A)</h3>
          <p v-if="!completedSessions.length" class="muted">
            Niciun formular de evaluare per personaj nu a fost trimis încă.
          </p>

          <div v-for="sess in completedSessions" :key="sess.sessionOrder" class="eval-block">
            <h4>
              Personaj {{ sess.sessionOrder }} — {{ sess.personaName || '—' }}
              <span class="eval-meta">(scenariu {{ sess.scenarioId }})</span>
            </h4>
            <p class="eval-meta">
              Trimis: {{ formatDate(sess.evaluationSubmittedAt) }} · Conversație ID:
              {{ sess.conversationId ?? '—' }}
            </p>

            <dl v-if="sess.evaluationData" class="detail-dl">
              <dt>Scenariu testat</dt>
              <dd>{{ sess.evaluationData.scenarioTested || '—' }}</dd>
              <dt>Schimburi conversație</dt>
              <dd>{{ sess.evaluationData.approxExchanges || '—' }}</dd>
              <dt>Calitate generală (1–5)</dt>
              <dd>{{ sess.evaluationData.overallQuality ?? '—' }}</dd>
            </dl>

            <div v-if="sess.evaluationData?.likert" class="likert-block">
              <h5>Likert (1–5)</h5>
              <ul>
                <li v-for="item in likertEntries(sess.evaluationData)" :key="item.key">
                  <span class="likert-score">{{ item.value }}</span> — {{ item.label }}
                </li>
              </ul>
            </div>

            <dl v-if="sess.evaluationData" class="detail-dl">
              <dt>Aspecte reușite</dt>
              <dd>{{ sess.evaluationData.successComments || '—' }}</dd>
              <dt>Îmbunătățiri</dt>
              <dd>{{ sess.evaluationData.improvementComments || '—' }}</dd>
            </dl>

            <div
              v-if="sess.evaluationData?.errorReport"
              class="error-report"
            >
              <h5>Raport problemă AI</h5>
              <pre>{{ JSON.stringify(sess.evaluationData.errorReport, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.admin-eval-forms {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 1rem 0 2rem;
  color: #000;
}

.page-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #2f5597;
  margin-bottom: 0.35rem;
}

.page-intro {
  margin-bottom: 1.25rem;
  font-size: 0.95rem;
  color: #333;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0;
  color: #2f5597;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.detail-actions {
  margin-bottom: 1rem;
}

.config-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  border: 2px solid #2f5597;
  border-radius: 6px;
  background: #fff;
}

.config-intro {
  font-size: 0.9rem;
  color: #333;
  margin-bottom: 0.75rem;
}

.config-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.mt-3 {
  margin-top: 0.75rem;
}

.consent-editor {
  font-family: inherit;
  line-height: 1.45;
}

.error-banner {
  color: #000;
  font-weight: 700;
  margin-bottom: 1rem;
  padding: 0.5rem;
  border: 2px solid #2f5597;
  background: #fff;
}

.loading-text {
  padding: 1rem 0;
}

.table-wrap {
  overflow-x: auto;
  border: 2px solid #2f5597;
  border-radius: 6px;
  background: #fff;
}

.attempts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.attempts-table th,
.attempts-table td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #bdd7ee;
  color: #000;
}

.attempts-table th {
  background: #bdd7ee;
  font-weight: 700;
}

.attempts-table tr.row-selected {
  background: #eef6fc;
}

.cell-small {
  font-size: 0.8rem;
  max-width: 200px;
}

.empty-cell {
  text-align: center;
  padding: 1.5rem;
  color: #555;
}

.detail-section {
  margin-top: 1.5rem;
}

.meta-line {
  font-size: 0.85rem;
  color: #333;
  margin-bottom: 1rem;
}

.badge-done {
  font-size: 0.75rem;
  font-weight: 700;
  background: #2f5597;
  color: #fff;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
}

.detail-card {
  background: #fff;
  border: 2px solid #2f5597;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.detail-card h3 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: #2f5597;
}

.detail-dl {
  display: grid;
  grid-template-columns: minmax(140px, 200px) 1fr;
  gap: 0.35rem 1rem;
  font-size: 0.9rem;
}

.detail-dl dt {
  font-weight: 600;
}

.detail-dl dd {
  margin: 0;
}

.muted {
  color: #555;
  font-style: italic;
}

.eval-block {
  border-top: 1px solid #bdd7ee;
  padding-top: 0.75rem;
  margin-top: 0.75rem;
}

.eval-block h4 {
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.eval-meta {
  font-size: 0.8rem;
  color: #555;
}

.likert-block ul {
  margin: 0.5rem 0 0 1rem;
  padding: 0;
}

.likert-score {
  display: inline-block;
  min-width: 1.25rem;
  font-weight: 700;
  color: #2f5597;
}

.error-report pre {
  font-size: 0.75rem;
  background: #f5f5f5;
  padding: 0.5rem;
  overflow-x: auto;
  border: 1px solid #ccc;
}
</style>
