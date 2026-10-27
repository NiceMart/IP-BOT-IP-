<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { t } from "../../../lang";

// 封面样式定义
export interface CoverStyle {
    // 文字设置
    titleFontSize: number;
    titleFontColor: string;
    titlePosition: 'top' | 'center' | 'bottom';
    titleAlignment: 'left' | 'center' | 'right';
    textDirection: 'horizontal' | 'vertical';
    textAngle: number;
    
    // 背景设置
    hasBackgroundBox: boolean;
    backgroundColor: string;
    backgroundOpacity: number;
    borderRadius: number;
    padding: number;
    
    // 效果设置
    titleShadowEnabled?: boolean;
    titleShadowColor?: string;
    titleShadowOffsetX?: number;
    titleShadowOffsetY?: number;
    titleShadowBlur?: number;
    hasBorder: boolean;
    borderColor: string;
    borderWidth: number;
    hasGlowEffect: boolean;
    glowColor: string;
    glowIntensity: number;
    
    // 副标题
    hasSubtitle: boolean;
    subtitleFontSize: number;
    subtitleFontColor: string;
    subtitleText: string;
    subtitleShadowEnabled?: boolean;
    subtitleShadowColor?: string;
    subtitleShadowOffsetX?: number;
    subtitleShadowOffsetY?: number;
    subtitleShadowBlur?: number;
    
    // 底部横幅
    hasBottomBanner: boolean;
    bannerColor: string;
    bannerHeight: number;
    
    // 背景处理
    blurBackground: boolean;
    blurIntensity: number;
    extractPerson: boolean;
    personOutlineColor: string; // 人像描边颜色
    personOutlineWidth: number; // 人像描边宽度
}

const props = defineProps<{
    modelValue?: string;
    coverStyle?: CoverStyle;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'styleChange', style: CoverStyle): void;
}>();

// 自定义封面样式
const coverStyle = ref<CoverStyle>(props.coverStyle || {
    // 文字设置
    titleFontSize: 90,
    titleFontColor: '#FFFFFF',
    titlePosition: 'bottom',
    titleAlignment: 'center',
    textDirection: 'horizontal',
    textAngle: 0,
    
    // 背景设置
    hasBackgroundBox: false,
    backgroundColor: '#000000',
    backgroundOpacity: 0.8,
    borderRadius: 0,
    padding: 25,
    
    // 效果设置
    titleShadowEnabled: true,
    titleShadowColor: '#000000',
    titleShadowOffsetX: 0,
    titleShadowOffsetY: 0,
    titleShadowBlur: 10,
    hasBorder: false,
    borderColor: '#FFFFFF',
    borderWidth: 4,
    hasGlowEffect: false,
    glowColor: '#00BFFF',
    glowIntensity: 8,
    
    // 副标题
    hasSubtitle: false,
    subtitleFontSize: 60,
    subtitleFontColor: '#FFFFFF',
    subtitleText: '',
    subtitleShadowEnabled: true,      // 副标题默认启用阴影
    subtitleShadowColor: '#000000',   // 阴影颜色，默认黑色
    subtitleShadowOffsetX: 0,         // 阴影X偏移，默认0
    subtitleShadowOffsetY: 0,         // 阴影Y偏移，默认0
    subtitleShadowBlur: 5,            // 副标题阴影模糊，默认5px
    
    // 底部横幅
    hasBottomBanner: false,
    bannerColor: '#FFD700',
    bannerHeight: 130,
    
    // 背景处理
    blurBackground: false,
    blurIntensity: 50, // 增强模糊强度
    extractPerson: false,
    personOutlineColor: '#FFFFFF', // 白色描边
    personOutlineWidth: 3 // 描边宽度
});

// 监听样式变化
watch(coverStyle, (newStyle) => {
    emit('styleChange', newStyle);
}, { deep: true });

// 获取选中的样式
const getSelectedStyle = () => {
    return coverStyle.value;
};

defineExpose({
    getSelectedStyle
});
</script>

<template>
    <div class="cover-style-editor space-y-6">
        <h4 class="font-bold text-base mb-4">{{ t("封面样式自定义") }}</h4>
        
        <!-- 文字设置 -->
        <div class="space-y-4">
            <h5 class="font-medium text-sm text-gray-700 mb-3">{{ t("文字设置") }}</h5>
            
            <!-- 字体大小 -->
            <div>
                <label class="text-sm text-gray-600 mb-2 block">{{ t("字体大小") }}</label>
                <div class="flex items-center gap-2">
                    <a-slider
                        v-model="coverStyle.titleFontSize"
                        :min="40"
                        :max="150"
                        :step="5"
                        class="flex-1"
                    />
                    <span class="text-sm font-mono w-16 text-right">{{ coverStyle.titleFontSize }}px</span>
                </div>
            </div>
            
            <!-- 文字颜色 -->
            <div>
                <label class="text-sm text-gray-600 mb-2 block">{{ t("文字颜色") }}</label>
                <div class="flex items-center gap-2">
                    <a-color-picker v-model="coverStyle.titleFontColor" />
                    <a-input v-model="coverStyle.titleFontColor" class="flex-1" size="small" placeholder="#FFFFFF" />
                </div>
            </div>
            
            <!-- 文字位置 -->
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("垂直位置") }}</label>
                    <a-select v-model="coverStyle.titlePosition" size="small">
                        <a-option value="top">{{ t("顶部") }}</a-option>
                        <a-option value="center">{{ t("居中") }}</a-option>
                        <a-option value="bottom">{{ t("底部") }}</a-option>
                    </a-select>
                </div>
                
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("水平对齐") }}</label>
                    <a-select v-model="coverStyle.titleAlignment" size="small">
                        <a-option value="left">{{ t("左对齐") }}</a-option>
                        <a-option value="center">{{ t("居中") }}</a-option>
                        <a-option value="right">{{ t("右对齐") }}</a-option>
                    </a-select>
                </div>
            </div>
            
            <!-- 文字方向 -->
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("文字方向") }}</label>
                    <a-select v-model="coverStyle.textDirection" size="small">
                        <a-option value="horizontal">{{ t("横向") }}</a-option>
                        <a-option value="vertical">{{ t("竖向") }}</a-option>
                    </a-select>
                </div>
                
                <div v-if="coverStyle.textDirection === 'horizontal'">
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("旋转角度") }}</label>
                    <a-input-number
                        v-model="coverStyle.textAngle"
                        :min="0"
                        :max="360"
                        :step="5"
                        size="small"
                        class="w-full"
                    />
                </div>
            </div>
        </div>
        
        <!-- 背景设置 -->
        <div class="space-y-4">
            <h5 class="font-medium text-sm text-gray-700 mb-3">{{ t("背景设置") }}</h5>
            
            <!-- 背景框 -->
            <div>
                <a-checkbox v-model="coverStyle.hasBackgroundBox">
                    {{ t("显示背景框") }}
                </a-checkbox>
            </div>
            
            <div v-if="coverStyle.hasBackgroundBox" class="space-y-3 pl-6 border-l-2 border-gray-200">
                <!-- 背景颜色 -->
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("背景颜色") }}</label>
                    <div class="flex items-center gap-2">
                        <a-color-picker v-model="coverStyle.backgroundColor" />
                        <a-input v-model="coverStyle.backgroundColor" class="flex-1" size="small" placeholder="#000000" />
                    </div>
                </div>
                
                <!-- 背景透明度 -->
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("背景透明度") }}</label>
                    <div class="flex items-center gap-2">
                        <a-slider
                            v-model="coverStyle.backgroundOpacity"
                            :min="0"
                            :max="1"
                            :step="0.05"
                            class="flex-1"
                        />
                        <span class="text-sm font-mono w-16 text-right">{{ Math.round(coverStyle.backgroundOpacity * 100) }}%</span>
                    </div>
                </div>
                
                <!-- 圆角 -->
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("圆角") }}</label>
                    <div class="flex items-center gap-2">
                        <a-slider
                            v-model="coverStyle.borderRadius"
                            :min="0"
                            :max="30"
                            :step="1"
                            class="flex-1"
                        />
                        <span class="text-sm font-mono w-12 text-right">{{ coverStyle.borderRadius }}px</span>
                    </div>
                </div>
                
                <!-- 内边距 -->
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("内边距") }}</label>
                    <div class="flex items-center gap-2">
                        <a-slider
                            v-model="coverStyle.padding"
                            :min="0"
                            :max="50"
                            :step="2"
                            class="flex-1"
                        />
                        <span class="text-sm font-mono w-12 text-right">{{ coverStyle.padding }}px</span>
                    </div>
                </div>
            </div>
            
            <!-- 底部横幅 -->
            <div>
                <a-checkbox v-model="coverStyle.hasBottomBanner">
                    {{ t("显示底部横幅") }}
                </a-checkbox>
            </div>
            
            <div v-if="coverStyle.hasBottomBanner" class="space-y-3 pl-6 border-l-2 border-gray-200">
                <!-- 横幅颜色 -->
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("横幅颜色") }}</label>
                    <div class="flex items-center gap-2">
                        <a-color-picker v-model="coverStyle.bannerColor" />
                        <a-input v-model="coverStyle.bannerColor" class="flex-1" size="small" placeholder="#FFD700" />
                    </div>
                </div>
                
                <!-- 横幅高度 -->
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("横幅高度") }}</label>
                    <div class="flex items-center gap-2">
                        <a-slider
                            v-model="coverStyle.bannerHeight"
                            :min="80"
                            :max="200"
                            :step="10"
                            class="flex-1"
                        />
                        <span class="text-sm font-mono w-16 text-right">{{ coverStyle.bannerHeight }}px</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 效果设置 -->
        <div class="space-y-4">
            <h5 class="font-medium text-sm text-gray-700 mb-3">{{ t("效果设置") }}</h5>
            
            <!-- 主标题阴影 -->
            <div>
                <a-checkbox v-model="coverStyle.titleShadowEnabled">
                    {{ t("主标题阴影") }}
                </a-checkbox>
            </div>

            <div v-if="coverStyle.titleShadowEnabled" class="space-y-3 pl-4 border-l-2 border-blue-200">
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("阴影颜色") }}</label>
                    <div class="flex items-center gap-2">
                        <a-color-picker v-model="coverStyle.titleShadowColor" size="small" />
                        <a-input v-model="coverStyle.titleShadowColor" class="flex-1" size="small" placeholder="#000000" />
                    </div>
                </div>

                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("阴影模糊") }}</label>
                    <div class="flex items-center gap-2">
                        <a-slider
                            v-model="coverStyle.titleShadowBlur"
                            :min="0"
                            :max="20"
                            :step="1"
                            class="flex-1"
                        />
                        <span class="text-sm font-mono w-12 text-right">{{ coverStyle.titleShadowBlur }}px</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-sm text-gray-600 mb-1 block">{{ t("偏移X") }}</label>
                        <a-input-number v-model="coverStyle.titleShadowOffsetX" :min="-20" :max="20" :step="1" size="small" />
                    </div>
                    <div>
                        <label class="text-sm text-gray-600 mb-1 block">{{ t("偏移Y") }}</label>
                        <a-input-number v-model="coverStyle.titleShadowOffsetY" :min="-20" :max="20" :step="1" size="small" />
                    </div>
                </div>
            </div>
            
            <!-- 边框 -->
            <div>
                <a-checkbox v-model="coverStyle.hasBorder">
                    {{ t("显示边框") }}
                </a-checkbox>
            </div>
            
            <div v-if="coverStyle.hasBorder" class="space-y-3 pl-6 border-l-2 border-gray-200">
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("边框颜色") }}</label>
                    <div class="flex items-center gap-2">
                        <a-color-picker v-model="coverStyle.borderColor" />
                        <a-input v-model="coverStyle.borderColor" class="flex-1" size="small" placeholder="#FFFFFF" />
                    </div>
                </div>
                
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("边框宽度") }}</label>
                    <div class="flex items-center gap-2">
                        <a-slider
                            v-model="coverStyle.borderWidth"
                            :min="1"
                            :max="10"
                            :step="1"
                            class="flex-1"
                        />
                        <span class="text-sm font-mono w-12 text-right">{{ coverStyle.borderWidth }}px</span>
                    </div>
                </div>
            </div>
            
            <!-- 发光效果 -->
            <div>
                <a-checkbox v-model="coverStyle.hasGlowEffect">
                    {{ t("显示发光效果") }}
                </a-checkbox>
            </div>
            
            <div v-if="coverStyle.hasGlowEffect" class="space-y-3 pl-6 border-l-2 border-gray-200">
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("发光颜色") }}</label>
                    <div class="flex items-center gap-2">
                        <a-color-picker v-model="coverStyle.glowColor" />
                        <a-input v-model="coverStyle.glowColor" class="flex-1" size="small" placeholder="#00BFFF" />
                    </div>
                </div>
                
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("发光强度") }}</label>
                    <div class="flex items-center gap-2">
                        <a-slider
                            v-model="coverStyle.glowIntensity"
                            :min="0"
                            :max="20"
                            :step="1"
                            class="flex-1"
                        />
                        <span class="text-sm font-mono w-12 text-right">{{ coverStyle.glowIntensity }}px</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 背景处理 -->
        <div class="space-y-4">
            <h5 class="font-medium text-sm text-gray-700 mb-3">{{ t("背景处理") }}</h5>
            
            <!-- 背景模糊 -->
            <div>
                <a-checkbox v-model="coverStyle.blurBackground">
                    {{ t("模糊背景") }}
                </a-checkbox>
            </div>
            
            <div v-if="coverStyle.blurBackground" class="space-y-3 pl-6 border-l-2 border-gray-200">
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("模糊强度") }} ({{ t("数值越大越模糊") }})</label>
                    <div class="flex items-center gap-2">
                        <a-slider
                            v-model="coverStyle.blurIntensity"
                            :min="10"
                            :max="100"
                            :step="5"
                            class="flex-1"
                        />
                        <span class="text-sm font-mono w-16 text-right">{{ coverStyle.blurIntensity }}</span>
                    </div>
                </div>
            </div>
            
            <!-- 人物提取 -->
            <div>
                <a-checkbox v-model="coverStyle.extractPerson">
                    {{ t("人物清晰（带描边）") }}
                </a-checkbox>
            </div>
            
            <div v-if="coverStyle.extractPerson" class="space-y-3 pl-6 border-l-2 border-gray-200">
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("描边颜色") }}</label>
                    <div class="flex items-center gap-2">
                        <a-color-picker v-model="coverStyle.personOutlineColor" />
                        <a-input v-model="coverStyle.personOutlineColor" class="flex-1" size="small" placeholder="#FFFFFF" />
                    </div>
                </div>
                
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("描边宽度") }}</label>
                    <div class="flex items-center gap-2">
                        <a-slider
                            v-model="coverStyle.personOutlineWidth"
                            :min="1"
                            :max="10"
                            :step="1"
                            class="flex-1"
                        />
                        <span class="text-sm font-mono w-12 text-right">{{ coverStyle.personOutlineWidth }}px</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 副标题 -->
        <div class="space-y-4">
            <h5 class="font-medium text-sm text-gray-700 mb-3">{{ t("副标题") }}</h5>
            
            <div>
                <a-checkbox v-model="coverStyle.hasSubtitle">
                    {{ t("显示副标题") }}
                </a-checkbox>
            </div>
            
            <div v-if="coverStyle.hasSubtitle" class="space-y-3 pl-6 border-l-2 border-gray-200">
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("副标题文字") }}</label>
                    <a-input v-model="coverStyle.subtitleText" size="small" :placeholder="t('输入副标题文字')" />
                </div>
                
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("副标题字体大小") }}</label>
                    <div class="flex items-center gap-2">
                        <a-slider
                            v-model="coverStyle.subtitleFontSize"
                            :min="30"
                            :max="100"
                            :step="5"
                            class="flex-1"
                        />
                        <span class="text-sm font-mono w-16 text-right">{{ coverStyle.subtitleFontSize }}px</span>
                    </div>
                </div>
                
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">{{ t("副标题颜色") }}</label>
                    <div class="flex items-center gap-2">
                        <a-color-picker v-model="coverStyle.subtitleFontColor" />
                        <a-input v-model="coverStyle.subtitleFontColor" class="flex-1" size="small" placeholder="#FFFFFF" />
                    </div>
                </div>

                <!-- 副标题阴影 -->
                <div>
                    <a-checkbox v-model="coverStyle.subtitleShadowEnabled">
                        {{ t("副标题阴影") }}
                    </a-checkbox>
                </div>

                <div v-if="coverStyle.subtitleShadowEnabled" class="space-y-3 pl-4 border-l-2 border-blue-200">
                    <div>
                        <label class="text-sm text-gray-600 mb-2 block">{{ t("阴影颜色") }}</label>
                        <div class="flex items-center gap-2">
                            <a-color-picker v-model="coverStyle.subtitleShadowColor" size="small" />
                            <a-input v-model="coverStyle.subtitleShadowColor" class="flex-1" size="small" placeholder="#000000" />
                        </div>
                    </div>

                    <div>
                        <label class="text-sm text-gray-600 mb-2 block">{{ t("阴影模糊") }}</label>
                        <div class="flex items-center gap-2">
                            <a-slider
                                v-model="coverStyle.subtitleShadowBlur"
                                :min="0"
                                :max="20"
                                :step="1"
                                class="flex-1"
                            />
                            <span class="text-sm font-mono w-12 text-right">{{ coverStyle.subtitleShadowBlur }}px</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-sm text-gray-600 mb-1 block">{{ t("偏移X") }}</label>
                            <a-input-number v-model="coverStyle.subtitleShadowOffsetX" :min="-20" :max="20" :step="1" size="small" />
                        </div>
                        <div>
                            <label class="text-sm text-gray-600 mb-1 block">{{ t("偏移Y") }}</label>
                            <a-input-number v-model="coverStyle.subtitleShadowOffsetY" :min="-20" :max="20" :step="1" size="small" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.cover-style-editor {
    max-height: 70vh;
    overflow-y: auto;
    padding-right: 8px;
}

.cover-style-editor::-webkit-scrollbar {
    width: 6px;
}

.cover-style-editor::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
}

.cover-style-editor::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;
}

.cover-style-editor::-webkit-scrollbar-thumb:hover {
    background: #555;
}
</style>
