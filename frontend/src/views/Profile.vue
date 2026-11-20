<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">个人设置</h1>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :md="12">
        <el-card class="card">
          <template #header>账号信息</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="用户名">{{ user?.username }}</el-descriptions-item>
            <el-descriptions-item label="姓名">{{ user?.name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="角色">{{ isBoss ? '老板' : '财务' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card class="card">
          <template #header>修改密码</template>
          <el-form :model="form" label-width="90px">
            <el-form-item label="原密码" required>
              <el-input v-model="form.old_password" type="password" show-password placeholder="请输入当前密码" />
            </el-form-item>
            <el-form-item label="新密码" required>
              <el-input v-model="form.new_password" type="password" show-password placeholder="至少 6 位" />
            </el-form-item>
            <el-form-item label="确认密码" required>
              <el-input v-model="form.confirm_password" type="password" show-password placeholder="再次输入新密码" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="submitting" @click="submit">保存密码</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../api';
import { useAuth } from '../stores/auth';

const { user, isBoss } = useAuth();
const submitting = ref(false);
const form = reactive({ old_password: '', new_password: '', confirm_password: '' });

async function submit(): Promise<void> {
  if (!form.old_password) {
    ElMessage.warning('请输入原密码');
    return;
  }
  if (form.new_password.length < 6) {
    ElMessage.warning('新密码至少 6 位');
    return;
  }
  if (form.new_password !== form.confirm_password) {
    ElMessage.warning('两次输入的新密码不一致');
    return;
  }
  submitting.value = true;
  try {
    await api.put('/profile/password', {
      old_password: form.old_password,
      new_password: form.new_password,
    });
    ElMessage.success('密码修改成功');
    form.old_password = '';
    form.new_password = '';
    form.confirm_password = '';
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    submitting.value = false;
  }
}
</script>
