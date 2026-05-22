import type { Device } from '../../types/domain'
import { sampleProject } from './data'
import { invokeCommand } from './invoke'

export async function getDevices(rackId?: string): Promise<Device[]> {
  try {
    const devices = await invokeCommand<Device[]>('get_devices', { rackId })
    if (devices.length > 0) {
      return devices
    }
    return rackId ? sampleProject.devices.filter((device) => device.rackId === rackId) : sampleProject.devices
  } catch {
    return rackId ? sampleProject.devices.filter((device) => device.rackId === rackId) : sampleProject.devices
  }
}
