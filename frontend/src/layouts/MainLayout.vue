<template>
  <el-container class="layout">
    <el-aside :width="asideCollapsed ? '64px' : '210px'" class="aside">
      <div class="brand">
        <el-icon><Wallet /></el-icon>
        <span v-if="!asideCollapsed">企业简易记账</span>
      </div>
      <el-menu
        :default-active="route.path"
        router
        class="menu"
        :collapse="asideCollapsed"
        background-color="#111827"
        text-color="#cbd5e1"
        active-text-color="#ffffff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>首页看板</span>
        </el-menu-item>
        <el-menu-item index="/bills">
          <el-icon><Tickets /></el-icon>
          <span>收支流水</span>
        </el-menu-item>
        <el-menu-item index="/stats">
          <el-icon><DataAnalysis /></el-icon>
          <span>统计报表</span>
        </el-menu-item>
        <el-menu-item v-if="isBoss" index="/logs">
          <el-icon><Document /></el-icon>
          <span>操作日志</span>
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
      <div v-if="!asideCollapsed" class="aside-footer">Cloudflare 免费版</div>
    </el-aside>

    <el-container class="content-wrap">
      <el-header class="header">
        <div class="header-left">
          <el-button link class="toggle-btn" @click="asideCollapsed = !asideCollapsed">
            <el-icon><component :is="asideCollapsed ? 'Expand' : 'Fold'" /></el-icon>
          </el-button>
          <div class="header-title">{{ route.meta.title || '企业简易记账' }}</div>
        </div>
        <div class="header-user">
          <el-tag :type="isBoss ? 'warning' : 'success'" size="small">{{ isBoss ? '老板' : '财务' }}</el-tag>
          <el-dropdown @command="handleCommand">
            <span class="user-trigger">
              {{ user?.name || user?.username }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><Setting /></el-icon>个人设置
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const { user, isBoss, logout } = useAuth();
const asideCollapsed = ref(false);

onMounted(() => {
  asideCollapsed.value = window.innerWidth < 900;
});

function handleCommand(command: string): void {
  if (command === 'profile') router.push({ name: 'profile' });
  if (command === 'logout') {
    logout();
    router.push({ name: 'login' });
  }
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
  transition: width 0.2s;
  overflow: hidden;
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
  white-space: nowrap;
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
  padding: 0 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-btn {
  font-size: 18px;
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

.user-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #374151;
}

.main {
  overflow: auto;
  padding: 16px;
}

@media (max-width: 768px) {
  .header-title {
    font-size: 14px;
  }

  .header-user .el-tag {
    display: none;
  }

  .main {
    padding: 12px;
  }
}
</style>
