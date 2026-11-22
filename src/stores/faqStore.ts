import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useFaqStore = defineStore('faqStore', () => {
    const questions = ref([
        'Ce este SMRF?',
        'Care sunt beneficiile SMRF?',
        'Ce eficiență are SMRF?',
        'Cine trebuie să aplice SMRF?',
        'Unde se aplică SMRF?',
        'Cum se aplică SMRF?'
    ]);

    const faqs = ref([
        {
            title: 'Ce este sfatul minimal de renunțare la fumat?',
            content: 'Tratarea dependenței de tutun necesită o combinație de sfaturi medicale, farmacoterapie și psihoterapie de susținere.<br> Există un număr mare de metode de abordare a tratamentului dependenței de tutun.<br> Sfatul minima de renunțare la fumat (SMRF) este una dintre cele mai rapide și mai ușor implementat metode.'
        },
        {
            title: 'Care sunt beneficiile SMRF?',
            content: 'Beneficiile sfatului minimal de renunțare la fumat (SMRF) includ o abordare rapidă și eficientă a tratamentului dependenței de tutun. Aceasta poate duce la o reducere semnificativă a consumului de tutun și la îmbunătățirea sănătății generale a pacientului.'
        },
        {
            title: 'Ce eficiență are SMRF?',
            content: 'Eficiența SMRF variază în funcție de individ, dar studiile arată că poate duce la o reducere semnificativă a consumului de tutun în rândul pacienților care primesc acest tip de consiliere.'
        },
        {
            title: 'Cine trebuie să aplice SMRF?',
            content: 'Sfatul minimal de renunțare la fumat (SMRF) poate fi aplicat de către orice profesionist din domeniul sănătății care lucrează cu pacienți dependenți de tutun. Aceasta include medici, asistente medicale, psihologi și alți specialiști în sănătate.'
        },
        {
            title: 'Unde se aplică SMRF?',
            content: 'SMRF poate fi aplicat în diverse medii, inclusiv spitale, clinici, cabinete medicale și centre de consiliere pentru dependența de tutun. Este o metodă flexibilă care poate fi adaptată la nevoile specifice ale fiecărui pacient.'
        },
        {
            title: 'Cum se aplică SMRF?',
            content: 'Aplicarea SMRF implică furnizarea de sfaturi și suport pacienților pentru a-i ajuta să renunțe la fumat. Aceasta poate include discuții despre beneficiile renunțării, strategii de gestionare a simptomelor de sevraj și suport continuu pentru a menține abstinența.'
        }
    ]);

    return { questions, faqs };
});