import {ModelAgentButtonFormItems} from "../../../module/Model/ModelAgentButton.vue";

export const SoundAsrResultOptimizedPrompt = `
这里是我使用ASR技术对音频内容进行转录的结果。
请注意，ASR技术可能会存在一定的误差，需要你帮我进行校对和优化。
ASR转录结果如下：

<content>{content}</content>

请直接输出优化后的文本，无需任何额外说明文字。
`

export const SoundGenerateTextFormItems: ModelAgentButtonFormItems = [
    {
        type: 'text',
        name: 'title',
        label: '主题',
    },
    {
        type: 'number',
        name: 'count',
        label: '字数',
        defaultValue: 100,
    }
]

export const SoundGenerateTextPrompt = `
你是一个视频口播专家，擅长根据用户给的主题和关键词生成高质量的口播稿件。
请根据以下要求生成口播稿件：

1. 主题：{title}
2. 字数：大约{count}字

请确保稿件内容连贯、有吸引力，并且符合口播的风格。
请直接输出生成的口播稿件，无需任何额外说明文字。
`
