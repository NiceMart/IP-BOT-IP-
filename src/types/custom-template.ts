/**
 * 自定义封面模板类型定义
 */

export interface CustomTemplate {
  id: string
  name: string
  createdAt: string
  background: BackgroundConfig
  portrait: PortraitConfig
  titles: TitlesConfig
  mask?: MaskConfig
}

export interface BackgroundConfig {
  blurEnabled: boolean
  blurRadius: number // 0-50
}

export interface PortraitConfig {
  strokeEnabled: boolean
  strokeType: 'solid' | 'dashed'
  strokeColor: string // hex color
  strokeWidth: number // pixels
  strokeDashPattern: number[] // [dash length, gap length, ...]
  size: { width: number; height: number } // percentage 0-100
  position: { x: number; y: number } // percentage 0-100
}

export interface TitlesConfig {
  main: TitleConfig
  sub: TitleConfig
}

export interface TitleConfig {
  text: string
  maxLength: number // 每行/每列最多字符数
  fontSize: number
  fontWeight: number
  fontName?: string
  color: string // hex color
  strokeColor: string // hex color
  strokeWidth: number
  position: { x: number; y: number } // percentage 0-100
  rotation?: number
  direction?: 'horizontal' | 'vertical' // 文字方向：横排或竖排，默认horizontal
  charSpacing?: number // 字符间距（像素），默认为fontSize的0.2倍
  lineSpacing?: number // 行/列间距（像素），默认为fontSize的1.2倍
  columns?: number // 列数（竖排时有效），默认自动计算
  rows?: number // 行数（横排时有效），默认自动计算
}

export interface MaskConfig {
  imagePath: string
  size: { width: number; height: number } // percentage 0-100
  position: { x: number; y: number } // percentage 0-100
  opacity: number // 0-1
  shape: 'rectangle' | 'circle' | 'custom'
}

export interface TitleConfig {
  [key: string]: any
}

/**
 * 拖拽元素状态
 */
export interface DragElementState {
  x: number // percentage 0-100
  y: number // percentage 0-100
  width?: number // percentage 0-100
  height?: number // percentage 0-100
  isDragging: boolean
}

export interface DragElements {
  portrait: DragElementState
  mainTitle: DragElementState
  subTitle: DragElementState
  mask: DragElementState
}

/**
 * 创建默认模板配置
 */
export function createDefaultTemplate(): CustomTemplate {
  return {
    id: `template_${Date.now()}`,
    name: '未命名模板',
    createdAt: new Date().toISOString(),
    background: {
      blurEnabled: false,
      blurRadius: 15,
    },
    portrait: {
      strokeEnabled: false,
      strokeType: 'solid',
      strokeColor: '#FFD700',
      strokeWidth: 3,
      strokeDashPattern: [10, 5],
      size: { width: 50, height: 70 },
      position: { x: 50, y: 50 },
    },
    titles: {
      main: {
        text: '',
        maxLength: 4,
        fontSize: 60,
        fontWeight: 700,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 2,
        position: { x: 50, y: 20 },
      },
      sub: {
        text: '',
        maxLength: 3,
        fontSize: 40,
        fontWeight: 600,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 1,
        position: { x: 50, y: 30 },
      },
    },
    mask: {
      imagePath: '',
      size: { width: 30, height: 20 },
      position: { x: 10, y: 10 },
      opacity: 0.8,
      shape: 'rectangle',
    },
  }
}

/**
 * 标题自动拆分逻辑
 */
export function splitTitle(text: string): { main: string; sub: string } {
  if (!text) return { main: '', sub: '' }

  const main = text.slice(0, 4) // 主标题最多4个字
  const sub = text.slice(4, 7) // 副标题最多3个字(第5-7个字)
  // 第8个字及以后的字符自动丢弃

  return { main, sub }
}

/**
 * 验证模板配置
 */
export function validateTemplate(template: CustomTemplate): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!template.name || template.name.trim() === '') {
    errors.push('模板名称不能为空')
  }

  if (template.background.blurRadius < 0 || template.background.blurRadius > 50) {
    errors.push('背景模糊度必须在0-50之间')
  }

  if (template.portrait.strokeWidth < 0 || template.portrait.strokeWidth > 20) {
    errors.push('描边宽度必须在0-20之间')
  }

  // 位置验证
  const validatePosition = (pos: { x: number; y: number }, name: string) => {
    if (pos.x < 0 || pos.x > 100 || pos.y < 0 || pos.y > 100) {
      errors.push(`${name}位置必须在0-100之间`)
    }
  }

  validatePosition(template.portrait.position, '人像')
  validatePosition(template.titles.main.position, '主标题')
  validatePosition(template.titles.sub.position, '副标题')

  return { valid: errors.length === 0, errors }
}
