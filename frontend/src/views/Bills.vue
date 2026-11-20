<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">收支流水</h1>
      <div class="header-actions">
        <el-button v-if="isFinance" :icon="Upload" @click="openImport">导入</el-button>
        <el-button :icon="Download" @click="exportCsv">导出 CSV</el-button>
        <el-button v-if="isFinance" :icon="Delete" @click="openRecycle">回收站</el-button>
        <el-button v-if="isFinance" type="primary" :icon="Plus" @click="openAdd">新增账单</el-button>
      </div>
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
        <el-select v-model="query.status" placeholder="审核状态" clearable>
          <el-option label="待审核" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="备注 / 分类关键词" clearable @keyup.enter="handleSearch" />
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <div v-if="isFinance && selectedRows.length" class="batch-bar">
        <span>已选择 {{ selectedRows.length }} 条</span>
        <el-button type="danger" size="small" :icon="Delete" @click="batchDelete">批量删除</el-button>
      </div>

      <el-table ref="tableRef" :data="list" v-loading="loading" stripe border size="default" @selection-change="onSelectionChange">
        <el-table-column v-if="isFinance" type="selection" width="48" />
        <el-table-column prop="bill_date" label="记账日期" width="115" />
        <el-table-column label="类型" width="85" align="center">
          <template #default="{ row }: { row: Bill }">
            <el-tag :type="row.category_type === 'income' ? 'success' : 'danger'" size="small">
              {{ row.category_type === 'income' ? '收入' : '支出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="分类" width="120" />
        <el-table-column label="金额" width="130" align="right">
          <template #default="{ row }: { row: Bill }">
            <span :class="row.category_type === 'income' ? 'amount-income' : 'amount-expense'">
              {{ row.category_type === 'income' ? '+' : '-' }}{{ money(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }: { row: Bill }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column prop="user_name" label="录入人" width="100" />
        <el-table-column prop="created_at" label="录入时间" width="160" />
        <el-table-column label="操作" :width="isBoss ? 150 : 140" fixed="right" align="center">
          <template #default="{ row }: { row: Bill }">
            <template v-if="isBoss">
              <template v-if="row.status === 'pending'">
                <el-button link type="success" size="small" @click="review(row, 'approve')">通过</el-button>
                <el-button link type="danger" size="small" @click="review(row, 'reject')">驳回</el-button>
              </template>
              <span v-else class="muted">已审核</span>
            </template>
            <template v-else-if="row.user_id === user?.id">
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="allowDelete" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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

    <el-dialog v-model="importVisible" title="批量导入账单" width="560px">
      <p class="dialog-tip">CSV 格式：<code>日期,分类,金额,备注</code>。分类可填名称或分类 ID，导入后均为待审核。</p>
      <el-input v-model="importText" type="textarea" :rows="12" placeholder="2026-11-20,办公费,100,购买文具" />
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="submitImport">开始导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="recycleVisible" title="回收站" width="900px">
      <el-table :data="recycleList" v-loading="recycleLoading" stripe border size="small">
        <el-table-column prop="bill_date" label="日期" width="110" />
        <el-table-column prop="category_name" label="分类" width="120" />
        <el-table-column label="金额" width="120" align="right">
          <template #default="{ row }: { row: Bill }">{{ money(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column prop="user_name" label="录入人" width="100" />
        <el-table-column label="操作" width="140" align="center">
          <template #default="{ row }: { row: Bill }">
            <el-button link type="primary" size="small" @click="restore(row)">恢复</el-button>
            <el-button v-if="isBoss" link type="danger" size="small" @click="purge(row)">彻底删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!recycleList.length" description="回收站为空" :image-size="60" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh, Upload, Download, Delete } from '@element-plus/icons-vue';
import api, { errorMessage } from '../api';
import { useAuth } from '../stores/auth';
import type { Bill, BillInput, BillStatus, BillType, Category } from '../types';
import { money, todayStr } from '../utils';

const { user, isBoss, isFinance } = useAuth();

const loading = ref(false);
const submitting = ref(false);
const importing = ref(false);
const recycleLoading = ref(false);
const list = ref<Bill[]>([]);
const recycleList = ref<Bill[]>([]);
const categories = ref<Category[]>([]);
const total = ref(0);
const allowDelete = ref(false);
const dateRange = ref<string[]>([]);
const selectedRows = ref<Bill[]>([]);
const tableRef = ref<{ clearSelection: () => void } | null>(null);

const query = reactive({
  page: 1,
  pageSize: 20,
  type: '' as BillType | '',
  categoryId: '' as number | '',
  status: '' as BillStatus | '',
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

const importVisible = ref(false);
const importText = ref('');
const recycleVisible = ref(false);

const categoriesOfType = computed(() => categories.value.filter((item) => item.type === form.type));

const statusText = (status: BillStatus) =>
  status === 'approved' ? '已通过' : status === 'pending' ? '待审核' : '已驳回';
const statusType = (status: BillStatus) =>
  status === 'approved' ? 'success' : status === 'pending' ? 'warning' : 'danger';

function onSelectionChange(rows: Bill[]): void {
  selectedRows.value = rows;
}

function queryParams(): Record<string, string | number> {
  const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize };
  if (dateRange.value?.length === 2) {
    params.startDate = dateRange.value[0];
    params.endDate = dateRange.value[1];
  }
  if (query.type) params.type = query.type;
  if (query.categoryId) params.categoryId = query.categoryId;
  if (query.status) params.status = query.status;
  if (query.keyword) params.keyword = query.keyword;
  return params;
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const result = await api.get<{ list: Bill[]; total: number }>('/bills', { params: queryParams() });
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
  query.status = '';
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
  if (!form.category_id || !form.bill_date) {
    ElMessage.warning('请选择分类和日期');
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
      ElMessage.success('修改成功，已重新提交审核');
    } else {
      await api.post('/bills', payload);
      ElMessage.success('新增成功，待老板审核');
    }
    dialogVisible.value = false;
    await loadData();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    submitting.value = false;
  }
}

async function review(row: Bill, action: 'approve' | 'reject'): Promise<void> {
  try {
    await api.put(`/bills/${row.id}/review`, { action });
    ElMessage.success(action === 'approve' ? '已通过' : '已驳回');
    await loadData();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

async function handleDelete(row: Bill): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除 ${row.bill_date} 的 ${money(row.amount)} 元账单吗？可在回收站恢复。`, '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await api.delete(`/bills/${row.id}`);
    ElMessage.success('已移入回收站');
    await loadData();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

async function batchDelete(): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认将选中的 ${selectedRows.value.length} 条账单移入回收站吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    const ids = selectedRows.value.map((row) => row.id);
    const result = await api.delete<{ deleted: number }>('/bills/batch-delete', { data: { ids } });
    ElMessage.success(`已删除 ${result.deleted} 条`);
    tableRef.value?.clearSelection();
    await loadData();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

async function exportCsv(): Promise<void> {
  try {
    const blob = await api.get<Blob>('/bills/export', { params: queryParams(), responseType: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `账单_${todayStr()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

function openImport(): void {
  importText.value = '';
  importVisible.value = true;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function submitImport(): Promise<void> {
  const lines = importText.value.replace(/^\ufeff/, '').split(/\r?\n/).filter((line) => line.trim());
  lines.shift();
  const items: BillInput[] = lines.map((line) => {
    const cols = parseCsvLine(line);
    const category = categories.value.find((item) => item.name === cols[1] || String(item.id) === cols[1]);
    return {
      bill_date: (cols[0] || '').trim(),
      category_id: category?.id || Number(cols[1]) || 0,
      amount: Number(cols[2]),
      remark: (cols[3] || '').trim(),
    };
  });
  if (!items.length) {
    ElMessage.warning('没有可导入的数据');
    return;
  }
  importing.value = true;
  try {
    const result = await api.post<{ success: number; failed: number; errors: string[] }>('/bills/import', { items });
    ElMessage.success(`成功 ${result.success} 条，失败 ${result.failed} 条`);
    if (result.errors.length) {
      await ElMessageBox.alert(result.errors.slice(0, 10).join('\n'), '导入失败明细', { type: 'warning' });
    }
    importVisible.value = false;
    await loadData();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    importing.value = false;
  }
}

async function loadRecycle(): Promise<void> {
  recycleLoading.value = true;
  try {
    recycleList.value = await api.get<Bill[]>('/bills/recycle');
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    recycleLoading.value = false;
  }
}

function openRecycle(): void {
  recycleVisible.value = true;
  void loadRecycle();
}

async function restore(row: Bill): Promise<void> {
  try {
    await api.put(`/bills/${row.id}/restore`);
    ElMessage.success('已恢复');
    await loadRecycle();
    await loadData();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

async function purge(row: Bill): Promise<void> {
  try {
    await ElMessageBox.confirm('彻底删除后无法恢复，确认继续吗？', '警告', { type: 'error' });
  } catch {
    return;
  }
  try {
    await api.delete(`/bills/${row.id}/purge`);
    ElMessage.success('已彻底删除');
    await loadRecycle();
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
.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #eff6ff;
  border-radius: 8px;
  color: #2563eb;
  font-size: 13px;
}

.dialog-tip {
  margin: 0 0 12px;
  color: #64748b;
  font-size: 13px;
}

code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.muted {
  color: #94a3b8;
  font-size: 12px;
}
</style>
