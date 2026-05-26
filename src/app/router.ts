import { createRouter, createWebHashHistory } from 'vue-router'

export const routes = [
  { path: '/', redirect: '/rack-overview' },
  {
    path: '/rack-overview',
    name: '机柜总览',
    component: () => import('../features/rack-overview/RackOverviewPage.vue'),
  },
  {
    path: '/assets',
    name: '资产管理',
    component: () => import('../features/asset-management/AssetManagementPage.vue'),
  },
  {
    path: '/virtual-servers',
    name: '虚拟服务器管理',
    component: () => import('../features/virtual-server-management/VirtualServerManagementPage.vue'),
  },
  {
    path: '/connections',
    name: '连线管理',
    component: () => import('../features/connection-manager/ConnectionManagerPage.vue'),
  },
  {
    path: '/alerts',
    name: '告警中心',
    component: () => import('../features/alert-center/AlertCenterPage.vue'),
  },
  {
    path: '/reports',
    name: '报表中心',
    component: () => import('../features/report-center/ReportCenterPage.vue'),
  },
  {
    path: '/settings',
    name: '系统设置',
    component: () => import('../features/settings/SettingsPage.vue'),
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
