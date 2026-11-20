<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">系统设置</h1>
      <span class="subtitle">仅老板可修改，保存后全站立即生效</span>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :md="12">
        <el-card class="card">
          <template #header>系统名称</template>
          <p class="desc">系统名称会显示在登录页、首页、侧边栏和浏览器标签上。</p>
          <el-form label-width="80px">
            <el-form-item label="名称">
              <el-input v-model="systemNameInput" maxlength="30" placeholder="例如：洛账" />
            </el-form-item>
            <el-form-item label="预览">
              <div class="preview">{{ systemNameInput || '洛账' }}</div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="nameSaving" @click="saveName">保存名称</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="card">
          <template #header>财务权限</template>
          <div class="setting-row">
            <div>
              <div class="setting-title">允许财务删除单据</div>
              <div class="desc">关闭后财务只能新增、编辑自己录入的单据</div>
            </div>
            <el-switch v-model="allowDelete" :loading="deleteLoading" @change="saveDelete" />
          </div>
          <el-alert
            class="tip"
            type="info"
            :closable="false"
            show-icon
            title="删除的单据会进入回收站，老板可以恢复或彻底删除。"
          />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../api';
import { useBranding } from '../stores/branding';

const { systemName, setSystemName } = useBranding();
const systemNameInput = ref(systemName.value);
const allowDelete = ref(false);
const nameSaving = ref(false);
const deleteLoading = ref(false);

async function loadSettings(): Promise<void> {
  try {
    const result = await api.get<{ allow_finance_delete: boolean; system_name: string }>('/settings');
    systemNameInput.value = result.system_name;
    allowDelete.value = result.allow_finance_delete;
    setSystemName(result.system_name);
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

async function saveName(): Promise<void> {
  const name = systemNameInput.value.trim();
  if (!name || name.length > 30) {
    ElMessage.warning('系统名称需为 1-30 个字符');
    return;
  }
  nameSaving.value = true;
  try {
    await api.put('/settings', { system_name: name });
    setSystemName(name);
    ElMessage.success('系统名称已更新');
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    nameSaving.value = false;
  }
}

async function saveDelete(value: boolean): Promise<void> {
  deleteLoading.value = true;
  try {
    await api.put('/settings', { allow_finance_delete: value });
    ElMessage.success('设置已保存');
  } catch (error) {
    allowDelete.value = !value;
    ElMessage.error(errorMessage(error));
  } finally {
    deleteLoading.value = false;
  }
}

onMounted(loadSettings);
</script>

<style scoped>
.subtitle,
.desc {
  color: #64748b;
  font-size: 13px;
}

.desc {
  margin: 0 0 18px;
  line-height: 1.7;
}

.preview {
  padding: 10px 16px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.setting-row .desc {
  margin: 6px 0 0;
}

.setting-title {
  font-weight: 600;
}

.tip {
  margin-top: 24px;
}
</style>
