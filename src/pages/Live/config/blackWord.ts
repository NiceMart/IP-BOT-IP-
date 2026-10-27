import {getDataContent} from "../../../components/common/dataConfig";

export const LiveBlackWordContent = [
    // 平台竞争对手
    "抖音",
    "快手",
    "微信",
    "QQ",
    "微博",
    "小红书",
    "知乎",
    "B站",
    "哔哩哔哩",
    "淘宝",
    "天猫",
    "京东",
    "拼多多",
    "支付宝",
    "百度",
    "腾讯",
    "阿里巴巴",

    // 广告法禁用词
    "最好",
    "最棒",
    "最佳",
    "最优",
    "最高级",
    "最先进",
    "最新技术",
    "最便宜",
    "第一",
    "独一无二",
    "唯一",
].join(",");

// 检测文本中的违规词汇
export const detectBlackWords = async (text: string): Promise<{ word: string; index: number }[]> => {
    const violations: { word: string; index: number }[] = [];
    const content = await getDataContent("LiveBlackWordContent", LiveBlackWordContent);
    const blackWords = content
        .split(",")
        .map(word => word.trim())
        .filter(word => word.length > 0);
    blackWords.forEach(word => {
        let startIndex = 0;
        while (true) {
            const index = text.indexOf(word, startIndex);
            if (index === -1) break;
            violations.push({word, index});
            startIndex = index + word.length;
        }
    });
    return violations;
};

// 高亮违规词汇
export const highlightBlackWords = async (text: string): Promise<string> => {
    let result = text;
    const violations = await detectBlackWords(text);

    // 从后往前替换，避免索引变化
    violations.reverse().forEach(violation => {
        const before = result.substring(0, violation.index);
        const word = result.substring(violation.index, violation.index + violation.word.length);
        const after = result.substring(violation.index + violation.word.length);
        result = before + `<span class="bg-red-200 text-red-800 px-1 rounded">${word}</span>` + after;
    });

    return result;
};
