<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">操作日志</h1>
      <span class="subtitle">仅老板可见，记录单据与账号的关键操作</span>
    </div>

    <el-card class="card">
      <div class="filter-bar">
        <el-select v-model="query.action" placeholder="操作类型" clearable>
          <el-option v-for="item in actionOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        />
        <el-input v-model="query.keyword" placeholder="内容 / 操作人" clearable @keyup.enter="handleSearch" />
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe border>
        <el-table-column prop="created_at" label="时间" width="180" />
        <el-table-column label="操作人" width="120">
          <template #default="{ row }: { row: LogItem }">{{ row.user_name || '系统' }}</template>
        </el-table-column>
        <el-table-column label="动作" width="100" align="center">
          <template #default="{ row }: { row: LogItem }">
            <el-tag :type="actionType(row.action)" size="small">{{ actionText(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="内容" min-width="240" show-overflow-tooltip />
        <el-table-column label="单据" width="100" align="center">
          <template #default="{ row }: { row: LogItem }">
            <el-button v-if="row.bill_id" link type="primary" size="small" @click="$router.push('/bills')">
              #{{ row.bill_id }}
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :page-sizes="[20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="loadData"
          @current-change="loadData"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../api';
import type { LogItem } from '../types';

const actionOptions = [
  { value: 'add', label: '新增' },
  { value: 'edit', label: '编辑' },
  { value: 'delete', label: '删除' },
  { value: 'import', label: '导入' },
  { value: 'review', label: '审核' },
  { value: 'restore', label: '恢复' },
  { value: 'purge', label: '彻底删除' },
  { value: 'password', label: '改密' },
];

const loading = ref(false);
const list = ref<LogItem[]>([]);
const total = ref(0);
const dateRange = ref<string[]>([]);
const query = reactive({ page: 1, pageSize: 20, action: '', keyword: '' });

const actionText = (action: string) => actionOptions.find((item) => item.value === action)?.label || action;
const actionType = (action: string) =>
  action === 'add' || action === 'restore' ? 'success'
    : action === 'delete' || action === 'purge' ? 'danger'
      : action === 'review' ? 'warning' : 'info';

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize };
    if (query.action) params.action = query.action;
    if (query.keyword) params.keyword = query.keyword;
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0];
      params.endDate = dateRange.value[1];
    }
    const result = await api.get<{ list: LogItem[]; total: number }>('/logs', { params });
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
  query.action = '';
  query.keyword = '';
  handleSearch();
}

onMounted(loadData);
</script>

<style scoped>
.subtitle {
  color: #94a3b8;
  font-size: 13px;
}
</style>
