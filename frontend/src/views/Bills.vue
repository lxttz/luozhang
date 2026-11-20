<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">收支流水</h1>
      <el-button v-if="isFinance" type="primary" :icon="Plus" @click="openAdd">新增账单</el-button>
    </div>

    <el-card class="card">
      <div class="filter-bar">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        />
        <el-select v-model="query.type" placeholder="收支类型" clearable>
          <el-option label="收入" value="income" />
          <el-option label="支出" value="expense" />
        </el-select>
        <el-select v-model="query.categoryId" placeholder="分类" clearable filterable>
          <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="备注 / 分类关键词" clearable @keyup.enter="handleSearch" />
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe border size="default">
        <el-table-column prop="bill_date" label="记账日期" width="120" />
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }: { row: Bill }">
            <el-tag :type="row.category_type === 'income' ? 'success' : 'danger'" size="small">
              {{ row.category_type === 'income' ? '收入' : '支出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="分类" width="130" />
        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }: { row: Bill }">
            <span :class="row.category_type === 'income' ? 'amount-income' : 'amount-expense'">
              {{ row.category_type === 'income' ? '+' : '-' }}{{ money(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column prop="user_name" label="录入人" width="110" />
        <el-table-column prop="created_at" label="录入时间" width="170" />
        <el-table-column v-if="isFinance" label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }: { row: Bill }">
            <template v-if="row.user_id === user?.id">
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button
                v-if="allowDelete"
                link
                type="danger"
                size="small"
                @click="handleDelete(row)"
              >删除</el-button>
            </template>
            <span v-else class="muted">他人录入</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="loadData"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑账单' : '新增账单'" width="480px" @closed="resetForm">
      <el-form :model="form" label-width="80px">
        <el-form-item label="类型" required>
          <el-radio-group v-model="form.type" @change="handleTypeChange">
            <el-radio-button value="income">收入</el-radio-button>
            <el-radio-button value="expense">支出</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="金额" required>
          <el-input-number v-model="form.amount" :min="0.01" :precision="2" :step="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="form.category_id" placeholder="请选择分类" style="width: 100%">
            <el-option v-for="item in categoriesOfType" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker v-model="form.bill_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="200" placeholder="可选" />
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
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh } from '@element-plus/icons-vue';
import api, { errorMessage } from '../api';
import { useAuth } from '../stores/auth';
import type { Bill, BillInput, BillType, Category } from '../types';
import { money, todayStr } from '../utils';

const { user, isFinance } = useAuth();

const loading = ref(false);
const submitting = ref(false);
const list = ref<Bill[]>([]);
const categories = ref<Category[]>([]);
const total = ref(0);
const allowDelete = ref(false);
const dateRange = ref<string[]>([]);

const query = reactive({
  page: 1,
  pageSize: 20,
  type: '' as BillType | '',
  categoryId: '' as number | '',
  keyword: '',
});

const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const form = reactive<BillInput & { type: BillType }>({
  type: 'expense',
  category_id: 0,
  amount: 0,
  bill_date: todayStr(),
  remark: '',
});

const categoriesOfType = computed(() => categories.value.filter((item) => item.type === form.type));

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, string | number> = {
      page: query.page,
      pageSize: query.pageSize,
    };
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0];
      params.endDate = dateRange.value[1];
    }
    if (query.type) params.type = query.type;
    if (query.categoryId) params.categoryId = query.categoryId;
    if (query.keyword) params.keyword = query.keyword;
    const result = await api.get<{ list: Bill[]; total: number }>('/bills', { params });
    list.value = result.list;
    total.value = result.total;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

function handleSearch(): void {
  query.page = 1;
  void loadData();
}

function handleReset(): void {
  dateRange.value = [];
  query.type = '';
  query.categoryId = '';
  query.keyword = '';
  handleSearch();
}

function handleTypeChange(): void {
  form.category_id = categoriesOfType.value[0]?.id || 0;
}

function openAdd(): void {
  editingId.value = null;
  form.type = 'expense';
  form.category_id = categoriesOfType.value[0]?.id || 0;
  form.amount = 0;
  form.bill_date = todayStr();
  form.remark = '';
  dialogVisible.value = true;
}

function openEdit(row: Bill): void {
  editingId.value = row.id;
  form.type = row.category_type;
  form.category_id = row.category_id;
  form.amount = row.amount;
  form.bill_date = row.bill_date;
  form.remark = row.remark || '';
  dialogVisible.value = true;
}

function resetForm(): void {
  editingId.value = null;
}

async function submit(): Promise<void> {
  if (!form.category_id) {
    ElMessage.warning('请选择分类');
    return;
  }
  if (!form.bill_date) {
    ElMessage.warning('请选择日期');
    return;
  }
  submitting.value = true;
  try {
    const payload: BillInput = {
      category_id: form.category_id,
      amount: form.amount,
      bill_date: form.bill_date,
      remark: form.remark,
    };
    if (editingId.value) {
      await api.put(`/bills/${editingId.value}`, payload);
      ElMessage.success('修改成功');
    } else {
      await api.post('/bills', payload);
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

async function handleDelete(row: Bill): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除 ${row.bill_date} 的 ${money(row.amount)} 元账单吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await api.delete(`/bills/${row.id}`);
    ElMessage.success('删除成功');
    await loadData();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

onMounted(async () => {
  try {
    const [categoryList, settings] = await Promise.all([
      api.get<Category[]>('/categories'),
      api.get<{ allow_finance_delete: boolean }>('/settings'),
    ]);
    categories.value = categoryList;
    allowDelete.value = settings.allow_finance_delete;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
  await loadData();
});
</script>

<style scoped>
.muted {
  color: #94a3b8;
  font-size: 12px;
}
</style>
