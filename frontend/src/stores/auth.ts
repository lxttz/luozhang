import { computed, ref } from 'vue';
import type { Role } from '../types';

export interface UserInfo {
  id: number;
  username: string;
  role: Role;
  name: string;
}

const token = ref(localStorage.getItem('token') || '');
const user = ref<UserInfo | null>(parseSavedUser());

function parseSavedUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

const isLogin = computed(() => !!token.value);
const isBoss = computed(() => user.value?.role === 'boss');
const isFinance = computed(() => user.value?.role === 'finance');

function setLogin(newToken: string, newUser: UserInfo): void {
  token.value = newToken;
  user.value = newUser;
  localStorage.setItem('token', newToken);
  localStorage.setItem('user', JSON.stringify(newUser));
}

function setUser(newUser: UserInfo): void {
  user.value = newUser;
  localStorage.setItem('user', JSON.stringify(newUser));
}

function logout(): void {
  token.value = '';
  user.value = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

window.addEventListener('auth:unauthorized', logout);

export function useAuth() {
  return { token, user, isLogin, isBoss, isFinance, setLogin, setUser, logout };
}
