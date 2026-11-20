<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">用户管理</h1>
      <el-button type="primary" :icon="Plus" @click="openAdd">新增账号</el-button>
    </div>

    <el-card class="card">
      <el-table :data="list" v-loading="loading" stripe border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" min-width="140" />
        <el-table-column prop="name" label="姓名" min-width="140" />
        <el-table-column label="角色" width="110" align="center">
          <template #default="{ row }: { row: UserItem }">
            <el-tag :type="row.role === 'boss' ? 'warning' : 'success'" size="small">
              {{ row.role === 'boss' ? '老板' : '财务' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" min-width="180" />
        <el-table-column label="操作" width="140" align="center">
          <template #default="{ row }: { row: UserItem }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑账号' : '新增账号'" width="440px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" :disabled="!!editingId" maxlength="30" placeholder="3-30 位字母、数字、下划线或短横线" />
        </el-form-item>
        <el-form-item :label="editingId ? '新密码' : '密码'" :required="!editingId">
          <el-input v-model="form.password" type="password" show-password :placeholder="editingId ? '留空则不修改' : '至少 6 位'" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.name" maxlength="30" placeholder="可选" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-radio-group v-model="form.role">
            <el-radio-button value="finance">财务</el-radio-button>
            <el-radio-button value="boss">老板</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api, { errorMessage } from '../api';
import { useAuth } from '../stores/auth';
import type { Role, UserItem } from '../types';

const { user } = useAuth();

const loading = ref(false);
const submitting = ref(false);
const list = ref<UserItem[]>([]);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const form = reactive({ username: '', password: '', name: '', role: 'finance' as Role });

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    list.value = await api.get<UserItem[]>('/users');
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

function openAdd(): void {
  editingId.value = null;
  form.username = '';
  form.password = '';
  form.name = '';
  form.role = 'finance';
  dialogVisible.value = true;
}

function openEdit(row: UserItem): void {
  editingId.value = row.id;
  form.username = row.username;
  form.password = '';
  form.name = row.name || '';
  form.role = row.role;
  dialogVisible.value = true;
}

async function submit(): Promise<void> {
  if (!editingId.value && !/^[a-zA-Z0-9_-]{3,30}$/.test(form.username)) {
    ElMessage.warning('用户名需为 3-30 位字母、数字、下划线或短横线');
    return;
  }
  if (!editingId.value && form.password.length < 6) {
    ElMessage.warning('密码至少 6 位');
    return;
  }
  submitting.value = true;
  try {
    const payload: Record<string, string> = { name: form.name, role: form.role };
    if (form.password) payload.password = form.password;
    if (!editingId.value) payload.username = form.username;
    if (editingId.value) {
      await api.put(`/users/${editingId.value}`, payload);
      ElMessage.success('修改成功');
    } else {
      await api.post('/users', payload);
      ElMessage.success('账号创建成功');
    }
    dialogVisible.value = false;
    await loadData();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: UserItem): Promise<void> {
  if (row.id === user.value?.id) {
    ElMessage.warning('不能删除当前登录账号');
    return;
  }
  try {
    await ElMessageBox.confirm(`确认删除账号「${row.username}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await api.delete(`/users/${row.id}`);
    ElMessage.success('删除成功');
    await loadData();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

onMounted(loadData);
</script>


