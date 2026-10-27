import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec, execSync } from 'child_process';
import { getRuntimeBundlePath } from './resource-path';

const SETUP_VERSION = '2';

function getSetupFlagPath(): string {
    return path.join(app.getPath('userData'), '.python-setup-done');
}

function getPythonInstallDir(): string {
    return getRuntimeBundlePath('python-runtime');
}

function getPythonBinPath(): string {
    return path.join(getPythonInstallDir(), 'python', 'bin', 'python3');
}

function getPipBinPath(): string {
    return path.join(getPythonInstallDir(), 'python', 'bin', 'pip3');
}

function getLocalResourcePath(filename: string): string | null {
    const runtimeBundlePath = path.join(getRuntimeBundlePath('python-runtime'), filename);
    if (fs.existsSync(runtimeBundlePath)) {
        return runtimeBundlePath;
    }

    const isDev = __dirname.includes('electron') && !__dirname.includes('dist-electron');
    const base = isDev
        ? path.join(app.getAppPath(), 'electron', 'resources', 'extra', 'osx')
        : path.join(process.resourcesPath, 'extra', 'osx');
    const fullPath = path.join(base, filename);
    return fs.existsSync(fullPath) ? fullPath : null;
}

function execAsync(cmd: string, opts?: any): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        exec(cmd, { timeout: 300000, ...opts }, (err, stdout, stderr) => {
            resolve({ code: err ? (err.code as number) || 1 : 0, stdout: stdout || '', stderr: stderr || '' });
        });
    });
}

export function isSetupComplete(): boolean {
    if (process.platform === 'win32') return true;
    if (!fs.existsSync(getSetupFlagPath())) return false;
    try {
        const v = fs.readFileSync(getSetupFlagPath(), 'utf-8').trim();
        if (v !== SETUP_VERSION) return false;
        return fs.existsSync(getPythonBinPath());
    } catch { return false; }
}

function markSetupComplete(): void {
    fs.writeFileSync(getSetupFlagPath(), SETUP_VERSION);
}

async function extractPython(): Promise<string> {
    const installDir = getPythonInstallDir();
    const pythonBin = getPythonBinPath();

    if (fs.existsSync(pythonBin)) {
        console.log('[PythonSetup] Python 已解压:', pythonBin);
        return pythonBin;
    }

    fs.mkdirSync(installDir, { recursive: true });

    const arch = os.arch();
    const tarName = arch === 'arm64' ? 'python-mac-arm64.tar.gz' : 'python-mac-x64.tar.gz';
    const tarPath = getLocalResourcePath(tarName);

    if (!tarPath) {
        throw new Error(`未找到 Python 包: ${tarName}`);
    }

    console.log('[PythonSetup] 解压 Python:', tarPath);
    const result = await execAsync(`tar -xzf "${tarPath}" -C "${installDir}"`, { timeout: 120000 });
    if (result.code !== 0) {
        throw new Error('解压 Python 失败: ' + result.stderr.substring(0, 200));
    }

    try {
        const entries = fs.readdirSync(installDir);
        const pythonEntry = entries.find(e => e.startsWith('python'));
        if (pythonEntry && pythonEntry !== 'python') {
            fs.renameSync(path.join(installDir, pythonEntry), path.join(installDir, 'python'));
        }
    } catch {}

    if (!fs.existsSync(pythonBin)) {
        throw new Error('解压后找不到 python3');
    }

    try { fs.chmodSync(pythonBin, 0o755); } catch {}
    console.log('[PythonSetup] ✅ Python 解压完成');
    return pythonBin;
}

async function installWheels(pythonBin: string): Promise<void> {
    const wheelsDir = getLocalResourcePath('wheels');
    if (!wheelsDir) {
        throw new Error('未找到 wheels 目录');
    }

    const wheelFiles = fs.readdirSync(wheelsDir).filter(f => f.endsWith('.whl') || f.endsWith('.tar.gz'));
    if (wheelFiles.length === 0) {
        throw new Error('wheels 目录为空');
    }

    console.log(`[PythonSetup] 离线安装 ${wheelFiles.length} 个包...`);

    const allFiles = wheelFiles.map(f => `"${path.join(wheelsDir, f)}"`).join(' ');

    const result = await execAsync(
        `"${pythonBin}" -m pip install --no-index --no-deps ${allFiles}`,
        { timeout: 300000 }
    );

    if (result.code !== 0) {
        console.warn('[PythonSetup] 部分 pip install 失败，尝试逐个安装...');
        for (const f of wheelFiles) {
            const filePath = path.join(wheelsDir, f);
            const r = await execAsync(`"${pythonBin}" -m pip install --no-index "${filePath}"`, { timeout: 120000 });
            if (r.code !== 0) {
                console.warn(`[PythonSetup] 安装失败: ${f}`, r.stderr.substring(0, 100));
            }
        }
    }

    console.log('[PythonSetup] ✅ 依赖安装完成');
}

async function verifyAll(pythonBin: string): Promise<boolean> {
    const code = `
import importlib
for mod in ['cv2','numpy','PIL','rembg','onnxruntime','jieba','loguru']:
    try: importlib.import_module(mod)
    except: exit(1)
print('OK')
`;
    const result = await execAsync(`"${pythonBin}" -c '${code.replace(/\n/g, ' ')}'`, { timeout: 30000 });
    return result.code === 0 && result.stdout.trim() === 'OK';
}

export async function ensurePythonSetup(): Promise<string | null> {
    if (process.platform === 'win32') return null;

    const pythonBin = getPythonBinPath();
    if (isSetupComplete() && fs.existsSync(pythonBin)) {
        return pythonBin;
    }

    console.log('[PythonSetup] 开始自动初始化（完全离线）...');

    try {
        const pyBin = await extractPython();
        await installWheels(pyBin);

        const ok = await verifyAll(pyBin);
        if (!ok) {
            console.warn('[PythonSetup] ⚠️ 部分依赖验证失败，但继续运行');
        }

        markSetupComplete();
        console.log('[PythonSetup] ✅ Python 环境初始化完成');
        return pyBin;
    } catch (err) {
        console.error('[PythonSetup] ❌ 初始化失败:', err);
        return null;
    }
}

export function getMacOSPythonPath(): string | null {
    if (process.platform === 'win32') return null;
    const p = getPythonBinPath();
    return fs.existsSync(p) ? p : null;
}
