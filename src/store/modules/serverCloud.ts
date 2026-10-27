import {defineStore} from "pinia";
import {buildServerContent} from "../../lib/aigcpanel";
import {wait} from "../../lib/util";
import {EnumServerStatus, EnumServerType, ServerRecord} from "../../types/Server";
import store from "../index";

export type VideoTemplateCloudRecord = {
    id: string;
    tags: string[];
    title: string;
    cover: string;
};

export type ServerCloudRecord = {
    logo: string;
    url: string;
    demo: any[];
    key: string;
    name: string;
    title: string;
    version: string;
    description: string;
    content: string;
    functions: {
        [key: string]: {
            param: {
                name: string;
                type: string;
                [key: string]: any;
            }[];
        };
    };
    runtime: {
        functions: string[];
        content: string;
    };
};

export const serverCloudStore = defineStore("serverCloud", {
    state: () => ({
        isReady: false,
        records: [] as ServerCloudRecord[],
        videoTemplateRecords: [] as VideoTemplateCloudRecord[],
    }),
    actions: {
        async waitReady() {
            await wait(() => this.isReady);
        },
        async init() {
            // 用户功能未启用，跳过云服务器刷新
            console.log('[serverCloud.init] 跳过云服务器刷新（userEnable=false）');
            this.records = [];
            this.isReady = true;
            return;
            // 注释：原来的代码会调用 server/all API，但用户功能未启用，所以永久禁用
            // try {
            //     await this.refresh();
            // } catch (error) {
            //     console.error('[serverCloud] 初始化失败，使用空数据:', error);
            //     this.records = [];
            // }
            // this.isReady = true;
        },
        async refresh() {
            try {
                const res = await $mapi.user.apiPost("server/all", {}, { throwException: false });
                if (!res.data || !res.data.records) {
                    console.warn('[serverCloud.refresh] 服务器未返回有效数据');
                    this.records = [];
                    return;
                }
                this.records = res.data.records.map((r: any) => {
                    return {
                        ...r,
                        key: this.generateServerKey(r),
                        status: EnumServerStatus.RUNNING,
                        type: EnumServerType.CLOUD,
                        autoStart: true,
                        runtime: {
                            functions: Object.keys(r.functions),
                            content: buildServerContent(r),
                        },
                    };
                });
            } catch (error) {
                console.error('[serverCloud.refresh] API调用失败:', error);
                this.records = [];
            }
        },
        async getByKey(key: string): Promise<ServerRecord | undefined> {
            return this.records.find(record => record.key === key) as any;
        },
        async getByNameVersion(name: string, version: string): Promise<ServerRecord | undefined> {
            return this.records.find(record => record.name === name && record.version === version) as any;
        },
        generateServerKey(serverCloud: ServerRecord) {
            return `${serverCloud.name}|${serverCloud.version}`;
        },
        async listVideoTemplates() {
            try {
                const res = await $mapi.user.apiPost("aigcpanel/video_template/all", {});
                this.videoTemplateRecords = res.data.records || [];
            } catch (error) {
                console.error('[serverCloud.listVideoTemplates] API调用失败:', error);
                this.videoTemplateRecords = [];
            }
        },
        async getVideoTemplate(id: string): Promise<VideoTemplateCloudRecord | null> {
            try {
                const res = await $mapi.user.apiPost("aigcpanel/video_template/get", {id});
                return res.data.record;
            } catch (error) {
                console.error('[serverCloud.getVideoTemplate] API调用失败:', error);
                return null;
            }
        },
    },
});

const serverCloud = serverCloudStore(store);
serverCloud.init().then(() => {});

export const useServerCloudStore = () => {
    return serverCloud;
};
