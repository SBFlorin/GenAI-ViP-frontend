import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from "@/stores/userStore";

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home.layout',
            component: (): any => import('../layout/PageLayout.vue'),
            children: [
                {
                    path: '',
                    name: 'home',
                    component: (): any => import('../views/HomeView.vue'),
                },
            ]
        },
        {
            path: '/student',
            name: 'student',
            component: (): any => import('../layout/StudentLayout.vue'),
            meta: { protected: true, roles: ['user'] },
            children: [
                {
                    path: 'informare',
                    name: 'student.informare',
                    component: (): any => import('../views/student/InformareView.vue'),
                    meta: { protected: true, roles: ['user'] },
                },
                {
                    path: 'instruire',
                    name: 'student.instruire',
                    component: (): any => import('../views/student/InstruireView.vue'),
                    meta: { protected: true, roles: ['user'] },
                },
        {
            path: 'examinare',
            name: 'student.examinare',
            component: (): any => import('../views/student/ExaminareView.vue'),
            meta: { protected: true, roles: ['user'] },
        },
            ]
        },
        {
            path: '/evaluator',
            name: 'evaluator',
            component: (): any => import('../layout/EvaluatorLayout.vue'),
            meta: { protected: true, roles: ['evaluator'] },
            children: [
                {
                    path: '',
                    name: 'evaluator.study',
                    component: (): any => import('../views/evaluator/EvaluatorStudyView.vue'),
                    meta: { protected: true, roles: ['evaluator'] },
                },
            ]
        },
        {
            path: '/admin',
            name: 'admin.layout',
            component: (): any => import('../layout/AdminLayout.vue'),
            meta: { protected: true, roles: ['admin'] },
            children: [
                {
                    path: '',
                    name: 'admin',
                    component: (): any => import('../views/AdminView.vue'),
                    meta: { protected: true, roles: ['admin'] },
                },
                {
                    path: 'catalog',
                    name: 'admin.catalog',
                    component: (): any => import('../views/admin/CatalogView.vue'),
                    meta: { protected: true, roles: ['admin'] },
                },
                {
                    path: 'statistici',
                    name: 'admin.statistici',
                    component: (): any => import('../views/admin/StatisticiView.vue'),
                    meta: { protected: true, roles: ['admin'] },
                },
                {
                    path: 'formulare-evaluatori',
                    name: 'admin.evaluatorForms',
                    component: (): any => import('../views/admin/EvaluatorFormsView.vue'),
                    meta: { protected: true, roles: ['admin'] },
                },
                {
                    path: 'formulare-evaluatori/edit/:formKey',
                    name: 'admin.evaluatorFormEdit',
                    component: (): any => import('../views/admin/EvaluatorFormEditorView.vue'),
                    meta: { protected: true, roles: ['admin'] },
                },
            ]
        }
    ],
})

function roleHomeName(role: string) {
    if (role === 'admin') return 'admin';
    if (role === 'evaluator') return 'evaluator.study';
    if (role === 'user') return 'student.informare';
    return 'home';
}

router.beforeEach((to, from) => {
    const userStore = useUserStore()

    if (to.meta.protected && !userStore.isAuthenticated) {
        console.log('User is not authenticated, redirecting to home');
        return { name: 'home' }
    }

    if (userStore.isAuthenticated && to.meta.roles) {
        const allowed = to.meta.roles as string[];
        if (!allowed.includes(userStore.user.role)) {
            return { name: roleHomeName(userStore.user.role) };
        }
    }
})


export default router
