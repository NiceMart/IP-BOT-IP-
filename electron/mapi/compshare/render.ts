import { ipcRenderer } from 'electron';

export default {
  async setApiKey(params: { publicKey: string; privateKey: string }) {
    return await ipcRenderer.invoke('compshare:setApiKey', params);
  },

  async startInstance(params: {
    region: string;
    zone: string;
    projectId: string;
    uhostId: string;
  }) {
    return await ipcRenderer.invoke('compshare:startInstance', params);
  },

  async stopInstance(params: {
    region: string;
    zone: string;
    projectId: string;
    uhostId: string;
  }) {
    return await ipcRenderer.invoke('compshare:stopInstance', params);
  },

  async describeInstance(params: {
    region?: string;
    zone?: string;
    projectId?: string;
    uhostIds?: string[];
  }) {
    return await ipcRenderer.invoke('compshare:describeInstance', params);
  },

  async digitalHumanProcess(params: {
    apiUrl: string;
    audioFile: string;
    videoFile: string;
  }) {
    return await ipcRenderer.invoke('compshare:digitalHumanProcess', params);
  }
};