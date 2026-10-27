export function splitText(text: string, maxLength: number = 150): { text: string }[] {
    const records: { text: string }[] = [];
    let current = '';
    const sentences = text.split(/[。！？]/).filter(s => s.trim());
    for (const sentence of sentences) {
        if ((current + sentence).length <= maxLength) {
            current += sentence + '。';
        } else {
            if (current) {
                records.push({text: current.trim()});
                current = sentence + '。';
            } else {
                // 如果单个句子超过 maxLength，强制分割
                const words = sentence.split('');
                let temp = '';
                for (const word of words) {
                    if ((temp + word).length <= maxLength) {
                        temp += word;
                    } else {
                        if (temp) {
                            records.push({text: temp.trim()});
                            temp = word;
                        }
                    }
                }
                if (temp) {
                    current = temp + '。';
                }
            }
        }
    }
    if (current) {
        records.push({text: current.trim()});
    }
    return records;
}
