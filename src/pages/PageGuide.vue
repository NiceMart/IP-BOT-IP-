<!-- Modified for IP Bot: publication preparation, configuration or security changes. See CHANGELOG.md. -->
<script setup lang="ts">
import {ref, reactive} from "vue";
import {AppConfig} from "../config";
import QrcodeWishImage from "../assets/image/support-placeholder.svg";

const activeCategory = ref('guide');
const searchQuery = ref('');
const showQrModal = ref(false);

// 指南分类
const categories = [
    { id: 'guide', name: '入门指南', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'faq', name: '常见问题', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'shortcuts', name: '快捷键', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'contact', name: '联系我们', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
];

// 入门指南内容
const guideSteps = [
    {
        num: '01',
        title: '添加数字人形象',
        desc: '在"形象管理"中添加数字人形象，建议选择能清晰看到嘴巴的视频，时长不低于20秒',
        tips: ['支持 MP4/AVI/MOV 格式', '建议分辨率 1920x1080', '确保背景简洁、光线充足']
    },
    {
        num: '02',
        title: '配置AI模型',
        desc: '在"模型管理"中添加本地或云端模型，配置文本生成、语音合成、数字人模型',
        tips: ['本地模型需要GPU支持', '云端模型需配置API密钥', '首次使用建议使用云端模型']
    },
    {
        num: '03',
        title: '合成数字人视频',
        desc: '进入"IP智能体"，输入文案内容，系统将自动完成：文案→语音→视频的全流程',
        tips: ['可调整语速和音调', '支持添加背景音乐', '可上传自定义字幕文件']
    },
    {
        num: '04',
        title: '编辑与导出',
        desc: '在"我的作品"中对生成的视频进行剪辑、添加特效，满意后导出发布',
        tips: ['支持多种导出分辨率', '可添加水印和片头片尾', '支持直接分享到社交平台']
    }
];

// 常见问题
const faqs = reactive([
    {
        question: '为什么视频生成失败？',
        answer: '可能原因：1) 模型未启动 2) 形象文件格式不支持 3) 网络连接异常 4) 账户余额不足。请检查以上项目后重试。',
        expanded: false
    },
    {
        question: '如何提升视频生成速度？',
        answer: '1) 使用本地GPU加速 2) 选择较小的输出分辨率 3) 减少视频时长 4) 使用轻量级模型。',
        expanded: false
    },
    {
        question: '本地模型和云端模型有什么区别？',
        answer: '本地模型运行在您自己的设备上，无需网络但需要较高硬件配置；云端模型通过API调用，依赖网络但配置要求低。',
        expanded: false
    },
    {
        question: '生成的视频有水印吗？',
        answer: '付费用户生成的视频无水印。免费用户生成的视频会带有平台水印。',
        expanded: false
    },
    {
        question: '支持哪些视频格式输出？',
        answer: '支持输出 MP4、MOV、AVI 格式，分辨率可选 720P、1080P、4K。',
        expanded: false
    },
    {
        question: '如何添加自定义音色？',
        answer: '在"音色管理"中，可以上传音频样本训练自定义音色，或从预置音色库中选择。',
        expanded: false
    }
]);

// 快捷键列表
const shortcuts = [
    { key: 'Ctrl + N', desc: '新建项目' },
    { key: 'Ctrl + S', desc: '保存当前' },
    { key: 'Ctrl + Z', desc: '撤销操作' },
    { key: 'Ctrl + Shift + Z', desc: '重做操作' },
    { key: 'Space', desc: '预览/暂停' },
    { key: 'Delete', desc: '删除选中' },
    { key: 'Ctrl + C', desc: '复制选中' },
    { key: 'Ctrl + V', desc: '粘贴内容' },
    { key: 'Ctrl + A', desc: '全选' },
    { key: 'F11', desc: '全屏模式' },
    { key: 'Esc', desc: '取消选中' },
    { key: 'Ctrl + E', desc: '导出视频' },
];

// 切换FAQ展开
const toggleFaq = (index: number) => {
    faqs[index].expanded = !faqs[index].expanded;
};

// 打开帮助文档
const openHelpDoc = () => {
    window.$mapi.app.openExternal(AppConfig.helpUrl);
};

// 打开反馈链接
const openFeedback = () => {
    window.$mapi.app.openExternal('https://my.feishu.cn/wiki/');
};
</script>

<template>
    <div class="guide-page">
        <!-- 页面头部 -->
        <div class="page-header">
            <div class="header-left">
                <div class="page-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="header-text">
                    <h1 class="page-title">帮助中心</h1>
                    <p class="page-desc">快速上手，解答疑惑</p>
                </div>
            </div>
            <a-button type="primary" @click="openHelpDoc" class="header-btn">
                <template #icon>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </template>
                在线文档
            </a-button>
        </div>

        <!-- 分类导航 -->
        <div class="category-nav">
            <div
                v-for="cat in categories"
                :key="cat.id"
                class="category-item"
                :class="{ active: activeCategory === cat.id }"
                @click="activeCategory = cat.id"
            >
                <div class="cat-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path :d="cat.icon" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <span class="cat-name">{{ cat.name }}</span>
            </div>
        </div>

        <div class="content-area">
            <!-- 入门指南 -->
            <div v-if="activeCategory === 'guide'" class="guide-content">
                <div class="guide-header">
                    <h2>快速入门</h2>
                    <p>遵循以下步骤，快速创建您的第一个数字人视频</p>
                </div>
                <div class="guide-timeline">
                    <div v-for="(step, index) in guideSteps" :key="index" class="guide-step-card">
                        <div class="step-indicator">
                            <div class="step-num">{{ step.num }}</div>
                            <div v-if="index < guideSteps.length - 1" class="step-line"></div>
                        </div>
                        <div class="step-content">
                            <h3>{{ step.title }}</h3>
                            <p>{{ step.desc }}</p>
                            <div class="step-tips">
                                <span v-for="tip in step.tips" :key="tip" class="tip-tag">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    {{ tip }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="guide-action">
                    <a-button type="primary" size="large" @click="openHelpDoc">
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </template>
                        查看详细教程
                    </a-button>
                </div>
            </div>

            <!-- 常见问题 -->
            <div v-if="activeCategory === 'faq'" class="faq-content">
                <div class="guide-header">
                    <h2>常见问题</h2>
                    <p>遇到问题？这里可能有您需要的答案</p>
                </div>
                <div class="faq-list">
                    <div
                        v-for="(faq, index) in faqs"
                        :key="index"
                        class="faq-item"
                        :class="{ expanded: faq.expanded }"
                        @click="toggleFaq(index)"
                    >
                        <div class="faq-question">
                            <span>{{ faq.question }}</span>
                            <svg class="faq-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="faq-answer">{{ faq.answer }}</div>
                    </div>
                </div>
                <div class="faq-footer">
                    <p>没有找到答案？</p>
                    <a-button @click="openFeedback">
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </template>
                        联系客服
                    </a-button>
                </div>
            </div>

            <!-- 快捷键 -->
            <div v-if="activeCategory === 'shortcuts'" class="shortcuts-content">
                <div class="guide-header">
                    <h2>键盘快捷键</h2>
                    <p>使用快捷键，提高操作效率</p>
                </div>
                <div class="shortcuts-grid">
                    <div v-for="(shortcut, index) in shortcuts" :key="index" class="shortcut-item">
                        <div class="shortcut-key">{{ shortcut.key }}</div>
                        <div class="shortcut-desc">{{ shortcut.desc }}</div>
                    </div>
                </div>
            </div>

            <!-- 联系我们 -->
            <div v-if="activeCategory === 'contact'" class="contact-content">
                <div class="guide-header">
                    <h2>联系我们</h2>
                    <p>有问题或建议？我们随时为您服务</p>
                </div>
                <div class="contact-cards">
                    <div class="contact-card" @click="openHelpDoc">
                        <div class="contact-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <h4>在线文档</h4>
                        <p>查看详细使用教程和API文档</p>
                    </div>
                    <div class="contact-card" @click="openFeedback">
                        <div class="contact-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <h4>意见反馈</h4>
                        <p>提交问题或功能建议</p>
                    </div>
                    <div class="contact-card" @click="showQrModal = true">
                        <div class="contact-icon qr">
                            <img :src="QrcodeWishImage" alt="反馈说明"/>
                        </div>
                        <h4>反馈说明</h4>
                        <p>请在项目仓库 Issues 中描述问题与复现步骤</p>
                    </div>
                </div>
                <!-- 二维码放大弹窗 -->
                <a-modal
                    v-model:visible="showQrModal"
                    :footer="false"
                    :mask-closable="true"
                    title="反馈说明"
                    width="320px"
                >
                    <div class="qr-modal-content">
                        <img :src="QrcodeWishImage" alt="反馈说明" />
                        <p>请在项目仓库 Issues 中描述问题与复现步骤</p>
                    </div>
                </a-modal>
                <div class="contact-info">
                    <div class="info-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>通过项目仓库 Issues 反馈</span>
                    </div>
                    <div class="info-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>社区协作维护，回复时间不固定</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="less" scoped>
.guide-page {
    padding: 24px 32px;
    min-height: 100%;
    background: transparent;
}

/* 页面头部 */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.page-icon {
    width: 52px;
    height: 52px;
    background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(245, 158, 11, 0.3);

    svg {
        width: 28px;
        height: 28px;
        color: #fff;
    }
}

.header-text {
    .page-title {
        font-size: 22px;
        font-weight: 700;
        color: #f8fafc;
        margin: 0;
        letter-spacing: -0.5px;
    }

    .page-desc {
        font-size: 13px;
        color: #64748b;
        margin: 4px 0 0;
    }
}

.header-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 10px;
    font-weight: 500;
    font-size: 14px;
    background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%) !important;
    border: none !important;
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);

    svg {
        width: 16px;
        height: 16px;
    }

    &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45);
    }
}

/* 分类导航 */
.category-nav {
    display: flex;
    gap: 12px;
    margin-bottom: 28px;
    padding: 6px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 14px;
    width: fit-content;
}

.category-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.25s ease;
    color: #64748b;

    &:hover {
        background: rgba(255, 255, 255, 0.03);
        color: #94a3b8;
    }

    &.active {
        background: rgba(245, 158, 11, 0.12);
        color: #fbbf24;

        .cat-icon {
            background: rgba(245, 158, 11, 0.15);
        }
    }
}

.cat-icon {
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.25s ease;

    svg {
        width: 18px;
        height: 18px;
    }
}

.cat-name {
    font-size: 14px;
    font-weight: 500;
}

/* 内容区域 */
.content-area {
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.guide-header {
    margin-bottom: 28px;

    h2 {
        font-size: 18px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0 0 8px;
    }

    p {
        font-size: 13px;
        color: #64748b;
        margin: 0;
    }
}

/* 入门指南 - 时间轴 */
.guide-timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
}

.guide-step-card {
    display: flex;
    gap: 24px;
}

.step-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
}

.step-num {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
}

.step-line {
    width: 2px;
    height: 60px;
    background: linear-gradient(to bottom, rgba(245, 158, 11, 0.3), rgba(245, 158, 11, 0.1));
    margin: 8px 0;
}

.step-content {
    flex: 1;
    padding-bottom: 28px;

    h3 {
        font-size: 15px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 8px 0 10px;
    }

    p {
        font-size: 13px;
        color: #94a3b8;
        line-height: 1.6;
        margin: 0 0 14px;
    }
}

.step-tips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.tip-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    font-size: 12px;
    color: #94a3b8;

    svg {
        width: 14px;
        height: 14px;
        color: #fbbf24;
    }
}

.guide-action {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);

    .ant-btn {
        background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%) !important;
        border: none !important;
        box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);

        svg {
            width: 16px;
            height: 16px;
        }
    }
}

/* 常见问题 */
.faq-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.faq-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.25s ease;
    cursor: pointer;

    &:hover {
        border-color: rgba(245, 158, 11, 0.2);
    }

    &.expanded {
        border-color: rgba(245, 158, 11, 0.3);
        background: rgba(245, 158, 11, 0.03);
    }
}

.faq-question {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px;
    font-size: 14px;
    font-weight: 500;
    color: #f1f5f9;

    span {
        flex: 1;
    }
}

.faq-arrow {
    width: 18px;
    height: 18px;
    color: #64748b;
    transition: transform 0.25s ease;
    flex-shrink: 0;

    .expanded & {
        transform: rotate(180deg);
        color: #fbbf24;
    }
}

.faq-answer {
    padding: 0 18px 16px;
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.6;
    display: none;

    .expanded & {
        display: block;
    }
}

.faq-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);

    p {
        font-size: 13px;
        color: #64748b;
        margin: 0;
    }

    .ant-btn {
        display: flex;
        align-items: center;
        gap: 6px;

        svg {
            width: 16px;
            height: 16px;
        }
    }
}

/* 快捷键 */
.shortcuts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
}

.shortcut-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    transition: all 0.2s ease;

    &:hover {
        border-color: rgba(245, 158, 11, 0.2);
        background: rgba(245, 158, 11, 0.03);
    }
}

.shortcut-key {
    padding: 6px 12px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    font-family: monospace;
    color: #fbbf24;
    white-space: nowrap;
}

.shortcut-desc {
    font-size: 13px;
    color: #94a3b8;
}

/* 联系我们 */
.contact-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 28px;
}

.contact-card {
    padding: 24px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    text-align: center;
    cursor: pointer;
    transition: all 0.25s ease;

    &:hover {
        border-color: rgba(245, 158, 11, 0.3);
        background: rgba(245, 158, 11, 0.03);
        transform: translateY(-2px);
    }

    h4 {
        font-size: 14px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 14px 0 6px;
    }

    p {
        font-size: 12px;
        color: #64748b;
        margin: 0;
    }
}

.contact-icon {
    width: 56px;
    height: 56px;
    background: rgba(245, 158, 11, 0.1);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;

    svg {
        width: 26px;
        height: 26px;
        color: #fbbf24;
    }

    &.qr {
        background: none;
        padding: 4px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    img {
        width: 100%;
        height: 100%;
        border-radius: 8px;
    }
}

.qr-modal-content {
    display: flex;
    flex-direction: column;
    align-items: center;

    img {
        width: 250px;
        height: 250px;
        object-fit: contain;
        border-radius: 8px;
    }

    p {
        margin: 16px 0 0;
        color: #666;
        font-size: 14px;
    }
}

.contact-info {
    display: flex;
    gap: 32px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
}

.info-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: #94a3b8;

    svg {
        width: 18px;
        height: 18px;
        color: #64748b;
    }
}
</style>
