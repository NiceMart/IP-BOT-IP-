import type { KeywordGroup } from "../../../src/types/smartSubtitle";
import { ipcRenderer } from 'electron';

const init = () => { };

const getAllGroups = async (): Promise<KeywordGroup[]> => {
    return ipcRenderer.invoke("keywordGroup:getAllGroups");
};

const saveGroup = async (group: KeywordGroup): Promise<{ success: boolean; id?: string; message?: string }> => {
    return ipcRenderer.invoke("keywordGroup:saveGroup", group);
};

const deleteGroup = async (groupId: string): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke("keywordGroup:deleteGroup", groupId);
};

const queryKeyword = async (keyword: string): Promise<KeywordGroup | null> => {
    return ipcRenderer.invoke("keywordGroup:queryKeyword", keyword);
};

const queryKeywordBatch = async (keywords: string[]): Promise<{ keyword: string; group: KeywordGroup }[]> => {
    return ipcRenderer.invoke("keywordGroup:queryKeywordBatch", keywords);
};

export default {
    init,
    getAllGroups,
    saveGroup,
    deleteGroup,
    queryKeyword,
    queryKeywordBatch
};
