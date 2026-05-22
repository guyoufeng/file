export function getEndU(startU: number, heightU: number): number {
  return startU + heightU - 1
}

export function validateUPosition(startU: number, heightU: number, rackHeightU = 48): boolean {
  return startU >= 1 && heightU >= 1 && getEndU(startU, heightU) <= rackHeightU
}

export function getDeviceBlockY(startU: number, heightU: number, rackHeightU: number, rowHeight: number): number {
  return (rackHeightU - getEndU(startU, heightU)) * rowHeight
}

export function getDeviceBlockHeight(heightU: number, rowHeight: number): number {
  return heightU * rowHeight
}
