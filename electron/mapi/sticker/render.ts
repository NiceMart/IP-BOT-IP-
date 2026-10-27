
export default {
    generate: async (params: any) => {
        return await ipcRenderer.invoke("Sticker:generate", params);
    },
    list: async () => {
        return await ipcRenderer.invoke("Sticker:list");
    }
};
