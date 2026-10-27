export type VideoTemplateRecord = {
    id?: number;
    name: string;
    video: string;
    info: any;
};

export const VideoTemplateService = {
    tableName() {
        return "data_video_template";
    },
    decodeRecord(record: VideoTemplateRecord): VideoTemplateRecord | null {
        if (!record) {
            return null;
        }
        return {
            ...record,
            info: record.info ? JSON.parse(record.info) : {},
        } as VideoTemplateRecord;
    },
    encodeRecord(record: VideoTemplateRecord): VideoTemplateRecord {
        if ("info" in record) {
            record.info = JSON.stringify(record.info || {});
        }
        return record;
    },
    async get(id: number): Promise<VideoTemplateRecord | null> {
        const record: any = await window.$mapi.db.first(
            `SELECT *
             FROM ${this.tableName()}
             WHERE id = ?`,
            [id]
        );
        return this.decodeRecord(record);
    },
    async getByName(name: string): Promise<VideoTemplateRecord | null> {
        const record: any = await window.$mapi.db.first(
            `SELECT *
             FROM ${this.tableName()}
             WHERE name = ?`,
            [name]
        );
        return this.decodeRecord(record);
    },
    async list(): Promise<VideoTemplateRecord[]> {
        const records: VideoTemplateRecord[] = await window.$mapi.db.select(`SELECT *
                                                                             FROM ${this.tableName()}
                                                                             ORDER BY id DESC`);
        return records.map(this.decodeRecord) as VideoTemplateRecord[];
    },
    async insert(record: VideoTemplateRecord) {
        record = this.encodeRecord(record);
        const fields = Object.keys(record).join(", ");
        const values = Object.values(record);
        const valuePlaceholders = values.map(() => "?").join(", ");
        return await window.$mapi.db.insert(
            `INSERT INTO ${this.tableName()} (${fields})
             VALUES (${valuePlaceholders})`,
            values
        );
    },
    async delete(record: VideoTemplateRecord) {
        if (record.video) {
            await window.$mapi.file.hubDelete(record.video);
        }
        await window.$mapi.db.delete(
            `DELETE
             FROM ${this.tableName()}
             WHERE id = ?`,
            [record.id]
        );
    },
    async update(id: number, record: Partial<VideoTemplateRecord>) {
        record = this.encodeRecord(record as VideoTemplateRecord);
        const fields = Object.keys(record)
            .map(key => `${key} = ?`)
            .join(", ");
        const values = Object.values(record);
        values.push(id);
        return await window.$mapi.db.update(
            `UPDATE ${this.tableName()}
             SET ${fields}
             WHERE id = ?`,
            values
        );
    },
};
