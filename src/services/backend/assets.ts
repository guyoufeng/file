import type { Device } from '../../types/domain'
import { sampleProject } from './data'
import { invokeCommand } from './invoke'

export async function getDevices(rackId?: string): Promise<Device[]> {
  try {
    return await invokeCommand<Device[]>('get_devices', { rackId })
  } catch {
    return rackId ? sampleProject.devices.filter((device) => device.rackId === rackId) : sampleProject.devices
  }
}
