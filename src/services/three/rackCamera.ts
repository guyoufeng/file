import type { SceneVector3 } from './rackScene'

export interface RackCameraPose {
  position: SceneVector3
  target: SceneVector3
}

export function getDefaultRackCameraPose(width: number, depth: number, leadershipMode: boolean): RackCameraPose {
  const centerX = width / 2 - 0.7
  const centerZ = depth / 2 - 1.1
  const distance = Math.max(depth, 8)

  return {
    position: {
      x: centerX + width * 0.76,
      y: leadershipMode ? 7.2 : 5.8,
      z: centerZ + distance * 0.74,
    },
    target: {
      x: centerX - width * 0.08,
      y: 1.45,
      z: centerZ - depth * 0.04,
    },
  }
}
