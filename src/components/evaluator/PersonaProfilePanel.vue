<script setup lang="ts">
export type PersonaDetailField = {
  key: string;
  label: string;
  value: string;
  multiline?: boolean;
};

export type PersonaProfile = {
  scenarioId: number;
  sessionOrder: number;
  name: string;
  scenarioTitle: string;
  intro: string;
  details: PersonaDetailField[];
};

defineProps<{
  persona: PersonaProfile | null;
}>();
</script>

<template>
  <section v-if="persona" class="persona-profile evaluator-card">
    <div class="persona-profile-header">
      <p class="persona-profile-kicker">PROFIL DE REFERINȚĂ PACIENT VIRTUAL</p>
      <h2 class="persona-profile-title">{{ persona.name }}</h2>
      <p class="persona-profile-intro evaluator-subtle">{{ persona.intro }}</p>
    </div>

    <dl class="persona-details">
      <div
        v-for="field in persona.details"
        :key="field.key"
        class="persona-detail-row"
        :class="{ 'persona-detail-row--multiline': field.multiline }"
      >
        <dt>{{ field.label }}</dt>
        <dd>{{ field.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.persona-profile {
  padding: 1rem 1.1rem;
}

.persona-profile-kicker {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #2f5597;
  margin-bottom: 0.35rem;
}

.persona-profile-title {
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.persona-profile-intro {
  margin-bottom: 0.85rem;
  line-height: 1.45;
}

.persona-details {
  margin: 0;
}

.persona-detail-row {
  display: grid;
  grid-template-columns: minmax(9rem, 34%) 1fr;
  gap: 0.65rem 1rem;
  padding: 0.55rem 0;
  border-top: 1px solid rgba(47, 85, 151, 0.12);
}

.persona-detail-row:first-child {
  border-top: none;
  padding-top: 0;
}

.persona-detail-row dt {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
  color: #2f5597;
}

.persona-detail-row dd {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.45;
  color: #111;
}

.persona-detail-row--multiline dd {
  white-space: pre-wrap;
}

@media (max-width: 640px) {
  .persona-detail-row {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
}
</style>
