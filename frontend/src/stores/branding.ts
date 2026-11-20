import { ref } from 'vue';
import api from '../api';

const STORAGE_KEY = 'system_name';
const DEFAULT_NAME = '洛账';

const systemName = ref(localStorage.getItem(STORAGE_KEY) || DEFAULT_NAME);

function setSystemName(name: string): void {
  const value = (name || '').trim() || DEFAULT_NAME;
  systemName.value = value;
  localStorage.setItem(STORAGE_KEY, value);
  document.title = `${value} - 企业简易记账`;
}

async function loadBranding(): Promise<void> {
  try {
    const result = await api.get<{ system_name: string }>('/branding');
    setSystemName(result.system_name);
  } catch {
    document.title = `${systemName.value} - 企业简易记账`;
  }
}

export function useBranding() {
  return { systemName, loadBranding, setSystemName };
}
