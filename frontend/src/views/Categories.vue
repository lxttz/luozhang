<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">分类管理</h1>
      <el-button type="primary" :icon="Plus" @click="openAdd">新增分类</el-button>
    </div>

    <el-card class="card">
      <el-table :data="list" v-loading="loading" stripe border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="分类名称" min-width="160" />
        <el-table-column label="类型" width="120" align="center">
          <template #default="{ row }: { row: Category }">
            <el-tag :type="row.type === 'income' ? 'success' : 'danger'" size="small">
              {{ row.type === 'income' ? '收入' : '支出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="100" align="center" />
        <el-table-column label="操作" width="160" align="center">
          <template #default="{ row }: { row: Category }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑分类' : '新增分类'" width="420px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="20" placeholder="分类名称" />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-radio-group v-model="form.type">
            <el-radio-button value="income">收入</el-radio-button>
            <el-radio-button value="expense">支出</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="999" style="width: 100%" />
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
import type { BillType, Category } from '../types';

const loading = ref(false);
const submitting = ref(false);
const list = ref<Category[]>([]);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const form = reactive({ name: '', type: 'expense' as BillType, sort: 0 });

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    list.value = await api.get<Category[]>('/categories');
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

function openAdd(): void {
  editingId.value = null;
  form.name = '';
  form.type = 'expense';
  form.sort = 0;
  dialogVisible.value = true;
}

function openEdit(row: Category): void {
  editingId.value = row.id;
  form.name = row.name;
  form.type = row.type;
  form.sort = row.sort;
  dialogVisible.value = true;
}

async function submit(): Promise<void> {
  if (!form.name.trim()) {
    ElMessage.warning('请输入分类名称');
    return;
  }
  submitting.value = true;
  try {
    if (editingId.value) {
      await api.put(`/categories/${editingId.value}`, form);
      ElMessage.success('修改成功');
    } else {
      await api.post('/categories', form);
      ElMessage.success('新增成功');
    }
    dialogVisible.value = false;
    await loadData();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: Category): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除分类「${row.name}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await api.delete(`/categories/${row.id}`);
    ElMessage.success('删除成功');
    await loadData();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

onMounted(loadData);
</script>
