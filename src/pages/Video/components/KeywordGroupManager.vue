<script setup lang="ts" name="KeywordGroupManager">
import { ref, computed, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon';
import type { KeywordGroup } from '../../../types/smartSubtitle';
import SoundEffectPanel from '@/components/SoundEffectPanel.vue';

interface Props {
    enableKeywordEffects: boolean;
    extractedKeywords?: Array<{ keyword: string; positions?: number[]; count?: number }>;
}

interface Emits {
    (e: 'update:enableKeywordEffects', value: boolean): void;
    (e: 'groupsChange', groups: KeywordGroup[]): void;
}

const props = withDefaults(defineProps<Props>(), {
    enableKeywordEffects: false,
    extractedKeywords: () => []
});

const emit = defineEmits<Emits>();

// 状态管理
const keywordGroups = ref<KeywordGroup[]>([]);
const selectedGroupId = ref<string>('');
const newGroupName = ref<string>('');
const showGroupForm = ref(false);
const showStyleDialog = ref(false);
const editingGroupId = ref<string>('');
const isInitializing = ref(true); // 添加初始化标志

// 特效列表
const keywordEffects = [
    // 基础动画
    { id: 'zoom-in', name: '缩放弹出', description: '从小到大的缩放效果，适合强调关键词' },
    { id: 'bounce', name: '弹跳反弹', description: '垂直弹跳效果，带重力衰减' },
    { id: 'fade', name: '淡入淡出', description: '透明度渐变效果' },
    { id: 'flash', name: '闪烁高亮', description: '快速闪烁的高亮效果' },

    // 位移动画
    { id: 'slide-up', name: '向上滑入', description: '从下方滑入，带缓动效果' },
    { id: 'slide-down', name: '向下滑入', description: '从上方滑入，带缓动效果' },
    { id: 'slide-left', name: '向左滑入', description: '从右侧滑入，带缓动效果' },
    { id: 'slide-right', name: '向右滑入', description: '从左侧滑入，带缓动效果' },
    { id: 'fly-in', name: '弹性飞入', description: '从屏幕外飞入，带弹性回弹效果' },

    // 旋转和翻转
    { id: 'spin', name: '旋转转动', description: '360度连续旋转效果' },
    { id: 'swing', name: '摇摆旋转', description: '左右摇摆效果，模拟钟摆运动' },

    // 视觉增强
    { id: 'glow', name: '发光闪烁', description: '外发光效果，可配置光晕大小和颜色' },
    { id: 'intense-flash', name: '⚡ 強力闪烁', description: '高亮白光闪烁，适合强调高光时刻' },
    { id: 'shake', name: '抖动震颤', description: '随机抖动效果，可配置强度' },
    { id: 'wave', name: '波浪浮动', description: '垂直波浪运动，适合动态感强的场景' },
    { id: 'breathe', name: '呼吸效果', description: '大小和透明度周期性变化，模拟呼吸' },

    // 高级特效
    { id: 'rainbow', name: '彩虹渐变', description: '颜色循环变化，呈现彩虹效果' },
    { id: 'particle-burst', name: '粒子爆炸', description: '文字分解成粒子向外扩散效果' },
    { id: 'electric', name: '电击效果', description: '快速抖动+颜色闪烁，模拟电击效果' },
    { id: 'heartbeat', name: '心跳脉冲', description: '模拟心跳的缩放节奏' },
    { id: 'danmaku', name: '🔥 弹幕满屏', description: '关键词在屏幕多个位置同时出现，形成刷屏效果' },
    { id: 'ARC_TEXT', name: '🌈 弧形文字', description: '文字沿半圆弧形排列，呈现拱形效果' },
    { id: 'flying-tilt', name: '✈️ 倾斜飞行', description: '文字从下往上飞行，带有倾斜角度变化，满屏多个位置同时出现' },
    { id: 'motion-blur-trail', name: '👻 运动模糊拖尾', description: '文字带有多重半透明残影，营造运动感' }
];

// 编辑样式状态
const editingGroupStyle = ref<any>({
    fontColor: '#FFD700',
    outlineColor: '#000000',
    outlineWidth: 3,
    fontSize: 72,
    bold: false,
    effectId: 'zoom-in',
    fontName: 'Microsoft YaHei',  // 添加字体名称
    shadowColor: '#000000',
    shadowBlur: 0,
    effectDuration: 2.0,
    // 🆕 音效相关字段
    soundEffectConfig: {
        enabled: false,
        soundEffectId: undefined,
        soundEffectConfig: {
            volume: 0.7,
            pitch: 1.0,
            fadeIn: 0,
            fadeOut: 50,
            triggerTime: 'start'
        }
    },
    stickerId: undefined, // 🆕
    stickerConfig: undefined // 🆕
});


// 可用字体列表 - 动态加载
const availableFonts = ref<Array<{ value: string; label: string; source?: string }>>([
    { value: 'Microsoft YaHei', label: 'Microsoft YaHei', source: 'system' },
    { value: 'SimSun', label: 'SimSun', source: 'system' },
    { value: 'SimHei', label: 'SimHei', source: 'system' }
]);

// 加载字体列表
const loadFonts = async () => {
    try {
        if (window.$mapi?.fontManager?.getAllFonts) {
            const result = await window.$mapi.fontManager.getAllFonts();
            console.log('[KeywordGroupManager] getAllFonts 返回:', result);

            // 处理返回值（可能是 { success, data } 或直接数组）
            let fonts = Array.isArray(result) ? result : (result?.data || []);

            if (fonts && Array.isArray(fonts) && fonts.length > 0) {
                // 转换为需要的格式，并按来源排序（ziti优先）
                const fontList = fonts.map((f: any) => ({
                    value: f.value || f.family,
                    label: f.label || f.family,
                    source: f.source
                })).sort((a: any, b: any) => {
                    // ziti > bundled > system > custom
                    const sourceOrder: Record<string, number> = { 'ziti': 0, 'bundled': 1, 'system': 2, 'custom': 3 };
                    return (sourceOrder[a.source] ?? 99) - (sourceOrder[b.source] ?? 99);
                });
                availableFonts.value = fontList;
                console.log('[KeywordGroupManager] 加载字体列表成功:', fontList.length, '个字体');
                console.log('[KeywordGroupManager] ziti 字体:', fontList.filter(f => f.source === 'ziti'));
            } else {
                console.warn('[KeywordGroupManager] 字体列表为空或格式不正确');
            }
        }
    } catch (error) {
        console.warn('[KeywordGroupManager] 加载字体列表失败:', error);
        // 保持默认系统字体
    }
};

// 在组件挂载时加载字体
onMounted(() => {
    loadFonts();
});

// 预览状态
const showEffectPreview = ref(false);
const activeTab = ref('style');

// 🆕 贴纸选项列表
const stickerOptions = ref<Array<{ id: string; label: string; previewText?: string; previewUrl?: string }>>([]);

// 加载贴纸列表
const loadStickers = async () => {
    try {
        // 1. 初始化预设贴纸 (使用动态路径)
        const presets = [
            { id: 'explosion', label: '爆炸特效', previewText: '💥', filename: 'explosion.png' },
            { id: 'comic_explosion', label: '漫画爆炸', previewText: '🗯️', filename: 'comic_explosion.png' },
            { id: 'magic_sparkle', label: '魔法光斑', previewText: '✨', filename: 'magic_sparkle.png' },
            { id: 'electric_zap', label: '闪电电击', previewText: '⚡️', filename: 'electric_zap.png' }
        ];

        const resolvePresetPreviewUrl = async (filename: string) => {
            try {
                if (window.$mapi?.app?.resourcePathResolve) {
                    const resolvedPath = await window.$mapi.app.resourcePathResolve(`extra/stickers/${filename}`);
                    return `file://${resolvedPath.replace(/\\/g, '/')}`;
                }

                if (window.$mapi?.app?.getResourcesPath) {
                    const resourcesPath = await window.$mapi.app.getResourcesPath();
                    return `file://${resourcesPath.replace(/\\/g, '/')}/stickers/${filename}`;
                }
            } catch (e) {
                console.warn('[KeywordGroupManager] Failed to resolve sticker preview path', filename, e);
            }

            return '';
        };

        const initialOptions = await Promise.all(presets.map(async (p) => ({
            ...p,
            previewUrl: await resolvePresetPreviewUrl(p.filename)
        })));
        
        // 设置初始值
        stickerOptions.value = initialOptions;

        // 定义预设的元数据 (ID -> 中文名, Emoji)
        const presetMetadata: Record<string, { label: string; emoji: string }> = {
            'explosion': { label: '爆炸特效', emoji: '💥' },
            'comic_explosion': { label: '漫画爆炸', emoji: '🗯️' },
            'magic_sparkle': { label: '魔法光斑', emoji: '✨' },
            'electric_zap': { label: '闪电电击', emoji: '⚡️' },
            'fire_flame': { label: '烈火燃烧', emoji: '🔥' }
        };

        if (window.$mapi?.sticker?.list) {
            console.log("正在加载贴纸列表...");
            const result = await window.$mapi.sticker.list();
            console.log("加载贴纸结果:", result);
            if (result && result.code === 0 && Array.isArray(result.data) && result.data.length > 0) {
                // 合并逻辑: 如果有自定义贴纸，追加到后面? 还是覆盖?
                // 当前逻辑似乎是想显示所有可用贴纸。
                // 如果后端返回列表，可能包含了用户生成的。
                // 我们保留预设，并追加用户生成的（排除重名的）
                
                const remoteStickers = result.data.map((item: any) => {
                    const preset = presetMetadata[item.id];
                    return {
                        id: item.id,
                        label: preset ? preset.label : item.label, // 优先用中文名
                        previewUrl: item.previewUrl,
                        previewText: preset ? preset.emoji : '🖼️' // Fallback emoji
                    };
                });
                
                // 简单的合并去重 (根据ID)
                const existingIds = new Set(initialOptions.map(o => o.id));
                for (const s of remoteStickers) {
                    if (!existingIds.has(s.id)) {
                        stickerOptions.value.push(s);
                    }
                }
            } else {
                console.warn("未加载到额外贴纸或列表为空");
            }
        }
    } catch (e) {
        console.error("加载贴纸失败", e);
    }
};

// 初始加载一次
onMounted(() => {
    loadStickers();
});

// 🆕 贴纸开关 (计算属性)
const enableSticker = computed({
    get: () => !!editingGroupStyle.value.stickerId,
    set: (val) => {
        if (!val) {
            editingGroupStyle.value.stickerId = undefined;
            editingGroupStyle.value.stickerConfig = undefined;
        } else {
            // 开启时，确保选中一个值
            if (stickerOptions.value.length > 0) {
                selectSticker(stickerOptions.value[0].id);
            } else {
                // 如果列表为空（极少情况），强制选中默认ID，防止开关回弹
                selectSticker('explosion');
            }
        }
    }
});

// 🆕 选择贴纸方法
const selectSticker = (stickerId: string) => {
  editingGroupStyle.value.stickerId = stickerId;
  // 如果选了贴纸，可以自动设置一些默认配置
  if (stickerId) {
    editingGroupStyle.value.stickerConfig = {
      offsetX: 0,
      offsetY: 0,
      scale: 1.0,
      opacity: 1.0
    };
  } else {
    editingGroupStyle.value.stickerConfig = undefined;
  }
};
const previewAnimation = ref<any>(null);

// 预定义的分组模板（系统默认，不可删除）
const groupTemplates = [
    {
        name: '重点词/成语词',
        color: '#FF6B6B',
        description: '视频中的重点词汇和成语',
        isSystem: true  // 标记为系统默认分组
    },
    {
        name: '行动词',
        color: '#4ECDC4',
        description: '需要强调的行动动词',
        isSystem: true
    },
    {
        name: '描述词',
        color: '#45B7D1',
        description: '描述性的形容词和副词',
        isSystem: true
    },
    {
        name: '情感词',
        color: '#F7DC6F',
        description: '表达情感的词汇',
        isSystem: true
    }
];

// 创建新分组
const createNewGroup = (template?: any) => {
    const groupName = template?.name || newGroupName.value;

    if (!groupName.trim()) {
        Message.warning('请输入分组名称');
        return;
    }

    // 检查分组名称唯一性
    if (keywordGroups.value.some(g => g.name === groupName)) {
        Message.error('分组名称已存在，请使用其他名称');
        return;
    }

    const newGroup: KeywordGroup = {
        id: 'group_' + Date.now() + '_' + Math.random(),
        name: groupName,
        description: template?.description || '',
        keywords: [],
        color: template?.color || generateRandomColor(),
        isSystem: template?.isSystem || false,  // 标记是否为系统分组
        createdAt: Date.now()
    };

    keywordGroups.value.push(newGroup);
    newGroupName.value = '';
    showGroupForm.value = false;
    Message.success('分组创建成功');
    if (!isInitializing.value) {
        emit('groupsChange', keywordGroups.value);
    }
    saveGroupsToStorage();
};

// 添加关键词到分组
const addKeywordToGroup = (groupId: string, keyword: string) => {
    const group = keywordGroups.value.find(g => g.id === groupId);
    if (!group) return;

    // 规范化关键词格式，处理字符串和对象两种格式
    const normalizedKeywords = group.keywords.map((k: any) =>
        typeof k === 'string' ? k : (k.keyword || '')
    );

    if (!normalizedKeywords.includes(keyword)) {
        group.keywords.push({
            keyword: keyword,
            enabled: true
        });
        if (!isInitializing.value) {
            emit('groupsChange', keywordGroups.value);
        }
        saveGroupsToStorage();
        Message.success(`已将"${keyword}"添加到分组`);
    }
};

// 系统默认分组名称列表
const systemGroupNames = ['重点词/成语词', '行动词', '描述词', '情感词'];

// 删除分组
const deleteGroup = (groupId: string) => {
    const index = keywordGroups.value.findIndex(g => g.id === groupId);
    if (index > -1) {
        const group = keywordGroups.value[index];

        // 检查是否为系统默认分组（通过isSystem属性或名称判断）
        if (group.isSystem || systemGroupNames.includes(group.name)) {
            Message.warning(`"${group.name}"是系统默认分组，不可删除`);
            return;
        }

        const groupName = group.name;
        keywordGroups.value.splice(index, 1);
        selectedGroupId.value = '';
        if (!isInitializing.value) {
            emit('groupsChange', keywordGroups.value);
        }
        saveGroupsToStorage();
        Message.success(`分组"${groupName}"已删除`);
    }
};

// 删除关键词 - 处理字符串和对象两种格式
const removeKeyword = (groupId: string, keyword: string) => {
    const group = keywordGroups.value.find(g => g.id === groupId);
    if (group) {
        // 处理字符串和对象两种格式
        const index = group.keywords.findIndex((k: any) =>
            typeof k === 'string' ? k === keyword : k.keyword === keyword
        );
        if (index > -1) {
            group.keywords.splice(index, 1);
            if (!isInitializing.value) {
                emit('groupsChange', keywordGroups.value);
            }
            saveGroupsToStorage();
        }
    }
};

// 编辑分组样式
const openStyleEditor = (groupId: string) => {
    const group = keywordGroups.value.find(g => g.id === groupId);
    if (group) {
        editingGroupId.value = groupId;
        const fontName = group.styleOverride?.fontName || 'Microsoft YaHei';

        // ✅ 新增：从availableFonts中查找对应的fontPath
        let fontPath: string | undefined;
        if (availableFonts.value && availableFonts.value.length > 0) {
            const fontInfo = availableFonts.value.find(f => f.value === fontName);
            if (fontInfo) {
                fontPath = fontInfo.path;
                console.log('[openStyleEditor] 找到字体路径:', { fontName, fontPath });
            }
        }

        editingGroupStyle.value = {
            fontColor: group.styleOverride?.fontColor || '#FFD700',
            outlineColor: group.styleOverride?.outlineColor || '#000000',
            // 🔧 修复：使用 ?? 允许加载0值
            outlineWidth: Number(group.styleOverride?.outlineWidth) ?? 3,
            fontSize: Number(group.styleOverride?.fontSize) || 72,
            fontName: fontName,  // ✅ 加载保存的字体名
            fontPath: fontPath || group.styleOverride?.fontPath,  // ✅ 新增：加载字体路径
            bold: false,
            effectId: group.effectId || 'zoom-in',
            effectDuration: group.effectDuration || 2,  // 🆕 加载特效时长，默认2秒
            stickerId: group.stickerId, // 🆕 加载贴纸ID
            stickerConfig: group.stickerConfig // 🆕 加载贴纸配置
        };

        // 🆕 加载音效配置（如果存在）- 结构要与 SoundEffectPanel 组件匹配
        editingGroupStyle.value.soundEffectConfig = {
            enabled: !!group.soundEffectId, // 如果有soundEffectId则默认启用
            soundEffectId: group.soundEffectId,
            soundEffectConfig: {
                volume: group.soundEffectConfig?.volume ?? 0.7,
                pitch: group.soundEffectConfig?.pitch ?? 1.0,
                fadeIn: group.soundEffectConfig?.fadeIn ?? 0,
                fadeOut: group.soundEffectConfig?.fadeOut ?? 50,
                triggerTime: group.soundEffectConfig?.triggerTime ?? 'start'
            }
        };

        console.log('[openStyleEditor] 🔊 加载的音效配置:', {
            groupSoundEffectId: group.soundEffectId,
            groupSoundEffectConfig: group.soundEffectConfig,
            editingSoundEffectConfig: editingGroupStyle.value.soundEffectConfig
        });

        // 调试输出：显示打开时的样式内容
        console.log('[openStyleEditor] 打开样式编辑器:', {
            groupName: group.name,
            existingStyle: group.styleOverride,
            loadedFontName: fontName,
            loadedFontPath: fontPath,
            soundEffectId: group.soundEffectId,
            soundEffectConfig: group.soundEffectConfig,
            stickerId: group.stickerId, // 🆕 调试输出贴纸ID
            stickerConfig: group.stickerConfig, // 🆕 调试输出贴纸配置
            editingStyle: editingGroupStyle.value
        });

        showStyleDialog.value = true;
    }
};

// 保存分组样式
const saveGroupStyle = () => {
    const group = keywordGroups.value.find(g => g.id === editingGroupId.value);
    if (group) {
        // 确保所有颜色值都是有效的字符串
        const fontColor = String(editingGroupStyle.value.fontColor || '#FFD700').trim();
        const outlineColor = String(editingGroupStyle.value.outlineColor || '#000000').trim();
        const fontSize = Number(editingGroupStyle.value.fontSize) || 72;
        // 🔧 修复：使用 ?? 允许保存0值
        const outlineWidth = Number(editingGroupStyle.value.outlineWidth) ?? 3;
        const effectId = String(editingGroupStyle.value.effectId || 'zoom-in').trim();
        const fontName = String(editingGroupStyle.value.fontName || 'Microsoft YaHei').trim();  // ✅ 保存字体名
        const fontPath = editingGroupStyle.value.fontPath;  // ✅ 新增:保存字体路径

        // 保存样式覆盖
        group.styleOverride = {
            fontColor: fontColor,
            outlineColor: outlineColor,
            outlineWidth: outlineWidth,
            fontSize: fontSize,
            fontName: fontName,  // ✅ 保存字体名到 styleOverride
            fontPath: fontPath  // ✅ 新增:保存字体路径到 styleOverride
        };
        group.effectId = effectId;
        
        // 🔧 新增:自动同步 fontColor 到 group.color,让标签背景色与文字颜色一致
        group.color = fontColor;
        
        // 🆕 保存特效时长
        group.effectId = editingGroupStyle.value.effectId;
        group.effectDuration = editingGroupStyle.value.effectDuration || 2;
    
        // 🆕 保存贴纸设置
        group.stickerId = editingGroupStyle.value.stickerId;
        group.stickerConfig = editingGroupStyle.value.stickerConfig;

        // 🆕 保存音效配置 - 修复结构匹配问题
        const soundConfig = editingGroupStyle.value.soundEffectConfig;
        console.log('[saveGroupStyle] 🔊 保存前的音效配置:', soundConfig);
        
        if (soundConfig?.enabled && soundConfig?.soundEffectId) {
            group.soundEffectId = soundConfig.soundEffectId;
            group.soundEffectConfig = {
                volume: soundConfig.soundEffectConfig?.volume ?? 0.7,
                pitch: soundConfig.soundEffectConfig?.pitch ?? 1.0,
                fadeIn: soundConfig.soundEffectConfig?.fadeIn ?? 0,
                fadeOut: soundConfig.soundEffectConfig?.fadeOut ?? 50,
                triggerTime: soundConfig.soundEffectConfig?.triggerTime ?? 'start'
            };
            console.log('[saveGroupStyle] ✅ 音效已保存:', { 
                soundEffectId: group.soundEffectId, 
                soundEffectConfig: group.soundEffectConfig 
            });
        } else {
            // 如果没有启用音效，清除音效配置
            group.soundEffectId = undefined;
            group.soundEffectConfig = undefined;
            console.log('[saveGroupStyle] ❌ 音效已清除');
        }

        // 调试输出:验证样式是否被正确保存
        console.log('[saveGroupStyle] 样式已保存:', {
            groupName: group.name,
            color: group.color,  // 🔧 新增:验证标签颜色
            styleOverride: group.styleOverride,
            effectId: group.effectId,
            effectDuration: group.effectDuration,  // 🆕 验证特效时长
            fontName: fontName,  // ✅ 验证字体名是否被保存
            fontPath: fontPath,   // ✅ 新增:验证字体路径是否被保存
            soundEffectId: group.soundEffectId,  // 🆕 验证音效ID
            soundEffectConfig: group.soundEffectConfig,  // 🆕 验证音效参数
            stickerId: group.stickerId, // 🆕 验证贴纸ID
            stickerConfig: group.stickerConfig // 🆕 验证贴纸配置
        });

        if (!isInitializing.value) {
            emit('groupsChange', keywordGroups.value);
        }
        saveGroupsToStorage();
        showStyleDialog.value = false;
        Message.success(`"${group.name}" 的样式已保存`);
    }
};


// LocalStorage 数据持久化
const STORAGE_KEY = 'zhenqianba_keyword_groups';

const saveGroupsToStorage = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keywordGroups.value));
    } catch (error) {
        console.error('保存分组到本地存储失败:', error);
    }
};

const loadGroupsFromStorage = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const loadedGroups = JSON.parse(stored);
            // 过滤掉测试分组
            keywordGroups.value = loadedGroups.filter((group: KeywordGroup) =>
                !group.id.startsWith('test_group_') && group.name !== '测试分组-全部字统一特效'
            );
            console.log('[KeywordGroupManager] 从localStorage加载了分组:', keywordGroups.value.length);
            // 🆕 调试：检查 effectDuration 是否被加载
            keywordGroups.value.forEach((g: KeywordGroup) => {
                console.log('[KeywordGroupManager] 加载分组:', {
                    name: g.name,
                    effectDuration: g.effectDuration,
                    effectId: g.effectId
                });
            });

            // 如果过滤后有变化，保存清理后的数据
            if (keywordGroups.value.length !== loadedGroups.length) {
                console.log('[KeywordGroupManager] 已过滤掉测试分组，保存清理后的数据');
                saveGroupsToStorage();
            }
        } else {
            // 【修复】首次使用时不自动创建默认分组，用户需要手动创建
            console.log('[KeywordGroupManager] 首次使用，不自动创建默认分组');
        }
    } catch (error) {
        console.error('从本地存储加载分组失败:', error);
        // 【修复】解析失败时也不自动创建默认分组
        console.log('[KeywordGroupManager] 解析失败，不自动创建默认分组');
    }
    // 初始化完成，设置标志
    isInitializing.value = false;
};

const initializeDefaultGroups = () => {
    keywordGroups.value = groupTemplates.map(template => ({
        id: 'group_' + Date.now() + '_' + Math.random(),
        name: template.name,
        description: template.description,
        keywords: [],
        color: template.color,
        isSystem: template.isSystem || false,  // 标记系统默认分组
        createdAt: Date.now()
    }));
    saveGroupsToStorage();
};

// 恢复系统默认分组
const restoreDefaultGroups = () => {
    // 检查哪些系统分组缺失
    const existingSystemGroups = keywordGroups.value.filter(g => g.isSystem);
    const missingGroups = groupTemplates.filter(template =>
        !keywordGroups.value.some(g => g.name === template.name)
    );

    if (missingGroups.length === 0) {
        Message.info('所有系统默认分组都已存在');
        return;
    }

    // 添加缺失的系统分组
    missingGroups.forEach(template => {
        const newGroup: KeywordGroup = {
            id: 'group_' + Date.now() + '_' + Math.random(),
            name: template.name,
            description: template.description,
            keywords: [],
            color: template.color,
            isSystem: true,
            createdAt: Date.now()
        };
        keywordGroups.value.push(newGroup);
    });

    if (!isInitializing.value) {
        emit('groupsChange', keywordGroups.value);
    }
    saveGroupsToStorage();
    Message.success(`已恢复 ${missingGroups.length} 个系统默认分组`);
    console.log('[restoreDefaultGroups] 已恢复系统分组:', missingGroups.map(g => g.name));
};

// 导出分组配置
const exportGroups = () => {
    const dataStr = JSON.stringify(keywordGroups.value, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `keyword_groups_${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    Message.success('分组配置已导出');
};

// 导入分组配置
const importGroups = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event: any) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (Array.isArray(imported)) {
                        keywordGroups.value = imported;
                        if (!isInitializing.value) {
                            emit('groupsChange', keywordGroups.value);
                        }
                        saveGroupsToStorage();
                        Message.success('分组配置已导入');
                    }
                } catch (error) {
                    Message.error('导入失败，文件格式不正确');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
};


// 工具函数
const generateRandomColor = () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#95E1D3', '#F38181'];
    return colors[Math.floor(Math.random() * colors.length)];
};

// 🔧 新增:根据背景色亮度自动选择文字颜色(深色背景用白色,浅色背景用黑色)
const getTextColor = (bgColor: string | undefined): string => {
    if (!bgColor) return '#ffffff';
    
    // 移除 # 符号
    const hex = bgColor.replace('#', '');
    
    // 转换为 RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // 计算亮度 (使用 YIQ 公式)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // 亮度大于 128 使用深色文字,否则使用浅色文字
    return brightness > 128 ? '#000000' : '#ffffff';
};

// 初始化：从LocalStorage加载分组
loadGroupsFromStorage();

// 外部更新分组数据（用于模板加载时同步）
const loadGroups = (groups: KeywordGroup[]) => {
    keywordGroups.value = JSON.parse(JSON.stringify(groups)); // 深拷贝
    selectedGroupId.value = '';
    saveGroupsToStorage();
    // 不要emit groupsChange，避免循环更新和覆盖父组件数据
    // emit('groupsChange', keywordGroups.value);
};

// 🆕 贴纸生成逻辑
const generatingSticker = ref(false);
const stickerPrompt = ref('');

// 生成贴纸
const handleGenerateSticker = async () => {
    if (!stickerPrompt.value) {
        // 默认提示词
        stickerPrompt.value = editingGroupStyle.value.name ? `${editingGroupStyle.value.name} style sticker, high quality` : 'explosion sticker';
    }
    
    generatingSticker.value = true;
    try {
        if (!window.$mapi?.sticker?.generate) {
            Message.error('贴纸生成模块未就绪');
            return;
        }

        const result = await window.$mapi.sticker.generate({
            prompt: stickerPrompt.value,
            apiKey: '' // Backend handles key
        });
        
        if (result && result.code === 0) {
            Message.success('贴纸生成成功');
            // 刷新贴纸列表
            const newSticker = {
                id: result.data.fileName, // 这里的 fileName 是文件名，也是 ID
                label: stickerPrompt.value || 'AI Generated',
                previewUrl: result.data.previewUrl
            };
            
            // 检查是否已存在
            const existingIndex = stickerOptions.value.findIndex(s => s.id === newSticker.id);
            if (existingIndex !== -1) {
                stickerOptions.value[existingIndex] = newSticker;
            } else {
                stickerOptions.value.push(newSticker);
            }

            // 自动选中生成的新贴纸
            editingGroupStyle.value.stickerId = result.data.fileName;
            
            if (!editingGroupStyle.value.stickerConfig) {
                 editingGroupStyle.value.stickerConfig = {
                    offsetX: 0,
                    offsetY: 0,
                    scale: 1.0,
                    opacity: 1.0
                };
            }
        } else {
            Message.error('生成失败: ' + (result?.msg || '未知错误'));
        }
    } catch (e: any) {
        console.error(e);
        Message.error('生成出错: ' + (e.message || e));
    } finally {
        generatingSticker.value = false;
    }
};

// 监听分组名称变化，自动更新 prompt 默认值
import { watch } from 'vue';
watch(() => editingGroupStyle.value.name, (newName) => {
    if (!stickerPrompt.value && newName) {
        stickerPrompt.value = newName;
    }
}, { immediate: true });

defineExpose({
    keywordGroups,
    loadGroups,
    getSelectedStyle: () => keywordGroups.value.find(g => g.id === selectedGroupId.value)?.styleOverride
});
</script>

<template>
    <div class="keyword-group-manager">

        <!-- 自定义分组表单 -->
        <div class="mb-4 p-3 bg-gray-50 rounded">
            <div class="flex gap-2">
                <a-input
                    v-model="newGroupName"
                    size="small"
                    placeholder="输入分组名称"
                    @keydown.enter="createNewGroup"
                />
                <a-button type="primary" size="small" @click="createNewGroup">创建分组</a-button>
            </div>
        </div>

        <!-- 已有分组列表 -->
        <div v-if="keywordGroups.length > 0" class="space-y-3">
            <div class="text-sm font-medium">已有分组 ({{ keywordGroups.length }})</div>
            <div
                v-for="group in keywordGroups"
                :key="group.id"
                class="p-3 border rounded-lg bg-gray-50"
                :style="{ borderLeftColor: group.color, borderLeftWidth: '4px' }"
            >
                <div class="flex items-center justify-between mb-2">
                    <div class="flex-1">
                        <div class="font-medium flex items-center gap-2">
                            {{ group.name }}
                            <span v-if="group.styleOverride" class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                ✓ 已设置样式
                            </span>
                            <span v-if="group.effectId" class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                ✓ 已设置特效
                            </span>
                        </div>
                        <div class="text-xs text-gray-500">{{ group.description }}</div>
                        <!-- 显示已设置的样式详情 -->
                        <div v-if="group.styleOverride" class="text-xs text-gray-600 mt-1 font-mono">
                            字体: {{ group.styleOverride.fontName || 'Microsoft YaHei' }} | 颜色: {{ group.styleOverride.fontColor }} | 描边: {{ group.styleOverride.outlineWidth }}px | 字号: {{ group.styleOverride.fontSize }}px
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <a-button
                            type="text"
                            size="mini"
                            @click="openStyleEditor(group.id)"
                        >
                            编辑样式
                        </a-button>
                        <!-- 系统默认分组不显示删除按钮（通过名称或isSystem属性判断） -->
                        <a-button
                            v-if="!group.isSystem && !systemGroupNames.includes(group.name)"
                            type="text"
                            status="danger"
                            size="mini"
                            @click="deleteGroup(group.id)"
                        >
                            删除
                        </a-button>
                    </div>
                </div>

                <!-- 关键词列表 -->
                <div class="mb-2">
                    <div class="text-xs text-gray-600 mb-1">关键词 ({{ group.keywords.length }})</div>
                    <div v-if="group.keywords.length > 0" class="flex flex-wrap gap-1">
                        <a-tag
                            v-for="(keyword, index) in group.keywords"
                            :key="(typeof keyword === 'string' ? keyword : keyword.keyword) + index"
                            closable
                            @close="removeKeyword(group.id, typeof keyword === 'string' ? keyword : keyword.keyword)"
                            :style="{
                                backgroundColor: group.color || '#1890ff',
                                color: getTextColor(group.color),
                                border: 'none'
                            }"
                        >
                            {{ typeof keyword === 'string' ? keyword : keyword.keyword }}
                        </a-tag>
                    </div>
                    <div v-else class="text-xs text-gray-400">暂无关键词</div>
                </div>

                <!-- 快速添加关键词 -->
                <div v-if="extractedKeywords && extractedKeywords.length > 0" class="text-xs">
                    <div class="text-gray-600 mb-1">从提取的关键词中添加：</div>
                    <div class="flex flex-wrap gap-1">
                        <a-button
                            v-for="item in extractedKeywords"
                            :key="item.keyword"
                            type="text"
                            size="mini"
                            @click="addKeywordToGroup(group.id, item.keyword)"
                            :disabled="group.keywords.some(k => k.keyword === item.keyword)"
                        >
                            + {{ item.keyword }}
                        </a-button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="text-center py-6 text-gray-400">
            <div>暂无分组，点击上方按钮创建分组</div>
        </div>

        <!-- 操作按钮 -->
        <div class="mt-4 flex gap-2">
            <a-button size="small" @click="exportGroups">导出配置</a-button>
            <a-button size="small" @click="importGroups">导入配置</a-button>
        </div>

        <!-- 分组样式编辑对话框 -->
        <a-modal
            v-model:visible="showStyleDialog"
            :title="`编辑 ${keywordGroups.find(g => g.id === editingGroupId)?.name || ''} 的样式`"
            @ok="saveGroupStyle"
            @cancel="showStyleDialog = false"
            :ok-text="$t('保存')"
            :cancel-text="$t('取消')"
            width="600px"
        >
            <div class="space-y-4" style="max-height: 65vh; overflow-y: auto; padding-right: 8px;">
                <a-tabs v-model:active-key="activeTab" type="rounded">
                    <a-tab-pane key="style" title="文字样式与特效">
                        <!-- 特效选择 -->
                        <div>
                            <label class="text-sm text-gray-600 mb-1 block">关键词特效</label>
                            <a-select v-model="editingGroupStyle.effectId" style="width: 100%">
                                <a-option v-for="effect in keywordEffects" :key="effect.id" :value="effect.id">
                                    {{ effect.name }}
                                </a-option>
                            </a-select>
                        </div>

                        <!-- 🆕 预览 (移至此处) -->
                        <div class="mt-2 mb-4">
                            <label class="text-sm text-gray-600 mb-2 block">动画效果预览</label>
                            <div class="p-8 bg-gray-800 rounded text-center min-h-32 flex items-center justify-center overflow-hidden">
                                <div
                                    class="text-lg font-bold preview-text"
                                    :class="`preview-${editingGroupStyle.effectId || 'zoom-in'}`"
                                    :style="{
                                        color: editingGroupStyle?.fontColor || '#FFD700',
                                        fontSize: (editingGroupStyle?.fontSize || 72) + 'px',
                                        textShadow: `-${editingGroupStyle?.outlineWidth || 3}px -${editingGroupStyle?.outlineWidth || 3}px 0 ${editingGroupStyle?.outlineColor || '#000000'}, ${editingGroupStyle?.outlineWidth || 3}px -${editingGroupStyle?.outlineWidth || 3}px 0 ${editingGroupStyle?.outlineColor || '#000000'}, -${editingGroupStyle?.outlineWidth || 3}px ${editingGroupStyle?.outlineWidth || 3}px 0 ${editingGroupStyle?.outlineColor || '#000000'}, ${editingGroupStyle?.outlineWidth || 3}px ${editingGroupStyle?.outlineWidth || 3}px 0 ${editingGroupStyle?.outlineColor || '#000000'}`
                                    }"
                                >
                                    {{ keywordEffects.find(e => e.id === editingGroupStyle.effectId)?.name || editingGroupStyle.effectId || 'zoom-in' }}
                                </div>
                            </div>
                            <div class="text-xs text-gray-500 mt-2">
                                {{ keywordEffects.find(e => e.id === editingGroupStyle.effectId)?.description || '预览动画效果' }}
                            </div>
                        </div>

                        <!-- 🆕 特效时长设置 -->
                        <div>
                            <label class="text-sm text-gray-600 mb-1 block">
                                特效动画时长
                                <span class="text-xs text-gray-400 ml-2">控制关键词特效的显示时长</span>
                            </label>
                            <div class="flex items-center gap-2">
                                <a-slider
                                    v-model="editingGroupStyle.effectDuration"
                                    :min="0.5"
                                    :max="10"
                                    :step="0.5"
                                    class="flex-1"
                                />
                                <span class="text-sm font-mono w-12 text-right">{{ editingGroupStyle.effectDuration || 2 }}秒</span>
                            </div>
                            <div class="text-xs text-gray-500 mt-1">
                                ⚠️ 时长越长，同一位置连续出现的关键词越容易触发避让
                            </div>
                        </div>

                        <!-- 字体颜色 -->
                        <div>
                            <label class="text-sm text-gray-600 mb-1 block">文字颜色</label>
                            <div class="flex items-center gap-2">
                                <a-color-picker v-model="editingGroupStyle.fontColor" />
                                <a-input v-model="editingGroupStyle.fontColor" class="flex-1" size="small" />
                            </div>
                        </div>

                        <!-- 描边颜色 -->
                        <div>
                            <label class="text-sm text-gray-600 mb-1 block">描边颜色</label>
                            <div class="flex items-center gap-2">
                                <a-color-picker v-model="editingGroupStyle.outlineColor" />
                                <a-input v-model="editingGroupStyle.outlineColor" class="flex-1" size="small" />
                            </div>
                        </div>

                        <!-- 描边宽度 -->
                        <div>
                            <label class="text-sm text-gray-600 mb-1 block">描边宽度</label>
                            <div class="flex items-center gap-2">
                                <a-slider
                                    v-model="editingGroupStyle.outlineWidth"
                                    :min="0"
                                    :max="10"
                                    :step="1"
                                    class="flex-1"
                                />
                                <a-tooltip content="设置为0可隐藏描边">
                                    <icon-question-circle class="text-gray-400" />
                                </a-tooltip>
                                <span class="text-sm font-mono w-12 text-right">{{ editingGroupStyle.outlineWidth }}px</span>
                            </div>
                        </div>



                        <!-- 🆕 贴纸设置区域 -->
                        <div class="border-t border-gray-200 py-3 mt-2">
                             <div class="flex items-center justify-between mb-3">
                                <label class="text-sm font-bold text-gray-700">启用背景贴纸</label>
                                <a-switch v-model="enableSticker" />
                            </div>

                            <div v-if="enableSticker" class="pl-2 border-l-2 border-gray-200 ml-1">
                                <!-- 生成区域 -->
                                <div class="mb-3">
                                    <div class="flex gap-2">
                                        <a-input
                                            v-model="stickerPrompt"
                                            placeholder="描述贴纸内容 (如: 爆炸, 闪电)"
                                            size="small"
                                            class="flex-1"
                                            @pressEnter="handleGenerateSticker"
                                        />
                                        <a-button
                                            type="primary"
                                            size="small"
                                            :loading="generatingSticker"
                                            @click="handleGenerateSticker"
                                        >
                                            <template #icon>✨</template>
                                            生成
                                        </a-button>
                                    </div>
                                </div>

                                <!-- 贴纸列表 -->
                                <div class="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 custom-scrollbar">
                                    <div
                                        v-for="sticker in stickerOptions"
                                        :key="sticker.id"
                                        class="cursor-pointer border rounded p-1 flex flex-col items-center justify-center aspect-square transition-all hover:border-blue-400 relative"
                                        :class="editingGroupStyle.stickerId === sticker.id ? 'border-primary bg-blue-50 ring-2 ring-primary ring-opacity-50' : 'border-gray-200 bg-white'"
                                        @click="selectSticker(sticker.id)"
                                        :title="sticker.label"
                                    >
                                        <div class="flex-1 w-full flex items-center justify-center overflow-hidden">
                                            <img v-if="sticker.previewUrl" :src="sticker.previewUrl" class="max-w-full max-h-full object-contain" />
                                            <span v-else class="text-2xl">{{ sticker.previewText || '🖼️' }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 字体大小 -->
                        <div>
                            <label class="text-sm text-gray-600 mb-1 block">字体大小</label>
                            <div class="flex items-center gap-2">
                                <a-slider
                                    v-model="editingGroupStyle.fontSize"
                                    :min="24"
                                    :max="200"
                                    :step="4"
                                    class="flex-1"
                                />
                                <span class="text-sm font-mono w-12 text-right">{{ editingGroupStyle.fontSize }}px</span>
                            </div>
                        </div>

                        <!-- 字体选择 -->
                        <div>
                            <label class="text-sm text-gray-600 mb-1 block">字体类型</label>
                            <a-select
                                v-model="editingGroupStyle.fontName"
                                class="w-full"
                                placeholder="选择字体"
                            >
                                <a-option
                                    v-for="font in availableFonts"
                                    :key="font.value"
                                    :value="font.value"
                                >
                                    {{ font.label }} {{ font.source ? `(${font.source})` : '' }}
                                </a-option>
                            </a-select>
                        </div>
                    </a-tab-pane>

                    <a-tab-pane key="sound" title="音效设置">
                        <!-- 🆕 音效配置面板 -->
                        <div class="mt-4">
                            <SoundEffectPanel
                                v-model="editingGroupStyle.soundEffectConfig"
                            />
                        </div>
                    </a-tab-pane>


                </a-tabs>
            </div>
        </a-modal>

    </div>
</template>

<style scoped>
.keyword-group-manager {
    padding: 0;
}

/* 预览文本动画效果 */
.preview-text {
    animation: preview-zoom-in 0.8s ease-in-out infinite;
    display: inline-block;
    white-space: nowrap;
}

/* 缩放弹出效果 */
.preview-zoom-in {
    animation: preview-zoom-in 0.8s ease-in-out infinite !important;
}

@keyframes preview-zoom-in {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
}

/* 弹跳反弹效果 */
.preview-bounce {
    animation: preview-bounce 0.8s ease-in-out infinite !important;
}

@keyframes preview-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
}

/* 发光闪烁效果 */
.preview-glow {
    animation: preview-glow 0.8s ease-in-out infinite !important;
}

@keyframes preview-glow {
    0%, 100% {
        transform: scale(1);
        filter: drop-shadow(0 0 5px currentColor);
    }
    50% {
        transform: scale(1.08);
        filter: drop-shadow(0 0 15px currentColor);
    }
}

/* 抖动震颤效果 */
.preview-shake {
    animation: preview-shake 0.3s ease-in-out infinite !important;
}

@keyframes preview-shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}

/* 底部滑入效果 */
.preview-slide-up {
    animation: preview-slide-up 1s ease-out !important;
}

@keyframes preview-slide-up {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* 渐变高亮效果 */
.preview-fade {
    animation: preview-fade 0.8s ease-in-out infinite !important;
}

@keyframes preview-fade {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
}

/* 旋转转动效果 */
.preview-spin {
    animation: preview-spin 1.2s linear infinite !important;
}

@keyframes preview-spin {
    from { transform: rotateZ(0deg); }
    to { transform: rotateZ(360deg); }
}

/* 彩虹波浪效果 */
.preview-wave {
    animation: preview-wave 1s ease-in-out infinite !important;
}

@keyframes preview-wave {
    0%, 100% {
        transform: translateY(0) scaleX(1);
    }
    50% {
        transform: translateY(-8px) scaleX(1.05);
    }
}

/* 翻转效果 */
.preview-flip {
    animation: preview-flip 0.8s ease-in-out infinite !important;
}

@keyframes preview-flip {
    0%, 100% { transform: rotateY(0deg); }
    50% { transform: rotateY(180deg); }
}

/* 闪烁高亮效果 */
.preview-flash {
    animation: preview-flash 0.5s ease-in-out infinite !important;
}

@keyframes preview-flash {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
}

/* 向下滑入效果 */
.preview-slide-down {
    animation: preview-slide-down 1s ease-out !important;
}

@keyframes preview-slide-down {
    from {
        opacity: 0;
        transform: translateY(-30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* 向左滑入效果 */
.preview-slide-left {
    animation: preview-slide-left 1s ease-out !important;
}

@keyframes preview-slide-left {
    from {
        opacity: 0;
        transform: translateX(30px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* 向右滑入效果 */
.preview-slide-right {
    animation: preview-slide-right 1s ease-out !important;
}

@keyframes preview-slide-right {
    from {
        opacity: 0;
        transform: translateX(-30px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* 弹性飞入效果 */
.preview-fly-in {
    animation: preview-fly-in 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
}

@keyframes preview-fly-in {
    from {
        opacity: 0;
        transform: translateY(-50px) scale(0.5);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* 摇摆旋转效果 */
.preview-swing {
    animation: preview-swing 1s ease-in-out infinite !important;
}

@keyframes preview-swing {
    0%, 100% { transform: rotate(-5deg); }
    50% { transform: rotate(5deg); }
}

/* 波浪浮动效果（更新） */
.preview-wave {
    animation: preview-wave 1.5s ease-in-out infinite !important;
}

@keyframes preview-wave {
    0%, 100% { transform: translateY(0); }
    25% { transform: translateY(-10px); }
    75% { transform: translateY(10px); }
}

/* 呼吸效果 */
.preview-breathe {
    animation: preview-breathe 2s ease-in-out infinite !important;
}

@keyframes preview-breathe {
    0%, 100% {
        opacity: 0.6;
        transform: scale(0.95);
    }
    50% {
        opacity: 1;
        transform: scale(1.05);
    }
}

/* 彩虹渐变效果 */
.preview-rainbow {
    animation: preview-rainbow 2s linear infinite !important;
}

@keyframes preview-rainbow {
    0% { color: #ff0000; }
    16.66% { color: #ff8800; }
    33.33% { color: #ffff00; }
    50% { color: #00ff00; }
    66.66% { color: #0088ff; }
    83.33% { color: #8800ff; }
    100% { color: #ff0000; }
}

/* 粒子爆炸效果 */
.preview-particle-burst {
    animation: preview-particle-burst 0.8s ease-out !important;
}

@keyframes preview-particle-burst {
    0% {
        opacity: 1;
        transform: scale(1);
    }
    100% {
        opacity: 0;
        transform: scale(2);
    }
}

/* 电击效果 */
.preview-electric {
    animation: preview-electric 0.2s ease-in-out infinite !important;
}

@keyframes preview-electric {
    0%, 100% {
        transform: translateX(0);
        opacity: 1;
    }
    25% {
        transform: translateX(-3px);
        opacity: 0.5;
    }
    75% {
        transform: translateX(3px);
        opacity: 0.5;
    }
}

/* 心跳脉冲效果 */
.preview-heartbeat {
    animation: preview-heartbeat 1s ease-in-out infinite !important;
}

@keyframes preview-heartbeat {
    0%, 100% { transform: scale(1); }
    10% { transform: scale(1.1); }
    20% { transform: scale(1); }
    30% { transform: scale(1.1); }
    40% { transform: scale(1); }
}

/* 弹幕满屏效果 */
.preview-danmaku {
    animation: preview-danmaku 2s ease-in-out infinite !important;
    position: relative;
}

.preview-danmaku::before,
.preview-danmaku::after {
    content: attr(data-text) '+1';
    position: absolute;
    font-size: 0.7em;
    opacity: 0.5;
    animation: preview-danmaku-float 2s ease-in-out infinite;
}

.preview-danmaku::before {
    top: -20px;
    left: -30px;
    animation-delay: 0.2s;
}

.preview-danmaku::after {
    top: -15px;
    right: -35px;
    animation-delay: 0.5s;
    opacity: 0.3;
}

@keyframes preview-danmaku {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.9; }
    100% { transform: scale(1); opacity: 1; }
}

@keyframes preview-danmaku-float {
    0% { transform: translateY(0) translateX(0); opacity: 0; }
    20% { opacity: 0.6; }
    80% { opacity: 0.4; }
    100% { transform: translateY(-30px) translateX(10px); opacity: 0; }
}

/* ✈️ 倾斜飞行效果 - 文字从下往上飞行，带有倾斜角度变化 */
.preview-flying-tilt {
    animation: preview-flying-tilt 2s ease-in-out infinite !important;
    position: relative;
}

.preview-flying-tilt::before,
.preview-flying-tilt::after {
    content: attr(data-text);
    position: absolute;
    font-size: 0.6em;
    opacity: 0.4;
    animation: preview-flying-tilt-item 2s ease-in-out infinite;
}

.preview-flying-tilt::before {
    top: 10px;
    left: -40px;
    animation-delay: 0.3s;
}

.preview-flying-tilt::after {
    top: 5px;
    right: -45px;
    animation-delay: 0.6s;
    opacity: 0.3;
}

@keyframes preview-flying-tilt {
    0% { 
        transform: translateY(20px) rotate(-5deg); 
        opacity: 0; 
    }
    20% { 
        opacity: 1; 
    }
    50% { 
        transform: translateY(-5px) rotate(3deg); 
    }
    80% { 
        opacity: 1; 
    }
    100% { 
        transform: translateY(-25px) rotate(-3deg); 
        opacity: 0; 
    }
}

@keyframes preview-flying-tilt-item {
    0% { 
        transform: translateY(30px) rotate(-8deg); 
        opacity: 0; 
    }
    30% { 
        opacity: 0.5; 
    }
    100% { 
        transform: translateY(-35px) rotate(5deg); 
        opacity: 0; 
    }
}
</style>
