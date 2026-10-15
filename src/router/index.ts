import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

// Hash-режим (#/chapters) работает на любом статическом хостинге без настройки сервера.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/chapters', name: 'chapters', component: () => import('@/views/ChaptersView.vue') },
    {
      path: '/chapters/:chapterId',
      name: 'chapter',
      component: () => import('@/views/ChapterView.vue'),
      props: true,
    },
    {
      path: '/lessons/:lessonId/practice',
      name: 'practice',
      component: () => import('@/views/PracticeView.vue'),
      props: true,
    },
    {
      path: '/lessons/:lessonId',
      name: 'lesson',
      component: () => import('@/views/LessonView.vue'),
      props: true,
    },
    { path: '/review', name: 'review', component: () => import('@/views/ReviewView.vue') },
    { path: '/phrases', name: 'phrases', component: () => import('@/views/PhrasesView.vue') },
    { path: '/stats', name: 'stats', component: () => import('@/views/StatsView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
})
