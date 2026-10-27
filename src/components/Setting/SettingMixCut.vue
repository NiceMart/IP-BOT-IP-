<script setup lang="ts">
import { ref, reactive, onMounted, computed, toRaw, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { t } from '../../lang';
import type {
  MixCutMode,
  MixCutDisplayMode,
  PipPosition,
  PipScaleMode,
  FixedModeConfig,
  KeywordModeConfig,
  KeywordGroup,
  KeywordGroupMixCutConfig,
  VideoMixCutConfig,
  OriginalVideoShape,
  OriginalVideoPosition,
  SubtitleModeConfig,
  SubtitleMaterialMapping
} from '../../lib/mixCutVideo/types';
import KeywordGroupService from '../../service/KeywordGroupService';
import { TaskService } from '../../service/TaskService';
import { VideoMaterialRecord, VideoMaterialService } from '../../service/VideoMaterialService';
import { useSettingStore } from '../../store/modules/setting';

const mixCutEnabled = ref(false);
const currentMode = ref<MixCutMode>('subtitle');
const settingStore = useSettingStore();
const isDarkTheme = computed(() => settingStore.currentTheme() === 'dark');
const globalDisplayPanelInlineStyle = computed(() => {
  if (!isDarkTheme.value) {
    return {};
  }
  return {
    background: 'linear-gradient(180deg, rgba(18, 33, 58, 0.96) 0%, rgba(15, 23, 42, 0.98) 100%)',
    borderColor: 'rgba(96, 165, 250, 0.35)',
    color: '#e5e7eb',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  };
});
const globalDisplayTitleInlineStyle = computed(() => (
  isDarkTheme.value ? { color: '#dbeafe' } : {}
));
const globalDisplayLabelInlineStyle = computed(() => (
  isDarkTheme.value ? { color: '#e5e7eb' } : {}
));
const globalDisplayMutedInlineStyle = computed(() => (
  isDarkTheme.value ? { color: '#94a3b8' } : {}
));
const globalDisplaySubPanelInlineStyle = computed(() => (
  isDarkTheme.value ? { borderColor: 'rgba(96, 165, 250, 0.35)' } : {}
));
// 🔧 删除全局 displayMode - 改为在片头、片中、片尾各自设置
const allKeywordGroups = ref<KeywordGroup[]>([]);

const fixedConfig = reactive<FixedModeConfig>({
  enabled: false,
  // 🔧 新增：每个位置都有独立的画中画配置
  opening: {
    enabled: false,
    timeRange: { durationMin: 2, durationMax: 5 },
    materialFolderPath: '',
    selectionMode: 'random',  // 🆕 添加素材选择模式
    displayMode: 'fullscreen',
    pipPosition: 'top-right' as PipPosition,
    pipSizePercent: 30,
    pipScaleMode: 'fit' as PipScaleMode,
    // 🆕 原视频最小化默认配置
    originalVideoMinimized: {
      enabled: false,
      shape: 'square' as OriginalVideoShape,
      position: 'bottom-right' as OriginalVideoPosition,
      sizePercent: 25
    }
  },
  middle: {
    enabled: false,
    timeRange: { durationMin: 2, durationMax: 5 },
    materialFolderPath: '',
    selectionMode: 'random',  // 🆕 添加素材选择模式
    displayMode: 'fullscreen',
    pipPosition: 'bottom-left' as PipPosition,
    pipSizePercent: 40,
    pipScaleMode: 'fit' as PipScaleMode,
    // 🆕 原视频最小化默认配置
    originalVideoMinimized: {
      enabled: false,
      shape: 'square' as OriginalVideoShape,
      position: 'bottom-right' as OriginalVideoPosition,
      sizePercent: 25
    }
  },
  ending: {
    enabled: false,
    timeRange: { durationMin: 2, durationMax: 5 },
    materialFolderPath: '',
    selectionMode: 'random',  // 🆕 添加素材选择模式
    displayMode: 'fullscreen',
    pipPosition: 'bottom-right' as PipPosition,
    pipSizePercent: 30,
    pipScaleMode: 'fit' as PipScaleMode,
    // 🆕 原视频最小化默认配置
    originalVideoMinimized: {
      enabled: false,
      shape: 'square' as OriginalVideoShape,
      position: 'bottom-right' as OriginalVideoPosition,
      sizePercent: 25
    }
  }
});

const keywordConfig = reactive<KeywordModeConfig>({ enabled: false, groups: [] });

// 🆕 全局显示模式配置（应用到所有素材）
const globalDisplaySettings = reactive({
  displayMode: 'fullscreen' as MixCutDisplayMode,
  pipPosition: 'bottom-right' as PipPosition,
  pipSizePercent: 30,
  pipScaleMode: 'fit' as PipScaleMode,
  originalVideoMinimized: {
    enabled: false,
    shape: 'square' as OriginalVideoShape,
    position: 'bottom-right' as OriginalVideoPosition,
    sizePercent: 25
  }
});

// 🆕 应用全局设置到所有素材
const applyGlobalSettings = () => {
  try {
    // 应用到固定模式的所有位置
    ['opening', 'middle', 'ending'].forEach(position => {
      const config = (fixedConfig as any)[position];
      config.displayMode = globalDisplaySettings.displayMode;
      config.pipPosition = globalDisplaySettings.pipPosition;
      config.pipSizePercent = globalDisplaySettings.pipSizePercent;
      config.pipScaleMode = globalDisplaySettings.pipScaleMode;
      config.originalVideoMinimized = {
        enabled: globalDisplaySettings.originalVideoMinimized.enabled,
        shape: globalDisplaySettings.originalVideoMinimized.shape,
        position: globalDisplaySettings.originalVideoMinimized.position,
        sizePercent: globalDisplaySettings.originalVideoMinimized.sizePercent
      };
    });

    // 应用到关键词模式的所有分组
    keywordConfig.groups.forEach(group => {
      group.displayMode = globalDisplaySettings.displayMode;
      group.pipPosition = globalDisplaySettings.pipPosition;
      group.pipSizePercent = globalDisplaySettings.pipSizePercent;
      group.pipScaleMode = globalDisplaySettings.pipScaleMode;
      group.originalVideoMinimized = {
        enabled: globalDisplaySettings.originalVideoMinimized.enabled,
        shape: globalDisplaySettings.originalVideoMinimized.shape,
        position: globalDisplaySettings.originalVideoMinimized.position,
        sizePercent: globalDisplaySettings.originalVideoMinimized.sizePercent
      };
    });

    // 应用到字幕模式的所有映射
    subtitleConfig.mappings.forEach(mapping => {
      mapping.displayMode = globalDisplaySettings.displayMode;
      mapping.pipPosition = globalDisplaySettings.pipPosition;
      mapping.pipSizePercent = globalDisplaySettings.pipSizePercent;
      mapping.pipScaleMode = globalDisplaySettings.pipScaleMode;
      mapping.originalVideoMinimized = {
        enabled: globalDisplaySettings.originalVideoMinimized.enabled,
        shape: globalDisplaySettings.originalVideoMinimized.shape,
        position: globalDisplaySettings.originalVideoMinimized.position,
        sizePercent: globalDisplaySettings.originalVideoMinimized.sizePercent
      };
    });

    Message.success(t('全局设置已应用到所有素材'));
    console.log('[applyGlobalSettings] 全局设置已应用');
  } catch (error: any) {
    console.error('[applyGlobalSettings] 应用失败:', error);
    Message.error(t('应用全局设置失败：') + (error?.message || error));
  }
};

// 字幕模式配置
const subtitleConfig = reactive<SubtitleModeConfig>({ enabled: false, mappings: [] });
const availableRecords = ref<any[]>([]);
const scriptLineToRecordsMap = ref<Map<number, number[]>>(new Map()); // 🆕 文案行到 records 的映射
const selectedSubtitleIndices = ref<Set<number>>(new Set());
const currentMaterialPath = ref('');
const currentDisplayMode = ref<MixCutDisplayMode>('fullscreen');
const currentPipPosition = ref<PipPosition>('bottom-right');
const currentPipSizePercent = ref(30);
const currentPipScaleMode = ref<PipScaleMode>('fit');
const currentOriginalVideoMinimized = reactive({
  enabled: false,
  shape: 'square' as OriginalVideoShape,
  position: 'bottom-right' as OriginalVideoPosition,
  sizePercent: 25
});
const materialLibraryVisible = ref(false);
const materialLibraryLoading = ref(false);
const materialLibraryRecords = ref<VideoMaterialRecord[]>([]);
const materialLibraryTargetLineIndex = ref<number | null>(null);
const specifiedMaterialTarget = ref<{ target: string; groupId?: string } | null>(null);

const getFileName = (filePath: string) => filePath?.split(/[\\/]/).pop() || filePath || '';
const materialLibraryTitle = computed(() =>
  specifiedMaterialTarget.value ? t('选择素材库素材') : t('素材库选择')
);
const materialLibraryHint = computed(() => {
  if (specifiedMaterialTarget.value) {
    return t('选择后会直接填入当前模式的指定素材。');
  }
  if (selectedSubtitleIndices.value.size > 1) {
    return t('如果当前字幕行已勾选多条，选择素材后会直接批量绑定到这些字幕。');
  }
  return t('选择一个素材后会绑定到当前字幕；如果已勾选多条字幕则会批量绑定。');
});

const openMaterialLibrary = async ({
  lineIndex = null,
  target = null,
  groupId
}: {
  lineIndex?: number | null;
  target?: string | null;
  groupId?: string;
} = {}) => {
  specifiedMaterialTarget.value = target ? { target, groupId } : null;
  materialLibraryTargetLineIndex.value = lineIndex;
  materialLibraryVisible.value = true;
  materialLibraryLoading.value = true;

  try {
    materialLibraryRecords.value = await VideoMaterialService.list();
  } catch (error: any) {
    materialLibraryVisible.value = false;
    console.error('[openMaterialLibrary] 加载素材库失败:', error);
    Message.error(t('加载素材库失败：') + (error?.message || error));
  } finally {
    materialLibraryLoading.value = false;
  }
};

const selectMaterialFolder = async (target: string, groupId?: string) => {
  try {
    console.log('[selectMaterialFolder] 开始选择目录，target:', target, 'groupId:', groupId);

    if (!window.$mapi || !window.$mapi.file) {
      console.error('[selectMaterialFolder] window.$mapi.file 不可用');
      Message.error(t('文件API不可用'));
      return;
    }

    const path = await window.$mapi.file.openDirectory();
    console.log('[selectMaterialFolder] 选择的路径:', path);

    if (!path) {
      console.warn('[selectMaterialFolder] 用户取消了选择');
      return;
    }

    // 🔧 处理固定模式
    if (target in fixedConfig) {
      (fixedConfig as any)[target].materialFolderPath = path;
      console.log('[selectMaterialFolder] 成功设置固定模式路径:', target, path);
      Message.success(t('目录已选择'));
    }
    // 🔧 处理关键词模式
    else if (groupId) {
      const groupConfig = keywordConfig.groups.find(g => g.groupId === groupId);
      if (groupConfig) {
        groupConfig.materialFolderPath = path;
        console.log('[selectMaterialFolder] 成功设置关键词分组路径:', groupId, path);
        Message.success(t('目录已选择'));
      } else {
        console.error('[selectMaterialFolder] 未找到分组配置:', groupId);
        Message.error(t('分组配置不存在'));
      }
    } else {
      console.error('[selectMaterialFolder] 无效的target:', target);
      Message.error(t('配置项不存在'));
    }
  } catch (error: any) {
    console.error('[selectMaterialFolder] 选择目录失败:', error);
    Message.error(t('选择目录失败：') + (error?.message || error));
  }
};

// 🆕 选择指定素材文件（用于固定模式和关键词模式）
const selectSpecifiedMaterial = async (target: string, groupId?: string) => {
  try {
    await openMaterialLibrary({ target, groupId });
    return;
    console.log('[selectSpecifiedMaterial] 开始选择文件，target:', target, 'groupId:', groupId);

    if (!window.$mapi || !window.$mapi.file) {
      console.error('[selectSpecifiedMaterial] window.$mapi.file 不可用');
      Message.error(t('文件API不可用'));
      return;
    }

    const materialPath = await window.$mapi.file.openFile({
      title: t('选择素材文件'),
      filters: [
        {
          name: t('媒体文件'),
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
        }
      ]
    });

    console.log('[selectSpecifiedMaterial] 用户选择的素材路径:', materialPath);

    if (!materialPath) {
      console.warn('[selectSpecifiedMaterial] 用户取消了选择');
      return;
    }

    // 🔧 处理固定模式
    if (target in fixedConfig) {
      (fixedConfig as any)[target].specifiedMaterialPath = materialPath;
      console.log('[selectSpecifiedMaterial] 成功设置固定模式指定素材:', target, materialPath);
      Message.success(t('素材已选择'));
    }
    // 🔧 处理关键词模式
    else if (groupId) {
      const groupConfig = keywordConfig.groups.find(g => g.groupId === groupId);
      if (groupConfig) {
        groupConfig.specifiedMaterialPath = materialPath;
        console.log('[selectSpecifiedMaterial] 成功设置关键词分组指定素材:', groupId, materialPath);
        Message.success(t('素材已选择'));
      } else {
        console.error('[selectSpecifiedMaterial] 未找到分组配置:', groupId);
        Message.error(t('分组配置不存在'));
      }
    } else {
      console.error('[selectSpecifiedMaterial] 无效的target:', target);
      Message.error(t('配置项不存在'));
    }
  } catch (error: any) {
    console.error('[selectSpecifiedMaterial] 选择文件失败:', error);
    Message.error(t('选择文件失败：') + (error?.message || error));
  }
};

/**
 * 🔧 同步关键词分组 - 从 KeywordGroupService 自动加载和更新
 * 功能：
 * 1. 从数据库获取最新的关键词分组
 * 2. 为新分组创建默认配置（默认禁用）
 * 3. 更新已有分组的名称
 * 4. 移除已删除分组的配置
 */
const syncKeywordGroups = async () => {
  try {
    console.log('[syncKeywordGroups] 开始同步关键词分组...');

    // 1. 从数据库获取最新的关键词分组
    const groups = await KeywordGroupService.getAllGroups();
    allKeywordGroups.value = groups;

    console.log('[syncKeywordGroups] 获取到 ' + groups.length + ' 个关键词分组:',
      groups.map(g => ({ id: g.id, name: g.name }))
    );

    // 2. 为每个分组创建或更新配置
    for (const group of groups) {
      // 查找是否已有配置
      let config = keywordConfig.groups.find(g => g.groupId === group.id);

      if (!config) {
        // 新分组：创建默认配置（默认禁用）
        const newConfig: KeywordGroupMixCutConfig = {
          groupId: group.id,
          groupName: group.name,
          materialFolderPath: '',
          durationMin: 2,
          durationMax: 5,
          selectionMode: 'random',
          displayMode: 'fullscreen',
          pipPosition: 'bottom-right',
          pipSizePercent: 30,
          pipScaleMode: 'fit',
          enabled: false,  // 🆕 默认禁用，用户手动启用
          // 🆕 原视频最小化默认配置
          originalVideoMinimized: {
            enabled: false,
            shape: 'square' as OriginalVideoShape,
            position: 'bottom-right' as OriginalVideoPosition,
            sizePercent: 25
          }
        };
        keywordConfig.groups.push(newConfig);
        console.log('[syncKeywordGroups] 创建新分组配置:', group.name);
      } else {
        // 已有配置：更新分组名称（可能被修改）
        config.groupName = group.name;
        // 🆕 补全缺失的 originalVideoMinimized 字段
        if (!config.originalVideoMinimized) {
          config.originalVideoMinimized = {
            enabled: false,
            shape: 'square' as OriginalVideoShape,
            position: 'bottom-right' as OriginalVideoPosition,
            sizePercent: 25
          };
        }
        console.log('[syncKeywordGroups] 更新分组名称:', group.name);
      }
    }

    // 3. 清理已删除的分组配置
    const initialCount = keywordConfig.groups.length;
    keywordConfig.groups = keywordConfig.groups.filter(config =>
      groups.some(g => g.id === config.groupId)
    );

    const removedCount = initialCount - keywordConfig.groups.length;
    if (removedCount > 0) {
      console.log('[syncKeywordGroups] 清理已删除分组，移除数量:', removedCount);
    }

    console.log('[syncKeywordGroups] 同步完成，当前配置分组数:', keywordConfig.groups.length);
  } catch (error) {
    console.error('[syncKeywordGroups] 同步关键词分组失败:', error);
    Message.error(t('同步关键词分组失败：') + (error?.message || error));
  }
};

// 字幕模式相关函数
const isGeneratingPreview = ref(false);
const scriptLines = ref<string[]>([]);  // 🆕 用户文案的行数组
const currentSrtPath = ref<string>('');  // 🆕 当前生成的SRT文件路径

// 🆕 解析 SRT 文件内容为 records
const parseSrtToRecords = (srtContent: string): any[] => {
  const records: any[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  console.log('[parseSrtToRecords] 解析SRT，共', blocks.length, '个块');

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // 第1行：序号
    // 第2行：时间轴 (00:00:00,000 --> 00:00:03,000)
    // 第3行及以后：文本内容
    const timeLine = lines[1];
    const text = lines.slice(2).join('\n');

    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timeMatch) continue;

    // 🔧 修复：保持毫秒为单位（步骤3的混剪处理需要毫秒）
    const startTime = parseInt(timeMatch[1]) * 3600000 + parseInt(timeMatch[2]) * 60000 + parseInt(timeMatch[3]) * 1000 + parseInt(timeMatch[4]);
    const endTime = parseInt(timeMatch[5]) * 3600000 + parseInt(timeMatch[6]) * 60000 + parseInt(timeMatch[7]) * 1000 + parseInt(timeMatch[8]);

    records.push({
      text: text.trim(),
      start: startTime,
      end: endTime
    });
  }

  console.log('[parseSrtToRecords] 解析完成，共', records.length, '条记录');
  console.log('[parseSrtToRecords] 示例record（毫秒）:', records[0]);
  return records;
};

// 🆕 建立文案行到 records 的映射函数
const buildLineToRecordsMapping = (lines: string[], records: any[]): Map<number, number[]> => {
  const mapping = new Map<number, number[]>();

  console.log('[buildLineToRecordsMapping] 开始建立映射');
  console.log('[buildLineToRecordsMapping] 文案行数:', lines.length);
  console.log('[buildLineToRecordsMapping] records数:', records.length);

  if (records.length === 0 || lines.length === 0) {
    console.warn('[buildLineToRecordsMapping] 文案行或records为空，无法建立映射');
    return mapping;
  }

  // 🔧 新策略：通过文本匹配来建立映射
  // 清理文本函数：移除标点和空格
  const cleanText = (text: string) => text.replace(/[，。！？、\s\n\r]/g, '');

  let recordIndex = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const cleanLine = cleanText(line);
    const matchedRecordIndices: number[] = [];
    let accumulatedText = '';

    console.log(`[buildLineToRecordsMapping] 处理第${lineIndex}行: "${line}"`);
    console.log(`[buildLineToRecordsMapping] 清理后: "${cleanLine}"`);

    // 从当前 recordIndex 开始累积文本，直到匹配当前行
    while (recordIndex < records.length) {
      const record = records[recordIndex];
      const cleanRecordText = cleanText(record.text);

      accumulatedText += cleanRecordText;
      matchedRecordIndices.push(recordIndex);
      recordIndex++;

      console.log(`[buildLineToRecordsMapping] 累积文本: "${accumulatedText}", record[${recordIndex-1}]: "${cleanRecordText}"`);

      // 检查是否已经匹配到当前行
      if (accumulatedText.includes(cleanLine) || cleanLine.includes(accumulatedText)) {
        console.log(`[buildLineToRecordsMapping] 匹配成功！`);
        break;
      }

      // 如果累积文本已经超过当前行长度很多，停止
      if (accumulatedText.length > cleanLine.length * 1.5) {
        console.warn(`[buildLineToRecordsMapping] 累积文本过长，停止匹配`);
        break;
      }
    }

    if (matchedRecordIndices.length > 0) {
      mapping.set(lineIndex, matchedRecordIndices);
      console.log(`[buildLineToRecordsMapping] 第${lineIndex}行映射到 records [${matchedRecordIndices.join(', ')}]`);
    } else {
      console.warn(`[buildLineToRecordsMapping] 第${lineIndex}行未找到匹配的records`);
    }
  }

  console.log('[buildLineToRecordsMapping] 映射完成，共', mapping.size, '个映射');
  return mapping;
};

// 🆕 从用户文案加载行，并自动生成时间轴
const loadScriptLines = async () => {
  if (isGeneratingPreview.value) {
    Message.warning(t('正在生成中，请稍候...'));
    return;
  }

  try {
    isGeneratingPreview.value = true;

    // 1. 🔧 修复：调用完整的字幕生成逻辑，生成 SRT 文件
    Message.info(t('正在生成字幕文件...'));

    // 调用 VideoIPAgent 的完整字幕生成方法
    const generateResult = await (window as any).$videoIPAgent?.generateFullSubtitle?.();

    console.log('[loadScriptLines] generateFullSubtitle 返回结果:', generateResult);

    if (generateResult && generateResult.success && generateResult.srtPath) {
      // 读取生成的 SRT 文件
      try {
        const srtContent = await window.$mapi.file.read(generateResult.srtPath, { isDataPath: false });
        console.log('[loadScriptLines] SRT文件内容长度:', srtContent.length);

        // 解析 SRT 文件，提取 records
        const records = parseSrtToRecords(srtContent);
        console.log('[loadScriptLines] 从SRT解析出', records.length, '条记录');

        if (records.length > 0) {
          availableRecords.value = records;

          // 🔧 修复：直接使用 SRT 中的文本作为文案行
          scriptLines.value = records.map(r => r.text);
          console.log('[loadScriptLines] 从SRT加载了', scriptLines.value.length, '行字幕');

          // 🔧 修复：建立简单的一对一映射（每行对应一个 record）
          scriptLineToRecordsMap.value = new Map();
          for (let i = 0; i < records.length; i++) {
            scriptLineToRecordsMap.value.set(i, [i]);
          }

          localStorage.setItem('videoIPAgent_subtitleRecords', JSON.stringify(records));
          localStorage.setItem('videoIPAgent_srtPath', generateResult.srtPath);  // 保存 SRT 路径
          currentSrtPath.value = generateResult.srtPath;  // 🆕 保存到状态中

          // 🆕 保存 records 到混剪配置中，供步骤3使用
          try {
            console.log('[loadScriptLines] 准备保存 records 到混剪配置，records数量:', records.length);

            // 🔧 关键修复：清理 records，移除 Proxy 包装，确保可序列化
            const cleanRecords = records.map(r => ({
              text: String(r.text || ''),
              start: Number(r.start || 0),
              end: Number(r.end || 0)
            }));

            console.log('[loadScriptLines] 清理后的 records 示例:', cleanRecords[0]);

            const mixCutConfig = await window.$mapi.config.get('videoMixCutSettings') || {};
            console.log('[loadScriptLines] 当前混剪配置:', mixCutConfig);

            mixCutConfig.records = cleanRecords;  // 使用清理后的数据

            console.log('[loadScriptLines] 准备保存的配置:', {
              enabled: mixCutConfig.enabled,
              mode: mixCutConfig.mode,
              recordsCount: mixCutConfig.records?.length
            });

            await window.$mapi.config.set('videoMixCutSettings', mixCutConfig);
            console.log('[loadScriptLines] ✅ 已将 records 保存到混剪配置');

            // 🔧 修复：从磁盘重新读取验证，而不是使用内存中的对象
            await new Promise(resolve => setTimeout(resolve, 100)); // 等待文件写入完成
            const savedConfig = await window.$mapi.config.get('videoMixCutSettings');
            console.log('[loadScriptLines] 验证保存结果（从磁盘读取），records数量:', savedConfig?.records?.length);

            if (!savedConfig?.records || savedConfig.records.length === 0) {
              throw new Error('Records 保存验证失败：配置文件中没有 records 数据');
            }

            // 同时保存到 localStorage 作为备份
            localStorage.setItem('videoIPAgent_subtitleRecords', JSON.stringify(cleanRecords));
            localStorage.setItem('videoIPAgent_srtPath', generateResult.srtPath);
          } catch (error) {
            console.error('[loadScriptLines] 保存 records 到配置失败:', error);
            Message.error(t('保存字幕数据失败：') + (error?.message || error));
          }

          Message.success(t('字幕加载成功，共') + ` ${records.length} ` + t('条'));
          return true;
        }
      } catch (error: any) {
        console.error('[loadScriptLines] 读取SRT文件失败:', error);
        Message.error(t('读取字幕文件失败：') + (error?.message || error));
        return false;
      }
    } else {
      Message.error(t('生成字幕文件失败：') + (generateResult?.error || t('未知错误')));
      return false;
    }
  } catch (error: any) {
    console.error('[loadScriptLines] 加载失败:', error);
    Message.error(t('加载文案失败：') + (error?.message || error));
    return false;
  } finally {
    isGeneratingPreview.value = false;
  }
};

// 🆕 打开SRT文件所在文件夹
const loadExistingSubtitleLines = async (options: { generateIfMissing?: boolean } = {}) => {
  if (isGeneratingPreview.value) {
    Message.warning(t('正在处理中，请稍候...'));
    return;
  }

  const applyRecords = async (records: any[], srtPath = '') => {
    if (!records.length) {
      return false;
    }

    availableRecords.value = records;
    scriptLines.value = records.map(r => r.text);
    scriptLineToRecordsMap.value = new Map();
    for (let i = 0; i < records.length; i++) {
      scriptLineToRecordsMap.value.set(i, [i]);
    }

    if (srtPath) {
      currentSrtPath.value = srtPath;
      localStorage.setItem('videoIPAgent_srtPath', srtPath);
    }

    const cleanRecords = records.map(r => ({
      text: String(r.text || ''),
      start: Number(r.start ?? r.startTime ?? 0),
      end: Number(r.end ?? r.endTime ?? 0)
    }));

    localStorage.setItem('videoIPAgent_subtitleRecords', JSON.stringify(cleanRecords));

    const mixCutConfig = await window.$mapi.config.get('videoMixCutSettings') || {};
    mixCutConfig.records = cleanRecords;
    if (srtPath) {
      mixCutConfig.subtitleFilePath = srtPath;
    }
    await window.$mapi.config.set('videoMixCutSettings', mixCutConfig);
    return true;
  };

  const readExistingRecords = async () => {
    const mixCutConfig = await window.$mapi.config.get('videoMixCutSettings') || {};
    if (Array.isArray(mixCutConfig.records) && mixCutConfig.records.length > 0) {
      return {
        records: mixCutConfig.records,
        srtPath: mixCutConfig.subtitleFilePath || localStorage.getItem('videoIPAgent_srtPath') || ''
      };
    }

    const cachedRecords = localStorage.getItem('videoIPAgent_subtitleRecords');
    if (cachedRecords) {
      try {
        const parsedRecords = JSON.parse(cachedRecords);
        if (Array.isArray(parsedRecords) && parsedRecords.length > 0) {
          return {
            records: parsedRecords,
            srtPath: mixCutConfig.subtitleFilePath || localStorage.getItem('videoIPAgent_srtPath') || ''
          };
        }
      } catch (error) {
        console.warn('[loadExistingSubtitleLines] cached records parse failed:', error);
      }
    }

    const srtPathCandidates = [
      mixCutConfig.subtitleFilePath,
      localStorage.getItem('videoIPAgent_srtPath'),
      (window as any).$videoIPAgent?.getSrtFilePath?.()
    ].filter(Boolean);

    for (const srtPath of srtPathCandidates) {
      try {
        const exists = await window.$mapi.file.exists(srtPath, { isDataPath: false });
        if (!exists) {
          continue;
        }
        const srtContent = await window.$mapi.file.read(srtPath, { isDataPath: false });
        const parsedRecords = parseSrtToRecords(srtContent);
        if (parsedRecords.length > 0) {
          return { records: parsedRecords, srtPath };
        }
      } catch (error) {
        console.warn('[loadExistingSubtitleLines] read srt failed:', srtPath, error);
      }
    }

    return null;
  };

  try {
    isGeneratingPreview.value = true;

    const existingData = await readExistingRecords();
    if (existingData && await applyRecords(existingData.records, existingData.srtPath)) {
      Message.success(t('已直接加载已识别字幕') + ` ${existingData.records.length} ` + t('条'));
      return true;
    }

    // Mounting a settings panel may restore existing subtitles, but must not start a generation task.
    if (options.generateIfMissing === false) {
      return false;
    }
    Message.info(t('未找到现成字幕，正在补生成...'));
    isGeneratingPreview.value = false;
    return await loadScriptLines();
  } catch (error: any) {
    console.error('[loadExistingSubtitleLines] failed:', error);
    Message.error(t('加载字幕失败：') + (error?.message || error));
    return false;
  } finally {
    isGeneratingPreview.value = false;
  }
};

const openSrtFolder = async () => {
  if (!currentSrtPath.value) {
    Message.warning(t('未找到字幕文件'));
    return;
  }

  try {
    await window.$mapi.file.showItemInFolder(currentSrtPath.value);
  } catch (error: any) {
    console.error('[openSrtFolder] 打开文件夹失败:', error);
    Message.error(t('打开文件夹失败：') + (error?.message || error));
  }
};

const loadRecordsFromStep2 = async () => {
  try {
    // 🆕 优先尝试从缓存加载
    const cachedRecords = localStorage.getItem('videoIPAgent_subtitleRecords');
    if (cachedRecords) {
      try {
        const parsed = JSON.parse(cachedRecords);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          availableRecords.value = parsed;
          console.log('[loadRecordsFromStep2] 从缓存加载了', availableRecords.value.length, '条字幕记录');
          Message.success(t('字幕数据加载成功（来自缓存）'));
          return true;
        }
      } catch (e) {
        console.warn('[loadRecordsFromStep2] 缓存数据解析失败:', e);
      }
    }

    // 如果缓存没有，尝试从任务记录加载
    const tasks = await TaskService.list('VideoGen', 1);
    const successTasks = tasks.filter(t => t.status === 'success');

    if (successTasks.length > 0) {
      const latestTask = successTasks.sort((a, b) =>
        (b.endTime || 0) - (a.endTime || 0)
      )[0];

      if (latestTask.result?.records) {
        availableRecords.value = latestTask.result.records;
        console.log('[loadRecordsFromStep2] 从任务记录加载了', availableRecords.value.length, '条字幕记录');
        Message.success(t('字幕数据加载成功'));
        return true;
      }
    }

    Message.warning(t('未找到字幕数据，请先点击"生成字幕预览"按钮'));
    return false;
  } catch (error) {
    console.error('[loadRecordsFromStep2] 加载失败:', error);
    Message.error(t('加载字幕数据失败'));
    return false;
  }
};

// 🆕 生成字幕预览（调用步骤5的字幕生成逻辑，但不渲染视频）
const generateSubtitlePreview = async () => {
  if (isGeneratingPreview.value) {
    Message.warning(t('正在生成中，请稍候...'));
    return;
  }

  try {
    isGeneratingPreview.value = true;
    Message.info(t('正在生成字幕预览...'));

    // 调用父组件的字幕预览生成函数
    const result = await (window as any).$videoIPAgent?.generateSubtitlePreview?.();

    if (result && result.success && result.records) {
      availableRecords.value = result.records;
      // 缓存到 localStorage
      localStorage.setItem('videoIPAgent_subtitleRecords', JSON.stringify(result.records));
      console.log('[generateSubtitlePreview] 生成了', availableRecords.value.length, '条字幕记录');
      Message.success(t('字幕预览生成成功'));
      return true;
    } else {
      Message.error(t('字幕预览生成失败：') + (result?.error || t('未知错误')));
      return false;
    }
  } catch (error: any) {
    console.error('[generateSubtitlePreview] 生成失败:', error);
    Message.error(t('字幕预览生成失败：') + (error?.message || error));
    return false;
  } finally {
    isGeneratingPreview.value = false;
  }
};

const toggleSubtitleSelection = (index: number) => {
  if (selectedSubtitleIndices.value.has(index)) {
    selectedSubtitleIndices.value.delete(index);
  } else {
    selectedSubtitleIndices.value.add(index);
  }
};

// 🆕 切换文案行选择
const selectedScriptLineIndices = ref<Set<number>>(new Set());
const toggleScriptLineSelection = (index: number) => {
  if (selectedScriptLineIndices.value.has(index)) {
    selectedScriptLineIndices.value.delete(index);
  } else {
    selectedScriptLineIndices.value.add(index);
  }
};

const selectSubtitleMaterial = async () => {
  try {
    const result = await window.$mapi.file.select({
      filters: [
        { name: t('媒体文件'), extensions: ['mp4', 'mov', 'avi', 'jpg', 'jpeg', 'png', 'gif'] }
      ]
    });

    if (result && result.length > 0) {
      currentMaterialPath.value = result[0];
      Message.success(t('素材已选择'));
    }
  } catch (error: any) {
    console.error('选择素材失败:', error);
    Message.error(t('选择素材失败：') + (error?.message || error));
  }
};

const addSubtitleMapping = () => {
  // 🆕 支持两种模式：基于文案行或基于ASR字幕
  const useScriptLines = scriptLines.value.length > 0;

  if (useScriptLines) {
    // 模式1：基于文案行
    if (selectedScriptLineIndices.value.size === 0) {
      Message.warning(t('请先选择文案行'));
      return;
    }

    if (!currentMaterialPath.value) {
      Message.warning(t('请先选择素材文件'));
      return;
    }

    const ext = currentMaterialPath.value.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '');

    // 保存选中的文案行索引
    subtitleConfig.mappings.push({
      subtitleIndices: Array.from(selectedScriptLineIndices.value).sort((a, b) => a - b),
      materialPath: currentMaterialPath.value,
      isImage,
      displayMode: currentDisplayMode.value,
      pipPosition: currentPipPosition.value,
      pipSizePercent: currentPipSizePercent.value,
      pipScaleMode: currentPipScaleMode.value,
      originalVideoMinimized: { ...currentOriginalVideoMinimized }
    });

    selectedScriptLineIndices.value.clear();
    currentMaterialPath.value = '';

    Message.success(t('映射已添加'));
  } else {
    // 模式2：基于ASR字幕（原有逻辑）
    if (selectedSubtitleIndices.value.size === 0) {
      Message.warning(t('请先选择字幕'));
      return;
    }

    if (!currentMaterialPath.value) {
      Message.warning(t('请先选择素材文件'));
      return;
    }

    const ext = currentMaterialPath.value.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '');

    subtitleConfig.mappings.push({
      subtitleIndices: Array.from(selectedSubtitleIndices.value).sort((a, b) => a - b),
      materialPath: currentMaterialPath.value,
      isImage,
      displayMode: currentDisplayMode.value,
      pipPosition: currentPipPosition.value,
      pipSizePercent: currentPipSizePercent.value,
      pipScaleMode: currentPipScaleMode.value,
      originalVideoMinimized: { ...currentOriginalVideoMinimized }
    });

    selectedSubtitleIndices.value.clear();
    currentMaterialPath.value = '';

    Message.success(t('映射已添加'));
  }
};

const removeSubtitleMapping = (index: number) => {
  subtitleConfig.mappings.splice(index, 1);
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
};

// 🆕 获取文案行对应的时间范围
// 🔧 修复：使用映射获取时间范围，而不是文本匹配
const getTimeRangeForLine = (lineIndex: number): string => {
  const recordIndices = scriptLineToRecordsMap.value.get(lineIndex);

  console.log(`[getTimeRangeForLine] 获取第${lineIndex}行的时间范围`);
  console.log(`[getTimeRangeForLine] recordIndices:`, recordIndices);
  console.log(`[getTimeRangeForLine] availableRecords.value.length:`, availableRecords.value?.length);

  if (!recordIndices || recordIndices.length === 0 || !availableRecords.value) {
    console.warn(`[getTimeRangeForLine] 第${lineIndex}行无法获取时间：recordIndices=${recordIndices}, availableRecords=${!!availableRecords.value}`);
    return '';
  }

  // 获取第一个和最后一个 record 的时间
  const firstRecord = availableRecords.value[recordIndices[0]];
  const lastRecord = availableRecords.value[recordIndices[recordIndices.length - 1]];

  console.log(`[getTimeRangeForLine] firstRecord:`, firstRecord);
  console.log(`[getTimeRangeForLine] lastRecord:`, lastRecord);

  if (!firstRecord || !lastRecord) {
    console.warn(`[getTimeRangeForLine] 第${lineIndex}行的 record 不存在`);
    return '';
  }

  // 🔧 修复：检查时间字段的不同可能性（start/startTime, end/endTime）
  const startTime = (firstRecord.start ?? firstRecord.startTime ?? 0) / 1000;  // 毫秒→秒
  const endTime = (lastRecord.end ?? lastRecord.endTime ?? 0) / 1000;

  console.log(`[getTimeRangeForLine] startTime: ${startTime}, endTime: ${endTime}`);

  if (isNaN(startTime) || isNaN(endTime)) {
    console.error(`[getTimeRangeForLine] 时间数据异常: startTime=${startTime}, endTime=${endTime}`);
    console.error(`[getTimeRangeForLine] firstRecord完整数据:`, JSON.stringify(firstRecord));
    console.error(`[getTimeRangeForLine] lastRecord完整数据:`, JSON.stringify(lastRecord));
    return '';
  }

  const result = `${formatTime(startTime)} - ${formatTime(endTime)}`;
  console.log(`[getTimeRangeForLine] 第${lineIndex}行时间范围: ${result}`);
  return result;
};

// 🆕 获取某行已配置的素材路径
const getMaterialForLine = (lineIndex: number): string => {
  const mapping = subtitleConfig.mappings.find(m =>
    m.subtitleIndices.length === 1 && m.subtitleIndices[0] === lineIndex
  );
  return mapping ? mapping.materialPath : '';
};

// 🆕 为某行选择素材
const selectMaterialForLine = async (lineIndex: number) => {
  console.log('[selectMaterialForLine] ========== 开始执行 ==========');
  console.log('[selectMaterialForLine] lineIndex:', lineIndex);
  try {
    // 🔧 修复：使用正确的文件选择 API
    if (!window.$mapi || !window.$mapi.file) {
      console.error('[selectMaterialForLine] window.$mapi.file 不可用');
      Message.error(t('文件API不可用'));
      return;
    }

    const materialPath = await window.$mapi.file.openFile({
      title: t('选择素材文件'),
      filters: [
        {
          name: t('媒体文件'),
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
        }
      ]
    });

    console.log('[selectMaterialForLine] 用户选择的素材路径:', materialPath);

    if (!materialPath) {
      console.warn('[selectMaterialForLine] 用户取消了选择');
      return;
    }

    // 判断是否为图片
    const ext = materialPath.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '');

    // 获取该行对应的 record 索引
    const recordIndices = scriptLineToRecordsMap.value.get(lineIndex);
    if (!recordIndices || recordIndices.length === 0) {
      Message.error(t('无法获取该行的时间信息'));
      return;
    }

    // 检查是否已有该行的映射
    const existingIndex = subtitleConfig.mappings.findIndex(m =>
      m.subtitleIndices.length === recordIndices.length &&
      m.subtitleIndices.every((idx, i) => idx === recordIndices[i])
    );

    // 🔍 调试日志 - 在创建 mapping 之前
    console.log('[selectMaterialForLine] 当前显示模式:', currentDisplayMode.value);
    console.log('[selectMaterialForLine] currentOriginalVideoMinimized (原始):', currentOriginalVideoMinimized);
    console.log('[selectMaterialForLine] currentOriginalVideoMinimized.enabled:', currentOriginalVideoMinimized.enabled);

    // 🔧 修复：使用 toRaw 获取原始对象，避免 reactive 代理问题
    const originalVideoMinimizedConfig = currentDisplayMode.value === 'fullscreen'
      ? {
          enabled: currentOriginalVideoMinimized.enabled,
          shape: currentOriginalVideoMinimized.shape,
          position: currentOriginalVideoMinimized.position,
          sizePercent: currentOriginalVideoMinimized.sizePercent
        }
      : undefined;

    console.log('[selectMaterialForLine] originalVideoMinimizedConfig (处理后):', originalVideoMinimizedConfig);

    const newMapping = {
      subtitleIndices: recordIndices,
      materialPath,
      isImage,
      displayMode: currentDisplayMode.value,
      pipPosition: currentPipPosition.value,
      pipSizePercent: currentPipSizePercent.value,
      pipScaleMode: currentPipScaleMode.value,
      originalVideoMinimized: originalVideoMinimizedConfig
    };

    console.log('[selectMaterialForLine] 新映射配置:', newMapping);

    if (existingIndex >= 0) {
      // 更新现有映射
      subtitleConfig.mappings[existingIndex] = newMapping;
      Message.success(t('素材已更新'));
    } else {
      // 添加新映射
      subtitleConfig.mappings.push(newMapping);
      Message.success(t('素材已添加'));
    }
  } catch (error: any) {
    console.error('[selectMaterialForLine] 选择素材失败:', error);
    Message.error(t('选择素材失败：') + (error?.message || error));
  }
};

// 🆕 删除某行的素材
const removeMaterialForLine = (lineIndex: number) => {
  const index = subtitleConfig.mappings.findIndex(m =>
    m.subtitleIndices.length === 1 && m.subtitleIndices[0] === lineIndex
  );

  if (index >= 0) {
    subtitleConfig.mappings.splice(index, 1);
    Message.success(t('素材已删除'));
  }
};

const getMaterialForLineDisplay = (lineIndex: number): string => {
  const mapping = subtitleConfig.mappings.find(m => m.subtitleIndices.includes(lineIndex));
  return mapping ? mapping.materialPath : '';
};

const getTargetSubtitleIndices = (lineIndex: number) => {
  const selectedIndices = Array.from(selectedSubtitleIndices.value).sort((a, b) => a - b);
  if (selectedIndices.length > 1 && selectedIndices.includes(lineIndex)) {
    return selectedIndices;
  }
  return [lineIndex];
};

const upsertMaterialMapping = (subtitleIndices: number[], materialPath: string) => {
  const ext = materialPath.split('.').pop()?.toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '');
  const originalVideoMinimizedConfig = currentDisplayMode.value === 'fullscreen'
    ? {
        enabled: currentOriginalVideoMinimized.enabled,
        shape: currentOriginalVideoMinimized.shape,
        position: currentOriginalVideoMinimized.position,
        sizePercent: currentOriginalVideoMinimized.sizePercent
      }
    : undefined;

  subtitleConfig.mappings = subtitleConfig.mappings.filter(mapping =>
    !subtitleIndices.some(index => mapping.subtitleIndices.includes(index))
  );

  subtitleConfig.mappings.push({
    subtitleIndices,
    materialPath,
    isImage,
    displayMode: currentDisplayMode.value,
    pipPosition: currentPipPosition.value,
    pipSizePercent: currentPipSizePercent.value,
    pipScaleMode: currentPipScaleMode.value,
    originalVideoMinimized: originalVideoMinimizedConfig
  });

  Message.success(
    subtitleIndices.length > 1
      ? t('已为选中的多条字幕绑定同一个素材')
      : t('素材已添加')
  );
};

const openMaterialLibraryForLine = async (lineIndex: number) => {
  return await openMaterialLibrary({ lineIndex });
  specifiedMaterialTarget.value = null;
  materialLibraryTargetLineIndex.value = lineIndex;
  materialLibraryVisible.value = true;
  materialLibraryLoading.value = true;
  try {
    materialLibraryRecords.value = await VideoMaterialService.list();
  } catch (error: any) {
    console.error('[openMaterialLibraryForLine] 加载素材库失败:', error);
    Message.error(t('加载素材库失败：') + (error?.message || error));
  } finally {
    materialLibraryLoading.value = false;
  }
};

const useLibraryMaterial = (record: VideoMaterialRecord) => {
  if (specifiedMaterialTarget.value) {
    const { target, groupId } = specifiedMaterialTarget.value;
    if (target in fixedConfig) {
      (fixedConfig as any)[target].specifiedMaterialPath = record.path;
      Message.success(t('素材已选择'));
    } else if (groupId) {
      const groupConfig = keywordConfig.groups.find(g => g.groupId === groupId);
      if (groupConfig) {
        groupConfig.specifiedMaterialPath = record.path;
        Message.success(t('素材已选择'));
      }
    }
    specifiedMaterialTarget.value = null;
    materialLibraryTargetLineIndex.value = null;
    materialLibraryVisible.value = false;
    return;
  }

  if (materialLibraryTargetLineIndex.value === null) {
    return;
  }
  const targetIndices = getTargetSubtitleIndices(materialLibraryTargetLineIndex.value);
  upsertMaterialMapping(targetIndices, record.path);
  materialLibraryTargetLineIndex.value = null;
  materialLibraryVisible.value = false;
};

const selectLocalMaterialForLine = async (lineIndex: number) => {
  try {
    const materialPath = await window.$mapi.file.openFile({
      title: t('选择素材文件'),
      filters: [
        {
          name: t('媒体文件'),
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
        }
      ]
    });

    if (!materialPath || Array.isArray(materialPath)) {
      return;
    }

    const targetIndices = getTargetSubtitleIndices(lineIndex);
    upsertMaterialMapping(targetIndices, materialPath);
  } catch (error: any) {
    console.error('[selectLocalMaterialForLine] 选择素材失败:', error);
    Message.error(t('选择素材失败：') + (error?.message || error));
  }
};

const removeMaterialAssignmentForLine = (lineIndex: number) => {
  const index = subtitleConfig.mappings.findIndex(m => m.subtitleIndices.includes(lineIndex));
  if (index >= 0) {
    subtitleConfig.mappings.splice(index, 1);
    selectedSubtitleIndices.value.delete(lineIndex);
    Message.success(t('素材已删除'));
  }
};

const clearSelectedSubtitleLines = () => {
  selectedSubtitleIndices.value.clear();
};

watch(currentMode, async (mode) => {
  if (mode === 'subtitle' && scriptLines.value.length === 0) {
    await loadExistingSubtitleLines();
  }
});

watch(materialLibraryVisible, (visible) => {
  if (!visible) {
    materialLibraryLoading.value = false;
    materialLibraryTargetLineIndex.value = null;
    specifiedMaterialTarget.value = null;
  }
});

const saveConfig = async () => {
  try {
    // 🆕 保存前先自动应用全局设置到所有素材
    applyGlobalSettings();

    // 将reactive对象转换为普通对象，避免IPC克隆失败
    const keywordConfigForSave = JSON.parse(JSON.stringify(toRaw(keywordConfig)));
    const fixedConfigForSave = JSON.parse(JSON.stringify(toRaw(fixedConfig)));

    // 🔧 根据模式自动设置 enabled 字段
    keywordConfigForSave.enabled = (currentMode.value === 'keyword');
    fixedConfigForSave.enabled = (currentMode.value === 'fixed');

    const subtitleConfigForSave = JSON.parse(JSON.stringify(toRaw(subtitleConfig)));
    subtitleConfigForSave.enabled = (currentMode.value === 'subtitle');

    const config: VideoMixCutConfig = {
      enabled: mixCutEnabled.value,
      mode: currentMode.value,
      fixedModeConfig: fixedConfigForSave,
      keywordModeConfig: keywordConfigForSave,
      subtitleModeConfig: subtitleConfigForSave
    };

    console.log('[SettingMixCut] 正在保存配置:', {
      enabled: config.enabled,
      mode: config.mode,
      fixedModeEnabled: config.fixedModeConfig.enabled,
      keywordModeEnabled: config.keywordModeConfig.enabled,
      keywordGroupCount: config.keywordModeConfig.groups.length,
      enabledGroupCount: config.keywordModeConfig.groups.filter(g => g.enabled).length
    });

    // 🔍 调试：打印固定模式的 selectionMode 配置（关键！）
    console.log('[SettingMixCut] 固定模式 selectionMode 配置:', {
      opening: {
        enabled: fixedConfigForSave.opening.enabled,
        selectionMode: fixedConfigForSave.opening.selectionMode,
        materialFolder: fixedConfigForSave.opening.materialFolderPath ? '已设置' : '未设置'
      },
      middle: {
        enabled: fixedConfigForSave.middle.enabled,
        selectionMode: fixedConfigForSave.middle.selectionMode,
        materialFolder: fixedConfigForSave.middle.materialFolderPath ? '已设置' : '未设置'
      },
      ending: {
        enabled: fixedConfigForSave.ending.enabled,
        selectionMode: fixedConfigForSave.ending.selectionMode,
        materialFolder: fixedConfigForSave.ending.materialFolderPath ? '已设置' : '未设置'
      }
    });

    await window.$mapi.config.set('videoMixCutSettings', config);

    // 验证保存
    const savedConfig = await window.$mapi.config.get('videoMixCutSettings');
    console.log('[SettingMixCut] ✅ 配置保存成功，验证结果:', {
      enabled: savedConfig?.enabled,
      mode: savedConfig?.mode,
      keywordModeEnabled: savedConfig?.keywordModeConfig?.enabled,
      keywordGroupCount: savedConfig?.keywordModeConfig?.groups?.length
    });

    Message.success(t('混剪配置保存成功！'));
  } catch (error) {
    console.error('[SettingMixCut] ❌ 保存失败:', error);
    Message.error(t('保存配置失败：') + (error?.message || error));
  }
};

// 暴露save方法给父组件调用
const save = () => saveConfig();

// 使用defineExpose暴露方法给父组件
defineExpose({ save });

onMounted(async () => {
  try {
    const config = await window.$mapi.config.get('videoMixCutSettings');
    if (config) {
      mixCutEnabled.value = config.enabled || false;
      currentMode.value = config.mode || 'subtitle';

      // 🔧 修复：使用深拷贝来正确加载嵌套对象
      const deepAssign = (target: any, source: any) => {
        if (!source) return;

        Object.keys(source).forEach(key => {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) {
              target[key] = {};
            }
            deepAssign(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        });
      };

      deepAssign(fixedConfig, config.fixedModeConfig);
      deepAssign(keywordConfig, config.keywordModeConfig);
      if (config.subtitleModeConfig) {
        deepAssign(subtitleConfig, config.subtitleModeConfig);
      }

      // 🆕 补全缺失的 originalVideoMinimized 字段
      const defaultMinimized = {
        enabled: false,
        shape: 'square' as OriginalVideoShape,
        position: 'bottom-right' as OriginalVideoPosition,
        sizePercent: 25
      };

      if (!fixedConfig.opening.originalVideoMinimized) {
        fixedConfig.opening.originalVideoMinimized = { ...defaultMinimized };
      }
      if (!fixedConfig.middle.originalVideoMinimized) {
        fixedConfig.middle.originalVideoMinimized = { ...defaultMinimized };
      }
      if (!fixedConfig.ending.originalVideoMinimized) {
        fixedConfig.ending.originalVideoMinimized = { ...defaultMinimized };
      }

      // 🆕 补全缺失的 selectionMode 字段（关键修复！）
      if (!fixedConfig.opening.selectionMode) {
        fixedConfig.opening.selectionMode = 'random';
        console.log('[SettingMixCut] 片头未设置selectionMode，默认为 random');
      }
      if (!fixedConfig.middle.selectionMode) {
        fixedConfig.middle.selectionMode = 'random';
        console.log('[SettingMixCut] 片中未设置selectionMode，默认为 random');
      }
      if (!fixedConfig.ending.selectionMode) {
        fixedConfig.ending.selectionMode = 'random';
        console.log('[SettingMixCut] 片尾未设置selectionMode，默认为 random');
      }

      // 🔍 调试：打印完整的固定模式配置
      console.log('[SettingMixCut] 加载的固定模式配置:', {
        opening: {
          enabled: fixedConfig.opening.enabled,
          selectionMode: fixedConfig.opening.selectionMode,
          displayMode: fixedConfig.opening.displayMode,
          pipPosition: fixedConfig.opening.pipPosition,
          pipSizePercent: fixedConfig.opening.pipSizePercent,
          originalVideoMinimized: fixedConfig.opening.originalVideoMinimized,
          materialFolderPath: fixedConfig.opening.materialFolderPath
        },
        middle: {
          enabled: fixedConfig.middle.enabled,
          selectionMode: fixedConfig.middle.selectionMode,
          displayMode: fixedConfig.middle.displayMode,
          pipPosition: fixedConfig.middle.pipPosition,
          pipSizePercent: fixedConfig.middle.pipSizePercent,
          originalVideoMinimized: fixedConfig.middle.originalVideoMinimized,
          materialFolderPath: fixedConfig.middle.materialFolderPath
        },
        ending: {
          enabled: fixedConfig.ending.enabled,
          selectionMode: fixedConfig.ending.selectionMode,
          displayMode: fixedConfig.ending.displayMode,
          pipPosition: fixedConfig.ending.pipPosition,
          pipSizePercent: fixedConfig.ending.pipSizePercent,
          originalVideoMinimized: fixedConfig.ending.originalVideoMinimized,
          materialFolderPath: fixedConfig.ending.materialFolderPath
        }
      });
    }

    // 🔧 新增：同步关键词分组
    if (currentMode.value === 'subtitle') {
      await loadExistingSubtitleLines({ generateIfMissing: false });
    }
    await syncKeywordGroups();
  } catch (error) {
    console.warn('加载混剪配置失败:', error);
  }
});
</script>

<template>
  <div class="mixcut-setting-panel space-y-6">
    <div>
      <a-checkbox v-model="mixCutEnabled">
        <span class="font-medium text-gray-900">{{ t('启用画中画混剪') }}</span>
      </a-checkbox>
      <p class="text-xs text-gray-500 ml-6 mt-1">
        {{ t('勾选后，点击自动处理时将应用混剪效果') }}
      </p>
    </div>

    <a-divider />

    <div>
      <label class="block mb-2 text-sm font-medium text-gray-900">{{ t('混剪模式') }}</label>
      <a-radio-group v-model="currentMode">
        <a-radio value="subtitle"><span class="text-gray-900">{{ t('字幕模式') }}</span></a-radio>
        <a-radio value="fixed"><span class="text-gray-900">{{ t('固定模式') }}</span></a-radio>
        <a-radio value="keyword"><span class="text-gray-900">{{ t('关键词模式') }}</span></a-radio>
      </a-radio-group>
    </div>

    <a-divider />

    <!-- 🆕 全局显示模式设置（应用到所有素材） -->
    <div class="global-display-panel bg-blue-50 border border-blue-200 rounded-lg p-4" :class="{ 'is-dark-panel': isDarkTheme }" :style="globalDisplayPanelInlineStyle">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-blue-900" :style="globalDisplayTitleInlineStyle">{{ t('全局显示模式（应用到所有素材）') }}</h3>
        <a-button type="primary" size="small" @click="applyGlobalSettings">
          {{ t('应用到所有素材') }}
        </a-button>
      </div>

      <div class="space-y-3">
        <!-- 显示模式 -->
        <div>
          <label class="block mb-1 text-xs font-medium text-gray-700" :style="globalDisplayLabelInlineStyle">{{ t('显示模式') }}</label>
          <a-radio-group v-model="globalDisplaySettings.displayMode" size="small">
            <a-radio value="fullscreen"><span :style="globalDisplayLabelInlineStyle">{{ t('全屏替换') }}</span></a-radio>
            <a-radio value="pip"><span :style="globalDisplayLabelInlineStyle">{{ t('画中画') }}</span></a-radio>
          </a-radio-group>
        </div>

        <!-- 原视频最小化（仅全屏替换模式） -->
        <div v-if="globalDisplaySettings.displayMode === 'fullscreen'" class="ml-4 space-y-2 border-l-2 border-blue-300 pl-3" :style="globalDisplaySubPanelInlineStyle">
          <div>
            <a-checkbox v-model="globalDisplaySettings.originalVideoMinimized.enabled">
              <span class="text-xs text-gray-700" :style="globalDisplayLabelInlineStyle">{{ t('原视频最小化') }}</span>
            </a-checkbox>
          </div>

          <div v-if="globalDisplaySettings.originalVideoMinimized.enabled" class="ml-5 space-y-2">
            <div>
              <label class="block mb-1 text-xs text-gray-600" :style="globalDisplayMutedInlineStyle">{{ t('形状') }}</label>
              <a-radio-group v-model="globalDisplaySettings.originalVideoMinimized.shape" size="small">
                <a-radio value="square"><span :style="globalDisplayLabelInlineStyle">{{ t('方形') }}</span></a-radio>
                <a-radio value="circle"><span :style="globalDisplayLabelInlineStyle">{{ t('圆形') }}</span></a-radio>
              </a-radio-group>
            </div>

            <div>
              <label class="block mb-1 text-xs text-gray-600" :style="globalDisplayMutedInlineStyle">{{ t('位置') }}</label>
              <a-select v-model="globalDisplaySettings.originalVideoMinimized.position" size="small" style="width: 100%">
                <a-option value="top-left">{{ t('左上角') }}</a-option>
                <a-option value="top-right">{{ t('右上角') }}</a-option>
                <a-option value="bottom-left">{{ t('左下角') }}</a-option>
                <a-option value="bottom-right">{{ t('右下角') }}</a-option>
                <a-option value="center">{{ t('正中间') }}</a-option>
              </a-select>
            </div>

            <div>
              <label class="block mb-1 text-xs text-gray-600" :style="globalDisplayMutedInlineStyle">{{ t('尺寸占比') }}</label>
              <div class="flex items-center gap-2">
                <a-slider
                    v-model="globalDisplaySettings.originalVideoMinimized.sizePercent"
                    :min="10"
                    :max="50"
                    :step="5"
                    style="flex: 1"
                />
                <span class="text-xs text-gray-600 w-12" :style="globalDisplayMutedInlineStyle">{{ globalDisplaySettings.originalVideoMinimized.sizePercent }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 画中画配置（仅画中画模式） -->
        <div v-if="globalDisplaySettings.displayMode === 'pip'" class="ml-4 space-y-2 border-l-2 border-blue-300 pl-3" :style="globalDisplaySubPanelInlineStyle">
          <div>
            <label class="block mb-1 text-xs text-gray-600" :style="globalDisplayMutedInlineStyle">{{ t('位置') }}</label>
            <a-select v-model="globalDisplaySettings.pipPosition" size="small" style="width: 100%">
              <a-option value="top-left">{{ t('左上角') }}</a-option>
              <a-option value="top-center">{{ t('顶部居中') }}</a-option>
              <a-option value="top-right">{{ t('右上角') }}</a-option>
              <a-option value="center-left">{{ t('左侧居中') }}</a-option>
              <a-option value="center">{{ t('正中间') }}</a-option>
              <a-option value="center-right">{{ t('右侧居中') }}</a-option>
              <a-option value="bottom-left">{{ t('左下角') }}</a-option>
              <a-option value="bottom-center">{{ t('底部居中') }}</a-option>
              <a-option value="bottom-right">{{ t('右下角') }}</a-option>
            </a-select>
          </div>

          <div>
            <label class="block mb-1 text-xs text-gray-600" :style="globalDisplayMutedInlineStyle">{{ t('尺寸占比') }}</label>
            <div class="flex items-center gap-2">
              <a-slider v-model="globalDisplaySettings.pipSizePercent" :min="10" :max="80" :step="5" style="flex: 1" />
              <span class="text-xs text-gray-600 w-12" :style="globalDisplayMutedInlineStyle">{{ globalDisplaySettings.pipSizePercent }}%</span>
            </div>
          </div>

          <div>
            <label class="block mb-1 text-xs text-gray-600" :style="globalDisplayMutedInlineStyle">{{ t('缩放模式') }}</label>
            <a-select v-model="globalDisplaySettings.pipScaleMode" size="small" style="width: 100%">
              <a-option value="fit">{{ t('保持比例+黑边') }}</a-option>
              <a-option value="fill">{{ t('保持比例+裁剪') }}</a-option>
              <a-option value="stretch">{{ t('强制拉伸') }}</a-option>
            </a-select>
          </div>
        </div>
      </div>

      <p class="text-xs text-gray-500 mt-3" :style="globalDisplayMutedInlineStyle">
        {{ t('💡 提示：修改上述设置后，点击"应用到所有素材"按钮，将统一应用到固定模式、关键词模式和字幕模式的所有素材配置') }}
      </p>
    </div>

    <a-divider />

    <!-- 🔧 删除全局显示模式选择 - 改为在片头、片中、片尾各自设置 -->

    <!-- 固定模式 -->
    <div v-if="currentMode === 'fixed'" class="space-y-4">
      <div class="text-sm font-medium text-gray-900">{{ t('固定模式配置') }}</div>

      <!-- 片头 -->
      <div class="border rounded-lg p-4 space-y-3">
        <div class="flex items-center gap-2">
          <a-checkbox v-model="fixedConfig.opening.enabled" />
          <span class="font-medium text-gray-900">{{ t('片头替换') }}</span>
        </div>
        <div v-if="fixedConfig.opening.enabled" class="ml-6 space-y-3">
          <div>
            <label class="block mb-1 text-xs">{{ t('播放时间范围（秒）') }}</label>
            <div class="flex gap-2 items-center">
              <a-input-number v-model="fixedConfig.opening.timeRange.durationMin" :min="0" :max="60" :step="0.5" size="small" style="width: 80px" />
              <span class="text-xs">到</span>
              <a-input-number v-model="fixedConfig.opening.timeRange.durationMax" :min="0.5" :max="60" :step="0.5" size="small" style="width: 80px" />
              <span class="text-xs">秒</span>
            </div>
          </div>
          <div>
            <label class="block mb-1 text-xs">{{ t('素材文件夹') }}</label>
            <div class="flex gap-2">
              <a-input v-model="fixedConfig.opening.materialFolderPath" readonly size="small" class="flex-1" />
              <a-button @click="selectMaterialFolder('opening')" size="small">{{ t('选择') }}</a-button>
            </div>
          </div>
          <!-- 🔧 素材选择模式 -->
          <div>
            <label class="block mb-1 text-xs">{{ t('素材选择模式') }}</label>
            <a-radio-group v-model="fixedConfig.opening.selectionMode" size="small">
              <a-radio value="random">{{ t('随机') }}</a-radio>
              <a-radio value="sequential">{{ t('顺序') }}</a-radio>
              <a-radio value="specified">{{ t('指定素材') }}</a-radio>
            </a-radio-group>
          </div>
          <!-- 🆕 指定素材文件选择 -->
          <div v-if="fixedConfig.opening.selectionMode === 'specified'">
            <label class="block mb-1 text-xs">{{ t('素材库素材') }}</label>
            <div class="flex gap-2">
              <a-input v-model="fixedConfig.opening.specifiedMaterialPath" readonly size="small" class="flex-1" :placeholder="t('请选择素材库素材')" />
              <a-button @click="selectSpecifiedMaterial('opening')" size="small">{{ t('素材库选择') }}</a-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 片中 -->
      <div class="border rounded-lg p-4 space-y-3">
        <div class="flex items-center gap-2">
          <a-checkbox v-model="fixedConfig.middle.enabled" />
          <span class="font-medium text-gray-900">{{ t('片中替换') }}</span>
        </div>
        <div v-if="fixedConfig.middle.enabled" class="ml-6 space-y-3">
          <div>
            <label class="block mb-1 text-xs">{{ t('播放时间范围（秒）') }}</label>
            <div class="flex gap-2 items-center">
              <a-input-number v-model="fixedConfig.middle.timeRange.durationMin" :min="0" :max="60" :step="0.5" size="small" style="width: 80px" />
              <span class="text-xs">到</span>
              <a-input-number v-model="fixedConfig.middle.timeRange.durationMax" :min="0.5" :max="60" :step="0.5" size="small" style="width: 80px" />
              <span class="text-xs">秒</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">{{ t('相对于视频中点。如设置2-5，在60秒视频中播放位置为32-35秒') }}</p>
          </div>
          <div>
            <label class="block mb-1 text-xs">{{ t('素材文件夹') }}</label>
            <div class="flex gap-2">
              <a-input v-model="fixedConfig.middle.materialFolderPath" readonly size="small" class="flex-1" />
              <a-button @click="selectMaterialFolder('middle')" size="small">{{ t('选择') }}</a-button>
            </div>
          </div>
          <!-- 🔧 素材选择模式 -->
          <div>
            <label class="block mb-1 text-xs">{{ t('素材选择模式') }}</label>
            <a-radio-group v-model="fixedConfig.middle.selectionMode" size="small">
              <a-radio value="random">{{ t('随机') }}</a-radio>
              <a-radio value="sequential">{{ t('顺序') }}</a-radio>
              <a-radio value="specified">{{ t('指定素材') }}</a-radio>
            </a-radio-group>
          </div>
          <!-- 🆕 指定素材文件选择 -->
          <div v-if="fixedConfig.middle.selectionMode === 'specified'">
            <label class="block mb-1 text-xs">{{ t('素材库素材') }}</label>
            <div class="flex gap-2">
              <a-input v-model="fixedConfig.middle.specifiedMaterialPath" readonly size="small" class="flex-1" :placeholder="t('请选择素材库素材')" />
              <a-button @click="selectSpecifiedMaterial('middle')" size="small">{{ t('素材库选择') }}</a-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 片尾 -->
      <div class="border rounded-lg p-4 space-y-3">
        <div class="flex items-center gap-2">
          <a-checkbox v-model="fixedConfig.ending.enabled" />
          <span class="font-medium text-gray-900">{{ t('片尾替换') }}</span>
        </div>
        <div v-if="fixedConfig.ending.enabled" class="ml-6 space-y-3">
          <div>
            <label class="block mb-1 text-xs">{{ t('播放时间范围（秒）') }}</label>
            <div class="flex gap-2 items-center">
              <a-input-number v-model="fixedConfig.ending.timeRange.durationMin" :min="0" :max="60" :step="0.5" size="small" style="width: 80px" />
              <span class="text-xs">到</span>
              <a-input-number v-model="fixedConfig.ending.timeRange.durationMax" :min="0.5" :max="60" :step="0.5" size="small" style="width: 80px" />
              <span class="text-xs">秒</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">{{ t('从视频结尾倒数。如设置2-5，在60秒视频中播放位置为57-60秒') }}</p>
          </div>
          <div>
            <label class="block mb-1 text-xs">{{ t('素材文件夹') }}</label>
            <div class="flex gap-2">
              <a-input v-model="fixedConfig.ending.materialFolderPath" readonly size="small" class="flex-1" />
              <a-button @click="selectMaterialFolder('ending')" size="small">{{ t('选择') }}</a-button>
            </div>
          </div>
          <!-- 🔧 素材选择模式 -->
          <div>
            <label class="block mb-1 text-xs">{{ t('素材选择模式') }}</label>
            <a-radio-group v-model="fixedConfig.ending.selectionMode" size="small">
              <a-radio value="random">{{ t('随机') }}</a-radio>
              <a-radio value="sequential">{{ t('顺序') }}</a-radio>
              <a-radio value="specified">{{ t('指定素材') }}</a-radio>
            </a-radio-group>
          </div>
          <!-- 🆕 指定素材文件选择 -->
          <div v-if="fixedConfig.ending.selectionMode === 'specified'">
            <label class="block mb-1 text-xs">{{ t('素材库素材') }}</label>
            <div class="flex gap-2">
              <a-input v-model="fixedConfig.ending.specifiedMaterialPath" readonly size="small" class="flex-1" :placeholder="t('请选择素材库素材')" />
              <a-button @click="selectSpecifiedMaterial('ending')" size="small">{{ t('素材库选择') }}</a-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 关键词模式 -->
    <div v-if="currentMode === 'keyword'" class="space-y-4">
      <div class="text-sm font-medium text-gray-900">{{ t('关键词模式配置') }}</div>
      <p class="text-xs text-gray-500 mb-3">
        {{ t('分组列表自动从【字幕设置】同步，新增/删除分组请前往字幕设置') }}
      </p>

      <!-- 关键词分组列表 -->
      <div v-if="keywordConfig.groups.length === 0" class="text-xs text-gray-400 text-center py-8">
        {{ t('暂无关键词分组，请前往字幕设置创建分组') }}
      </div>

      <!-- 每个分组的配置卡片 -->
      <div v-for="groupConfig in keywordConfig.groups" :key="groupConfig.groupId" class="border rounded-lg p-4 space-y-3">
        <div class="flex items-center gap-2">
          <a-checkbox v-model="groupConfig.enabled" />
          <span class="font-medium">{{ groupConfig.groupName }}</span>
          <span v-if="!groupConfig.enabled" class="text-xs text-gray-400 ml-2">{{ t('（未启用）') }}</span>
        </div>

        <div v-if="groupConfig.enabled" class="ml-6 space-y-3">
          <!-- 素材文件夹 -->
          <div>
            <label class="block mb-1 text-xs">{{ t('素材文件夹') }}</label>
            <div class="flex gap-2">
              <a-input v-model="groupConfig.materialFolderPath" readonly size="small" class="flex-1" :placeholder="t('请选择素材文件夹')" />
              <a-button @click="selectMaterialFolder('keyword', groupConfig.groupId)" size="small">{{ t('选择') }}</a-button>
            </div>
          </div>

          <!-- 播放时长范围 -->
          <div>
            <label class="block mb-1 text-xs">{{ t('播放时长范围（秒）') }}</label>
            <div class="flex gap-2 items-center">
              <a-input-number v-model="groupConfig.durationMin" :min="0" :max="60" :step="0.5" size="small" style="width: 80px" />
              <span class="text-xs">到</span>
              <a-input-number v-model="groupConfig.durationMax" :min="0.5" :max="60" :step="0.5" size="small" style="width: 80px" />
              <span class="text-xs">秒</span>
            </div>
          </div>

          <!-- 素材选择模式 -->
          <div>
            <label class="block mb-1 text-xs">{{ t('素材选择模式') }}</label>
            <a-radio-group v-model="groupConfig.selectionMode" size="small">
              <a-radio value="random">{{ t('随机') }}</a-radio>
              <a-radio value="sequential">{{ t('顺序') }}</a-radio>
              <a-radio value="specified">{{ t('指定素材') }}</a-radio>
            </a-radio-group>
          </div>
          <!-- 🆕 指定素材文件选择 -->
          <div v-if="groupConfig.selectionMode === 'specified'">
            <label class="block mb-1 text-xs">{{ t('素材库素材') }}</label>
            <div class="flex gap-2">
              <a-input v-model="groupConfig.specifiedMaterialPath" readonly size="small" class="flex-1" :placeholder="t('请选择素材库素材')" />
              <a-button @click="selectSpecifiedMaterial('keyword', groupConfig.groupId)" size="small">{{ t('素材库选择') }}</a-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 字幕模式 -->
    <div v-if="currentMode === 'subtitle'" class="space-y-4">
      <div class="text-sm font-medium text-gray-900">{{ t('字幕模式配置') }}</div>
      <p class="text-xs text-gray-500 mb-3">
        {{ t('为每一行字幕（或多行字幕）指定插入的素材文件') }}
      </p>

      <!-- 加载字幕按钮 - 简化为单个按钮 -->
      <div class="flex gap-2 items-center flex-wrap">
        <a-button @click="() => loadExistingSubtitleLines()" size="small" type="primary" :loading="isGeneratingPreview">
          {{ t('加载已识别字幕') }}
        </a-button>
        <span v-if="scriptLines.length > 0" class="text-xs text-gray-500">
          {{ t('已加载') }} {{ scriptLines.length }} {{ t('行文案') }}
        </span>
        <a-button
          v-if="selectedSubtitleIndices.size > 0"
          @click="openMaterialLibraryForLine(Array.from(selectedSubtitleIndices)[0])"
          size="small"
          type="outline"
        >
          {{ t('给选中字幕选素材') }}
        </a-button>
        <a-button
          v-if="selectedSubtitleIndices.size > 0"
          @click="clearSelectedSubtitleLines"
          size="small"
          type="outline"
        >
          {{ t('清空勾选') }}
        </a-button>
        <span v-if="selectedSubtitleIndices.size > 0" class="text-xs text-blue-600">
          {{ t('已选字幕') }} {{ selectedSubtitleIndices.size }} {{ t('条') }}
        </span>
        <a-button v-if="currentSrtPath" @click="openSrtFolder" size="small" type="outline">
          {{ t('打开字幕文件') }}
        </a-button>
      </div>
      <p v-if="currentSrtPath" class="text-xs text-gray-500 mt-1">
        {{ t('字幕文件：') }}{{ currentSrtPath }}
      </p>
      <p class="text-xs text-gray-400 mt-1">
        {{ t('优先复用已生成字幕记录或SRT，找不到时才会补生成字幕列表。') }}
      </p>

      <!-- 文案行列表（带时间轴和独立素材按钮） -->
      <div v-if="scriptLines.length > 0" class="border rounded-lg p-3 space-y-2 max-h-96 overflow-y-auto">
        <div class="text-xs font-medium text-gray-700 mb-2">{{ t('为每行文案配置素材') }}</div>
        <div
          v-for="(line, index) in scriptLines"
          :key="index"
          class="line-material-card border rounded p-3 transition-colors"
          :class="{ 'border-blue-500 bg-blue-50': selectedSubtitleIndices.has(index) }"
        >
          <div class="flex items-start gap-3">
            <a-checkbox
              :model-value="selectedSubtitleIndices.has(index)"
              @change="toggleSubtitleSelection(index)"
            />
            <!-- 左侧：文案内容和时间 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-medium text-gray-500">{{ t('第') }} {{ index + 1 }} {{ t('行') }}</span>
                <span v-if="getTimeRangeForLine(index)" class="text-xs text-blue-600 font-mono">
                  {{ getTimeRangeForLine(index) }}
                </span>
                <span v-else class="text-xs text-orange-500">
                  {{ t('(时间轴匹配中...)') }}
                </span>
              </div>
              <div class="text-sm text-gray-900 mb-2">{{ line }}</div>

              <!-- 已配置的素材显示 -->
              <div v-if="getMaterialForLineDisplay(index)" class="text-xs text-green-600 flex items-center gap-1">
                <span>✓</span>
                <span class="truncate max-w-xs">{{ getFileName(getMaterialForLineDisplay(index)) }}</span>
              </div>
            </div>

            <!-- 右侧：素材选择按钮 -->
            <div class="flex flex-col gap-2">
              <a-button
                @click="openMaterialLibraryForLine(index)"
                size="mini"
                :type="getMaterialForLineDisplay(index) ? 'outline' : 'primary'"
              >
                {{ getMaterialForLineDisplay(index) ? t('更换素材') : t('素材库选择') }}
              </a-button>
              <a-button
                @click="selectLocalMaterialForLine(index)"
                size="mini"
                type="outline"
              >
                {{ t('本地文件') }}
              </a-button>
              <a-button
                v-if="getMaterialForLineDisplay(index)"
                @click="removeMaterialAssignmentForLine(index)"
                size="mini"
                status="danger"
              >
                {{ t('删除') }}
              </a-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 已添加的映射统计 -->
      <div v-if="subtitleConfig.mappings.length > 0" class="text-xs text-gray-500">
        {{ t('已配置') }} {{ subtitleConfig.mappings.length }} {{ t('行素材') }}
      </div>
    </div>

    <a-modal
      v-model:visible="materialLibraryVisible"
      :title="materialLibraryTitle"
      width="960px"
      :footer="false"
    >
      <div class="space-y-3">
        <div class="text-xs text-gray-500">
          {{ materialLibraryHint }}
        </div>

        <div v-if="materialLibraryLoading" class="py-10 text-center text-gray-400">
          {{ t('素材加载中...') }}
        </div>

        <div v-else-if="!materialLibraryRecords.length" class="py-10 text-center text-gray-400">
          {{ t('素材库还没有内容，请先到左侧“素材”页面上传。') }}
        </div>

        <div v-else class="grid grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto">
          <div
            v-for="record in materialLibraryRecords"
            :key="record.id"
            class="material-library-card border rounded-lg p-3 bg-white hover:border-blue-400 transition-colors"
          >
            <div class="material-library-preview aspect-video bg-gray-100 rounded overflow-hidden flex items-center justify-center mb-2">
              <img
                v-if="record.type === 'image'"
                :src="'file://' + record.path"
                :alt="record.name"
                class="max-h-full max-w-full object-contain"
              />
              <video
                v-else
                :src="'file://' + record.path"
                class="w-full h-full object-cover"
                muted
                preload="metadata"
              />
            </div>
            <div class="text-sm font-medium text-gray-800 truncate">{{ record.name }}</div>
            <div class="text-xs text-gray-500 truncate mb-2">{{ getFileName(record.path) }}</div>
            <a-button type="primary" size="small" block @click="useLibraryMaterial(record)">
              {{ t('使用这个素材') }}
            </a-button>
          </div>
        </div>
      </div>
    </a-modal>

  </div>
</template>

<style scoped>
:deep(.arco-checkbox-icon) {
  border-color: #d1d5db !important; /* gray-300 */
}

:deep(.arco-checkbox-checked .arco-checkbox-icon) {
  border-color: rgb(var(--primary-6)) !important;
  background-color: rgb(var(--primary-6)) !important;
}

/* 🔧 修复：增加 radio 按钮的颜色对比度 */
:deep(.arco-radio-circle) {
  border-color: #9ca3af !important; /* gray-400 - 更深的颜色 */
  border-width: 2px !important; /* 增加边框宽度 */
}

:deep(.arco-radio-checked .arco-radio-circle) {
  border-color: rgb(var(--primary-6)) !important;
  background-color: rgb(var(--primary-6)) !important; /* 🆕 添加背景色 */
}

:deep(.arco-radio-checked .arco-radio-circle::after) {
  background-color: white !important; /* 内圆为白色 */
}

/* 🔧 修复：确保文字颜色足够深 - 增强优先级 */
:deep(.arco-radio-group .arco-radio .arco-radio-label),
:deep(.arco-checkbox-label),
:deep(.arco-radio-label) {
  color: #1f2937 !important; /* gray-800 - 更深的文字颜色 */
  font-weight: 500 !important; /* 增加字重 */
}

/* 全局显示模式配置区域的背景色调整 */
.bg-gray-50 {
  background-color: #f9fafb !important; /* 稍微深一点的灰色背景 */
}
:global(body[data-theme="dark"]) .mixcut-setting-panel {
  color: #e5e7eb;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .text-gray-900,
:global(body[data-theme="dark"]) .mixcut-setting-panel .text-gray-800,
:global(body[data-theme="dark"]) .mixcut-setting-panel .text-gray-700,
:global(body[data-theme="dark"]) .mixcut-setting-panel .font-medium,
:global(body[data-theme="dark"]) .mixcut-setting-panel label,
:global(body[data-theme="dark"]) .mixcut-setting-panel span,
:global(body[data-theme="dark"]) .mixcut-setting-panel p,
:global(body[data-theme="dark"]) .mixcut-setting-panel div {
  color: inherit;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .text-gray-600,
:global(body[data-theme="dark"]) .mixcut-setting-panel .text-gray-500,
:global(body[data-theme="dark"]) .mixcut-setting-panel .text-gray-400 {
  color: #94a3b8 !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .bg-blue-50 {
  background: linear-gradient(180deg, rgba(18, 33, 58, 0.96) 0%, rgba(15, 23, 42, 0.98) 100%) !important;
  border-color: rgba(96, 165, 250, 0.35) !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel,
:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel * {
  color: #e5e7eb !important;
}

:global(.global-display-panel.is-dark-panel),
:global(.global-display-panel.is-dark-panel *) {
  color: #e5e7eb !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel {
  background: linear-gradient(180deg, rgba(18, 33, 58, 0.96) 0%, rgba(15, 23, 42, 0.98) 100%) !important;
  border-color: rgba(96, 165, 250, 0.35) !important;
}

:global(.global-display-panel.is-dark-panel) {
  background: linear-gradient(180deg, rgba(18, 33, 58, 0.96) 0%, rgba(15, 23, 42, 0.98) 100%) !important;
  border-color: rgba(96, 165, 250, 0.35) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel .text-blue-900 {
  color: #dbeafe !important;
}

:global(.global-display-panel.is-dark-panel .text-blue-900) {
  color: #dbeafe !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel .text-blue-600 {
  color: #60a5fa !important;
}

:global(.global-display-panel.is-dark-panel .text-blue-600) {
  color: #60a5fa !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel .text-gray-700,
:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel .text-gray-600,
:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel .text-gray-500,
:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel .text-gray-400 {
  color: #94a3b8 !important;
}

:global(.global-display-panel.is-dark-panel .text-gray-700),
:global(.global-display-panel.is-dark-panel .text-gray-600),
:global(.global-display-panel.is-dark-panel .text-gray-500),
:global(.global-display-panel.is-dark-panel .text-gray-400) {
  color: #94a3b8 !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel :deep(.arco-radio-label),
:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel :deep(.arco-checkbox-label) {
  color: #e5e7eb !important;
}

:global(.global-display-panel.is-dark-panel) :deep(.arco-radio-label),
:global(.global-display-panel.is-dark-panel) :deep(.arco-checkbox-label),
:global(.global-display-panel.is-dark-panel) :deep(.arco-radio-group .arco-radio-label) {
  color: #e5e7eb !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .global-display-panel :deep(.arco-btn:not(.arco-btn-primary)) {
  background: #172033 !important;
  border-color: #3b82f6 !important;
  color: #dbeafe !important;
}

:global(.global-display-panel.is-dark-panel) :deep(.arco-btn:not(.arco-btn-primary)) {
  background: #172033 !important;
  border-color: #3b82f6 !important;
  color: #dbeafe !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .text-blue-900 {
  color: #dbeafe !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .text-blue-600 {
  color: #60a5fa !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .line-material-card {
  background: #111827;
  border-color: #374151;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .line-material-card:hover {
  background: transparent !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .line-material-card.border-blue-500 {
  border-color: #60a5fa !important;
  background: rgba(37, 99, 235, 0.14) !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .material-library-card {
  background: #111827 !important;
  border-color: #374151 !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel .material-library-preview {
  background: #0b1220 !important;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel :deep(.arco-btn:not(.arco-btn-primary)) {
  background: #172033;
  border-color: #3b82f6;
  color: #dbeafe;
}

:global(body[data-theme="dark"]) .mixcut-setting-panel :deep(.arco-btn-status-danger) {
  background: rgba(127, 29, 29, 0.28);
  border-color: rgba(248, 113, 113, 0.35);
  color: #fecaca;
}
</style>
