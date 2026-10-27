
export function parseSrt(content: string): { start: number; end: number; text: string }[] {
    const records: { start: number; end: number; text: string }[] = [];
    const blocks = content.split(/\n\s*\n/);

    for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length < 3) continue;

        // 跳过序号行
        let timeLine = lines[1];
        if (!timeLine.includes('-->')) {
            timeLine = lines[0];
        }

        const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
        if (!timeMatch) continue;

        const start = timeToMs(timeMatch[1]);
        const end = timeToMs(timeMatch[2]);
        const text = lines.slice(2).join(' ').trim();

        if (text) {
            records.push({ start, end, text });
        }
    }

    return records;
}

function timeToMs(time: string): number {
    const [hms, ms] = time.split(',');
    const [hours, minutes, seconds] = hms.split(':').map(Number);
    return hours * 3600000 + minutes * 60000 + seconds * 1000 + Number(ms);
}

export function adjustAudioSpeed(records: { start: number; end: number; text: string }[]): { record: { start: number; end: number; text: string }; speed?: number }[] {
    const adjusted: { record: { start: number; end: number; text: string }; speed?: number }[] = [];
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const nextRecord = records[i + 1];
        const duration = record.end - record.start;
        const interval = nextRecord ? nextRecord.start - record.end : 0;

        if (interval > 0 && duration > interval) {
            // 音频长度超过间隔，需要加快
            const speed = duration / interval;
            adjusted.push({ record, speed });
        } else {
            adjusted.push({ record });
        }
    }
    return adjusted;
}
