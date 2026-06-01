export interface DeviceCenterScrollInput {
  rackHeightU: number;
  deviceStartU: number;
  deviceEndU: number;
  deviceHeightU: number;
  unitHeight: number;
  containerHeight: number;
}

export function computeDeviceCenterScrollTop(input: DeviceCenterScrollInput): number {
  const rackHeightPx = input.rackHeightU * input.unitHeight;
  const deviceMiddleFromTop =
    (input.rackHeightU - input.deviceEndU + input.deviceHeightU / 2) *
    input.unitHeight;
  return Math.max(
    0,
    Math.min(
      rackHeightPx - input.containerHeight,
      deviceMiddleFromTop - input.containerHeight / 2,
    ),
  );
}
