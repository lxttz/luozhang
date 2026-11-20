<template>
  <div class="login-shell">
    <section class="brand-panel">
      <div class="brand-top">
        <div class="brand-mark"><el-icon><Wallet /></el-icon></div>
        <div class="brand-name">{{ systemName }}</div>
      </div>

      <div class="brand-center">
        <h1>让每一笔收支<br />都清晰可查</h1>
        <p>简洁的记账工作台，老板看全局，财务记流水，权限分明，协作有序。</p>
        <div class="feature-list">
          <div class="feature-item"><span class="dot"></span>收支流水与分类统计</div>
          <div class="feature-item"><span class="dot"></span>单据审核与操作留痕</div>
          <div class="feature-item"><span class="dot"></span>Cloudflare 免费栈，免运维</div>
        </div>
      </div>

      <div class="brand-bottom">Cloudflare Workers · D1 · Pages</div>
    </section>

    <section class="form-panel">
      <div class="login-box">
        <div class="eyebrow">WELCOME BACK</div>
        <h2>登录工作台</h2>
        <p class="intro">请输入账号密码，继续管理你的账目</p>

        <el-form :model="form" class="login-form" @submit.prevent="handleLogin">
          <el-form-item>
            <el-input v-model="form.username" size="large" placeholder="用户名" clearable @keyup.enter="handleLogin">
              <template #prefix><el-icon><User /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-input
              v-model="form.password"
              type="password"
              size="large"
              placeholder="密码"
              show-password
              @keyup.enter="handleLogin"
            >
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-button type="primary" size="large" class="submit" :loading="loading" @click="handleLogin">
            登录 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </el-form>

        <div class="secure-note">
          <el-icon><Lock /></el-icon>
          <span>账号由老板统一分配，不开放注册</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../api';
import { useAuth, type UserInfo } from '../stores/auth';
import { useBranding } from '../stores/branding';

const router = useRouter();
const auth = useAuth();
const { systemName, loadBranding } = useBranding();
const loading = ref(false);
const form = reactive({ username: '', password: '' });

async function handleLogin(): Promise<void> {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码');
    return;
  }
  loading.value = true;
  try {
    const result = await api.post<{ token: string; user: UserInfo }>('/login', form);
    auth.setLogin(result.token, result.user);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

onMounted(loadBranding);
</script>

<style scoped>
.login-shell {
  display: flex;
  min-height: 100vh;
  background: #f8fafc;
}

.brand-panel {
  position: relative;
  width: 46%;
  min-height: 100vh;
  padding: 56px 64px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 20% 15%, rgba(99, 102, 241, 0.45), transparent 45%),
    radial-gradient(circle at 85% 85%, rgba(14, 165, 233, 0.35), transparent 40%),
    linear-gradient(145deg, #0f172a 0%, #111827 55%, #1e1b4b 100%);
}

.brand-panel::before {
  content: '';
  position: absolute;
  width: 420px;
  height: 420px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  right: -160px;
  top: 12%;
}

.brand-panel::after {
  content: '';
  position: absolute;
  width: 260px;
  height: 260px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 50%;
  right: -80px;
  top: 26%;
}

.brand-top,
.brand-center,
.brand-bottom {
  position: relative;
  z-index: 1;
}

.brand-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23px;
  background: linear-gradient(135deg, #6366f1, #0ea5e9);
  box-shadow: 0 12px 30px rgba(14, 165, 233, 0.35);
}

.brand-name {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
}

.brand-center h1 {
  margin: 0;
  font-size: 40px;
  line-height: 1.35;
  font-weight: 600;
  letter-spacing: 1px;
}

.brand-center p {
  margin: 22px 0 32px;
  max-width: 380px;
  color: rgba(226, 232, 240, 0.75);
  font-size: 14px;
  line-height: 1.9;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(241, 245, 249, 0.88);
  font-size: 14px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.15);
}

.brand-bottom {
  color: rgba(148, 163, 184, 0.7);
  font-size: 12px;
  letter-spacing: 0.5px;
}

.form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.login-box {
  width: 100%;
  max-width: 400px;
}

.eyebrow {
  color: #6366f1;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
}

.login-box h2 {
  margin: 10px 0 8px;
  font-size: 28px;
  font-weight: 600;
  color: #0f172a;
}

.intro {
  margin: 0 0 32px;
  color: #64748b;
  font-size: 14px;
}

.login-form :deep(.el-input__wrapper) {
  border-radius: 10px;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
  padding: 4px 14px;
}

.login-form :deep(.el-input__wrapper:hover),
.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #6366f1 inset;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.submit {
  width: 100%;
  height: 46px;
  margin-top: 6px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #1e293b, #0f172a);
  font-size: 15px;
  letter-spacing: 2px;
}

.submit:hover {
  background: linear-gradient(135deg, #334155, #1e293b);
}

.secure-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 28px;
  color: #94a3b8;
  font-size: 12px;
}

@media (max-width: 900px) {
  .brand-panel {
    display: none;
  }

  .form-panel {
    min-height: 100vh;
  }
}
</style>
