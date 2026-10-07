import { createRouter, createWebHistory } from 'vue-router'
import { state } from './lib/state'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/today' },
    { path: '/welcome', component: () => import('./pages/OnboardingPage.vue'), meta: { tab: 'today', navbar: false, tabbar: false } },
    { path: '/today', component: () => import('./pages/TodayPage.vue'), meta: { tab: 'today', navbar: false } },
    { path: '/archive', component: () => import('./pages/ArchivePage.vue'), meta: { tab: 'archive', title: 'archive.title' } },
    { path: '/archive/:id', component: () => import('./pages/QuotePage.vue'), meta: { tab: 'archive', navbar: true } },
    { path: '/explore', component: () => import('./pages/ExplorePage.vue'), meta: { tab: 'explore', title: 'explore.title' } },
    { path: '/settings', component: () => import('./pages/SettingsPage.vue'), meta: { tab: 'settings', title: 'settings.title' } },
    { path: '/:pathMatch(.*)*', redirect: '/today' },
  ],
})

// First launch: walk through the app once before the first quote.
router.beforeEach((to) => {
  if (!state.onboarded && !import.meta.env.VITE_SCREENSHOTS && to.path !== '/welcome')
    return '/welcome'
})
