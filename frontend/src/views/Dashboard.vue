<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">首页看板</h1>
        <p class="subtitle">{{ stat.date }} · {{ stat.month }}</p>
      </div>
      <el-button v-if="isFinance" type="primary" :icon="Plus" @click="$router.push('/bills')">去记一笔</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :sm="8">
        <el-card class="card stat-card">
          <div class="stat-label">今日收入</div>
          <div class="stat-value income">¥ {{ money(stat.today.income) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="card stat-card">
          <div class="stat-label">今日支出</div>
          <div class="stat-value expense">¥ {{ money(stat.today.expense) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="card stat-card">
          <div class="stat-label">今日结余</div>
          <div class="stat-value" :class="stat.today.balance >= 0 ? 'income' : 'expense'">
            ¥ {{ money(stat.today.balance) }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :xs="24" :sm="8">
        <el-card class="card stat-card">
          <div class="stat-label">本月收入</div>
          <div class="stat-value income">¥ {{ money(stat.monthTotals.income) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="card stat-card">
          <div class="stat-label">本月支出</div>
          <div class="stat-value expense">¥ {{ money(stat.monthTotals.expense) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="card stat-card">
          <div class="stat-label">本月结余</div>
          <div class="stat-value" :class="stat.monthTotals.balance >= 0 ? 'income' : 'expense'">
            ¥ {{ money(stat.monthTotals.balance) }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :xs="24" :md="14">
        <el-card class="card">
          <template #header>
            <div class="card-header">
              <span>最近流水</span>
              <el-button link type="primary" @click="$router.push('/bills')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="stat.recent" size="small" v-loading="loading">
            <el-table-column prop="bill_date" label="日期" width="110" />
            <el-table-column prop="category_name" label="分类" min-width="110" />
            <el-table-column label="金额" width="120" align="right">
              <template #default="{ row }: { row: DashboardStat['recent'][number] }">
                <span :class="row.category_type === 'income' ? 'amount-income' : 'amount-expense'">
                  {{ row.category_type === 'income' ? '+' : '-' }}{{ money(row.amount) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }: { row: DashboardStat['recent'][number] }">
                <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!stat.recent.length" description="暂无已审核流水" :image-size="60" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="10">
        <el-card class="card">
          <template #header>本月分类排行</template>
          <div v-for="item in stat.ranking" :key="item.id" class="rank-item">
            <div class="rank-info">
              <span>{{ item.name }}</span>
              <span :class="item.type === 'income' ? 'income' : 'expense'">¥ {{ money(item.total) }}</span>
            </div>
            <el-progress
              :percentage="rankPercent(item.total)"
              :color="item.type === 'income' ? '#22c55e' : '#f97316'"
              :show-text="false"
            />
          </div>
          <el-empty v-if="!stat.ranking.length" description="本月暂无数据" :image-size="60" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../api';
import { useAuth } from '../stores/auth';
import type { BillStatus, DashboardStat } from '../types';
import { money } from '../utils';

const { isFinance } = useAuth();
const loading = ref(false);
const stat = reactive<DashboardStat>({
  date: '',
  month: '',
  today: { income: 0, expense: 0, balance: 0 },
  monthTotals: { income: 0, expense: 0, balance: 0 },
  recent: [],
  ranking: [],
});

const statusText = (status: BillStatus) =>
  status === 'approved' ? '已通过' : status === 'pending' ? '待审核' : '已驳回';
const statusType = (status: BillStatus) =>
  status === 'approved' ? 'success' : status === 'pending' ? 'warning' : 'danger';

function rankPercent(total: number): number {
  const max = Math.max(...stat.ranking.map((item) => item.total), 1);
  return Math.round((total / max) * 100);
}

onMounted(async () => {
  loading.value = true;
  try {
    Object.assign(stat, await api.get<DashboardStat>('/stats/dashboard'));
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.subtitle {
  margin: 4px 0 0;
  color: #94a3b8;
  font-size: 13px;
}

.stat-card {
  text-align: center;
}

.stat-label {
  color: #64748b;
  font-size: 14px;
}

.stat-value {
  margin-top: 10px;
  font-size: 24px;
  font-weight: 700;
}

.income {
  color: #16a34a;
}

.expense {
  color: #dc2626;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rank-item {
  margin-bottom: 14px;
}

.rank-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
}
</style>
