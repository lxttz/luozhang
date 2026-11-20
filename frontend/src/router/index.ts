import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import api from '../api';
import { useAuth, type UserInfo } from '../stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    bossOnly?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', redirect: '/bills' },
      {
        path: 'bills',
        name: 'bills',
        component: () => import('../views/Bills.vue'),
        meta: { title: '收支流水' },
      },
      {
        path: 'stats',
        name: 'stats',
        component: () => import('../views/Stats.vue'),
        meta: { title: '统计报表' },
      },
      {
        path: 'categories',
        name: 'categories',
        component: () => import('../views/Categories.vue'),
        meta: { title: '分类管理', bossOnly: true },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('../views/Users.vue'),
        meta: { title: '用户管理', bossOnly: true },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuth();
  if (to.name === 'login') return true;
  if (!auth.token.value) return { name: 'login' };
  if (!auth.user.value) {
    try {
      const profile = await api.get<UserInfo>('/me');
      auth.setUser(profile);
    } catch {
      auth.logout();
      return { name: 'login' };
    }
  }
  if (to.meta.bossOnly && !auth.isBoss.value) return { name: 'bills' };
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} - 企业简易记账` : '企业简易记账系统';
});

window.addEventListener('auth:unauthorized', () => {
  router.push({ name: 'login' });
});

export default router;
