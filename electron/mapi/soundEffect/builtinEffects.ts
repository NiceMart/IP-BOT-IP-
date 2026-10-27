/**
 * 内置音效定义（主进程版本）
 * 注意：这是 src/lib/subtitle/effects/SoundEffectLibrary.ts 的精简版本
 * 仅包含主进程所需的元数据和命令生成功能
 */

import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

/**
 * 音效 ID 到文件名的映射
 * 这些音效文件存储在 resources/extra/common/soundEffects/ 目录下
 */
export const SOUND_EFFECT_FILES: Record<string, string> = {
  // 原有音效
  'swoosh': 'swoosh.mp3',
  'magic': 'magic.mp3',
  // 新增已下载的精选音效
  'pop-1': '789790__quatricise__pop-1.wav',
  'glass-collide': '122583__timkahn__glass-collide.wav',
  'sweep-up-down': '157553__timbre__sine-log-sweep-up-down.wav',
  'interference': '194201__coldwellw__text-interference.wav',
  'knife-scrape': '244258__bajko__blade-scrape_knife.wav',
  'pill-pop': '256314__kodack__popping-open-some-pills.wav',
  'chalk-writing': '377832__newagesoup__writing-chalk-med-01.wav',
  'chalk-one': '377840__newagesoup__writing-chalk-oneshot-03.wav',
  'chalk-short': '377841__newagesoup__writing-chalk-short-04.wav',
  'bubble-drink': '398029__swordofkings128__raw_bubblingdrink5.ogg',
  'chain-pull': '405417__mrthenoronha__pulling-chain.wav',
  'page-turn': '457916__phantastonia__turn-over-the-book-page-2.wav',
  'lamp-switch': '541761__philliparthursimmons__desk-lamp-chain-pull-medium.wav',
  'firecracker': '559842__walkingwithmicrophones__firecracker-corsair-4.wav',
  'dove': '607243__d4xx__collared-dove.wav',
  'buildup': '610309__brickdeveloper171__buildup.wav',
  'click': '678248__pixeliota__mouse-click-sound.mp3',
  'cash-register': '201159__kiddpark__cash-register.mp3',
  'gasp': '341908__bacruz666__gasp.mp3',
  'impact': '319590__hybrid_v__shield-bash-impact.wav',
  'whip': '593660__eelke__whip-03-single-loud.wav',
  'airhorn': '414208__jacksonacademyashmore__airhorn.wav',
  'heartbeat': '485076__inspectorj__heartbeat-regular-single-01-01-loop.wav',
  'magic-sfx': '264981__renatalmar__sfx-magic.wav',
  'punch': '104183__ekokubza123__punch.wav',
  'arrow-whoosh': 'mixkit-arrow-whoosh-1491.wav',
  'blow-impact': 'mixkit-impact-of-a-blow-2150.wav',
  'whistle': '39548__the_bizniss__whistle.wav',

  // 🆕 新增中文音效
  'ding': '叮.MP3',
  'ding2': '叮2.MP3',
  'transition-whoosh': '呼转场.MP3',
  'shua': '唰.MP3',
  'bo2': '啵2.MP3',
  'bo3': '啵3.MP3',
  'sousou': '嗖嗖.MP3',
  'popup': '弹出1.MP3',
  'suspense': '悬疑咚声.MP3',
  'gun-bolt': '拉栓.MP3',
  'spacebar': '按空格键.MP3',
  'cash-sound': '收银声.MP3',
  'waterdrop1': '水滴1.MP3',
  'waterdrop': '水滴声.MP3',
  'bubble': '泡泡声.MP3',
  'di': '滴.MP3',
  'click-cn': '点击.MP3',
  'electric': '电流.MP3',
  'book-flip': '翻书声.MP3',
  'flashback': '闪回.MP3',
};

/**
 * 获取音效文件所在目录
 */
export function getSoundEffectsDir(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    // 开发模式：使用 app.getAppPath() 获取项目根目录
    return path.join(app.getAppPath(), 'electron/resources/extra/common/soundEffects');
  } else {
    // 生产模式：使用 process.resourcesPath
    return path.join(process.resourcesPath, 'extra/common/soundEffects');
  }
}

/**
 * 获取内置音效文件路径
 * @param effectId 音效ID
 * @returns 音效文件路径，如果不存在则返回 null
 */
export function getBuiltinEffectFilePath(effectId: string): string | null {
  const fileName = SOUND_EFFECT_FILES[effectId];
  if (!fileName) {
    return null;
  }

  const soundEffectsDir = getSoundEffectsDir();
  const filePath = path.join(soundEffectsDir, fileName);

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  console.warn(`[SoundEffect] 音效文件不存在: ${filePath}`);
  return null;
}

/**
 * 检查是否有预置的音效文件
 */
export function hasBuiltinEffectFile(effectId: string): boolean {
  return getBuiltinEffectFilePath(effectId) !== null;
}


/**
 * 内置音效列表 - 包含所有精选音效
 */
export const BUILTIN_SOUND_EFFECTS = [
  // 基础音效
  { id: 'swoosh', name: '划过音', description: '快速划过的嗖声，适合滑动效果', category: 'basic' },
  { id: 'click', name: '点击音', description: '清脆的鼠标点击声', category: 'basic' },
  { id: 'impact', name: '撞击声', description: '有力的撞击声效', category: 'basic' },
  { id: 'punch', name: '打击声', description: '拳击打击效果', category: 'basic' },
  { id: 'whip', name: '鞭子声', description: '快速挥动的鞭子声', category: 'basic' },
  { id: 'blow-impact', name: '打击音', description: '重击效果声', category: 'basic' },
  { id: 'arrow-whoosh', name: '箭矢划过', description: '箭矢快速飞过的声音', category: 'basic' },
  { id: 'pop-1', name: '气泡音', description: '清脆的气泡破裂声', category: 'basic' },
  { id: 'glass-collide', name: '玻璃碰撞', description: '清脆的玻璃撞击声', category: 'basic' },
  { id: 'sweep-up-down', name: '扫频音', description: '上下起伏的扫频声', category: 'basic' },
  { id: 'knife-scrape', name: '刀刮声', description: '金属刮擦的声音', category: 'basic' },
  { id: 'pill-pop', name: '药片弹出', description: '药片从包装中顶出的声音', category: 'basic' },
  { id: 'chalk-writing', name: '粉笔写字', description: '粉笔在黑板上书写的声音', category: 'basic' },
  { id: 'bubble-drink', name: '饮料气泡', description: '饮料中气泡翻腾的声音', category: 'basic' },
  { id: 'chain-pull', name: '拉链声', description: '拉动金属链条的声音', category: 'basic' },
  { id: 'page-turn', name: '翻书声', description: '快速翻动书页的声音', category: 'basic' },
  { id: 'lamp-switch', name: '开关声', description: '台灯拉线开关的声音', category: 'basic' },
  { id: 'firecracker', name: '鞭炮声', description: '鞭炮爆炸的声音', category: 'basic' },
  { id: 'dove', name: '鸽子叫', description: '鸽子的咕咕声', category: 'basic' },
  { id: 'buildup', name: '积蓄音', description: '能量积蓄上升的声音', category: 'basic' },
  { id: 'interference', name: '干扰音', description: '电子信号干扰的声音', category: 'advanced' },

  // 提示音效
  { id: 'cash-register', name: '收银机', description: '收银机叮当声', category: 'motion' },
  { id: 'airhorn', name: '气喇叭', description: '响亮的气喇叭声', category: 'motion' },
  { id: 'whistle', name: '哨子声', description: '清脆的哨子声', category: 'motion' },
  { id: 'gasp', name: '惊叹声', description: '惊叹吸气声效', category: 'motion' },

  // 特效音效
  { id: 'magic', name: '魔法音', description: '神奇梦幻的音效，适合魔法效果', category: 'advanced' },
  { id: 'magic-sfx', name: '魔法特效', description: '另一种魔法音效', category: 'advanced' },
  { id: 'heartbeat', name: '心跳声', description: '有节奏的心跳声', category: 'advanced' },

  // 🆕 新增中文音效
  { id: 'ding', name: '叮', description: '清脆的叮声提示音', category: 'basic' },
  { id: 'ding2', name: '叮2', description: '另一种叮声变体', category: 'basic' },
  { id: 'transition-whoosh', name: '呼转场', description: '转场过渡的呼声', category: 'motion' },
  { id: 'shua', name: '唰', description: '快速滑动的唰声', category: 'basic' },
  { id: 'bo2', name: '啵2', description: '气泡破裂的啵声', category: 'basic' },
  { id: 'bo3', name: '啵3', description: '另一种啵声变体', category: 'basic' },
  { id: 'sousou', name: '嗖嗖', description: '快速移动的嗖嗖声', category: 'motion' },
  { id: 'popup', name: '弹出', description: '元素弹出的提示音', category: 'basic' },
  { id: 'suspense', name: '悬疑咚声', description: '制造悬念的低沉咚声', category: 'advanced' },
  { id: 'gun-bolt', name: '拉栓', description: '枪械拉栓的金属声', category: 'advanced' },
  { id: 'spacebar', name: '按空格键', description: '键盘空格键按下的声音', category: 'basic' },
  { id: 'cash-sound', name: '收银声', description: '收银结算的声音', category: 'motion' },
  { id: 'waterdrop1', name: '水滴1', description: '水滴落下的声音', category: 'basic' },
  { id: 'waterdrop', name: '水滴声', description: '水滴的清脆声音', category: 'basic' },
  { id: 'bubble', name: '泡泡声', description: '气泡冒出的声音', category: 'basic' },
  { id: 'di', name: '滴', description: '简短的滴声提示', category: 'basic' },
  { id: 'click-cn', name: '点击', description: '鼠标点击的声音', category: 'basic' },
  { id: 'electric', name: '电流', description: '电流通过的声音效果', category: 'advanced' },
  { id: 'book-flip', name: '翻书声', description: '翻动书页的声音', category: 'basic' },
  { id: 'flashback', name: '闪回', description: '回忆闪回的特效音', category: 'advanced' },
];

/**
 * 获取所有内置音效
 */
export function getAllBuiltinEffects() {
  return BUILTIN_SOUND_EFFECTS.map(effect => ({
    id: effect.id,
    name: effect.name,
    description: effect.description,
    category: effect.category,
    defaultParams: {
      volume: 0.7,
      pitch: 1.0,
      fadeIn: 0,
      fadeOut: 50,
      triggerTime: 'start'
    }
  }));
}

/**
 * 根据ID获取内置音效
 */
export function getBuiltinEffect(effectId: string) {
  return BUILTIN_SOUND_EFFECTS.find(e => e.id === effectId);
}

/**
 * 生成 FFmpeg 音效合成命令
 * 为不同的音效生成不同的声音参数
 */
export function generateFFmpegCommand(
  effectId: string,
  params: any,
  outputPath: string
): string {
  const effect = getBuiltinEffect(effectId);
  if (!effect) {
    throw new Error(`未找到音效: ${effectId}`);
  }

  const volume = params?.volume || 0.7;
  const duration = params?.duration || 0.3;
  const pitch = params?.pitch || 1.0;

  // 根据音效 ID 生成不同的声音参数
  let soundParams = getSoundParams(effectId);

  // 应用用户的音调参数
  if (soundParams.frequency) {
    soundParams.frequency = Math.round(soundParams.frequency * pitch);
  }

  // 使用不同的音效类型
  if (soundParams.type === 'noise') {
    // 噪音效果 - 使用 anoisesrc 生成噪音
    return `ffmpeg -f lavfi -i "anoisesrc=d=${duration}:r=44100:c=stereo" -filter_complex "[0:a]volume=${volume}[a]" -map "[a]" -y "${outputPath}"`;
  } else if (soundParams.type === 'sweep') {
    // 扫频效果 - 从高频到低频的变化
    const freq1 = soundParams.freq1 || 1000;
    const freq2 = soundParams.freq2 || 400;
    // 使用变频正弦波：从 freq1 扫到 freq2
    return `ffmpeg -f lavfi -i "sine=f=${freq1}:d=${duration}:s=44100" -filter_complex "[0:a]atempo=0.5,volume=${volume}[a]" -map "[a]" -y "${outputPath}"`;
  } else {
    // 普通正弦波 - 这是最可靠的方式
    const freq = soundParams.frequency || 440;
    return `ffmpeg -f lavfi -i "sine=f=${freq}:d=${duration}" -filter_complex "volume=${volume}" -y "${outputPath}"`;
  }
}

/**
 * 获取不同音效的声音参数
 */
function getSoundParams(effectId: string): any {
  const soundMap: Record<string, any> = {
    // 基础音效 - 不同频率的正弦波
    'pop': { type: 'sine', frequency: 800 },           // 高频爆裂音
    'swoosh': { type: 'sweep', freq1: 2000, freq2: 400 }, // 从高到低的扫频
    'ping': { type: 'sine', frequency: 1200 },          // 更高的叮当声
    'ding': { type: 'sine', frequency: 600 },           // 低一点的钟声
    'click': { type: 'sine', frequency: 1000 },         // 点击声
    'snap': { type: 'sine', frequency: 950 },           // 啪嗒声
    'bounce': { type: 'sine', frequency: 400 },         // 低频弹跳
    'zoom': { type: 'sweep', freq1: 300, freq2: 1200 },  // 上升扫频

    // 动画音效
    'slide': { type: 'sweep', freq1: 500, freq2: 800 },  // 滑动效果
    'spin': { type: 'sine', frequency: 700 },           // 旋转声
    'swing': { type: 'sweep', freq1: 400, freq2: 900 },  // 摆动
    'shake': { type: 'noise' },                         // 震动 - 噪音
    'wave': { type: 'sweep', freq1: 300, freq2: 700 },   // 波浪
    'sparkle': { type: 'sine', frequency: 1500 },      // 高频闪烁

    // 高级音效
    'electric': { type: 'noise' },                      // 电流 - 噪音
    'explosion': { type: 'sweep', freq1: 1000, freq2: 100 }, // 下降扫频
    'magic': { type: 'sweep', freq1: 800, freq2: 1500 }, // 魔法上升音
    'heartbeat': { type: 'sine', frequency: 100 },     // 低频心跳
    'rainbow': { type: 'sweep', freq1: 200, freq2: 2000 } // 广频扫频
  };

  return soundMap[effectId] || { type: 'sine', frequency: 440 };
}
