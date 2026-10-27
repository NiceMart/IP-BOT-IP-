export const DataService = {
    async saveFile(
        file: string,
        option?: {
            ext?: string;
            saveGroup?: string;
        }
    ) {
        return await window.$mapi.file.hubSave(file, {
            ...option,
        });
    },
    async saveBuffer(ext: string, data: Uint8Array, saveGroup?: string) {
        const path = await window.$mapi.file.temp(ext);
        await window.$mapi.file.writeBuffer(path, data, {
            isDataPath: false,
        });
        const result = await this.saveFile(path, {saveGroup});
        await window.$mapi.file.deletes(path, {
            isDataPath: false,
        });
        return result;
    },
};
