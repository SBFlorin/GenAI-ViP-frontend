<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { useToast } from 'primevue/usetoast';
import {
  MEDIC_ADDRESSING_OPTIONS,
  type MedicAddressingOption
} from '@/constants/evaluatorChat';

const evaluatorStore = useEvaluatorStore();
const toast = useToast();

const newName = ref('');
const medicAddressing = ref<MedicAddressingOption | ''>('');
const consentAccepted = ref(false);
const starting = ref(false);
const formError = ref('');

const emit = defineEmits<{ selected: [] }>();

onMounted(async () => {
  try {
    await evaluatorStore.fetchConsent();
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Eroare',
      detail: 'Nu s-a putut încărca textul de consimțământ',
      life: 4000
    });
  }
});

const onCreate = async () => {
  formError.value = '';
  const name = newName.value.trim();
  if (name.length < 2) {
    formError.value = 'Introduceți un nume de utilizator (minim 2 caractere).';
    toast.add({
      severity: 'warn',
      summary: 'Nume utilizator necesar',
      detail: formError.value,
      life: 3500
    });
    return;
  }
  if (!medicAddressing.value) {
    formError.value = 'Selectați „Domnul doctor” sau „Doamna doctor”.';
    toast.add({
      severity: 'warn',
      summary: 'Forma de adresare',
      detail: formError.value,
      life: 3500
    });
    return;
  }
  if (!consentAccepted.value) {
    formError.value =
      'Confirmați că ați citit și acceptați consimțământul informat.';
    toast.add({
      severity: 'warn',
      summary: 'Consimțământ necesar',
      detail: formError.value,
      life: 3500
    });
    return;
  }
  starting.value = true;
  try {
    const { resumed } = await evaluatorStore.createAttempt(
      name,
      medicAddressing.value,
      true
    );
    if (!evaluatorStore.progress) {
      throw new Error('Nu s-a putut încărca progresul evaluării.');
    }
    if (resumed) {
      toast.add({
        severity: 'info',
        summary: 'Sesiune reluată',
        detail: 'Continuați evaluarea de unde ați rămas.',
        life: 3500
      });
    }
    emit('selected');
  } catch (e: any) {
    formError.value = e.message || 'Nu s-a putut începe evaluarea';
    toast.add({
      severity: 'error',
      summary: 'Eroare',
      detail: formError.value,
      life: 4000
    });
  } finally {
    starting.value = false;
  }
};
</script>

<template>
  <div class="picker evaluator-card">
    <h1 class="picker-title">Studiu evaluare</h1>
    <p class="evaluator-subtle picker-intro">
      Evaluarea este anonimă. Alegeți un nume de utilizator (alias), forma de adresare și confirmați
      consimțământul informat. Dacă întrerupeți evaluarea, o puteți relua ulterior cu același nume de
      utilizator.
    </p>

    <form class="new-session" @submit.prevent="onCreate">
      <h2 class="section-title">Identificare evaluator</h2>
      <label class="name-label" for="participant-name">Nume utilizator</label>
      <p class="field-hint evaluator-subtle">
        Alegeți un nume de utilizator, de exemplu, evaluator64. Dacă nu finalizați evaluarea într-o
        singură sesiune, o veți putea relua ulterior folosind numele de utilizator respectiv. Vă
        recomandăm să îl rețineți sau să îl notați.
      </p>
      <InputText
        id="participant-name"
        v-model="newName"
        class="w-full eval-field"
        placeholder="ex. evaluator64"
        autocomplete="username"
        @input="formError = ''"
      />

      <label class="name-label mt-3">Forma de adresare</label>
      <div class="radio-col">
        <label v-for="opt in MEDIC_ADDRESSING_OPTIONS" :key="opt" class="radio-row">
          <RadioButton
            v-model="medicAddressing"
            name="medicAddressing"
            :inputId="`addressing-${opt}`"
            :value="opt"
            @update:modelValue="formError = ''"
          />
          <span>{{ opt }}</span>
        </label>
      </div>

      <section class="consent-section">
        <h2 class="section-title">Consimțământ informat pentru participare la studiu</h2>
        <div class="consent-text evaluator-subtle">
          {{ evaluatorStore.consentText }}
        </div>
        <label class="consent-check">
          <Checkbox
            v-model="consentAccepted"
            :binary="true"
            inputId="consent-accepted"
            @update:modelValue="formError = ''"
          />
          <span>
            Confirm că am citit și înțeles informațiile de mai sus și îmi exprim acordul voluntar
            de a participa la acest studiu.
          </span>
        </label>
      </section>

      <p v-if="formError" class="error-text" role="alert">{{ formError }}</p>

      <div class="actions-top">
        <Button
          label="Începe evaluarea"
          :loading="starting"
          :disabled="starting"
          @click="onCreate"
        />
      </div>
    </form>
  </div>
</template>

<style scoped>
.picker {
  max-width: 640px;
  margin: 0 auto;
}

.picker-title {
  font-size: 1.35rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.picker-intro {
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.new-session {
  margin-bottom: 1.5rem;
}

.name-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.field-hint {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  line-height: 1.45;
}

.mt-3 {
  margin-top: 0.75rem;
}

.radio-col {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.35rem;
  margin-bottom: 0.25rem;
}

.radio-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.consent-section {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 2px solid #2f5597;
}

.consent-text {
  max-height: 280px;
  overflow-y: auto;
  padding: 0.75rem;
  border: 1px solid #bdd7ee;
  border-radius: 6px;
  background: #fff;
  white-space: pre-wrap;
  line-height: 1.45;
  margin-bottom: 0.75rem;
}

.consent-check {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-weight: 600;
  line-height: 1.4;
}

.actions-top {
  margin-top: 0.75rem;
  display: flex;
  justify-content: flex-end;
}
</style>
