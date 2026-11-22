import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiRequest } from '../apiRequest';
import { DEFAULT_EVALUATOR_CONSENT_TEXT } from '@/data/defaultEvaluatorConsent';

const ACTIVE_ATTEMPT_KEY = 'evaluatorActiveAttemptId';

export type PersonaDetailField = {
  key: string;
  label: string;
  value: string;
  multiline?: boolean;
};

export type EvaluatorPersonaProfile = {
  scenarioId: number;
  sessionOrder: number;
  name: string;
  scenarioTitle: string;
  intro: string;
  details: PersonaDetailField[];
};

export type EvaluatorAttemptSummary = {
  id: number;
  participantName: string;
  medicGender?: 'barbat' | 'femeie' | null;
  profileCompleted: boolean;
  currentPersonaIndex: number;
  totalPersonas: number;
  studyCompleted: boolean;
  studyCompletedAt: string | null;
  updatedAt: string;
  statusLabel: string;
};

export const useEvaluatorStore = defineStore('evaluatorStore', () => {
  const attempts = ref<EvaluatorAttemptSummary[]>([]);
  const activeAttemptId = ref<number | null>(null);
  const progress = ref<any>(null);
  const consentText = ref(DEFAULT_EVALUATOR_CONSENT_TEXT);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const activeAttempt = computed(() =>
    attempts.value.find((a) => a.id === activeAttemptId.value) ?? null
  );

  const totalPersonas = computed(() => progress.value?.totalPersonas ?? 0);
  const studyCompleted = computed(() => Boolean(progress.value?.studyCompleted));
  const profileCompleted = computed(() => Boolean(progress.value?.profileCompleted));
  const participantName = computed(
    () => progress.value?.participantName ?? activeAttempt.value?.participantName ?? ''
  );
  const medicGender = computed(
    () => progress.value?.medicGender ?? activeAttempt.value?.medicGender ?? null
  );
  const currentPersonaIndex = computed(() => progress.value?.currentPersonaIndex ?? 1);
  const currentPersona = computed(
    () => (progress.value?.currentPersona ?? null) as EvaluatorPersonaProfile | null
  );
  const currentSession = computed(() => {
    const order = currentPersonaIndex.value;
    return progress.value?.sessions?.find((s: any) => s.sessionOrder === order) ?? null;
  });
  const evaluationSubmitted = computed(
    () => Boolean(currentSession.value?.evaluationSubmittedAt)
  );
  const chatCompleted = computed(() => Boolean(currentSession.value?.chatCompletedAt));
  const isLastPersona = computed(
    () => currentPersonaIndex.value >= totalPersonas.value && !studyCompleted.value
  );
  const overallEvaluationSubmitted = computed(() =>
    Boolean(progress.value?.overallEvaluationSubmitted)
  );

  function persistActiveAttemptId(id: number | null) {
    if (id == null) {
      localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
    } else {
      localStorage.setItem(ACTIVE_ATTEMPT_KEY, String(id));
    }
  }

  function restoreActiveAttemptIdFromStorage() {
    const raw = localStorage.getItem(ACTIVE_ATTEMPT_KEY);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed)) {
        activeAttemptId.value = parsed;
      }
    }
  }

  function attemptPath(suffix = '') {
    if (!activeAttemptId.value) {
      throw new Error('No evaluator attempt selected');
    }
    return `/evaluator/attempts/${activeAttemptId.value}${suffix}`;
  }

  async function fetchConsent() {
    try {
      const data = await apiRequest('/evaluator/consent');
      consentText.value = data.consentText || DEFAULT_EVALUATOR_CONSENT_TEXT;
    } catch {
      consentText.value = DEFAULT_EVALUATOR_CONSENT_TEXT;
    }
  }

  async function fetchAttempts() {
    loading.value = true;
    error.value = null;
    try {
      const data = await apiRequest('/evaluator/attempts');
      attempts.value = data.attempts ?? [];
    } catch (e: any) {
      error.value = e.message || 'Nu s-au putut încărca sesiunile';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function createAttempt(
    participantName: string,
    medicAddressing: string,
    consentAccepted: boolean
  ) {
    loading.value = true;
    error.value = null;
    try {
      const data = await apiRequest('/evaluator/attempts', {
        method: 'POST',
        body: JSON.stringify({
          participantName: participantName.trim(),
          medicAddressing: medicAddressing.trim(),
          consentAccepted
        })
      });
      const attempt = data.attempt as EvaluatorAttemptSummary;
      attempts.value = [attempt, ...attempts.value.filter((a) => a.id !== attempt.id)];
      activeAttemptId.value = attempt.id;
      persistActiveAttemptId(attempt.id);
      progress.value = data.progress;
      return { attempt, resumed: Boolean(data.resumed) };
    } catch (e: any) {
      error.value = e.message || 'Nu s-a putut crea sesiunea';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function selectAttempt(attemptId: number) {
    activeAttemptId.value = attemptId;
    persistActiveAttemptId(attemptId);
    await fetchProgress();
  }

  function clearActiveAttempt() {
    activeAttemptId.value = null;
    progress.value = null;
    persistActiveAttemptId(null);
  }

  async function fetchProgress() {
    if (!activeAttemptId.value) {
      progress.value = null;
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      progress.value = await apiRequest(attemptPath('/progress'));
    } catch (e: any) {
      error.value = e.message || 'Nu s-a putut încărca progresul';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function saveProfile(profileData: Record<string, unknown>) {
    progress.value = await apiRequest(attemptPath('/profile'), {
      method: 'PUT',
      body: JSON.stringify({ profileData })
    });
    await fetchAttempts();
  }

  async function startSession(sessionOrder: number) {
    const data = await apiRequest(attemptPath(`/sessions/${sessionOrder}/start`), {
      method: 'POST'
    });
    progress.value = data.progress;
    await fetchAttempts();
    return {
      conversation: data.conversation,
      openingMessage: data.openingMessage ?? null
    };
  }

  async function markChatComplete(sessionOrder: number) {
    progress.value = await apiRequest(
      attemptPath(`/sessions/${sessionOrder}/chat-complete`),
      { method: 'POST' }
    );
    await fetchAttempts();
  }

  async function saveEvaluation(sessionOrder: number, evaluationData: Record<string, unknown>) {
    progress.value = await apiRequest(attemptPath(`/sessions/${sessionOrder}/evaluation`), {
      method: 'PUT',
      body: JSON.stringify({ evaluationData })
    });
    await fetchAttempts();
  }

  async function advance() {
    progress.value = await apiRequest(attemptPath('/advance'), { method: 'POST' });
    await fetchAttempts();
  }

  async function saveOverallEvaluation(evaluationData: Record<string, unknown>) {
    progress.value = await apiRequest(attemptPath('/overall-evaluation'), {
      method: 'PUT',
      body: JSON.stringify({ evaluationData })
    });
    await fetchAttempts();
  }

  return {
    attempts,
    activeAttemptId,
    activeAttempt,
    progress,
    consentText,
    loading,
    error,
    participantName,
    medicGender,
    totalPersonas,
    studyCompleted,
    profileCompleted,
    currentPersonaIndex,
    currentPersona,
    currentSession,
    evaluationSubmitted,
    chatCompleted,
    isLastPersona,
    overallEvaluationSubmitted,
    restoreActiveAttemptIdFromStorage,
    fetchConsent,
    fetchAttempts,
    createAttempt,
    selectAttempt,
    clearActiveAttempt,
    fetchProgress,
    saveProfile,
    startSession,
    markChatComplete,
    saveEvaluation,
    advance,
    saveOverallEvaluation
  };
});
