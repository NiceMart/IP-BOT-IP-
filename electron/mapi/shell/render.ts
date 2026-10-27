
const showItemInFolder = async (filePath: string) => {
    return ipcRenderer.invoke("shell:showItemInFolder", filePath);
};

/**
 * 执行FFmpeg命令
 * @param command FFmpeg命令字符串 或 JSON格式的长过滤器配置
 * @returns Promise<string> FFmpeg输出
 */
const executeFFmpeg = async (command: string): Promise<string> => {
    console.log('[shell.executeFFmpeg] 调用IPC执行FFmpeg:', {
        commandLength: command.length,
        isJson: command.startsWith('{')
    });
    return ipcRenderer.invoke("shell:executeFFmpeg", command);
};

/**
 * 执行系统命令（如 python、nvidia-smi、taskkill 等）
 * @param command 要执行的命令字符串
 * @returns Promise<string> 命令输出
 */
const exec = async (command: string): Promise<string> => {
    console.log('[shell.exec] 调用IPC执行系统命令:', {
        command: command.substring(0, 100) + (command.length > 100 ? '...' : '')
    });
    return ipcRenderer.invoke("shell:exec", command);
};

/**
 * 获取 Python 可执行文件路径
 * @returns Promise<string> Python 可执行文件路径
 */
const getPythonPath = async (): Promise<string> => {
    console.log('[shell.getPythonPath] 调用IPC获取Python路径');
    return ipcRenderer.invoke("shell:getPythonPath");
};

export const shell = {
    showItemInFolder,
    executeFFmpeg,
    exec,
    getPythonPath,
};

export default shell;