// Mapi类型定义
/*
declare global {
  interface Window {
    $mapi: {
      ipAgent: {
        openBrowserWindow(params: { url: string }): Promise<any>;
        scrapeFromBrowser(params: { url: string }): Promise<any>;
        analyzeDouyinAccount(params: { url: string }): Promise<any>;
        rewriteTitles(params: {
          titles: string[];
          accountName: string;
          modelConfig: any;
          rewritePrompt: string;
        }): Promise<any>;
        generateScript(params: {
          title: string;
          count: number;
          modelConfig: any;
          scriptPrompt: string;
        }): Promise<any>;
        generateTitleTags(params: {
          content: string;
          modelConfig: any;
          titleTagPrompt: string;
        }): Promise<any>;
        saveSettings(params: { settings: any }): Promise<any>;
        getSettings(): Promise<any>;
        processSilenceDetection(params: {
          inputVideo: string;
          silenceThreshold: number;
          silenceDuration: number;
        }): Promise<any>;
        generateSubtitle(params: {
          videoPath: string;
          scriptContent: string;
          asrModelKey?: string;
          timeOffset?: number;
        }): Promise<any>;
        addSubtitleToVideo(params: {
          inputVideo: string;
          srtPath: string;
          subtitleStyle: any;
          highlightWords?: string[];
          keywordStyle?: any;
          keywords?: Array<{ keyword: string; enabled?: boolean }>;
          enableTopTitle?: boolean;
          topTitleStyle?: any;
          topTitleText?: string;
        }): Promise<any>;
        addBGMToVideo(params: {
          inputVideo: string;
          bgmPath: string;
          bgmVolume: number;
        }): Promise<any>;
        style: typeof import("../../electron/mapi/style/render").default;
        sticker: typeof import("../../electron/mapi/sticker/render").default;
        selectMusicFile(): Promise<any>;
        selectVideoFile(): Promise<any>;
        generateFunasrSubtitle(params: {
          videoPath: string;
          language?: string;
          maxCharsPerLine?: number;
        }): Promise<any>;
        extractAudioFromVideo(params: { videoPath: string }): Promise<any>;
        getVideoDuration(params: { videoPath: string }): Promise<{ success: boolean; duration?: number; message?: string }>;
        processVideoMixCut(params: {
          inputVideo: string;
          replacements: Array<{
            startTime: number;
            duration: number;
            materialPath: string;
            materialDuration: number;
            materialStartOffset: number;
            reason: string;
          }>;
          outputPath: string;
          videoResolution: { width: number; height: number };
          videoDuration: number;
          displayMode?: 'pip' | 'fullscreen';
        }): Promise<{ success: boolean; outputVideo?: string; message?: string }>;
        extractAudioFromVideoEnhanced(params: {
          videoPath: string;
          format?: string;
          quality?: string;
          sampleRate?: string;
          outputPath?: string;
        }): Promise<any>;
        generateSrtFromScript(params: {
          videoPath: string;
          scriptContent: string;
          audioDuration?: number;
          maxCharsPerLine?: number;
        }): Promise<any>;
        generateSrtFromAsrResult(params: {
          videoPath: string;
          asrRecords: any[];
          maxCharsPerLine?: number;
          audioPath?: string;
          timestamp?: number;
        }): Promise<any>;
        extractKeywords(params: {
          subtitleText: string;
          modelConfig: any;
          customPrompt?: string;
        }): Promise<any>;
        extractBestFrames(params: {
          videoPath: string;
          frameCount?: number;
        }): Promise<any>;
        generateVideoCover(params: {
          videoPath: string;
          titleText: string;
          effectStyle?: any;
        }): Promise<any>;
        readSrtFile(params: { srtPath: string }): Promise<any>;
        saveAssFile(params: {
          assContent: string;
          videoPath?: string;
          timestamp?: number;
        }): Promise<any>;
        downloadVideoFromUrl(params: {
          videoUrl: string;
          fileName?: string;
        }): Promise<any>;
        rewriteVideoContent(params: {
          videoUrl: string;
          modelConfig: {
            providerId: string;
            modelId: string;
            apiUrl: string;
            apiHost: string;
            apiKey: string;
            type: string;
          };
          rewritePrompt: string;
        }): Promise<{
          success: boolean;
          recognizedText?: string;
          rewrittenText?: string;
          videoPath?: string;
          segments?: any[];
          message?: string;
        }>;
        // 封面模板管理
        getCoverTemplates(): Promise<{
          success: boolean;
          templates?: Array<{
            id: string;
            name: string;
            thumbnailPath?: string;
            config: any;
            createdAt: number;
            updatedAt: number;
          }>;
          message?: string;
        }>;
        getCoverTemplate(params: { id: string }): Promise<{
          success: boolean;
          template?: {
            id: string;
            name: string;
            thumbnailPath?: string;
            config: any;
            createdAt: number;
            updatedAt: number;
          };
          message?: string;
        }>;
        saveCoverTemplate(params: {
          name: string;
          config: any;
          thumbnailPath?: string;
          id?: string;
        }): Promise<{
          success: boolean;
          id?: string;
          message?: string;
        }>;
        deleteCoverTemplate(params: { id: string }): Promise<{
          success: boolean;
          message?: string;
        }>;
        updateCoverTemplate(params: {
          id: string;
          name?: string;
          config?: any;
          thumbnailPath?: string;
        }): Promise<{
          success: boolean;
          message?: string;
        }>;
        getCoverTemplateImage(params: { templateId: string }): Promise<string | null>;
        reinitSystemTemplates(): Promise<{ success: boolean; message?: string }>;
        style: typeof import("../../electron/mapi/style/render").default;
        sticker: typeof import("../../electron/mapi/sticker/render").default;
      };
      platform: {
        startQRLogin(params: { platform: string }): Promise<{ success: boolean; sessionId?: string; qrCodeUrl?: string; message?: string }>;
        checkLoginStatus(params: { sessionId: string }): Promise<{ status: string; userInfo?: any; message?: string }>;
        getAccounts(params?: { platform?: string }): Promise<{ success: boolean; accounts: any[]; message?: string }>;
        logout(params: { accountId: number }): Promise<{ success: boolean; message?: string }>;
        refreshAccount(params: { accountId: number }): Promise<{ success: boolean; isLoggedIn?: boolean; account?: any; userInfo?: any; message?: string }>;
        clearBrowserData(params: { platform: string }): Promise<{ success: boolean; message?: string }>;
      };
      publish: {
        checkLoginStatus(params: { platform: string; checkBrowser?: boolean }): Promise<{ success: boolean; isLoggedIn: boolean; userInfo?: any; message?: string }>;
      };
      file: {
        openFile(params: { filters?: Array<{ name: string; extensions: string[] }> }): Promise<string>;
        downloadUrl(url: string, saveDir?: string): Promise<string>;
        readDir(dirPath: string, options?: { extensions?: string[] }): Promise<{name: string; path: string; isDirectory: boolean}[]>;
        getBGMDir(): Promise<string>;
      };
      runninghub: {
        uploadFile(params: { filePath: string; fileType: 'video' | 'audio' }): Promise<{ success: boolean; fileName?: string; error?: string }>;
        createTask(params: { videoFileName: string; audioFileName: string }): Promise<{ success: boolean; taskId?: string; error?: string }>;
        queryTask(params: { taskId: string }): Promise<{ success: boolean; result?: any; error?: string }>;
        waitForTaskComplete(params: { taskId: string; maxRetries?: number; interval?: number }): Promise<{ success: boolean; result?: any; error?: string }>;
        cloudBeautySubmit(params: { videoPath: string; audioPath: string; humanWeight: string }): Promise<{ success: boolean; taskId?: string; error?: string }>;
        cloudBeautyQueryStatus(params: { taskId: string }): Promise<{ success: boolean; data?: any; error?: string }>;
      };
      compshare: {
        setApiKey(params: { publicKey: string; privateKey: string }): Promise<{ success: boolean }>;
        startInstance(params: {
          region: string;
          zone: string;
          projectId: string;
          uhostId: string;
        }): Promise<{ success: boolean; message?: string }>;
        stopInstance(params: {
          region: string;
          zone: string;
          projectId: string;
          uhostId: string;
        }): Promise<{ success: boolean; message?: string }>;
        describeInstance(params: {
          region?: string;
          zone?: string;
          projectId?: string;
          uhostIds?: string[];
        }): Promise<{ success: boolean; instances?: any[]; message?: string }>;
        digitalHumanProcess(params: {
          apiUrl: string;
          audioFile: string;
          videoFile: string;
        }): Promise<{ success: boolean; videoPath?: string; message?: string }>;
      };
      shell: {
        exec(command: string): Promise<string>;
        getPythonPath(): Promise<string>;
        execFFmpegCommand(params: string[], options?: { cwd?: string; outputEncoding?: string; onProgress?: (progress: any) => void }): Promise<string>;
        extractAudioFromVideo(inputPath: string, outputPath: string, options?: { format?: string; quality?: string }): Promise<string>;
        execCommand(command: string, args?: string[], options?: { cwd?: string; timeout?: number }): Promise<{ stdout: string; stderr: string; code: number }>;
        executeFFmpeg(command: string): Promise<string>;
        showItemInFolder(filePath: string): Promise<void>;
      };
    };
  }
}

export { };
*/

export {};
