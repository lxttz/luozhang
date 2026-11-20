<template>
  <el-container class="layout">
    <el-aside width="210px" class="aside">
      <div class="brand">
        <el-icon><Wallet /></el-icon>
        <span>企业简易记账</span>
      </div>
      <el-menu :default-active="route.path" router class="menu" background-color="#111827" text-color="#cbd5e1" active-text-color="#ffffff">
        <el-menu-item index="/bills">
          <el-icon><Tickets /></el-icon>
          <span>收支流水</span>
        </el-menu-item>
        <el-menu-item index="/stats">
          <el-icon><DataAnalysis /></el-icon>
          <span>统计报表</span>
        </el-menu-item>
        <el-menu-item v-if="isBoss" index="/categories">
          <el-icon><FolderOpened /></el-icon>
          <span>分类管理</span>
        </el-menu-item>
        <el-menu-item v-if="isBoss" index="/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>
      <div class="aside-footer">Cloudflare 免费版</div>
    </el-aside>

    <el-container class="content-wrap">
      <el-header class="header">
        <div class="header-title">{{ route.meta.title || '企业简易记账' }}</div>
        <div class="header-user">
          <el-tag :type="isBoss ? 'warning' : 'success'" size="small">{{ isBoss ? '老板' : '财务' }}</el-tag>
          <span>{{ user?.name || user?.username }}</span>
          <el-button link type="primary" @click="handleLogout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const { user, isBoss, logout } = useAuth();

function handleLogout(): void {
  logout();
  router.push({ name: 'login' });
}
</script>

<style scoped>
.layout {
  height: 100vh;
}

.aside {
  background: #111827;
  display: flex;
  flex-direction: column;
}

.brand {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.menu {
  flex: 1;
  border-right: none;
}

.aside-footer {
  padding: 16px;
  color: #64748b;
  font-size: 12px;
  text-align: center;
}

.content-wrap {
  min-width: 0;
  background: #f3f5f9;
}

.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5e7eb;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.main {
  overflow: auto;
}
</style>
