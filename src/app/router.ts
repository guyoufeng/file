import { createRouter, createWebHashHistory } from 'vue-router'
import {
  canAccessModule,
  getCurrentSession,
  getFirstAccessiblePath,
  type AppModuleKey,
} from '../services/auth/accountAccess'

export const routes = [
  { path: '/', redirect: '/rack-overview' },
  {
    path: '/login',
    name: '登录',
    component: () => import('../features/auth/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/rack-overview',
    name: '机柜总览',
    component: () => import('../features/rack-overview/RackOverviewPage.vue'),
    meta: { module: 'rack-overview' },
  },
  {
    path: '/assets',
    name: '资产管理',
    component: () => import('../features/asset-management/AssetManagementPage.vue'),
    meta: { module: 'assets' },
  },
  {
    path: '/virtual-servers',
    name: '虚拟服务器管理',
    component: () => import('../features/virtual-server-management/VirtualServerManagementPage.vue'),
    meta: { module: 'virtual-servers' },
  },
  {
    path: '/access-records',
    name: '数据中心进出管理',
    component: () => import('../features/access-management/AccessManagementPage.vue'),
    meta: { module: 'access-records' },
  },
  {
    path: '/changes',
    name: '变更管理',
    component: () => import('../features/change-management/ChangeManagementPage.vue'),
    meta: { module: 'change-management' },
  },
  {
    path: '/connections',
    name: '连线管理',
    component: () => import('../features/connection-manager/ConnectionManagerPage.vue'),
    meta: { module: 'connections' },
  },
  {
    path: '/alerts',
    name: '告警中心',
    component: () => import('../features/alert-center/AlertCenterPage.vue'),
    meta: { module: 'alerts' },
  },
  {
    path: '/reports',
    name: '报表中心',
    component: () => import('../features/report-center/ReportCenterPage.vue'),
    meta: { module: 'reports' },
  },
  {
    path: '/settings',
    name: '系统设置',
    component: () => import('../features/settings/SettingsPage.vue'),
    meta: { module: 'settings' },
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  const session = getCurrentSession()
  if (to.meta.public) {
    return session ? getFirstAccessiblePath(session) : true
  }
  if (!session) return '/login'
  const moduleKey = to.meta.module as AppModuleKey | undefined
  if (moduleKey && !canAccessModule(session, moduleKey)) {
    return getFirstAccessiblePath(session)
  }
  return true
})
