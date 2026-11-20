<template>
  <div class="login-page">
    <el-card class="login-card">
      <div class="logo">
        <el-icon><Wallet /></el-icon>
      </div>
      <h2>企业简易记账系统</h2>
      <p class="subtitle">收支流水 · 分类统计 · 多人协作</p>
      <el-form :model="form" @submit.prevent="handleLogin">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" size="large" clearable />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-button type="primary" size="large" class="submit" :loading="loading" @click="handleLogin">登 录</el-button>
      </el-form>
      <p class="tip">账号由老板统一分配，不开放注册</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../api';
import { useAuth, type UserInfo } from '../stores/auth';

const router = useRouter();
const auth = useAuth();
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
    router.push('/bills');
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%);
}

.login-card {
  width: 400px;
  max-width: calc(100vw - 32px);
  padding: 24px;
  border-radius: 16px;
  text-align: center;
}

.logo {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2563eb;
  color: #fff;
  font-size: 28px;
}

h2 {
  margin: 0;
  font-size: 22px;
}

.subtitle {
  margin: 8px 0 24px;
  color: #94a3b8;
  font-size: 13px;
}

.submit {
  width: 100%;
}

.tip {
  margin: 20px 0 0;
  color: #94a3b8;
  font-size: 12px;
}
</style>
