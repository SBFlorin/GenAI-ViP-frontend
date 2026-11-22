<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppStore } from "@/stores/appStore";

const settingsStore = useSettingsStore();
// Load settings on mount
onMounted(async () => {
    const settings = await settingsStore.fetchSettings();
    if (settings?.healthProfile) {
        const hp = settings.healthProfile;
        // Assign loaded settings to local refs if present
        if (typeof hp.sex !== 'undefined') sex.value = hp.sex;
        if (typeof hp.varsta1820 !== 'undefined') varsta1820.value = hp.varsta1820;
        if (typeof hp.varsta2030 !== 'undefined') varsta2030.value = hp.varsta2030;
        if (typeof hp.varsta3140 !== 'undefined') varsta3140.value = hp.varsta3140;
        if (typeof hp.varsta4150 !== 'undefined') varsta4150.value = hp.varsta4150;
        if (typeof hp.varsta5160 !== 'undefined') varsta5160.value = hp.varsta5160;
        if (typeof hp.varsta6170 !== 'undefined') varsta6170.value = hp.varsta6170;
        if (typeof hp.varsta71 !== 'undefined') varsta71.value = hp.varsta71;
        if (typeof hp.nivelEducatiePrimara !== 'undefined') nivelEducatiePrimara.value = hp.nivelEducatiePrimara;
        if (typeof hp.nivelEducatieLiceu !== 'undefined') nivelEducatieLiceu.value = hp.nivelEducatieLiceu;
        if (typeof hp.nivelEducatieUniversitate !== 'undefined') nivelEducatieUniversitate.value = hp.nivelEducatieUniversitate;
        if (typeof hp.fumatorNiciodata !== 'undefined') fumatorNiciodata.value = hp.fumatorNiciodata;
        if (typeof hp.fumatorFost !== 'undefined') fumatorFost.value = hp.fumatorFost;
        if (typeof hp.fumatorActual !== 'undefined') fumatorActual.value = hp.fumatorActual;
        if (typeof hp.fumeazaDe1An !== 'undefined') fumeazaDe1An.value = hp.fumeazaDe1An;
        if (typeof hp.fumeazaDe2_5Ani !== 'undefined') fumeazaDe2_5Ani.value = hp.fumeazaDe2_5Ani;
        if (typeof hp.fumeazaDe6_10Ani !== 'undefined') fumeazaDe6_10Ani.value = hp.fumeazaDe6_10Ani;
        if (typeof hp.fumeazaDeMaiMultDe10Ani !== 'undefined') fumeazaDeMaiMultDe10Ani.value = hp.fumeazaDeMaiMultDe10Ani;
        if (typeof hp.fumeazaSub5Tigari !== 'undefined') fumeazaSub5Tigari.value = hp.fumeazaSub5Tigari;
        if (typeof hp.fumeazaIntre6_10Tigari !== 'undefined') fumeazaIntre6_10Tigari.value = hp.fumeazaIntre6_10Tigari;
        if (typeof hp.fumeazaPeste10Tigari !== 'undefined') fumeazaPeste10Tigari.value = hp.fumeazaPeste10Tigari;
        if (typeof hp.cunoastereFumat !== 'undefined') cunoastereFumat.value = hp.cunoastereFumat;
        if (typeof hp.fumatorDe1An !== 'undefined') fumatorDe1An.value = hp.fumatorDe1An;
        if (typeof hp.fumatorDe2_5Ani !== 'undefined') fumatorDe2_5Ani.value = hp.fumatorDe2_5Ani;
        if (typeof hp.fumatorDe6_10Ani !== 'undefined') fumatorDe6_10Ani.value = hp.fumatorDe6_10Ani;
        if (typeof hp.sub5TigariFumate !== 'undefined') sub5TigariFumate.value = hp.sub5TigariFumate;
        if (typeof hp.intre6_10Tigari !== 'undefined') intre6_10Tigari.value = hp.intre6_10Tigari;
        if (typeof hp.peste10TigariFumate !== 'undefined') peste10TigariFumate.value = hp.peste10TigariFumate;
        if (typeof hp.interesRenuntareFumat !== 'undefined') interesRenuntareFumat.value = hp.interesRenuntareFumat;
        if (typeof hp.incredereRenuntareFumat !== 'undefined') incredereRenuntareFumat.value = hp.incredereRenuntareFumat;
    }
});
const appStore = useAppStore();

const breadcrumbData = ref([
    { label: 'admin', route: '/admin' },
    { label: 'setari' },
]);
appStore.breadcrumb = breadcrumbData.value;

const sex = ref(false);

const varsta1820 = ref<number | null>(100);
const varsta2030 = ref<number | null>(0);
const varsta3140 = ref<number | null>(0);
const varsta4150 = ref<number | null>(0);
const varsta5160 = ref<number | null>(0);
const varsta6170 = ref<number | null>(0);
const varsta71 = ref<number | null>(0);

const ageFields = [varsta1820, varsta2030, varsta3140, varsta4150, varsta5160, varsta6170, varsta71];

let lastAgeIdx: number | null = null;
ageFields.forEach((f, idx) => {
    watch(f, () => {
        lastAgeIdx = idx;
        enforceAgeSumConstraint();
    });
});


const enforceAgeSumConstraint = () => {
    const values = ageFields.map(f => f.value ?? 0);
    let sum = values.reduce((a, b) => a + b, 0);

    if (sum > 100 && lastAgeIdx !== null) {
        let excess = sum - 100;
        for (let i = 0; i < ageFields.length; i++) {
            if (i === lastAgeIdx) continue;
            let v = ageFields[i].value ?? 0;
            if (v > 0) {
                let toSubtract = Math.min(v, excess);
                ageFields[i].value = v - toSubtract;
                excess -= toSubtract;
                if (excess === 0) break;
            }
        }
    }

    sum = ageFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
    if (sum === 100) {
        ageFields.forEach(f => {
            if (f.value === null) f.value = 0;
        });
    }
    // If sum < 100, add missing amount to last changed field
    if (sum < 100 && lastAgeIdx !== null) {
        ageFields[lastAgeIdx].value = (ageFields[lastAgeIdx].value ?? 0) + (100 - sum);
    }
}

const nivelEducatiePrimara = ref<number | null>(100);
const nivelEducatieLiceu = ref<number | null>(0);
const nivelEducatieUniversitate = ref<number | null>(0);

const educationFields = [nivelEducatiePrimara, nivelEducatieLiceu, nivelEducatieUniversitate];


let lastEducationIdx: number | null = null;
educationFields.forEach((f, idx) => {
    watch(f, () => {
        lastEducationIdx = idx;
        enforceEducationSumConstraint();
    });
});


const enforceEducationSumConstraint = () => {
    const values = educationFields.map(f => f.value ?? 0);
    let sum = values.reduce((a, b) => a + b, 0);

    if (sum > 100 && lastEducationIdx !== null) {
        let excess = sum - 100;
        for (let i = 0; i < educationFields.length; i++) {
            if (i === lastEducationIdx) continue;
            let v = educationFields[i].value ?? 0;
            if (v > 0) {
                let toSubtract = Math.min(v, excess);
                educationFields[i].value = v - toSubtract;
                excess -= toSubtract;
                if (excess === 0) break;
            }
        }
    }

    sum = educationFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
    if (sum === 100) {
        educationFields.forEach(f => {
            if (f.value === null) f.value = 0;
        });
    }
    // If sum < 100, add missing amount to last changed field
    if (sum < 100 && lastEducationIdx !== null) {
        educationFields[lastEducationIdx].value = (educationFields[lastEducationIdx].value ?? 0) + (100 - sum);
    }
}

educationFields.forEach(f => {
    watch(f, enforceEducationSumConstraint);
});


// Statutul de fumător
const fumatorNiciodata = ref<number | null>(100);
const fumatorFost = ref<number | null>(0);
const fumatorActual = ref<number | null>(0);

const smokingFields = [fumatorNiciodata, fumatorFost, fumatorActual];
let lastSmokingIdx: number | null = null;
smokingFields.forEach((f, idx) => {
    watch(f, () => {
        lastSmokingIdx = idx;
        enforceSmokingSumConstraint();
    });
});



const enforceSmokingSumConstraint = () => {
    const values = smokingFields.map(f => f.value ?? 0);
    let sum = values.reduce((a, b) => a + b, 0);

    if (sum > 100 && lastSmokingIdx !== null) {
        let excess = sum - 100;
        for (let i = 0; i < smokingFields.length; i++) {
            if (i === lastSmokingIdx) continue;
            let v = smokingFields[i].value ?? 0;
            if (v > 0) {
                let toSubtract = Math.min(v, excess);
                smokingFields[i].value = v - toSubtract;
                excess -= toSubtract;
                if (excess === 0) break;
            }
        }
    }

    sum = smokingFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
    if (sum === 100) {
        smokingFields.forEach(f => {
            if (f.value === null) f.value = 0;
        });
    }
    // If sum < 100, distribute missing amount to all fields, prioritizing last changed
    if (sum < 100 && lastSmokingIdx !== null) {
        let missing = 100 - sum;
        // Try to add to last changed field first
        smokingFields[lastSmokingIdx].value = (smokingFields[lastSmokingIdx].value ?? 0) + missing;
        sum = smokingFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
        // If still less than 100 (e.g. last field is locked at max), distribute to others
        if (sum < 100) {
            missing = 100 - sum;
            for (let i = 0; i < smokingFields.length; i++) {
                if (i === lastSmokingIdx) continue;
                smokingFields[i].value = (smokingFields[i].value ?? 0) + missing;
                break;
            }
        }
    }
}


// Durata fumatului (în cazul fumătorilor)
const fumeazaDe1An = ref<number | null>(100);
const fumeazaDe2_5Ani = ref<number | null>(0);
const fumeazaDe6_10Ani = ref<number | null>(0);
const fumeazaDeMaiMultDe10Ani = ref<number | null>(0);
const fumeazaSub5Tigari = ref<number | null>(100);
const fumeazaIntre6_10Tigari = ref<number | null>(0);
const fumeazaPeste10Tigari = ref<number | null>(0);

const durationFields = [fumeazaDe1An, fumeazaDe2_5Ani, fumeazaDe6_10Ani, fumeazaDeMaiMultDe10Ani];
let lastDurationIdx: number | null = null;
durationFields.forEach((f, idx) => {
    watch(f, () => {
        lastDurationIdx = idx;
        enforceDurationSumConstraint();
    });
});

const enforceDurationSumConstraint = () => {
    const values = durationFields.map(f => f.value ?? 0);
    let sum = values.reduce((a, b) => a + b, 0);

    if (sum > 100 && lastDurationIdx !== null) {
        let excess = sum - 100;
        for (let i = 0; i < durationFields.length; i++) {
            if (i === lastDurationIdx) continue;
            let v = durationFields[i].value ?? 0;
            if (v > 0) {
                let toSubtract = Math.min(v, excess);
                durationFields[i].value = v - toSubtract;
                excess -= toSubtract;
                if (excess === 0) break;
            }
        }
    }

    sum = durationFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
    if (sum === 100) {
        durationFields.forEach(f => {
            if (f.value === null) f.value = 0;
        });
    }
    // If sum < 100, distribute missing amount to all fields, prioritizing last changed
    if (sum < 100 && lastDurationIdx !== null) {
        let missing = 100 - sum;
        durationFields[lastDurationIdx].value = (durationFields[lastDurationIdx].value ?? 0) + missing;
        sum = durationFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
        if (sum < 100) {
            missing = 100 - sum;
            for (let i = 0; i < durationFields.length; i++) {
                if (i === lastDurationIdx) continue;
                durationFields[i].value = (durationFields[i].value ?? 0) + missing;
                break;
            }
        }
    }
}

const cigFields = [fumeazaSub5Tigari, fumeazaIntre6_10Tigari, fumeazaPeste10Tigari];
let lastCigIdx: number | null = null;
cigFields.forEach((f, idx) => {
    watch(f, () => {
        lastCigIdx = idx;
        enforceCigSumConstraint();
    });
});

const enforceCigSumConstraint = () => {
    const values = cigFields.map(f => f.value ?? 0);
    let sum = values.reduce((a, b) => a + b, 0);

    if (sum > 100 && lastCigIdx !== null) {
        let excess = sum - 100;
        for (let i = 0; i < cigFields.length; i++) {
            if (i === lastCigIdx) continue;
            let v = cigFields[i].value ?? 0;
            if (v > 0) {
                let toSubtract = Math.min(v, excess);
                cigFields[i].value = v - toSubtract;
                excess -= toSubtract;
                if (excess === 0) break;
            }
        }
    }

    sum = cigFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
    if (sum === 100) {
        cigFields.forEach(f => {
            if (f.value === null) f.value = 0;
        });
    }
    // If sum < 100, distribute missing amount to all fields, prioritizing last changed
    if (sum < 100 && lastCigIdx !== null) {
        let missing = 100 - sum;
        cigFields[lastCigIdx].value = (cigFields[lastCigIdx].value ?? 0) + missing;
        sum = cigFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
        if (sum < 100) {
            missing = 100 - sum;
            for (let i = 0; i < cigFields.length; i++) {
                if (i === lastCigIdx) continue;
                cigFields[i].value = (cigFields[i].value ?? 0) + missing;
                break;
            }
        }
    }
}

// Cunoastere despre fumat (consecințele fumatului)
const cunoastereFumat = ref(false);


// În cazul fumătorilor actuali - Durata fumatului
const fumatorDe1An = ref<number | null>(100);
const fumatorDe2_5Ani = ref<number | null>(0);
const fumatorDe6_10Ani = ref<number | null>(0);

const actualDurationFields = [fumatorDe1An, fumatorDe2_5Ani, fumatorDe6_10Ani];
let lastActualDurationIdx: number | null = null;
actualDurationFields.forEach((f, idx) => {
    watch(f, () => {
        lastActualDurationIdx = idx;
        enforceActualDurationSumConstraint();
    });
});

const enforceActualDurationSumConstraint = () => {
    const values = actualDurationFields.map(f => f.value ?? 0);
    let sum = values.reduce((a, b) => a + b, 0);

    if (sum > 100 && lastActualDurationIdx !== null) {
        let excess = sum - 100;
        for (let i = 0; i < actualDurationFields.length; i++) {
            if (i === lastActualDurationIdx) continue;
            let v = actualDurationFields[i].value ?? 0;
            if (v > 0) {
                let toSubtract = Math.min(v, excess);
                actualDurationFields[i].value = v - toSubtract;
                excess -= toSubtract;
                if (excess === 0) break;
            }
        }
    }

    sum = actualDurationFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
    if (sum === 100) {
        actualDurationFields.forEach(f => {
            if (f.value === null) f.value = 0;
        });
    }
    // If sum < 100, distribute missing amount to all fields, prioritizing last changed
    if (sum < 100 && lastActualDurationIdx !== null) {
        let missing = 100 - sum;
        actualDurationFields[lastActualDurationIdx].value = (actualDurationFields[lastActualDurationIdx].value ?? 0) + missing;
        sum = actualDurationFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
        if (sum < 100) {
            missing = 100 - sum;
            for (let i = 0; i < actualDurationFields.length; i++) {
                if (i === lastActualDurationIdx) continue;
                actualDurationFields[i].value = (actualDurationFields[i].value ?? 0) + missing;
                break;
            }
        }
    }
}

// Add missing ref for sub5TigariFumate
const sub5TigariFumate = ref<number | null>(100);
const intre6_10Tigari = ref<number | null>(0);
const peste10TigariFumate = ref<number | null>(0);

// Sum-to-100 constraint logic for sub5TigariFumate, intre6_10Tigari, peste10TigariFumate
const actualCigFields = [sub5TigariFumate, intre6_10Tigari, peste10TigariFumate];
let lastActualCigIdx: number | null = null;
actualCigFields.forEach((f, idx) => {
    watch(f, () => {
        lastActualCigIdx = idx;
        enforceActualCigSumConstraint();
    });
});

const enforceActualCigSumConstraint = () => {
    const values = actualCigFields.map(f => f.value ?? 0);
    let sum = values.reduce((a, b) => a + b, 0);

    if (sum > 100 && lastActualCigIdx !== null) {
        let excess = sum - 100;
        for (let i = 0; i < actualCigFields.length; i++) {
            if (i === lastActualCigIdx) continue;
            let v = actualCigFields[i].value ?? 0;
            if (v > 0) {
                let toSubtract = Math.min(v, excess);
                actualCigFields[i].value = v - toSubtract;
                excess -= toSubtract;
                if (excess === 0) break;
            }
        }
    }

    sum = actualCigFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
    if (sum === 100) {
        actualCigFields.forEach(f => {
            if (f.value === null) f.value = 0;
        });
    }
    // If sum < 100, distribute missing amount to all fields, prioritizing last changed
    if (sum < 100 && lastActualCigIdx !== null) {
        let missing = 100 - sum;
        actualCigFields[lastActualCigIdx].value = (actualCigFields[lastActualCigIdx].value ?? 0) + missing;
        sum = actualCigFields.map(f => f.value ?? 0).reduce((a, b) => a + b, 0);
        if (sum < 100) {
            missing = 100 - sum;
            for (let i = 0; i < actualCigFields.length; i++) {
                if (i === lastActualCigIdx) continue;
                actualCigFields[i].value = (actualCigFields[i].value ?? 0) + missing;
                break;
            }
        }
    }
}

// Add missing ref for interesRenuntareFumat
const interesRenuntareFumat = ref(false);

// Add missing ref for incredereRenuntareFumat
const incredereRenuntareFumat = ref(false);

// Add the missing handleSaveSettings function
const confirm = useConfirm();
const toast = useToast();

const handleSaveSettings = () => {
    confirm.require({
        message: 'Sigur doriți să salvați setările?',
        header: 'Confirmare salvare',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Da',
        rejectLabel: 'Nu',
        accept: () => {
            settingsStore.setSettings({
                healthProfile: {
                    sex: sex.value,
                    varsta1820: varsta1820.value,
                    varsta2030: varsta2030.value,
                    varsta3140: varsta3140.value,
                    varsta4150: varsta4150.value,
                    varsta5160: varsta5160.value,
                    varsta6170: varsta6170.value,
                    varsta71: varsta71.value,
                    nivelEducatiePrimara: nivelEducatiePrimara.value,
                    nivelEducatieLiceu: nivelEducatieLiceu.value,
                    nivelEducatieUniversitate: nivelEducatieUniversitate.value,
                    fumatorNiciodata: fumatorNiciodata.value,
                    fumatorFost: fumatorFost.value,
                    fumatorActual: fumatorActual.value,
                    fumeazaDe1An: fumeazaDe1An.value,
                    fumeazaDe2_5Ani: fumeazaDe2_5Ani.value,
                    fumeazaDe6_10Ani: fumeazaDe6_10Ani.value,
                    fumeazaDeMaiMultDe10Ani: fumeazaDeMaiMultDe10Ani.value,
                    fumeazaSub5Tigari: fumeazaSub5Tigari.value,
                    fumeazaIntre6_10Tigari: fumeazaIntre6_10Tigari.value,
                    fumeazaPeste10Tigari: fumeazaPeste10Tigari.value,
                    cunoastereFumat: cunoastereFumat.value,
                    fumatorDe1An: fumatorDe1An.value,
                    fumatorDe2_5Ani: fumatorDe2_5Ani.value,
                    fumatorDe6_10Ani: fumatorDe6_10Ani.value,
                    sub5TigariFumate: sub5TigariFumate.value,
                    intre6_10Tigari: intre6_10Tigari.value,
                    peste10TigariFumate: peste10TigariFumate.value,
                    interesRenuntareFumat: interesRenuntareFumat.value,
                    incredereRenuntareFumat: incredereRenuntareFumat.value
                }
            });
            toast.add({ severity: 'success', summary: 'Succes', detail: 'Setările au fost salvate!', life: 3000 });
        },
        reject: () => {
            toast.add({ severity: 'info', summary: 'Anulat', detail: 'Salvarea setărilor a fost anulată.', life: 3000 });
        }
    });
};
</script>

<template>
    <div class="flex flex-col flex-auto gap-4">
        <div class="admin flex flex-auto gap-4">
            <div class="flex flex-col grow-1">
                <div class="title">Caracteristici socio-demografice</div>
                <div class="section flex flex-col gap-2">
                    <div>Sex (% cazuri):</div>
                    <div class="flex justify-start gap-4">
                        <div>Feminin</div>
                        <div>
                            <ToggleSwitch v-model="sex" />
                        </div>
                        <div>Masculin</div>
                    </div>
                </div>
                <div class="section flex flex-col gap-2">
                    <div>Vârstă (% cazuri):</div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- De la 18-20 ani:</div>
                        <div class="general-input">
                            <InputNumber v-model="varsta1820" inputId="varsta1820" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- 20-30 ani:</div>
                        <div class="general-input">
                            <InputNumber v-model="varsta2030" inputId="varsta2030" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- 31-40 ani:</div>
                        <div class="general-input">
                            <InputNumber v-model="varsta3140" inputId="varsta3140" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- 41-50 ani:</div>
                        <div class="general-input">
                            <InputNumber v-model="varsta4150" inputId="varsta4150" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- 51-60 ani:</div>
                        <div class="general-input">
                            <InputNumber v-model="varsta5160" inputId="varsta5160" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- 61-70 ani:</div>
                        <div class="general-input">
                            <InputNumber v-model="varsta6170" inputId="varsta6170" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- 71 ani și peste</div>
                        <div class="general-input">
                            <InputNumber v-model="varsta71" inputId="varsta71" fluid />
                        </div>
                        <div>%</div>
                    </div>
                </div>
                <div class="section flex flex-col gap-2">
                    <div>Nivel de educație:</div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- Primară sau gimnazială:</div>
                        <div class="general-input">
                            <InputNumber v-model="nivelEducatiePrimara" inputId="nivelEducatiePrimara" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- Liceu:</div>
                        <div class="general-input">
                            <InputNumber v-model="nivelEducatieLiceu" inputId="nivelEducatieLiceu" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- Universitate:</div>
                        <div class="general-input">
                            <InputNumber v-model="nivelEducatieUniversitate" inputId="nivelEducatieUniversitate"
                                fluid />
                        </div>
                        <div>%</div>
                    </div>
                </div>
            </div>
            <div class="flex flex-col grow-1">
                <div class="title">Statutul de fumător</div>
                <div class="section flex flex-col gap-2">
                    <div class="flex justify-start items-center gap-4">
                        <div>- Nu a fumat niciodată:</div>
                        <div class="general-input">
                            <InputNumber v-model="fumatorNiciodata" inputId="fumatorNiciodata" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- Fost fumător:</div>
                        <div class="general-input">
                            <InputNumber v-model="fumatorFost" inputId="fumatorFost" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- Fumător actual:</div>
                        <div class="general-input">
                            <InputNumber v-model="fumatorActual" inputId="fumatorActual" fluid />
                        </div>
                        <div>%</div>
                    </div>
                </div>
                <div class="title">Durata fumatului (în cazul fumătorilor)</div>
                <div class="section flex flex-col gap-2">
                    <div class="flex justify-start items-center gap-4">
                        <div>- Fumează de 1 an:</div>
                        <div class="general-input">
                            <InputNumber v-model="fumeazaDe1An" inputId="fumeazaDe1An" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- Fumează de 2-5 ani:</div>
                        <div class="general-input">
                            <InputNumber v-model="fumeazaDe2_5Ani" inputId="fumeazaDe2_5Ani" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- Fumează de 6-10 ani:</div>
                        <div class="general-input">
                            <InputNumber v-model="fumeazaDe6_10Ani" inputId="fumeazaDe6_10Ani" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- Fumează de mai mult de 10 ani:</div>
                        <div class="general-input">
                            <InputNumber v-model="fumeazaDeMaiMultDe10Ani" inputId="fumeazaDeMaiMultDe10Ani" fluid />
                        </div>
                        <div>%</div>
                    </div>
                </div>
                <div class="title">Nr. de țigări fumate /zi (în cazul fumătorilor)</div>
                <div class="section flex flex-col gap-2">
                    <div class="flex justify-start items-center gap-4">
                        <div>- Sub 5 țigări:</div>
                        <div class="general-input">
                            <InputNumber v-model="fumeazaSub5Tigari" inputId="fumeazaSub5Tigari" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- Între 6-10 țigări:</div>
                        <div class="general-input">
                            <InputNumber v-model="fumeazaIntre6_10Tigari" inputId="fumeazaIntre6_10Tigari" fluid />
                        </div>
                        <div>%</div>
                    </div>
                    <div class="flex justify-start items-center gap-4">
                        <div>- Peste 10 țigări:</div>
                        <div class="general-input">
                            <InputNumber v-model="fumeazaPeste10Tigari" inputId="fumeazaPeste10Tigari" fluid />
                        </div>
                        <div>%</div>
                    </div>
                </div>
            </div>
            <div class="flex flex-col grow-1">
                <div class="title">În cazul fumătorilor actuali</div>
                <div class="section flex flex-col gap-2">
                    <div>Cunoștințe despre fumat (consecințele fumatului):</div>
                    <div class="flex justify-start gap-4">
                        <div>Minime</div>
                        <div>
                            <ToggleSwitch v-model="cunoastereFumat" />
                        </div>
                        <div>Exhaustive</div>
                    </div>
                </div>
                <div class="title">Interes față de renunțare la fumat</div>
                <div class="flex justify-start gap-4">
                    <div>Slab</div>
                    <div>
                        <ToggleSwitch v-model="interesRenuntareFumat" />
                    </div>
                    <div>Puternic</div>
                </div>
                <div class="title">Încrederea în capacitatea de a renunța la fumat</div>
                <div class="flex justify-start gap-4">
                    <div>Slab</div>
                    <div>
                        <ToggleSwitch v-model="incredereRenuntareFumat" />
                    </div>
                    <div>Puternică</div>
                </div>
            </div>
        </div>
        <div class="flex justify-center">
            <Button type="button" label="Salvare Setari" @click="handleSaveSettings"></Button>
        </div>
    </div>
</template>

<style scoped>
.admin {
    padding: 20px 0;
}

.title {
    margin-bottom: 10px;
}

.general-input .p-inputtext,
.general-input .p-inputnumber {
    width: 60px;
}

.section {
    margin-bottom: 20px;
}
</style>