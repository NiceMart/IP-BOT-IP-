<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Message } from '@arco-design/web-vue';
import type { UploadFile } from '@arco-design/web-vue';
import VideoPlayer from '../../components/common/VideoPlayer.vue';
import TemplateEditor from '../../components/CoverEditor/TemplateEditor.vue';
import TemplateManager from '../../components/CoverEditor/TemplateManager.vue';
import type { CustomTemplate } from '../../types/custom-template';
import { createDefaultTemplate } from '../../types/custom-template';

const { t } = useI18n();

// 状态管理
const loading = ref(false);
const videoFilePath = ref<string>('');
const videoFileName = ref<string>('');
const scriptText = ref('');
const selectedSubtitleStyle = ref('default');

// 自定义模板系统
const customTemplates = ref<CustomTemplate[]>([]);
const currentTemplate = ref<CustomTemplate | null>(null);
const showTemplateEditor = ref(false)
const showTemplateManager = ref(false)
const selectedCustomTemplate = ref<CustomTemplate | null>(null);

// 预览结果
const videoPreviewUrl = ref('');
const coverPreviewUrl = ref('');
const subtitlePreview = ref<any[]>([]);
const generatedCoverPreview = ref(''); // 实时生成的封面预览

// 生成结果
const generatedVideoUrl = ref('');
const generatedCoverUrl = ref('');
const generatedVideoPath = ref('');  // 存储实际文件路径
const generatedCoverPath = ref('');  // 存储实际文件路径

// 生成上下文（用于重新生成封面）
const generationContext = ref<{
  videoPath: string;
  scriptText: string;
  template: CustomTemplate;
} | null>(null);

// 图片预览状态
const previewVisible = ref(false);
const previewImageUrl = ref('');

// 封面参数设置
const selectedCoverStyle = ref('default');
const useFunasr = ref(false);
const coverText = ref('');
const coverTextPosition = ref('bottom');
const coverTextColor = ref('#FFFFFF');
const coverTextSize = ref(50);
const outlineColor = ref('#FFD700');
const outlineWidth = ref(3);
const blurRadius = ref(15);
const zoomLevel = ref(1.0);
const showAdvancedSettings = ref(false);

// 主标题文字间距控制
const mainTitleCharSpacing = ref<number | undefined>(undefined);
const mainTitleLineSpacing = ref<number | undefined>(undefined);

// 副标题文字间距控制
const subTitleCharSpacing = ref<number | undefined>(undefined);
const subTitleLineSpacing = ref<number | undefined>(undefined);

// 图片预览方法
const openPreview = (imageUrl: string) => {
  previewImageUrl.value = imageUrl;
  previewVisible.value = true;
};

const closePreview = () => {
  previewVisible.value = false;
  previewImageUrl.value = '';
};

// 字幕样式选项
const subtitleStyles = [
  {
    value: 'default',
    label: '默认样式',
    description: '白色字体，黑色描边',
    preview: 'color: white; text-shadow: 2px 2px 4px black; font-weight: bold;'
  },
  {
    value: 'highlight',
    label: '高亮样式',
    description: '黄色高亮背景',
    preview: 'color: black; background-color: yellow; padding: 2px 8px; font-weight: bold;'
  },
  {
    value: 'card',
    label: '卡片样式',
    description: '圆角卡片背景',
    preview: 'color: white; background-color: rgba(0,0,0,0.7); padding: 4px 12px; border-radius: 8px; font-weight: bold;'
  },
  {
    value: 'neon',
    label: '霓虹样式',
    description: '霓虹灯效果',
    preview: 'color: cyan; text-shadow: 0 0 10px magenta, 0 0 20px cyan; font-weight: bold;'
  },
  {
    value: 'minimal',
    label: '极简样式',
    description: '简洁现代风格',
    preview: 'color: white; text-shadow: 1px 1px 2px black;'
  },
  {
    value: 'emotion-mixed',
    label: '情感混合样式',
    description: '根据情感分析自动调整颜色',
    preview: 'color: white; background-color: rgba(0,0,0,0.7); padding: 2px 8px; border-radius: 4px; font-weight: bold;'
  }
];

// 封面样式选项 - 改为封面模板
const coverStyles = [
  {
    value: 'default',
    label: '默认封面',
    description: '标准视频截图',
    preview: '📸',
    previewImage: '/cover-previews/cover-preview-default.png',
    pythonStyle: 'default',
    params: '标准截图'
  },
  {
    value: 'professional',
    label: '专业商务风',
    description: '金色描边 + 中度虚化 + 人物清晰',
    preview: '💼',
    previewImage: '/cover-previews/cover-preview-outline.png',
    pythonStyle: 'outline',
    params: '描边:金色 | 虚化:中度'
  },
  {
    value: 'vibrant',
    label: '活力青春风',
    description: '粉色描边 + 轻度虚化 + 明亮色调',
    preview: '🌸',
    previewImage: '/cover-previews/cover-preview-gradient.png',
    pythonStyle: 'gradient',
    params: '描边:粉色 | 虚化:轻度'
  },
  {
    value: 'elegant',
    label: '优雅高级风',
    description: '银色描边 + 重度虚化 + 柔和光效',
    preview: '💎',
    previewImage: '/cover-previews/cover-preview-blur-bg.png',
    pythonStyle: 'blur-bg',
    params: '描边:银色 | 虚化:重度'
  },
  {
    value: 'classic',
    label: '经典商务风',
    description: '白色描边 + 轻度虚化 + 简洁风格',
    preview: '🏛️',
    previewImage: '/cover-previews/cover-preview-split.png',
    pythonStyle: 'split',
    params: '描边:白色 | 虚化:轻度'
  },
  {
    value: 'dramatic',
    label: '戏剧艺术风',
    description: '红色描边 + 重度虚化 + 强烈对比',
    preview: '🎭',
    previewImage: '/cover-previews/cover-preview-default.png',
    pythonStyle: 'default',
    params: '描边:红色 | 虚化:重度'
  }
];

// 计算属性
const canGenerate = computed(() => {
  return videoFilePath.value && scriptText.value.trim();
});

const canGenerateCoverPreview = computed(() => {
  return videoFilePath.value && selectedCoverStyle.value;
});

// 选择视频文件（使用原生对话框）
const selectVideoFile = async () => {
  try {
    const filePath = await window.$mapi.file.openFile({
      filters: [
        { name: '视频文件', extensions: ['mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv', 'webm', 'm4v', 'mpeg', 'mpg'] }
      ],
      properties: ['openFile']
    });

    if (filePath) {
      videoFilePath.value = filePath as string;
      videoFileName.value = (filePath as string).split(/[\\/]/).pop() || '';
      videoPreviewUrl.value = `file:///${(filePath as string).replace(/\\/g, '/')}`;
      Message.success(t('视频文件已选择'));
    }
  } catch (error: any) {
    console.error('选择视频失败:', error);
    Message.error(t('选择视频失败') + ': ' + (error.message || error));
  }
};

// 文案输入处理
const handleScriptInput = (value: string) => {
  scriptText.value = value;
  // 自动生成预览字幕
  generateSubtitlePreview();
};

// 生成字幕预览
const generateSubtitlePreview = () => {
  if (!scriptText.value.trim()) {
    subtitlePreview.value = [];
    return;
  }

  const lines = scriptText.value.split('\n').filter(line => line.trim());
  subtitlePreview.value = lines.map((line, index) => ({
    id: index + 1,
    text: line.trim(),
    startTime: index * 3,
    endTime: (index + 1) * 3
  }));
};

// 一键生成字幕和封面
const handleGenerate = async () => {
  if (!canGenerate.value) {
    Message.warning(t('请先上传视频并输入文案'));
    return;
  }

  loading.value = true;
  try {
    // 检查环境
    const envCheck = await window.$mapi.subtitleCover.checkEnvironment();
    if (!envCheck.pythonAvailable) {
      Message.error('Python环境不可用，请检查Python安装');
      return;
    }
    if (!envCheck.scriptExists) {
      Message.error('Python脚本未找到');
      return;
    }
    if (!envCheck.dependenciesInstalled) {
      Message.error(`缺少依赖库: ${envCheck.missingLibraries?.join(', ') || ''}`);
      return;
    }

    // 检查是否使用自定义模板
    if (selectedCoverStyle.value.startsWith('custom_')) {
      // 如果 selectedCustomTemplate 为空,从 customTemplates 中查找
      let template = selectedCustomTemplate.value;
      if (!template) {
        const templateId = selectedCoverStyle.value.replace('custom_', '');
        template = customTemplates.value.find(t => t.id === templateId) || null;
        console.log('Restored template from customTemplates for generation:', template);
      }

      if (template) {
        console.log('Generating with custom template:', template);

        // 使用自定义模板生成封面（字幕功能暂不支持）
        const coverResult = await window.$mapi.subtitleCover.generateWithCustomTemplate({
          videoPath: videoFilePath.value,
          scriptText: scriptText.value,
          template: structuredClone(template)
        });

      console.log('Custom template generation result:', coverResult);

      if (coverResult.success) {
        // 保存生成上下文
        generationContext.value = {
          videoPath: videoFilePath.value,
          scriptText: scriptText.value,
          template: selectedCustomTemplate.value
        };

        if (coverResult.coverPath) {
          generatedCoverPath.value = coverResult.coverPath;
          generatedCoverUrl.value = `file:///${coverResult.coverPath.replace(/\\/g, '/')}`;
          console.log('Generated custom cover:', generatedCoverUrl.value);
        }
        Message.success(t('自定义模板封面生成成功'));
      } else {
        console.error('Custom template generation failed:', coverResult);
        Message.error(`${t('生成失败')}: ${coverResult.message || coverResult.error}`);
        }
      } else {
        console.error('Custom template not found for generation:', selectedCoverStyle.value);
        Message.error(t('自定义模板不存在,请重新选择'));
      }
    } else {
      // 使用预设样式生成
      console.log('Starting generation with video path:', videoFilePath.value);

      const result = await window.$mapi.subtitleCover.generate({
        videoPath: videoFilePath.value,
        scriptText: scriptText.value,
        subtitleStyle: selectedSubtitleStyle.value,
        coverStyle: selectedCoverStyle.value,
        useFunasr: useFunasr.value  // 传递FUNASR选项
      });

      console.log('Generation result:', result);
      console.log('Generated paths:', {
        videoPath: result.videoPath,
        coverPath: result.coverPath
      });

      if (result.success) {
        // 保存生成上下文供重新生成封面使用
        generationContext.value = {
          videoPath: videoFilePath.value,
          scriptText: scriptText.value
        };

        // 更新生成的视频和封面路径
        if (result.videoPath) {
          generatedVideoPath.value = result.videoPath;
          // 将本地文件路径转换为可访问的URL
          generatedVideoUrl.value = `file:///${result.videoPath.replace(/\\/g, '/')}`;
          console.log('Set generatedVideoPath:', generatedVideoPath.value);
          console.log('Generated video URL:', generatedVideoUrl.value);
        }
        if (result.coverPath) {
          generatedCoverPath.value = result.coverPath;
          generatedCoverUrl.value = `file:///${result.coverPath.replace(/\\/g, '/')}`;
          console.log('Set generatedCoverPath:', generatedCoverPath.value);
          console.log('Generated cover URL:', generatedCoverUrl.value);
        }
        Message.success(t('字幕和封面生成成功'));
      } else {
        console.error('Generation failed:', result);
        Message.error(`${t('生成失败')}: ${result.message || result.error}`);
      }
    }
  } catch (error: any) {
    console.error('Generate error:', error);
    Message.error(`${t('生成失败，请重试')}: ${error.message}`);
  } finally {
    loading.value = false;
  }
};

// 生成封面预览（不需要文案）
const generateCoverPreview = async () => {
  if (!videoFilePath.value) {
    Message.warning(t('请先上传视频'));
    return;
  }

  loading.value = true;
  try {
    console.log('Generating cover preview with style:', selectedCoverStyle.value);

    // 检查是否使用自定义模板
    if (selectedCoverStyle.value.startsWith('custom_')) {
      // 如果 selectedCustomTemplate 为空,从 customTemplates 中查找
      let template = selectedCustomTemplate.value;
      if (!template) {
        const templateId = selectedCoverStyle.value.replace('custom_', '');
        template = customTemplates.value.find(t => t.id === templateId) || null;
        console.log('Restored template from customTemplates:', template);
      }

      if (template) {
        console.log('Using custom template:', template);

        // 克隆模板并应用用户自定义的间距设置
        const templateCopy = structuredClone(template);

        // 应用主标题间距设置
        if (mainTitleCharSpacing.value !== undefined) {
          templateCopy.titles.main.charSpacing = mainTitleCharSpacing.value;
        }
        if (mainTitleLineSpacing.value !== undefined) {
          templateCopy.titles.main.lineSpacing = mainTitleLineSpacing.value;
        }

        // 应用副标题间距设置
        if (subTitleCharSpacing.value !== undefined) {
          templateCopy.titles.sub.charSpacing = subTitleCharSpacing.value;
        }
        if (subTitleLineSpacing.value !== undefined) {
          templateCopy.titles.sub.lineSpacing = subTitleLineSpacing.value;
        }

        console.log('Template with custom spacing:', templateCopy);

        // 使用自定义模板API
        const result = await window.$mapi.subtitleCover.generateWithCustomTemplate({
          videoPath: videoFilePath.value,
          scriptText: scriptText.value || '',
          template: templateCopy
        });

      console.log('Custom template cover result:', result);

      if (result.success && result.coverPath) {
        generatedCoverPreview.value = `file:///${result.coverPath.replace(/\\/g, '/')}`;
        console.log('Generated custom cover preview:', generatedCoverPreview.value);
        Message.success(t('封面预览生成成功'));
      } else {
        console.error('Custom cover preview failed:', result);
        Message.error(result.message || t('封面预览生成失败'));
        }
      } else {
        console.error('Custom template not found for:', selectedCoverStyle.value);
        Message.error(t('自定义模板不存在,请重新选择'));
      }
    } else {
      // 使用预设样式
      const result = await window.$mapi.subtitleCover.regenerateCover({
        videoPath: videoFilePath.value,
        scriptText: '', // 封面预览不需要文案
        coverStyle: coverStyles.find(s => s.value === selectedCoverStyle.value)?.pythonStyle || selectedCoverStyle.value,
        // 新增参数
        coverText: coverText.value,
        coverTextPosition: coverTextPosition.value,
        coverTextColor: coverTextColor.value,
        coverTextSize: coverTextSize.value,
        outlineColor: outlineColor.value,
        outlineWidth: outlineWidth.value,
        blurRadius: blurRadius.value,
        zoomLevel: zoomLevel.value
      });

      console.log('Cover preview result:', result);

      if (result.success && result.coverPath) {
        generatedCoverPreview.value = `file:///${result.coverPath.replace(/\\/g, '/')}`;
        console.log('Generated cover preview:', generatedCoverPreview.value);
        Message.success(t('封面预览生成成功'));
      } else {
        console.error('Cover preview failed:', result);
        Message.error(result.message || t('封面预览生成失败'));
      }
    }
  } catch (error: any) {
    console.error('Cover preview error:', error);
    Message.error(t('封面预览生成失败') + ': ' + (error.message || error));
  } finally {
    loading.value = false;
  }
};

// 重新生成封面
const regenerateCover = async () => {
  if (!generationContext.value) {
    Message.error(t('请先生成一次字幕和封面'));
    console.error('Regenerate cover failed: no generation context');
    return;
  }

  loading.value = true;
  try {
    console.log('Regenerating cover with style:', selectedCoverStyle.value);

    const result = await window.$mapi.subtitleCover.regenerateCover({
      videoPath: generationContext.value.videoPath,
      scriptText: generationContext.value.scriptText,
      coverStyle: selectedCoverStyle.value
    });

    console.log('Regenerate cover result:', result);

    if (result.success && result.coverPath) {
      generatedCoverPath.value = result.coverPath;
      generatedCoverUrl.value = `file:///${result.coverPath.replace(/\\/g, '/')}`;
      console.log('Regenerated cover path:', generatedCoverPath.value);
      Message.success(t('封面重新生成成功'));
    } else {
      console.error('Regenerate cover failed:', result);
      Message.error(result.message || t('封面生成失败'));
    }
  } catch (error: any) {
    console.error('Regenerate cover error:', error);
    Message.error(t('封面生成失败') + ': ' + (error.message || error));
  } finally {
    loading.value = false;
  }
};

// 下载处理
const downloadVideo = async () => {
  if (!generatedVideoPath.value) {
    Message.error(t('视频路径不存在'));
    console.error('Download video failed: no video path');
    return;
  }

  console.log('Attempting to show video in folder:', generatedVideoPath.value);

  try {
    const result = await window.$mapi.shell.showItemInFolder(generatedVideoPath.value);
    console.log('showItemInFolder result:', result);

    if (result) {
      Message.success(t('已在文件夹中显示视频'));
    } else {
      Message.error(t('无法打开文件位置'));
    }
  } catch (error: any) {
    console.error('Download video error:', error);
    Message.error(t('无法打开文件位置') + ': ' + (error.message || error));
  }
};

const downloadCover = async () => {
  if (!generatedCoverPath.value) {
    Message.error(t('封面路径不存在'));
    console.error('Download cover failed: no cover path');
    return;
  }

  console.log('Attempting to show cover in folder:', generatedCoverPath.value);

  try {
    const result = await window.$mapi.shell.showItemInFolder(generatedCoverPath.value);
    console.log('showItemInFolder result:', result);

    if (result) {
      Message.success(t('已在文件夹中显示封面'));
    } else {
      Message.error(t('无法打开文件位置'));
    }
  } catch (error: any) {
    console.error('Download cover error:', error);
    Message.error(t('无法打开文件位置') + ': ' + (error.message || error));
  }
};

// 清除上传
const clearUpload = () => {
  videoFilePath.value = '';
  videoFileName.value = '';
  videoPreviewUrl.value = '';
  scriptText.value = '';
  generatedVideoUrl.value = '';
  generatedCoverUrl.value = '';
  generatedVideoPath.value = '';
  generatedCoverPath.value = '';
  subtitlePreview.value = [];
  generatedCoverPreview.value = '';
};

// 重置封面参数
const resetCoverParams = () => {
  coverText.value = '';
  coverTextPosition.value = 'bottom';
  coverTextColor.value = '#FFFFFF';
  coverTextSize.value = 50;
  outlineColor.value = '#FFD700';
  outlineWidth.value = 3;
  blurRadius.value = 15;
  zoomLevel.value = 1.0;

  // 重置文字间距参数
  mainTitleCharSpacing.value = undefined;
  mainTitleLineSpacing.value = undefined;
  subTitleCharSpacing.value = undefined;
  subTitleLineSpacing.value = undefined;

  Message.success(t('参数已重置'));
};

// =========== 自定义模板系统方法 ===========

// 加载保存的模板
const loadSavedTemplates = () => {
  try {
    // 加载自定义封面模板
    const saved = localStorage.getItem('customCoverTemplates')
    if (saved) {
      customTemplates.value = JSON.parse(saved)
    }

    // 加载保存的字幕样式
    const savedSubtitleStyle = localStorage.getItem('selectedSubtitleStyle')
    if (savedSubtitleStyle) {
      selectedSubtitleStyle.value = savedSubtitleStyle
      console.log('已加载保存的字幕样式:', savedSubtitleStyle)
    }

    // 加载保存的封面样式
    const savedCoverStyle = localStorage.getItem('selectedCoverStyle')
    if (savedCoverStyle) {
      selectedCoverStyle.value = savedCoverStyle
      console.log('已加载保存的封面样式:', savedCoverStyle)
    }
  } catch (error) {
    console.error('加载模板失败:', error)
  }
}

// 保存模板到本地存储
const saveTemplatesToStorage = () => {
  try {
    const dataToSave = JSON.stringify(customTemplates.value)
    localStorage.setItem('customCoverTemplates', dataToSave)
    console.log('🔧 模板已保存到localStorage，当前模板数:', customTemplates.value.length)
    // 调试：打印保存的模板信息
    customTemplates.value.forEach((t, idx) => {
      console.log(`  [${idx}] ${t.name} - 标题颜色: ${t.titles?.main?.color}, 描边颜色: ${t.portrait?.strokeColor}`)
    })
  } catch (error) {
    console.error('保存模板失败:', error)
  }
}

// 保存字幕样式到本地存储
const saveSubtitleStyleToStorage = (style: string) => {
  try {
    localStorage.setItem('selectedSubtitleStyle', style)
    console.log('已保存字幕样式:', style)
  } catch (error) {
    console.error('保存字幕样式失败:', error)
  }
}

// 保存封面样式到本地存储
const saveCoverStyleToStorage = (style: string) => {
  try {
    localStorage.setItem('selectedCoverStyle', style)
    console.log('已保存封面样式:', style)
  } catch (error) {
    console.error('保存封面样式失败:', error)
  }
}

// 处理模板变化事件
const handleTemplateChange = (changedTemplate: CustomTemplate) => {
  // 🔧 修复：使用深拷贝确保完整保存模板数据
  currentTemplate.value = structuredClone(changedTemplate)
  console.log('🔧 模板已变化并同步:', currentTemplate.value)
}

// 打开模板管理器
const openTemplateManager = () => {
  showTemplateManager.value = true
}

// 打开模板编辑器
const openTemplateEditor = (template?: CustomTemplate) => {
  if (template) {
    // 🔧 修复：使用深拷贝，确保嵌套对象不会被修改
    currentTemplate.value = structuredClone(template)
  } else {
    // 创建一个新的默认模板
    currentTemplate.value = createDefaultTemplate()
  }
  showTemplateEditor.value = true
}

// 选择模板
const selectTemplate = (template: CustomTemplate) => {
  selectedCustomTemplate.value = template
  // 🔧 修复：使用深拷贝只在 currentTemplate，不影响 selectedCustomTemplate 的引用
  currentTemplate.value = structuredClone(template)
  selectedCoverStyle.value = `custom_${template.id}` // 设置为自定义模板
  Message.success(`已选择模板: ${template.name}`)
}

// 保存模板
const saveTemplate = (template: CustomTemplate | null) => {
  if (!template) {
    // 如果传入的模板为空，尝试使用当前模板
    if (!currentTemplate.value) {
      Message.error(t('模板数据无效'))
      return
    }
    template = currentTemplate.value
  }

  // 🔧 修复：使用深拷贝，确保保存的是完整的模板数据
  const templateToSave = structuredClone(template)

  // 确保模板有有效的 ID 和名称
  if (!templateToSave.id) {
    templateToSave.id = `template_${Date.now()}`
  }
  if (!templateToSave.name || templateToSave.name === '未命名模板') {
    templateToSave.name = `自定义模板 ${customTemplates.value.length + 1}`
  }

  const index = customTemplates.value.findIndex(t => t.id === templateToSave.id)
  if (index >= 0) {
    // 更新现有模板 - 使用深拷贝保存
    customTemplates.value[index] = templateToSave
    console.log('🔧 模板已更新（深拷贝）:', templateToSave)
    Message.success(t('模板已更新'))
  } else {
    // 添加新模板 - 使用深拷贝保存
    customTemplates.value.push(templateToSave)
    console.log('🔧 模板已保存（深拷贝）:', templateToSave)
    Message.success(t('模板已保存'))
  }
  saveTemplatesToStorage()
  showTemplateEditor.value = false
}

// 删除模板
const deleteTemplate = (templateId: string) => {
  const index = customTemplates.value.findIndex(t => t.id === templateId)
  if (index >= 0) {
    customTemplates.value.splice(index, 1)
    saveTemplatesToStorage()
    if (selectedCustomTemplate.value?.id === templateId) {
      selectedCustomTemplate.value = null
      currentTemplate.value = null
    }
  }
}

// 重命名模板
const renameTemplate = (id: string, name: string) => {
  const t = customTemplates.value.find(template => template.id === id)
  if (t) {
    t.name = name
    saveTemplatesToStorage()
  }
}

// 使用自定义模板生成封面
const generateWithCustomTemplate = async () => {
  if (!selectedCustomTemplate.value) {
    Message.warning(t('请先选择一个自定义模板'))
    return
  }

  if (!videoFilePath.value) {
    Message.warning(t('请先上传视频'))
    return
  }

  loading.value = true
  try {
    // 调用后端API，传递自定义模板参数
    const result = await window.$mapi.subtitleCover.generateWithCustomTemplate({
      videoPath: videoFilePath.value,
      scriptText: scriptText.value,
      template: structuredClone(selectedCustomTemplate.value)
    })

    if (result.success && result.coverPath) {
      generatedCoverPreview.value = `file:///${result.coverPath.replace(/\\/g, '/')}`
      Message.success(t('使用自定义模板生成成功'))
    } else {
      Message.error(result.message || t('生成失败'))
    }
  } catch (error: any) {
    console.error('Generate with custom template error:', error)
    Message.error(t('生成失败') + ': ' + (error.message || error))
  } finally {
    loading.value = false
  }
}

// 监听字幕样式变化，自动保存
watch(selectedSubtitleStyle, (newStyle) => {
  saveSubtitleStyleToStorage(newStyle)
});

// 监听封面样式变化，自动保存
watch(selectedCoverStyle, (newStyle) => {
  saveCoverStyleToStorage(newStyle)
});

// 监听自定义模板变化，自动保存
watch(customTemplates, (newTemplates) => {
  saveTemplatesToStorage()
}, { deep: true });

onMounted(() => {
  // 初始化，加载保存的模板
  loadSavedTemplates()
});
</script>

<template>
  <div class="subtitle-cover-generator h-full p-6">
    <!-- 标题区域 -->
    <div class="mb-6">
      <h2 class="text-2xl font-bold mb-2">{{ t('一键字幕 + 一键封面') }}</h2>
      <p class="text-gray-600">{{ t('上传视频，输入文案，选择字幕和封面效果，一键生成专业视频内容') }}</p>
    </div>

    <div class="grid grid-cols-2 gap-6 h-full">
      <!-- 左侧：输入区域 -->
      <div class="space-y-6">
        <!-- 视频上传 -->
        <div class="bg-white p-6 rounded-lg border border-gray-200">
          <h3 class="text-lg font-semibold mb-4 flex items-center">
            <i class="iconfont icon-video mr-2 text-blue-500"></i>
            {{ t('视频上传') }}
          </h3>
          <div class="w-full">
            <a-button
              type="outline"
              size="large"
              @click="selectVideoFile"
              class="w-full h-32 border-2 border-dashed"
              :class="videoFileName ? 'border-green-400' : 'border-gray-300 hover:border-blue-400'"
            >
              <div class="text-center">
                <i
                  class="iconfont text-3xl"
                  :class="videoFileName ? 'icon-video text-green-500' : 'icon-upload text-gray-400'"
                ></i>
                <p v-if="!videoFileName" class="text-gray-500 mt-2">{{ t('点击选择视频文件') }}</p>
                <p v-else class="text-green-600 mt-2">{{ videoFileName }}</p>
                <p class="text-gray-400 text-sm mt-1">{{ t('支持 MP4, AVI, MOV 等格式') }}</p>
              </div>
            </a-button>
          </div>

          <!-- 视频预览 -->
          <div v-if="videoPreviewUrl" class="mt-4">
            <VideoPlayer :src="videoPreviewUrl" class="w-full h-48" />
          </div>
        </div>

        <!-- 文案输入 -->
        <div class="bg-white p-6 rounded-lg border border-gray-200">
          <h3 class="text-lg font-semibold mb-4 flex items-center">
            <i class="iconfont icon-edit mr-2 text-green-500"></i>
            {{ t('文案输入') }}
          </h3>
          <a-textarea
            v-model="scriptText"
            :placeholder="t('请输入视频文案，每句话将生成一条字幕')"
            :auto-size="{ minRows: 4, maxRows: 8 }"
            @input="handleScriptInput"
            class="w-full"
          />
          <div class="mt-2 text-sm text-gray-500">
            {{ t('字数') }}: {{ scriptText.length }} | {{ t('预计生成') }} {{ subtitlePreview.length }} {{ t('条字幕') }}
          </div>
        </div>

        <!-- 效果选择 -->
        <div class="bg-white p-6 rounded-lg border border-gray-200">
          <h3 class="text-lg font-semibold mb-4 flex items-center">
            <i class="iconfont icon-magic mr-2 text-purple-500"></i>
            {{ t('效果选择') }}
          </h3>

          <!-- 字幕样式 -->
          <div class="mb-6">
            <h4 class="font-medium mb-3">{{ t('字幕效果') }}</h4>

            <!-- FUNASR语音识别选项 -->
            <div class="mb-4 p-3 bg-blue-50 rounded-lg">
              <a-checkbox v-model="useFunasr">
                <span class="font-medium">{{ t('使用FUNASR语音识别') }}</span>
                <span class="text-gray-500 text-sm ml-2">{{ t('自动识别视频音频生成精确时间戳字幕') }}</span>
              </a-checkbox>
            </div>

            <a-radio-group v-model="selectedSubtitleStyle" direction="vertical" class="w-full">
              <div v-for="style in subtitleStyles" :key="style.value" class="mb-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <a-radio :value="style.value">
                  <div class="flex flex-col">
                    <div class="flex items-center mb-2">
                      <span class="font-medium">{{ style.label }}</span>
                      <span class="text-gray-500 text-sm ml-2">{{ style.description }}</span>
                    </div>
                    <!-- 样式预览 -->
                    <div v-if="style.value === 'emotion-mixed'" class="mt-2 p-3 bg-gray-800 rounded text-center">
                      <span style="color: yellow; font-weight: bold;">积极</span>
                      <span style="color: white;"> 普通文字 </span>
                      <span style="color: cyan;">关键词</span>
                      <span style="color: red; font-weight: bold;">消极</span>
                    </div>
                    <div v-else class="mt-2 p-3 bg-gray-800 rounded text-center">
                      <span :style="style.preview">示例字幕文字</span>
                    </div>
                  </div>
                </a-radio>
              </div>
            </a-radio-group>
          </div>

          <!-- 封面样式 -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-medium">{{ t('封面预设模板') }}</h4>
              <div class="flex space-x-2">
                <a-button size="small" type="outline" @click="openTemplateManager">
                  <template #icon>
                    <i class="iconfont icon-template"></i>
                  </template>
                  {{ t('模板管理') }}
                </a-button>
                <a-button size="small" type="outline" @click="openTemplateEditor()">
                  <template #icon>
                    <i class="iconfont icon-plus"></i>
                  </template>
                  {{ t('新建模板') }}
                </a-button>
              </div>
            </div>

            <!-- 预设模板选择 -->
            <a-radio-group v-model="selectedCoverStyle" direction="vertical" class="w-full mb-4">
              <div v-for="style in coverStyles" :key="style.value" class="mb-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border">
                <a-radio :value="style.value">
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <span class="font-medium">{{ style.label }}</span>
                      <p class="text-gray-500 text-sm mt-1">{{ style.description }}</p>
                      <div v-if="style.params" class="flex gap-2 mt-2 text-xs text-gray-600">
                        <span>{{ style.params }}</span>
                      </div>
                    </div>
                    <!-- 模板预览 -->
                    <div class="ml-4 flex items-center space-x-3">
                      <div class="relative group">
                        <img
                          :src="style.previewImage"
                          class="w-16 h-12 object-cover rounded border"
                          :alt="style.label"
                        />
                      </div>
                      <span class="text-2xl">{{ style.preview }}</span>
                    </div>
                  </div>
                </a-radio>
              </div>
            </a-radio-group>

            <!-- 自定义模板选择 -->
            <div v-if="customTemplates.length > 0" class="mb-4">
              <h5 class="font-medium mb-2 text-gray-700">{{ t('自定义模板') }}</h5>
              <a-radio-group v-model="selectedCoverStyle" direction="vertical" class="w-full">
                <div v-for="template in customTemplates" :key="template.id" class="mb-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border-2"
                     :class="selectedCustomTemplate?.id === template.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200'">
                  <a-radio :value="`custom_${template.id}`">
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <div class="flex items-center">
                          <span class="font-medium">{{ template.name }}</span>
                          <a-button size="mini" type="text" @click.stop="openTemplateEditor(template)" class="ml-2">
                            <template #icon>
                              <i class="iconfont icon-edit"></i>
                            </template>
                          </a-button>
                        </div>
                        <p class="text-gray-500 text-sm mt-1">{{ template.titles.main.text }} {{ template.titles.sub.text }}</p>
                        <div class="flex gap-2 mt-2 text-xs text-gray-600">
                          <span v-if="template.background.blurEnabled">背景模糊</span>
                          <span v-if="template.portrait.strokeEnabled">描边</span>
                        </div>
                      </div>
                      <div class="ml-4 flex items-center space-x-3">
                        <div class="w-16 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded border flex items-center justify-center">
                          <i class="iconfont icon-template text-white text-lg"></i>
                        </div>
                        <span class="text-lg">🎨</span>
                      </div>
                    </div>
                  </a-radio>
                </div>
              </a-radio-group>
            </div>

            <!-- 立即生成封面预览按钮 -->
            <div class="mt-4 pt-4 border-t border-gray-200">
              <a-button
                type="primary"
                size="large"
                :loading="loading"
                :disabled="!canGenerateCoverPreview"
                @click="generateCoverPreview"
                class="w-full"
                :class="!canGenerateCoverPreview ? 'bg-gray-300' : 'bg-blue-500 hover:bg-blue-600'"
              >
                <template #icon>
                  <i class="iconfont icon-magic"></i>
                </template>
                {{ t('立即生成封面预览') }}
              </a-button>
              <p class="text-sm text-gray-500 mt-2 text-center">{{ t('选择封面样式并上传视频后，可预览封面效果') }}</p>
            </div>

            <!-- 封面参数设置 -->
            <div class="mt-6 pt-4 border-t border-gray-200">
              <div class="flex items-center justify-between mb-4">
                <h4 class="font-medium">{{ t('封面参数设置') }}</h4>
                <div class="flex space-x-2">
                  <a-button size="small" @click="showAdvancedSettings = !showAdvancedSettings">
                    <template #icon>
                      <i class="iconfont" :class="showAdvancedSettings ? 'icon-up' : 'icon-down'"></i>
                    </template>
                    {{ showAdvancedSettings ? t('收起') : t('展开') }}
                  </a-button>
                  <a-button size="small" type="outline" @click="resetCoverParams">
                    <template #icon>
                      <i class="iconfont icon-refresh"></i>
                    </template>
                    {{ t('重置') }}
                  </a-button>
                </div>
              </div>

              <!-- 基础设置 -->
              <div class="space-y-4">
                <!-- 文字间距控制 -->
                <div v-if="selectedCoverStyle.startsWith('custom_')" class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h5 class="font-medium text-blue-900 mb-3 flex items-center">
                    <i class="iconfont icon-text mr-2"></i>
                    {{ t('文字间距调整') }}
                  </h5>

                  <!-- 主标题间距 -->
                  <div class="mb-4">
                    <div class="text-sm font-medium text-gray-700 mb-2">{{ t('主标题') }}</div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-xs text-gray-600 mb-1">
                          {{ t('字符间距') }}: {{ mainTitleCharSpacing !== undefined ? mainTitleCharSpacing + 'px' : t('默认') }}
                        </label>
                        <a-slider
                          v-model="mainTitleCharSpacing"
                          :min="0"
                          :max="100"
                          :step="1"
                          :marks="{ 0: '0', 50: '50', 100: '100' }"
                        />
                        <a-button size="mini" type="text" @click="mainTitleCharSpacing = undefined" class="mt-1">
                          {{ t('使用默认') }}
                        </a-button>
                      </div>
                      <div>
                        <label class="block text-xs text-gray-600 mb-1">
                          {{ t('行间距') }}: {{ mainTitleLineSpacing !== undefined ? mainTitleLineSpacing + 'px' : t('默认') }}
                        </label>
                        <a-slider
                          v-model="mainTitleLineSpacing"
                          :min="0"
                          :max="200"
                          :step="1"
                          :marks="{ 0: '0', 100: '100', 200: '200' }"
                        />
                        <a-button size="mini" type="text" @click="mainTitleLineSpacing = undefined" class="mt-1">
                          {{ t('使用默认') }}
                        </a-button>
                      </div>
                    </div>
                  </div>

                  <!-- 副标题间距 -->
                  <div>
                    <div class="text-sm font-medium text-gray-700 mb-2">{{ t('副标题') }}</div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-xs text-gray-600 mb-1">
                          {{ t('字符间距') }}: {{ subTitleCharSpacing !== undefined ? subTitleCharSpacing + 'px' : t('默认') }}
                        </label>
                        <a-slider
                          v-model="subTitleCharSpacing"
                          :min="0"
                          :max="100"
                          :step="1"
                          :marks="{ 0: '0', 50: '50', 100: '100' }"
                        />
                        <a-button size="mini" type="text" @click="subTitleCharSpacing = undefined" class="mt-1">
                          {{ t('使用默认') }}
                        </a-button>
                      </div>
                      <div>
                        <label class="block text-xs text-gray-600 mb-1">
                          {{ t('行间距') }}: {{ subTitleLineSpacing !== undefined ? subTitleLineSpacing + 'px' : t('默认') }}
                        </label>
                        <a-slider
                          v-model="subTitleLineSpacing"
                          :min="0"
                          :max="200"
                          :step="1"
                          :marks="{ 0: '0', 100: '100', 200: '200' }"
                        />
                        <a-button size="mini" type="text" @click="subTitleLineSpacing = undefined" class="mt-1">
                          {{ t('使用默认') }}
                        </a-button>
                      </div>
                    </div>
                  </div>

                  <div class="mt-3 text-xs text-blue-700 bg-blue-100 p-2 rounded">
                    <i class="iconfont icon-info-circle mr-1"></i>
                    {{ t('调整后点击"立即生成封面预览"查看效果') }}
                  </div>
                </div>

                <!-- 封面文字 -->
                <div>
                  <label class="block text-sm font-medium mb-2">{{ t('封面文字') }}</label>
                  <a-input
                    v-model="coverText"
                    :placeholder="t('输入要显示在封面上的文字')"
                    class="w-full"
                  />
                </div>

                <!-- 文字位置 -->
                <div>
                  <label class="block text-sm font-medium mb-2">{{ t('文字位置') }}</label>
                  <a-radio-group v-model="coverTextPosition" direction="horizontal">
                    <a-radio value="top">{{ t('顶部') }}</a-radio>
                    <a-radio value="center">{{ t('居中') }}</a-radio>
                    <a-radio value="bottom">{{ t('底部') }}</a-radio>
                  </a-radio-group>
                </div>

                <!-- 文字颜色 -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium mb-2">{{ t('文字颜色') }}</label>
                    <div class="flex space-x-2">
                      <input
                        type="color"
                        v-model="coverTextColor"
                        class="w-12 h-8 border border-gray-300 rounded"
                      />
                      <a-input
                        v-model="coverTextColor"
                        :placeholder="'#FFFFFF'"
                        class="flex-1"
                      />
                    </div>
                  </div>

                  <!-- 文字大小 -->
                  <div>
                    <label class="block text-sm font-medium mb-2">{{ t('文字大小') }}: {{ coverTextSize }}px</label>
                    <a-slider
                      v-model="coverTextSize"
                      :min="20"
                      :max="120"
                      :step="5"
                      class="w-full"
                    />
                  </div>
                </div>
              </div>

              <!-- 高级设置 -->
              <div v-if="showAdvancedSettings" class="mt-6 pt-4 border-t border-gray-200">
                <h5 class="font-medium mb-4 text-gray-700">{{ t('高级设置') }}</h5>

                <div class="grid grid-cols-2 gap-4">
                  <!-- 描边颜色 -->
                  <div>
                    <label class="block text-sm font-medium mb-2">{{ t('描边颜色') }}</label>
                    <div class="flex space-x-2">
                      <input
                        type="color"
                        v-model="outlineColor"
                        class="w-12 h-8 border border-gray-300 rounded"
                      />
                      <a-input
                        v-model="outlineColor"
                        :placeholder="'#FFD700'"
                        class="flex-1"
                      />
                    </div>
                  </div>

                  <!-- 描边宽度 -->
                  <div>
                    <label class="block text-sm font-medium mb-2">{{ t('描边宽度') }}: {{ outlineWidth }}px</label>
                    <a-slider
                      v-model="outlineWidth"
                      :min="0"
                      :max="10"
                      :step="1"
                      class="w-full"
                    />
                  </div>

                  <!-- 背景模糊度 -->
                  <div>
                    <label class="block text-sm font-medium mb-2">{{ t('背景模糊度') }}: {{ blurRadius }}</label>
                    <a-slider
                      v-model="blurRadius"
                      :min="0"
                      :max="50"
                      :step="1"
                      class="w-full"
                    />
                  </div>

                  <!-- 放大倍数 -->
                  <div>
                    <label class="block text-sm font-medium mb-2">{{ t('放大倍数') }}: {{ zoomLevel.toFixed(1) }}x</label>
                    <a-slider
                      v-model="zoomLevel"
                      :min="0.5"
                      :max="3.0"
                      :step="0.1"
                      class="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex space-x-4">
          <a-button
            type="primary"
            size="large"
            :loading="loading"
            :disabled="!canGenerate"
            @click="handleGenerate"
            class="flex-1"
          >
            <template #icon>
              <i class="iconfont icon-magic"></i>
            </template>
            {{ t('一键生成字幕和封面') }}
          </a-button>
          <a-button size="large" @click="clearUpload">
            {{ t('重置') }}
          </a-button>
        </div>
      </div>

      <!-- 右侧：预览区域 -->
      <div class="space-y-6">
        <!-- 封面实时预览 -->
        <div v-if="generatedCoverPreview" class="bg-white p-6 rounded-lg border border-gray-200 border-blue-400 shadow-lg">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold flex items-center">
              <i class="iconfont icon-image mr-2 text-blue-500"></i>
              {{ t('封面实时预览') }}
            </h3>
            <a-button type="text" size="small" @click="generatedCoverPreview = ''">
              <template #icon>
                <i class="iconfont icon-close"></i>
              </template>
            </a-button>
          </div>
          <div class="relative group cursor-pointer" @click="openPreview(generatedCoverPreview)">
            <img :src="generatedCoverPreview" class="w-full h-64 object-cover rounded-lg" alt="Cover Preview" />
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center rounded-lg">
              <i class="iconfont icon-zoom-in text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
            </div>
          </div>
          <p class="text-sm text-gray-500 mt-3 text-center">{{ t('点击可放大查看封面效果') }}</p>
          <div class="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-600 text-center">
            <i class="iconfont icon-info-circle mr-1"></i>
            {{ t('当前样式') }}: {{ coverStyles.find(s => s.value === selectedCoverStyle)?.label }}
          </div>
        </div>

        <!-- 字幕预览 -->
        <div class="bg-white p-6 rounded-lg border border-gray-200">
          <h3 class="text-lg font-semibold mb-4 flex items-center">
            <i class="iconfont icon-text mr-2 text-blue-500"></i>
            {{ t('字幕预览') }}
          </h3>
          <div v-if="subtitlePreview.length > 0" class="space-y-2 max-h-64 overflow-y-auto">
            <div v-for="item in subtitlePreview" :key="item.id" class="flex items-center p-3 bg-gray-50 rounded">
              <span class="text-sm font-medium text-gray-500 w-8">{{ item.id }}</span>
              <span class="flex-1">{{ item.text }}</span>
              <span class="text-sm text-gray-400">{{ item.startTime }}s - {{ item.endTime }}s</span>
            </div>
          </div>
          <div v-else class="text-center text-gray-400 py-8">
            <i class="iconfont icon-text text-3xl mb-2"></i>
            <p>{{ t('输入文案后将显示字幕预览') }}</p>
          </div>
        </div>

        <!-- 生成结果 -->
        <div v-if="generatedVideoUrl || generatedCoverUrl" class="space-y-6">
          <!-- 视频结果 -->
          <div v-if="generatedVideoUrl" class="bg-white p-6 rounded-lg border border-gray-200">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold flex items-center">
                <i class="iconfont icon-video mr-2 text-green-500"></i>
                {{ t('生成的视频') }}
              </h3>
              <a-button type="outline" @click="downloadVideo">
                <template #icon>
                  <i class="iconfont icon-download"></i>
                </template>
                {{ t('下载') }}
              </a-button>
            </div>
            <VideoPlayer :src="generatedVideoUrl" class="w-full h-48" />
          </div>

          <!-- 封面结果 -->
          <div v-if="generatedCoverUrl" class="bg-white p-6 rounded-lg border border-gray-200">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold flex items-center">
                <i class="iconfont icon-image mr-2 text-purple-500"></i>
                {{ t('生成的封面') }}
              </h3>
              <div class="flex space-x-2">
                <a-button type="outline" @click="regenerateCover" :loading="loading">
                  <template #icon>
                    <i class="iconfont icon-refresh"></i>
                  </template>
                  {{ t('重新生成') }}
                </a-button>
                <a-button type="outline" @click="downloadCover">
                  <template #icon>
                    <i class="iconfont icon-download"></i>
                  </template>
                  {{ t('下载') }}
                </a-button>
              </div>
            </div>

            <!-- 封面预览（支持放大） -->
            <div class="relative group cursor-pointer" @click="openPreview(generatedCoverUrl)">
              <img :src="generatedCoverUrl" class="w-full h-48 object-cover rounded-lg" alt="Generated Cover" />
              <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center rounded-lg">
                <i class="iconfont icon-zoom-in text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
              </div>
            </div>
            <p class="text-sm text-gray-500 mt-2 text-center">{{ t('点击封面可放大查看') }}</p>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="bg-white p-12 rounded-lg border border-gray-200 text-center">
          <i class="iconfont icon-magic text-6xl text-gray-300 mb-4"></i>
          <p class="text-gray-500 text-lg mb-2">{{ t('等待生成结果') }}</p>
          <p class="text-gray-400">{{ t('上传视频并输入文案后，点击"一键生成"查看结果') }}</p>
        </div>
      </div>
    </div>

    <!-- 自定义模板编辑器对话框 -->
    <a-modal
      v-model:visible="showTemplateEditor"
      title="自定义模板编辑器"
      width="95%"
      unmount-on-close
      @ok="saveTemplate(currentTemplate)"
      @cancel="showTemplateEditor = false"
      ok-text="保存模板"
      cancel-text="取消"
    >
      <TemplateEditor
        v-if="showTemplateEditor"
        :currentTemplate="currentTemplate"
        :videoPreviewUrl="videoPreviewUrl"
        @template-change="handleTemplateChange"
        @generate-preview="saveTemplate"
      />
    </a-modal>

    <!-- 模板管理器对话框 -->
    <a-modal
      v-model:visible="showTemplateManager"
      title="模板管理"
      width="800px"
      :footer="false"
      unmount-on-close
    >
      <TemplateManager
        :templates="customTemplates"
        :max-templates="10"
        @template-select="selectTemplate"
        @template-save="saveTemplate"
        @template-delete="deleteTemplate"
        @template-rename="renameTemplate"
      />
    </a-modal>

    <!-- 图片预览对话框 -->
    <a-modal
      v-model:visible="previewVisible"
      :footer="false"
      width="90%"
      unmount-on-close
      @cancel="closePreview"
    >
      <div class="flex justify-center items-center">
        <img :src="previewImageUrl" class="max-w-full max-h-[80vh] object-contain" alt="Preview" />
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.subtitle-cover-generator {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.grid {
  display: grid;
  gap: 1.5rem;
}

.grid-cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

@media (max-width: 1024px) {
  .grid-cols-2 {
    grid-template-columns: 1fr;
  }
}

.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}

.group:hover .group-hover\:bg-opacity-20 {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>