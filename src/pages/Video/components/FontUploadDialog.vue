<template>
    <a-modal
        :visible="visible"
        :title="t('上传字体')"
        width="600px"
        @cancel="handleCancel"
        @before-ok="handleUpload"
        :ok-loading="uploading"
    >
        <a-form :model="formData" layout="vertical">
            <!-- 字体文件上传 -->
            <a-form-item :label="t('字体文件')" required>
                <a-upload
                    :custom-request="handleFileSelect"
                    :show-file-list="false"
                    accept=".ttf,.otf,.woff,.woff2"
                >
                    <template #upload-button>
                        <a-button type="outline">
                            <template #icon>
                                <icon-upload />
                            </template>
                            {{ t('选择字体文件') }}
                        </a-button>
                    </template>
                </a-upload>
                <div v-if="formData.file" class="mt-2 p-3 bg-gray-50 rounded flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <icon-file class="text-blue-500" />
                        <div>
                            <div class="font-medium">{{ formData.file.name }}</div>
                            <div class="text-xs text-gray-500">{{ formatFileSize(formData.file.size) }}</div>
                        </div>
                    </div>
                    <a-button size="small" type="text" @click="formData.file = null">
                        <icon-close />
                    </a-button>
                </div>
                <div class="text-xs text-gray-500 mt-2">
                    {{ t('支持格式：TTF, OTF, WOFF, WOFF2') }}
                </div>
            </a-form-item>

            <!-- 字体名称 -->
            <a-form-item :label="t('字体名称')" required>
                <a-input
                    v-model="formData.displayName"
                    :placeholder="t('例如：思源黑体')"
                />
                <div class="text-xs text-gray-500 mt-1">
                    {{ t('用于在界面中显示的名称') }}
                </div>
            </a-form-item>

            <!-- 字体标识 -->
            <a-form-item :label="t('字体标识')" required>
                <a-input
                    v-model="formData.fontFamily"
                    :placeholder="t('例如：Source Han Sans')"
                />
                <div class="text-xs text-gray-500 mt-1">
                    {{ t('CSS font-family 属性值，通常与字体文件内部名称一致') }}
                </div>
            </a-form-item>

            <!-- 字体分类 -->
            <a-form-item :label="t('字体分类')">
                <a-select v-model="formData.category" :placeholder="t('选择分类')">
                    <a-option value="sans-serif">{{ t('无衬线') }}</a-option>
                    <a-option value="serif">{{ t('衬线') }}</a-option>
                    <a-option value="monospace">{{ t('等宽') }}</a-option>
                    <a-option value="handwriting">{{ t('手写') }}</a-option>
                    <a-option value="display">{{ t('展示') }}</a-option>
                </a-select>
            </a-form-item>

            <!-- 支持语言 -->
            <a-form-item :label="t('支持语言')">
                <a-select
                    v-model="formData.languages"
                    :placeholder="t('选择支持的语言')"
                    multiple
                    allow-clear
                >
                    <a-option value="zh-CN">简体中文</a-option>
                    <a-option value="zh-TW">繁体中文</a-option>
                    <a-option value="en">English</a-option>
                    <a-option value="ja">日本語</a-option>
                    <a-option value="ko">한국어</a-option>
                </a-select>
            </a-form-item>

            <!-- 字体类型 -->
            <a-form-item :label="t('字体类型')">
                <a-radio-group v-model="formData.fontType">
                    <a-radio value="Chinese">
                        <span class="flex items-center gap-2">
                            {{ t('中文字体') }}
                            <a-tag size="small" color="red">CN</a-tag>
                        </span>
                    </a-radio>
                    <a-radio value="English">
                        <span class="flex items-center gap-2">
                            {{ t('英文字体') }}
                            <a-tag size="small" color="cyan">EN</a-tag>
                        </span>
                    </a-radio>
                    <a-radio value="Mixed">
                        <span class="flex items-center gap-2">
                            {{ t('混合字体') }}
                            <a-tag size="small" color="orange">MIX</a-tag>
                        </span>
                    </a-radio>
                </a-radio-group>
                <div class="text-xs text-gray-500 mt-2">
                    {{ t('自动检测: {detectedType}', { detectedType: detectedFontType.value }) }}
                </div>
            </a-form-item>

            <!-- 字体预览 -->
            <a-form-item v-if="formData.fontFamily" :label="t('预览')">
                <div
                    class="p-4 bg-gray-50 rounded border"
                    :style="{ fontFamily: formData.fontFamily }"
                >
                    <div class="text-2xl mb-2">{{ previewText }}</div>
                    <div class="text-sm text-gray-600">
                        ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>
                        abcdefghijklmnopqrstuvwxyz<br>
                        0123456789
                    </div>
                </div>
                <a-input
                    v-model="previewText"
                    :placeholder="t('自定义预览文本')"
                    class="mt-2"
                />
            </a-form-item>
        </a-form>
    </a-modal>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Message } from '@arco-design/web-vue';

const { t } = useI18n();

interface Props {
    visible: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    visible: false
});

const emit = defineEmits<{
    'update:visible': [value: boolean];
    success: [];
}>();

const uploading = ref(false);
const previewText = ref('快速的棕色狐狸跳过懒狗');

const formData = ref({
    file: null as File | null,
    displayName: '',
    fontFamily: '',
    category: 'sans-serif',
    languages: ['zh-CN', 'en'],
    fontType: 'Mixed' as 'Chinese' | 'English' | 'Mixed',
    uploadToZiti: true,
});

/**
 * 自动检测字体类型
 */
const detectFontType = (fontName: string, languages: string[]): 'Chinese' | 'English' | 'Mixed' => {
    // 中文字体关键词列表
    const chineseKeywords = [
        '中文', '中', '汉', '黑', '宋', '楷', '隶', '篆', '仿',
        '雅黑', '微软', '思源', '猫啃', '墨趣', '古风',
        '骚包', '手写', '毛峰', '张亚玲', '黑方', '朴素',
        'simhei', 'simsun', 'yahei', '胡晓波', '平方',
        '雨晨', '字体', '书法', '装饰', '标题', '毛笔'
    ];

    // 英文字体关键词列表
    const englishKeywords = [
        'arial', 'helvetica', 'times', 'courier', 'verdana', 'georgia',
        'comic', 'impact', 'trebuchet', 'lucida', 'palatino',
        'bodoni', 'garamond', 'calibri', 'consolas', 'monaco',
        'roboto', 'open sans', 'lato', 'raleway', 'montserrat',
        'murecho', 'maoken', 'dymon', 'fonte', 'bold',
        'light', 'regular', 'medium', 'semibold', 'extralight'
    ];

    const fontNameLower = fontName.toLowerCase();

    // 检查支持的语言
    const supportsChinese = languages.includes('zh-CN') || languages.includes('zh-TW') || languages.includes('zh');
    const supportsEnglish = languages.includes('en') || languages.length === 0;

    // 根据字体名称匹配关键词
    const hasChineseKeyword = chineseKeywords.some(keyword =>
        fontNameLower.includes(keyword.toLowerCase())
    );

    const hasEnglishKeyword = englishKeywords.some(keyword =>
        fontNameLower.includes(keyword.toLowerCase())
    );

    // 检查字体名称中是否有中文字符
    const chineseCharMatch = fontName.match(/[\u4e00-\u9fff]/);
    if (chineseCharMatch) {
        return 'Chinese';
    }

    // 判断逻辑
    if (supportsChinese && hasChineseKeyword) {
        return 'Chinese';
    }

    if (supportsChinese && !supportsEnglish) {
        return 'Chinese';
    }

    if (!supportsChinese && supportsEnglish) {
        return 'English';
    }

    // 根据关键词判断
    if (hasChineseKeyword) {
        return 'Chinese';
    }

    if (hasEnglishKeyword) {
        return 'English';
    }

    // 默认判断
    if (supportsChinese && supportsEnglish) {
        return 'Mixed';
    }

    if (supportsChinese) {
        return 'Chinese';
    }

    return 'English';
};

/**
 * 计算自动检测的字体类型
 */
const detectedFontType = computed(() => {
    if (!formData.value.fontFamily || formData.value.languages.length === 0) {
        return t('待检测');
    }
    const detected = detectFontType(formData.value.fontFamily, formData.value.languages);
    const typeLabels: Record<string, string> = {
        'Chinese': t('中文字体'),
        'English': t('英文字体'),
        'Mixed': t('混合字体')
    };
    return typeLabels[detected] || detected;
});

// 监听visible变化，重置表单
watch(() => props.visible, (newVal) => {
    if (!newVal) {
        resetForm();
    }
});

// 重置表单
const resetForm = () => {
    formData.value = {
        file: null,
        displayName: '',
        fontFamily: '',
        category: 'sans-serif',
        languages: ['zh-CN', 'en'],
        fontType: 'Mixed',
        uploadToZiti: true,  // 保存到应用安装目录的ziti，通过asarUnpack配置保护，更新不覆盖
    };
};

// 处理文件选择
const handleFileSelect = (option: any) => {
    const file = option.fileItem.file;
    if (file) {
        formData.value.file = file;

        // 自动填充字体名称（从文件名提取）
        if (!formData.value.displayName) {
            const nameWithoutExt = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, '');
            formData.value.displayName = nameWithoutExt;
        }

        // 自动填充字体标识
        if (!formData.value.fontFamily) {
            const nameWithoutExt = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, '');
            formData.value.fontFamily = nameWithoutExt;

            // 自动检测并设置字体类型
            const detected = detectFontType(nameWithoutExt, formData.value.languages);
            formData.value.fontType = detected;
        }
    }
    return Promise.resolve();
};

// 格式化文件大小
const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

// 验证表单
const validateForm = () => {
    if (!formData.value.file) {
        Message.warning(t('请选择字体文件'));
        return false;
    }
    if (!formData.value.displayName) {
        Message.warning(t('请输入字体名称'));
        return false;
    }
    if (!formData.value.fontFamily) {
        Message.warning(t('请输入字体标识'));
        return false;
    }
    return true;
};

// 处理上传
const handleUpload = async () => {
    if (!validateForm()) {
        return false;
    }

    uploading.value = true;
    try {
        console.log('[FontUploadDialog] 开始上传字体:', {
            fileName: formData.value.file!.name,
            fileSize: formData.value.file!.size,
            displayName: formData.value.displayName,
            fontFamily: formData.value.fontFamily
        });

        // 读取文件内容
        const fileBuffer = await formData.value.file!.arrayBuffer();
        console.log('[FontUploadDialog] 文件读取成功, buffer size:', fileBuffer.byteLength);

        // 转换为Base64编码（避免IPC传输大数组时的克隆问题）
        const uint8Array = new Uint8Array(fileBuffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binaryString += String.fromCharCode(uint8Array[i]);
        }
        const fileDataBase64 = btoa(binaryString);
        console.log('[FontUploadDialog] 转换为Base64成功, length:', fileDataBase64.length);

        // 准备上传参数
        const uploadParams = {
            fileName: formData.value.file!.name,
            fileDataBase64: fileDataBase64,
            displayName: formData.value.displayName,
            fontFamily: formData.value.fontFamily,
            category: formData.value.category,
            languages: [...formData.value.languages], // 确保是纯数组
            fontType: formData.value.fontType,
            uploadToZiti: formData.value.uploadToZiti,
        };

        console.log('[FontUploadDialog] 准备调用API, params:', {
            fileName: uploadParams.fileName,
            displayName: uploadParams.displayName,
            fontFamily: uploadParams.fontFamily,
            category: uploadParams.category,
            languages: uploadParams.languages,
            fontType: uploadParams.fontType,
            uploadToZiti: uploadParams.uploadToZiti,
            fileDataBase64Length: uploadParams.fileDataBase64.length
        });

        // 调用API上传字体
        const result = await window.$mapi.fontManager.uploadFont(uploadParams);

        console.log('[FontUploadDialog] API调用结果:', result);

        if (result.success) {
            Message.success(t('字体上传成功'));
            emit('success');
            emit('update:visible', false);
            return true;
        } else {
            Message.error(result.message || t('上传失败'));
            return false;
        }
    } catch (error) {
        console.error('[FontUploadDialog] 上传字体失败:', error);
        console.error('[FontUploadDialog] 错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息');
        Message.error(t('上传字体失败') + ': ' + (error instanceof Error ? error.message : String(error)));
        return false;
    } finally {
        uploading.value = false;
    }
};

// 处理取消
const handleCancel = () => {
    emit('update:visible', false);
};
</script>

<style scoped>
:deep(.arco-upload) {
    width: 100%;
}
</style>
