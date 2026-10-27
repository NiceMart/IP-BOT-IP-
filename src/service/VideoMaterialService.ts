import { DataService } from "./DataService";

export type VideoMaterialRecord = {
    id?: number;
    name: string;
    path: string;
    type: "image" | "video";
    info: any;
    createdAt?: number;
    updatedAt?: number;
};

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "bmp", "webp"];

export const VideoMaterialService = {
    tableName() {
        return "data_video_material";
    },
    decodeRecord(record: any): VideoMaterialRecord | null {
        if (!record) {
            return null;
        }
        return {
            ...record,
            info: record.info ? JSON.parse(record.info) : {},
        } as VideoMaterialRecord;
    },
    encodeRecord(record: Partial<VideoMaterialRecord>) {
        const nextRecord = { ...record } as any;
        if ("info" in nextRecord) {
            nextRecord.info = JSON.stringify(nextRecord.info || {});
        }
        return nextRecord;
    },
    getMaterialType(filePath: string): "image" | "video" {
        const ext = filePath.split(".").pop()?.toLowerCase() || "";
        return IMAGE_EXTENSIONS.includes(ext) ? "image" : "video";
    },
    getMaterialName(filePath: string) {
        const fileName = filePath.split(/[\\/]/).pop() || "未命名素材";
        return fileName.replace(/\.[^/.]+$/, "") || fileName;
    },
    async list(): Promise<VideoMaterialRecord[]> {
        const records = await window.$mapi.db.select(
            `SELECT *
             FROM ${this.tableName()}
             ORDER BY updatedAt DESC, id DESC`
        );
        return records.map((record: any) => this.decodeRecord(record)).filter(Boolean) as VideoMaterialRecord[];
    },
    async insert(record: VideoMaterialRecord) {
        const nextRecord = this.encodeRecord(record);
        const fields = Object.keys(nextRecord).join(", ");
        const values = Object.values(nextRecord);
        const valuePlaceholders = values.map(() => "?").join(", ");
        return await window.$mapi.db.insert(
            `INSERT INTO ${this.tableName()} (${fields})
             VALUES (${valuePlaceholders})`,
            values
        );
    },
    async update(id: number, record: Partial<VideoMaterialRecord>) {
        const nextRecord = this.encodeRecord({
            ...record,
            updatedAt: Date.now(),
        });
        const fields = Object.keys(nextRecord)
            .map(key => `${key} = ?`)
            .join(", ");
        const values = Object.values(nextRecord);
        values.push(id);
        return await window.$mapi.db.update(
            `UPDATE ${this.tableName()}
             SET ${fields}
             WHERE id = ?`,
            values
        );
    },
    async delete(record: VideoMaterialRecord) {
        if (record.path) {
            await window.$mapi.file.hubDelete(record.path);
        }
        await window.$mapi.db.delete(
            `DELETE
             FROM ${this.tableName()}
             WHERE id = ?`,
            [record.id]
        );
    },
    async importFiles(filePaths: string[]) {
        const ids: number[] = [];
        for (const filePath of filePaths) {
            const savedPath = await DataService.saveFile(filePath, { saveGroup: "video-material" });
            const now = Date.now();
            const id = await this.insert({
                name: this.getMaterialName(filePath),
                path: savedPath,
                type: this.getMaterialType(filePath),
                info: {
                    sourcePath: filePath,
                },
                createdAt: now,
                updatedAt: now,
            });
            ids.push(id);
        }
        return ids;
    },
};
