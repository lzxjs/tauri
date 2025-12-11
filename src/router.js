import { createRouter, createWebHashHistory } from 'vue-router';
import LauncherView from './views/LauncherView.vue';
import ScraperView from './views/ScraperView.vue';
import SystemView from './views/SystemView.vue';
import RecorderView from './views/RecorderView.vue';
import ClipboardView from './views/ClipboardView.vue';

const routes = [
  { path: '/', redirect: '/launcher' },
  { path: '/launcher', name: 'launcher', component: LauncherView },
  { path: '/scraper', name: 'scraper', component: ScraperView },
  { path: '/system', name: 'system', component: SystemView },
  { path: '/recorder', name: 'recorder', component: RecorderView },
  { path: '/clipboard', name: 'clipboard', component: ClipboardView },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
