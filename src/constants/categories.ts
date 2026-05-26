import type { DeviceCategory } from '../types/domain'

export const defaultDeviceCategories: DeviceCategory[] = [
  {
    id: 'server',
    name: '服务器',
    major: 'server',
    subtypes: ['物理服务器', '数据库服务器', '虚拟化服务器', '超融合服务器'],
  },
  {
    id: 'virtual_server',
    name: '虚拟服务器',
    major: 'virtual_server',
    subtypes: ['ZStack虚拟机', 'VMware虚拟机', '云主机', '容器节点'],
  },
  {
    id: 'network',
    name: '网络设备',
    major: 'network',
    subtypes: ['核心交换机', '接入交换机', '路由器', '负载均衡'],
  },
  {
    id: 'security',
    name: '安全设备',
    major: 'security',
    subtypes: ['防火墙', '堡垒机', '入侵防护', '日志审计'],
  },
  {
    id: 'storage',
    name: '存储设备',
    major: 'storage',
    subtypes: ['SAN存储', 'NAS存储', '备份一体机', '磁带库'],
  },
  {
    id: 'facility',
    name: '基础设施',
    major: 'facility',
    subtypes: ['列头柜', '精密空调', 'UPS', 'PDU'],
  },
  {
    id: 'patching',
    name: '配线设备',
    major: 'patching',
    subtypes: ['配线架', 'ODF', 'MDF'],
  },
  {
    id: 'other',
    name: '其他设备',
    major: 'other',
    subtypes: ['其他'],
  },
]
