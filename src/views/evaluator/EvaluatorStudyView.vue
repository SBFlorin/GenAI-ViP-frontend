<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '@/stores/appStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { useEvaluatorFormsStore } from '@/stores/evaluatorFormsStore';
import { useChatStore } from '@/stores/chatStore';
import EvaluatorAttemptPicker from '@/components/evaluator/EvaluatorAttemptPicker.vue';
import ExpertProfileForm from '@/components/evaluator/ExpertProfileForm.vue';
import EvaluatorChatPanel from '@/components/evaluator/EvaluatorChatPanel.vue';
import SessionEvaluationForm from '@/components/evaluator/SessionEvaluationForm.vue';
import OverallEvaluationForm from '@/components/evaluator/OverallEvaluationForm.vue';
import PersonaProfilePanel from '@/components/evaluator/PersonaProfilePanel.vue';
import { useToast } from 'primevue/usetoast';

const appStore = useAppStore();
const evaluatorStore = useEvaluatorStore();
const formsStore = useEvaluatorFormsStore();
const chatStore = useChatStore();
const toast = useToast();

const showPicker = ref(true);
const showEvalForm = ref(false);
const chatComplete = ref(false);
const saving = ref(false);
const evalFormRef = ref<InstanceType<typeof SessionEvaluationForm> | null>(null);
const overallEvalFormRef = ref<InstanceType<typeof OverallEvaluationForm> | null>(null);

const breadcrumbData = [
  { label: 'evaluator', route: '/evaluator' },
  { label: 'studiu' }
];
appStore.breadcrumb = breadcrumbData;
appStore.footerInfo = [
  { icon: 'medic-dark-blue', text: 'Studiu evaluare — sesiuni per evaluator' }
];

const sessionOrder = computed(() => evaluatorStore.currentPersonaIndex);
const persona = computed(() => evaluatorStore.currentPersona);
const sessionRecord = computed(() => evaluatorStore.currentSession);

const sessionMeta = computed(() => {
  const convId = sessionRecord.value?.conversationId;
  return {
    sessionId: convId ?? '—',
    sessionDate: new Date().toLocaleString('ro-RO'),
    defaultScenario: mapScenarioTitleToEnglish(persona.value?.scenarioTitle)
  };
});

function mapScenarioTitleToEnglish(title?: string) {
  if (title === 'Pacient nefumător') return 'Non-smoker';
  if (title === 'Fost fumător') return 'Former smoker';
  if (title === 'Fumător interesat') return 'Smoker interested in quitting';
  if (title === 'Fumător neinteresat') return 'Smoker not interested in quitting';
  return 'Former smoker';
}

const saveAndNextLabel = computed(() => {
  if (sessionOrder.value >= evaluatorStore.totalPersonas) {
    return 'Salvați și finalizați studiul';
  }
  return 'Salvați și afișați scenariul următor';
});

const showChatPanel = computed(() => !showEvalForm.value && !chatComplete.value);

const applyResumeState = () => {
  if (evaluatorStore.studyCompleted && !evaluatorStore.overallEvaluationSubmitted) {
    chatComplete.value = false;
    showEvalForm.value = false;
    return;
  }

  if (evaluatorStore.evaluationSubmitted) {
    chatComplete.value = true;
    showEvalForm.value = true;
    return;
  }

  if (evaluatorStore.chatCompleted) {
    chatComplete.value = true;
    showEvalForm.value = true;
    return;
  }

  chatComplete.value = false;
  showEvalForm.value = false;
};

const initStudy = async () => {
  evaluatorStore.restoreActiveAttemptIdFromStorage();

  if (evaluatorStore.activeAttemptId) {
    try {
      await evaluatorStore.fetchProgress();
      showPicker.value = false;
      applyResumeState();
      return;
    } catch {
      evaluatorStore.clearActiveAttempt();
    }
  }

  showPicker.value = true;
};

onMounted(async () => {
  try {
    await Promise.all([formsStore.ensureLoadedForEvaluator(), initStudy()]);
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Eroare',
      detail: evaluatorStore.error || 'Nu s-a putut încărca studiul',
      life: 4000
    });
  }
});

const onAttemptSelected = async () => {
  if (!evaluatorStore.progress && evaluatorStore.activeAttemptId) {
    try {
      await evaluatorStore.fetchProgress();
    } catch (e: any) {
      toast.add({
        severity: 'error',
        summary: 'Eroare',
        detail: e.message || 'Nu s-a putut încărca progresul evaluării',
        life: 4000
      });
      evaluatorStore.clearActiveAttempt();
      showPicker.value = true;
      return;
    }
  }
  showPicker.value = false;
  chatComplete.value = false;
  showEvalForm.value = false;
  applyResumeState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const onChangeParticipant = () => {
  evaluatorStore.clearActiveAttempt();
  showPicker.value = true;
  chatComplete.value = false;
  showEvalForm.value = false;
};

const onProfileSubmit = async (data: Record<string, unknown>) => {
  saving.value = true;
  try {
    await evaluatorStore.saveProfile(data);
    toast.add({ severity: 'success', summary: 'Profil salvat', life: 3000 });
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Eroare', detail: e.message, life: 4000 });
  } finally {
    saving.value = false;
  }
};

const onChatComplete = () => {
  chatComplete.value = true;
  showEvalForm.value = true;
};

const onSaveAndNext = async () => {
  saving.value = true;
  try {
    if (!evaluatorStore.evaluationSubmitted) {
      const data = evalFormRef.value?.validateAndBuildPayload();
      if (!data) {
        return;
      }
      await evaluatorStore.saveEvaluation(sessionOrder.value, data);
    }

    await evaluatorStore.advance();
    chatComplete.value = false;
    showEvalForm.value = false;
    chatStore.clearCurrentConversation();
    toast.add({ severity: 'success', summary: 'Progres salvat', life: 3000 });
    if (evaluatorStore.studyCompleted) {
      await evaluatorStore.fetchAttempts();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Eroare', detail: e.message, life: 4000 });
  } finally {
    saving.value = false;
  }
};

const onOverallEvaluationSubmit = async (data: Record<string, unknown>) => {
  saving.value = true;
  try {
    await evaluatorStore.saveOverallEvaluation(data);
    toast.add({ severity: 'success', summary: 'Evaluare finală trimisă', life: 3000 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Eroare', detail: e.message, life: 4000 });
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="study-view">
    <EvaluatorAttemptPicker v-if="showPicker" @selected="onAttemptSelected" />

    <template v-else>
      <div class="participant-bar evaluator-card">
        <div>
          <span class="bar-label">Nume utilizator:</span>
          <strong>{{ evaluatorStore.participantName }}</strong>
          <span
            v-if="evaluatorStore.medicGender === 'femeie'"
            class="bar-addressing evaluator-subtle"
          >
            — Doamna doctor
          </span>
          <span
            v-else-if="evaluatorStore.medicGender === 'barbat'"
            class="bar-addressing evaluator-subtle"
          >
            — Domnul doctor
          </span>
        </div>
        <Button label="Schimbă numele de utilizator" outlined size="small" @click="onChangeParticipant" />
      </div>

      <div
        v-if="evaluatorStore.loading && !evaluatorStore.progress"
        class="loading-panel evaluator-card"
      >
        Se încarcă studiul...
      </div>

      <div
        v-else-if="evaluatorStore.studyCompleted && evaluatorStore.overallEvaluationSubmitted"
        class="complete-panel evaluator-card"
      >
        <h1 class="study-title">Studiu finalizat</h1>
        <p class="evaluator-muted">
          {{ evaluatorStore.participantName }} — evaluarea celor
          {{ evaluatorStore.totalPersonas }} personaje și evaluarea finală a aplicației sunt
          complete.
        </p>
        <div class="complete-actions">
          <Button label="Înapoi la identificare" @click="onChangeParticipant" />
        </div>
      </div>

      <OverallEvaluationForm
        v-else-if="evaluatorStore.studyCompleted && !evaluatorStore.overallEvaluationSubmitted"
        ref="overallEvalFormRef"
        :disabled="saving"
        @submit="onOverallEvaluationSubmit"
      />

      <ExpertProfileForm
        v-else-if="!evaluatorStore.profileCompleted"
        @submit="onProfileSubmit"
      />

      <div v-else class="session-flow">
        <header class="session-header evaluator-card">
          <p class="session-step">SESIUNE CURENTĂ</p>
          <h1 class="study-title">
            Scenariul {{ sessionOrder }} din {{ evaluatorStore.totalPersonas }}
          </h1>
        </header>

        <PersonaProfilePanel :persona="persona" />

        <EvaluatorChatPanel
          v-if="showChatPanel"
          :key="`chat-${sessionOrder}`"
          :session-order="sessionOrder"
          :persona-name="persona?.name ?? ''"
          @chat-complete="onChatComplete"
        />

        <SessionEvaluationForm
          v-if="showEvalForm && chatComplete"
          :key="`eval-${sessionOrder}`"
          ref="evalFormRef"
          class="eval-section"
          :session-id="sessionMeta.sessionId"
          :session-date="sessionMeta.sessionDate"
          :persona-name="persona?.name ?? ''"
          :persona-scenario-id="persona?.scenarioId ?? ''"
          :default-scenario="sessionMeta.defaultScenario"
          :disabled="evaluatorStore.evaluationSubmitted"
        />

        <div v-if="showEvalForm && chatComplete" class="advance-row">
          <Button
            :label="saveAndNextLabel"
            :loading="saving"
            :disabled="saving"
            @click="onSaveAndNext"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.study-view {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 1.25rem 0 2rem;
}

.participant-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
}

.bar-label {
  margin-right: 0.35rem;
}

.loading-panel,
.complete-panel {
  text-align: center;
  padding: 2rem 1rem;
}

.complete-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
}

.session-flow {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.session-step {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #2f5597;
  margin-bottom: 0.35rem;
}

.study-title {
  font-size: 1.35rem;
  line-height: 1.3;
  font-weight: 700;
  text-transform: none;
}

.persona-name {
  margin-top: 0.5rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: #000;
}

.advance-row {
  display: flex;
  justify-content: flex-end;
}
</style>
