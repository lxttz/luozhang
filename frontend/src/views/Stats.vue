<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">统计报表</h1>
      <el-date-picker v-model="month" type="month" value-format="YYYY-MM" placeholder="选择月份" @change="loadMonth" />
    </div>

    <el-row :gutter="16">
      <el-col :span="8">
        <el-card class="card stat-card">
          <div class="stat-label">本月收入</div>
          <div class="stat-value income">¥ {{ money(monthStat.income) }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="card stat-card">
          <div class="stat-label">本月支出</div>
          <div class="stat-value expense">¥ {{ money(monthStat.expense) }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="card stat-card">
          <div class="stat-label">本月结余</div>
          <div class="stat-value" :class="monthStat.balance >= 0 ? 'income' : 'expense'">
            ¥ {{ money(monthStat.balance) }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="isBoss ? 12 : 24">
        <el-card class="card">
          <template #header>本月分类占比</template>
          <div ref="pieRef" class="chart"></div>
          <el-empty v-if="!monthStat.categories.length" description="本月暂无数据" :image-size="60" />
        </el-card>
      </el-col>
      <el-col v-if="isBoss" :span="12">
        <el-card class="card">
          <template #header>
            <div class="chart-header">
              <span>年度收支趋势</span>
              <el-date-picker
                v-model="year"
                type="year"
                value-format="YYYY"
                placeholder="选择年份"
                size="small"
                style="width: 110px"
                @change="loadYear"
              />
            </div>
          </template>
          <div ref="barRef" class="chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="isBoss" class="card" style="margin-top: 16px">
      <template #header>{{ year }} 年汇总（仅老板可见）</template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="全年收入">¥ {{ money(yearStat.income) }}</el-descriptions-item>
        <el-descriptions-item label="全年支出">¥ {{ money(yearStat.expense) }}</el-descriptions-item>
        <el-descriptions-item label="全年结余">¥ {{ money(yearStat.balance) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import * as echarts from 'echarts';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../api';
import { useAuth } from '../stores/auth';
import type { MonthStat, YearStat } from '../types';
import { currentMonth, money } from '../utils';

const { isBoss } = useAuth();

const month = ref(currentMonth());
const year = ref(String(new Date().getFullYear()));
const monthStat = reactive<MonthStat>({ month: '', income: 0, expense: 0, balance: 0, categories: [] });
const yearStat = reactive<YearStat>({ year: 0, income: 0, expense: 0, balance: 0, months: [] });

const pieRef = ref<HTMLDivElement | null>(null);
const barRef = ref<HTMLDivElement | null>(null);
let pieChart: echarts.ECharts | null = null;
let barChart: echarts.ECharts | null = null;

async function loadMonth(): Promise<void> {
  try {
    const result = await api.get<MonthStat>('/stats/month', { params: { month: month.value } });
    Object.assign(monthStat, result);
    await nextTick();
    renderPie();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

async function loadYear(): Promise<void> {
  if (!isBoss.value) return;
  try {
    const result = await api.get<YearStat>('/stats/year', { params: { year: year.value } });
    Object.assign(yearStat, result);
    await nextTick();
    renderBar();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

function renderPie(): void {
  if (!pieRef.value) return;
  if (!pieChart) pieChart = echarts.init(pieRef.value);
  const data = monthStat.categories.map((item) => ({
    name: `${item.name}（${item.type === 'income' ? '收' : '支'}）`,
    value: item.total,
    itemStyle: { color: item.type === 'income' ? '#22c55e' : '#f97316' },
  }));
  pieChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        data,
      },
    ],
  });
  pieChart.resize();
}

function renderBar(): void {
  if (!barRef.value) return;
  if (!barChart) barChart = echarts.init(barRef.value);
  barChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['收入', '支出'], bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'category', data: yearStat.months.map((item) => item.month.slice(5)) },
    yAxis: { type: 'value' },
    series: [
      { name: '收入', type: 'bar', data: yearStat.months.map((item) => item.income), itemStyle: { color: '#22c55e' } },
      { name: '支出', type: 'bar', data: yearStat.months.map((item) => item.expense), itemStyle: { color: '#f97316' } },
    ],
  });
  barChart.resize();
}

function handleResize(): void {
  pieChart?.resize();
  barChart?.resize();
}

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  await loadMonth();
  await loadYear();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  pieChart?.dispose();
  barChart?.dispose();
});
</script>

<style scoped>
.stat-card {
  text-align: center;
}

.stat-label {
  color: #64748b;
  font-size: 14px;
}

.stat-value {
  margin-top: 10px;
  font-size: 26px;
  font-weight: 700;
}

.income {
  color: #16a34a;
}

.expense {
  color: #dc2626;
}

.chart {
  height: 320px;
  width: 100%;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
