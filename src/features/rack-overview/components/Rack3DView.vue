<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Alert, Device, Rack, Room } from '../../../types/domain'
import { getDefaultRackCameraPose } from '../../../services/three/rackCamera'
import { buildRackSceneModel } from '../../../services/three/rackScene'

const props = defineProps<{
  room: Room | undefined
  racks: Rack[]
  devices: Device[]
  alerts: Alert[]
  selectedRackId: string | null
  leadershipMode: boolean
}>()

const emit = defineEmits<{
  selectRack: [rack: Rack]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const sceneError = ref("")
const rackMeshes = new Map<string, THREE.Mesh>()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let rackGroup: THREE.Group | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrame = 0

const sceneModel = computed(() => buildRackSceneModel(props.room, props.racks, props.devices, props.alerts))
const activeAlertCount = computed(() => props.alerts.filter((alert) => alert.status !== 'recovered' && alert.status !== 'closed').length)

onMounted(async () => {
  await nextTick()
  setupScene()
  rebuildScene()
  fitCamera()
  startAnimation()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  controls?.dispose()
  renderer?.dispose()
  rackMeshes.clear()
})

watch(sceneModel, () => {
  rebuildScene()
  fitCamera()
})

watch(
  () => props.selectedRackId,
  (rackId) => {
    highlightSelectedRack(rackId)
    if (rackId) focusRack(rackId)
  },
)

function setupScene() {
  if (!canvasRef.value || !containerRef.value) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#050a16')
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true, alpha: false })
  } catch {
    sceneError.value = '当前浏览器没有成功启用 WebGL，无法加载 3D 视图。请检查浏览器硬件加速、显卡驱动或换 Edge/Chrome 再试。'
    return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.maxPolarAngle = Math.PI * 0.47
  controls.minDistance = 5
  controls.maxDistance = 70

  const ambient = new THREE.AmbientLight('#c7d2fe', 1.6)
  const mainLight = new THREE.DirectionalLight('#ffffff', 2.2)
  mainLight.position.set(10, 16, 8)
  mainLight.castShadow = true
  const blueLight = new THREE.PointLight('#38bdf8', 1.8, 28)
  blueLight.position.set(-8, 6, -6)
  scene.add(ambient, mainLight, blueLight)

  rackGroup = new THREE.Group()
  scene.add(rackGroup)

  resizeObserver = new ResizeObserver(resizeScene)
  resizeObserver.observe(containerRef.value)
  resizeScene()
}

function rebuildScene() {
  if (!scene || !rackGroup) return

  rackGroup.clear()
  rackMeshes.clear()

  const model = sceneModel.value
  const floor = createFloor(model.bounds.width, model.bounds.depth)
  rackGroup.add(floor)

  for (const module of model.modules) {
    rackGroup.add(createModulePad(module.position.x, module.position.z, module.size.x, module.size.z))
    rackGroup.add(createTextSprite(module.name, '#bae6fd', 0.78, module.position.x, 0.08, module.position.z - module.size.z / 2 + 0.26))
  }

  for (const item of model.items) {
    const mesh = createRackMesh(item)
    rackMeshes.set(item.rackId, mesh)
    rackGroup.add(mesh)
    rackGroup.add(createTextSprite(item.displayName, '#f8fafc', 0.48, item.position.x, item.size.y + 0.56, item.position.z))
  }

  highlightSelectedRack(props.selectedRackId)
}

function createFloor(width: number, depth: number) {
  const group = new THREE.Group()
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(width + 5, 12), Math.max(depth + 6, 8)),
    new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.86, metalness: 0.08 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(width / 2 - 0.7, -0.02, depth / 2 - 1.1)
  floor.receiveShadow = true

  const grid = new THREE.GridHelper(Math.max(width + 5, 12), 24, '#1d4ed8', '#1e293b')
  grid.position.copy(floor.position)
  grid.position.y = 0
  group.add(floor, grid)
  return group
}

function createModulePad(x: number, z: number, width: number, depth: number) {
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.04, depth),
    new THREE.MeshStandardMaterial({ color: '#0b1220', emissive: '#082f49', roughness: 0.72 }),
  )
  pad.position.set(x, 0, z)
  return pad
}

function createRackMesh(item: ReturnType<typeof buildRackSceneModel>['items'][number]) {
  const material = new THREE.MeshStandardMaterial({
    color: item.visual.color,
    emissive: item.visual.emissive,
    roughness: 0.48,
    metalness: 0.35,
    transparent: true,
    opacity: item.visual.opacity,
  })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(item.size.x, item.size.y, item.size.z), material)
  mesh.position.set(item.position.x, item.position.y, item.position.z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.rack = item.rack

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: item.visual.alertLevel ? '#fef2f2' : '#93c5fd', transparent: true, opacity: 0.56 }),
  )
  mesh.add(edge)

  return mesh
}

function createTextSprite(text: string, color: string, scale: number, x: number, y: number, z: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = 'rgba(2, 6, 23, 0.78)'
    context.fillRect(0, 18, 256, 58)
    context.strokeStyle = 'rgba(56, 189, 248, 0.38)'
    context.strokeRect(1, 19, 254, 56)
    context.font = '600 28px Microsoft YaHei, Arial'
    context.fillStyle = color
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, 128, 48, 224)
  }
  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
  sprite.scale.set(2.2 * scale, 0.82 * scale, 1)
  sprite.position.set(x, y, z)
  return sprite
}

function resizeScene() {
  if (!containerRef.value || !camera || !renderer) return
  const rect = containerRef.value.getBoundingClientRect()
  camera.aspect = rect.width / Math.max(rect.height, 1)
  camera.updateProjectionMatrix()
  renderer.setSize(rect.width, rect.height, false)
}

function fitCamera() {
  if (!camera || !controls) return
  const { width, depth } = sceneModel.value.bounds
  const pose = getDefaultRackCameraPose(width, depth, props.leadershipMode)
  camera.position.set(pose.position.x, pose.position.y, pose.position.z)
  controls.target.set(pose.target.x, pose.target.y, pose.target.z)
  controls.update()
}

function focusRack(rackId: string) {
  const mesh = rackMeshes.get(rackId)
  if (!mesh || !camera || !controls) return
  const target = mesh.position
  controls.target.set(target.x, 1.6, target.z)
  camera.position.set(target.x + 4.2, 5.5, target.z + 6.2)
  controls.update()
}

function highlightSelectedRack(rackId: string | null) {
  for (const [id, mesh] of rackMeshes) {
    const scale = id === rackId ? 1.12 : 1
    mesh.scale.set(scale, scale, scale)
  }
}

function handlePointerDown(event: PointerEvent) {
  if (!canvasRef.value || !camera) return
  const rect = canvasRef.value.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const intersects = raycaster.intersectObjects([...rackMeshes.values()], false)
  const rack = intersects[0]?.object.userData.rack as Rack | undefined
  if (rack) {
    emit('selectRack', rack)
    focusRack(rack.id)
  }
}

function startAnimation() {
  const render = () => {
    controls?.update()
    if (renderer && scene && camera) renderer.render(scene, camera)
    animationFrame = requestAnimationFrame(render)
  }
  render()
}
</script>

<template>
  <div ref="containerRef" class="rack-3d-view" :class="{ leadership: leadershipMode }" data-testid="rack-3d-view">
    <canvas ref="canvasRef" aria-label="3D轻量机柜视图" @pointerdown="handlePointerDown" />
    <div v-if="sceneError" class="scene-error" role="alert">
      {{ sceneError }}
    </div>
    <div class="scene-hud">
      <div>
        <strong>{{ room?.name ?? '未选择机房' }}</strong>
        <span>{{ racks.length }} 个机柜 / {{ devices.length }} 台设备</span>
      </div>
      <div>
        <strong>{{ activeAlertCount }}</strong>
        <span>活动告警</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rack-3d-view {
  position: relative;
  min-height: 560px;
  overflow: hidden;
  border: 1px solid var(--viz-border);
  border-radius: 8px;
  background: var(--viz-bg);
  box-shadow: 0 18px 44px rgba(2, 6, 23, 0.2);
}

.rack-3d-view.leadership {
  min-height: 680px;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
}

canvas:active {
  cursor: grabbing;
}

.scene-hud {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
}

.scene-error {
  position: absolute;
  inset: 16px;
  display: grid;
  place-items: center;
  padding: 18px;
  border: 1px solid rgba(239, 68, 68, 0.42);
  border-radius: 8px;
  color: #fecaca;
  text-align: center;
  background: rgba(127, 29, 29, 0.18);
}

.scene-hud > div {
  min-width: 160px;
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.76);
  backdrop-filter: blur(10px);
}

.scene-hud strong {
  color: var(--viz-text);
  font-size: 18px;
}

.scene-hud span {
  color: var(--viz-muted);
  font-size: 12px;
}
</style>
