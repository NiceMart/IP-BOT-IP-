<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import type { DragElements, DragElementState, CustomTemplate } from '../../types/custom-template'

interface Props {
  width?: number
  height?: number
  elements: DragElements
  template?: CustomTemplate  // 添加模板数据以显示实际文字
  onElementMove?: (elementId: string, position: { x: number; y: number }) => void
  onElementResize?: (elementId: string, size: { width: number; height: number }) => void
}

const props = withDefaults(defineProps<Props>(), {
  width: 400,
  height: 600,
})

const canvas = ref<HTMLCanvasElement | null>(null)
const ctx = ref<CanvasRenderingContext2D | null>(null)

// 拖拽状态
const isDragging = ref(false)
const dragElement = ref<string | null>(null)
const dragOffset = ref({ x: 0, y: 0 })

// 元素配置
const elements = reactive({
  portrait: {
    name: '人像',
    color: 'rgba(0, 123, 255, 0.3)', // 蓝色
    borderColor: 'rgba(0, 123, 255, 0.8)',
  },
  mainTitle: {
    name: '主标题',
    color: 'rgba(255, 0, 0, 0.3)', // 红色
    borderColor: 'rgba(255, 0, 0, 0.8)',
  },
  subTitle: {
    name: '副标题',
    color: 'rgba(255, 193, 7, 0.3)', // 黄色
    borderColor: 'rgba(255, 193, 7, 0.8)',
  },
  mask: {
    name: '蒙版',
    color: 'rgba(40, 167, 69, 0.3)', // 绿色
    borderColor: 'rgba(40, 167, 69, 0.8)',
  },
})

// 初始化画布
const initCanvas = () => {
  if (!canvas.value) return

  ctx.value = canvas.value.getContext('2d')
  if (!ctx.value) return

  // 设置画布尺寸
  canvas.value.width = props.width
  canvas.value.height = props.height

  // 设置画布样式
  canvas.value.style.border = '1px solid #e5e7eb'
  canvas.value.style.borderRadius = '8px'
  canvas.value.style.backgroundColor = '#f9fafb'

  drawCanvas()
}

// 绘制画布
const drawCanvas = () => {
  if (!ctx.value || !canvas.value) return

  // 清空画布
  ctx.value.clearRect(0, 0, canvas.value.width, canvas.value.height)

  // 绘制背景网格
  drawGrid()

  // 绘制元素
  Object.entries(props.elements).forEach(([key, element]) => {
    drawElement(key, element)
  })

  // 绘制实际的文字预览
  if (props.template) {
    drawTextPreview()
  }

  // 绘制说明文字
  drawInstructions()
}

// 绘制背景网格
const drawGrid = () => {
  if (!ctx.value) return

  ctx.value.strokeStyle = '#e5e7eb'
  ctx.value.lineWidth = 0.5

  // 绘制水平线
  for (let y = 0; y <= canvas.value!.height; y += 50) {
    ctx.value.beginPath()
    ctx.value.moveTo(0, y)
    ctx.value.lineTo(canvas.value!.width, y)
    ctx.value.stroke()
  }

  // 绘制垂直线
  for (let x = 0; x <= canvas.value!.width; x += 50) {
    ctx.value.beginPath()
    ctx.value.moveTo(x, 0)
    ctx.value.lineTo(x, canvas.value!.height)
    ctx.value.stroke()
  }
}

// 绘制元素
const drawElement = (key: string, element: DragElementState) => {
  if (!ctx.value || !canvas.value) return

  const config = elements[key as keyof typeof elements]
  if (!config) return

  // 计算实际坐标和尺寸
  const x = (element.x / 100) * canvas.value.width
  const y = (element.y / 100) * canvas.value.height
  const width = ((element.width || 20) / 100) * canvas.value.width
  const height = ((element.height || 15) / 100) * canvas.value.height

  // 绘制元素背景
  ctx.value.fillStyle = config.color
  ctx.value.fillRect(x - width / 2, y - height / 2, width, height)

  // 绘制边框
  ctx.value.strokeStyle = config.borderColor
  ctx.value.lineWidth = 2
  ctx.value.strokeRect(x - width / 2, y - height / 2, width, height)

  // 绘制元素名称
  ctx.value.fillStyle = config.borderColor
  ctx.value.font = '12px Arial'
  ctx.value.textAlign = 'center'
  ctx.value.fillText(
    config.name,
    x,
    y + height / 2 + 15
  )

  // 如果正在拖拽这个元素，高亮显示
  if (isDragging.value && dragElement.value === key) {
    ctx.value.strokeStyle = '#ff0000'
    ctx.value.lineWidth = 3
    ctx.value.strokeRect(x - width / 2 - 2, y - height / 2 - 2, width + 4, height + 4)
  }
}

// 绘制实际的文字预览
const drawTextPreview = () => {
  if (!ctx.value || !canvas.value || !props.template) return

  const canvasWidth = canvas.value.width
  const canvasHeight = canvas.value.height


  // 绘制主标题
  if (props.template.titles?.main?.text) {
    const mainTitle = props.template.titles.main
    const text = mainTitle.text
    const maxLength = mainTitle.maxLength || 4
    // 计算缩放比例（基准分辨率：1080x1440）
    const scale = canvasWidth / 1080
    const baseFontSize = mainTitle.fontSize || 60
    const fontSize = Math.round(baseFontSize * scale)
    const direction = mainTitle.direction || 'horizontal'
    const baseCharSpacing = mainTitle.charSpacing !== undefined ? mainTitle.charSpacing : Math.round(baseFontSize * 0.2)
    const baseLineSpacing = mainTitle.lineSpacing !== undefined ? mainTitle.lineSpacing : Math.round(baseFontSize * 1.2)
    const charSpacing = Math.round(baseCharSpacing * scale)
    const lineSpacing = Math.round(baseLineSpacing * scale)

    // 处理旋转坐标转换
    let posX = mainTitle.position.x
    let posY = mainTitle.position.y
    const rotation = mainTitle.rotation || 0
    // 当旋转 90° 或 270° 时，需要转换坐标（因为生成时也进行了这个转换）
    if (Math.abs(rotation - 90) < 1 || Math.abs(rotation - 270) < 1) {
      // 90° 旋转：新X = 旧Y，新Y = 100 - 旧X
      const tempX = posX
      posX = posY
      posY = 100 - tempX
    }

    const x = (posX / 100) * canvasWidth
    const y = (posY / 100) * canvasHeight
    console.log('[DragCanvas] Main title position:', mainTitle.position, '-> pixels:', {x, y}, 'rotation:', rotation)

    ctx.value.fillStyle = mainTitle.color || '#FFFFFF'
    const fontFamily = mainTitle.fontName || 'Arial'
    ctx.value.font = `${mainTitle.fontWeight || 700} ${fontSize}px "${fontFamily}"`
    ctx.value.textAlign = 'center'
    ctx.value.textBaseline = 'middle'

    // 分行
    const lines: string[] = []
    for (let i = 0; i < text.length; i += maxLength) {
      lines.push(text.slice(i, i + maxLength))
    }

    if (direction === 'vertical') {
      // 竖排：宽度 = fontSize + (列数-1) * lineSpacing
      const totalWidth = fontSize + (lines.length - 1) * lineSpacing
      const maxColChars = Math.max(...lines.map(l => l.length), 1)
      const totalHeight = (maxColChars - 1) * (fontSize + charSpacing) + fontSize
      const startX = x + totalWidth / 2 - fontSize / 2
      const startY = y - totalHeight / 2

      lines.forEach((line, colIdx) => {
        const colX = startX - colIdx * lineSpacing
        Array.from(line).forEach((char, charIdx) => {
          const charY = startY + charIdx * (fontSize + charSpacing) + fontSize / 2
          ctx.value!.fillText(char, colX, charY)
        })
      })
    } else {
      // 横排：宽度 = (最长行字符数-1) * (fontSize + charSpacing) + fontSize
      const maxLineChars = Math.max(...lines.map(l => l.length), 1)
      const totalWidth = (maxLineChars - 1) * (fontSize + charSpacing) + fontSize
      // 横排：高度 = (行数-1) * (fontSize + lineSpacing) + fontSize
      const totalHeight = (lines.length - 1) * (fontSize + lineSpacing) + fontSize
      const startX = x - totalWidth / 2
      const startY = y - totalHeight / 2

      lines.forEach((line, rowIdx) => {
        const lineY = startY + rowIdx * (fontSize + lineSpacing) + fontSize / 2
        Array.from(line).forEach((char, charIdx) => {
          const charX = startX + charIdx * (fontSize + charSpacing) + fontSize / 2
          ctx.value!.fillText(char, charX, lineY)
        })
      })
    }
  }

  // 绘制副标题（同样的逻辑）
  if (props.template.titles?.sub?.text) {
    const subTitle = props.template.titles.sub
    const text = subTitle.text
    const maxLength = subTitle.maxLength || 3
    // 计算缩放比例（基准分辨率：1080x1440）
    const scale = canvasWidth / 1080
    const baseFontSize = subTitle.fontSize || 40
    const fontSize = Math.round(baseFontSize * scale)
    const direction = subTitle.direction || 'horizontal'
    const baseCharSpacing = subTitle.charSpacing !== undefined ? subTitle.charSpacing : Math.round(baseFontSize * 0.2)
    const baseLineSpacing = subTitle.lineSpacing !== undefined ? subTitle.lineSpacing : Math.round(baseFontSize * 1.2)
    const charSpacing = Math.round(baseCharSpacing * scale)
    const lineSpacing = Math.round(baseLineSpacing * scale)

    // 处理旋转坐标转换
    let posX = subTitle.position.x
    let posY = subTitle.position.y
    const rotation = subTitle.rotation || 0
    // 当旋转 90° 或 270° 时，需要转换坐标（因为生成时也进行了这个转换）
    if (Math.abs(rotation - 90) < 1 || Math.abs(rotation - 270) < 1) {
      // 90° 旋转：新X = 旧Y，新Y = 100 - 旧X
      const tempX = posX
      posX = posY
      posY = 100 - tempX
    }

    const x = (posX / 100) * canvasWidth
    const y = (posY / 100) * canvasHeight

    ctx.value.fillStyle = subTitle.color || '#FFFFFF'
    const fontFamily = subTitle.fontName || 'Arial'
    ctx.value.font = `${subTitle.fontWeight || 600} ${fontSize}px "${fontFamily}"`
    ctx.value.textAlign = 'center'
    ctx.value.textBaseline = 'middle'

    // 分行
    const lines: string[] = []
    for (let i = 0; i < text.length; i += maxLength) {
      lines.push(text.slice(i, i + maxLength))
    }

    if (direction === 'vertical') {
      // 竖排：宽度 = fontSize + (列数-1) * lineSpacing
      const totalWidth = fontSize + (lines.length - 1) * lineSpacing
      const maxColChars = Math.max(...lines.map(l => l.length), 1)
      const totalHeight = (maxColChars - 1) * (fontSize + charSpacing) + fontSize
      const startX = x + totalWidth / 2 - fontSize / 2
      const startY = y - totalHeight / 2

      lines.forEach((line, colIdx) => {
        const colX = startX - colIdx * lineSpacing
        Array.from(line).forEach((char, charIdx) => {
          const charY = startY + charIdx * (fontSize + charSpacing) + fontSize / 2
          ctx.value!.fillText(char, colX, charY)
        })
      })
    } else {
      // 横排：宽度 = (最长行字符数-1) * (fontSize + charSpacing) + fontSize
      const maxLineChars = Math.max(...lines.map(l => l.length), 1)
      const totalWidth = (maxLineChars - 1) * (fontSize + charSpacing) + fontSize
      // 横排：高度 = (行数-1) * (fontSize + lineSpacing) + fontSize
      const totalHeight = (lines.length - 1) * (fontSize + lineSpacing) + fontSize
      const startX = x - totalWidth / 2
      const startY = y - totalHeight / 2

      lines.forEach((line, rowIdx) => {
        const lineY = startY + rowIdx * (fontSize + lineSpacing) + fontSize / 2
        Array.from(line).forEach((char, charIdx) => {
          const charX = startX + charIdx * (fontSize + charSpacing) + fontSize / 2
          ctx.value!.fillText(char, charX, lineY)
        })
      })
    }
  }
}

// 绘制说明文字
const drawInstructions = () => {
  if (!ctx.value) return

  ctx.value.fillStyle = '#6b7280'
  ctx.value.font = '14px Arial'
  ctx.value.textAlign = 'center'
  ctx.value.fillText(
    '拖拽调整元素位置 - 蓝色:人像, 红色:主标题, 黄色:副标题, 绿色:蒙版',
    canvas.value!.width / 2,
    canvas.value!.height - 20
  )
}

// 鼠标事件处理
const handleMouseDown = (event: MouseEvent) => {
  if (!canvas.value) return

  const rect = canvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 检查点击的元素
  for (const [key, element] of Object.entries(props.elements)) {
    const elementX = (element.x / 100) * canvas.value.width
    const elementY = (element.y / 100) * canvas.value.height
    const width = ((element.width || 20) / 100) * canvas.value.width
    const height = ((element.height || 15) / 100) * canvas.value.height

    if (
      x >= elementX - width / 2 &&
      x <= elementX + width / 2 &&
      y >= elementY - height / 2 &&
      y <= elementY + height / 2
    ) {
      isDragging.value = true
      dragElement.value = key
      dragOffset.value = {
        x: x - elementX,
        y: y - elementY,
      }
      break
    }
  }
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !dragElement.value || !canvas.value) return

  const rect = canvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 计算新的百分比位置
  const newX = ((x - dragOffset.value.x) / canvas.value.width) * 100
  const newY = ((y - dragOffset.value.y) / canvas.value.height) * 100

  // 限制在画布范围内
  const clampedX = Math.max(0, Math.min(100, newX))
  const clampedY = Math.max(0, Math.min(100, newY))

  // 更新元素位置
  if (props.onElementMove) {
    props.onElementMove(dragElement.value, { x: clampedX, y: clampedY })
  }
}

const handleMouseUp = () => {
  isDragging.value = false
  dragElement.value = null
}

// 监听元素和模板变化
watch(
  () => [props.elements, props.template],
  () => {
    drawCanvas()
  },
  { deep: true }
)

// 生命周期
onMounted(() => {
  initCanvas()

  // 添加事件监听器
  if (canvas.value) {
    canvas.value.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }
})

onUnmounted(() => {
  // 移除事件监听器
  if (canvas.value) {
    canvas.value.removeEventListener('mousedown', handleMouseDown)
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
})
</script>

<template>
  <div class="drag-canvas-container">
    <canvas
      ref="canvas"
      :width="width"
      :height="height"
      class="drag-canvas"
    />
    <div class="canvas-info mt-2 text-sm text-gray-600">
      <p>📐 画布尺寸: {{ width }}x{{ height }}px</p>
      <p>🎨 拖拽元素调整位置，点击查看参数设置</p>
    </div>
  </div>
</template>

<style scoped>
.drag-canvas {
  cursor: default;
  display: block;
  margin: 0 auto;
}

.drag-canvas-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.canvas-info {
  text-align: center;
}
</style>