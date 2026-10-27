import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import axios from 'axios';
import yauzl from 'yauzl';
import { AppEnv } from './env';
import { fetchElectronSystemConfig } from './systemConfig';
import Log from './log/main';

let statusListener: ((data: any) => void) | null = null;

export function setResourceStatusListener(listener: ((data: any) => void) | null) {
    statusListener = listener;
}

function emitStatus(data: any) {
    if (statusListener) {
        statusListener(data);
    }
}

export interface ResourceBundleInfo {
    version: string;
    archive: string;
    url: string;
    sha256: string;
    size: number;
    required: boolean;
    extractTo: string;
    source?: string;
}

export interface ResourceManifest {
    manifestVersion: number;
    generatedAt: string;
    appVersion: string;
    bundles: Record<string, ResourceBundleInfo>;
}

interface LocalResourceState {
    manifestVersion: number;
    appVersion: string;
    bundles: Record<string, { version: string; sha256: string; installedAt: string; path: string }>;
}

const getEmbeddedManifestPath = () => {
    const packagedPath = path.join(process.resourcesPath || AppEnv.appRoot, 'extra', 'common', 'resource-manifest.json');
    if (fs.existsSync(packagedPath)) {
        return packagedPath;
    }
    return path.join(AppEnv.appRoot, 'electron', 'resources', 'extra', 'common', 'resource-manifest.json');
};
const getLocalStatePath = () => path.join(AppEnv.resourceStateRoot, 'resource-state.json');
const getBundleRoot = (bundleName: string) => path.join(AppEnv.resourceBundleRoot, bundleName);
const getArchivePath = (bundle: ResourceBundleInfo) => path.join(AppEnv.resourceBundleRoot, bundle.archive);
const getBundleTempRoot = () => path.join(AppEnv.tempRoot, 'resource-install');

function readJsonFile<T>(filePath: string, fallback: T): T {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
        return fallback;
    }
}

function writeJsonFile(filePath: string, data: any) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function rmIfExists(targetPath: string) {
    if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
    }
}

function ensureDir(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
}

const bundleSentinels: Record<string, string[]> = {
    'python-runtime': ['python.exe', 'subtitle_cover_generator_simple.py'],
    models: ['u2net.onnx'],
};

function isBundleReady(bundleName: string, bundleRoot: string): boolean {
    if (!fs.existsSync(bundleRoot)) {
        return false;
    }

    try {
        const entries = fs.readdirSync(bundleRoot);
        if (entries.length === 0) {
            return false;
        }
    } catch {
        return false;
    }

    const sentinels = bundleSentinels[bundleName] || [];
    return sentinels.every((relativePath) => fs.existsSync(path.join(bundleRoot, relativePath)));
}
function downloadToFile(url: string, filePath: string, onProgress?: (downloaded: number, total: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        ensureDir(path.dirname(filePath));
        const writer = fs.createWriteStream(filePath);
        let settled = false;

        const fail = (error: any) => {
            if (settled) {
                return;
            }
            settled = true;
            try {
                writer.destroy();
            } catch {
                // ignore cleanup failure
            }
            rmIfExists(filePath);
            reject(error);
        };

        axios({ method: 'get', url, responseType: 'stream', timeout: 10 * 60 * 1000 })
            .then((response) => {
                const total = Number(response.headers['content-length'] || 0);
                let downloaded = 0;
                response.data.on('data', (chunk: Buffer) => {
                    downloaded += chunk.length;
                    onProgress?.(downloaded, total);
                });
                response.data.on('error', fail);
                response.data.pipe(writer);
                writer.on('finish', () => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    resolve();
                });
                writer.on('error', fail);
            })
            .catch(fail);
    });
}
function extractZip(zipPath: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
        ensureDir(destination);
        yauzl.open(zipPath, { lazyEntries: true }, (error, zipFile) => {
            if (error || !zipFile) {
                reject(error || new Error('打开 zip 失败'));
                return;
            }

            zipFile.readEntry();
            zipFile.on('entry', (entry) => {
                const destPath = path.join(destination, entry.fileName);
                if (/\/$/.test(entry.fileName)) {
                    ensureDir(destPath);
                    zipFile.readEntry();
                    return;
                }

                ensureDir(path.dirname(destPath));
                zipFile.openReadStream(entry, (streamError, readStream) => {
                    if (streamError || !readStream) {
                        reject(streamError || new Error('读取 zip entry 失败'));
                        return;
                    }
                    const writeStream = fs.createWriteStream(destPath);
                    readStream.pipe(writeStream);
                    writeStream.on('finish', () => zipFile.readEntry());
                    writeStream.on('error', reject);
                });
            });

            zipFile.on('end', () => resolve());
            zipFile.on('error', reject);
        });
    });
}

function fileSha256(filePath: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

async function resolveManifest(): Promise<ResourceManifest | null> {
    const embedded = readJsonFile<ResourceManifest | null>(getEmbeddedManifestPath(), null);
    if (embedded) return embedded;

    try {
        const config = await fetchElectronSystemConfig();
        const baseUrl = config.update_url?.replace(/\/$/, '');
        if (!baseUrl) return null;
        const response = await fetch(`${baseUrl}/resource-manifest.json`);
        if (!response.ok) return null;
        return await response.json() as ResourceManifest;
    } catch (error: any) {
        Log.warn('[ResourceManager] resolveManifest failed', error?.message || error);
        return null;
    }
}

async function ensureArchive(bundleName: string, bundle: ResourceBundleInfo): Promise<string> {
    const archivePath = getArchivePath(bundle);
    if (fs.existsSync(archivePath) && fileSha256(archivePath) === bundle.sha256) {
        emitStatus({ status: 'resource-ready', bundle: bundleName, archive: bundle.archive });
        return archivePath;
    }

    if (!/^https?:\/\//i.test(bundle.url)) {
        const config = await fetchElectronSystemConfig();
        const baseUrl = config.update_url?.replace(/\/$/, '');
        if (!baseUrl) {
            throw new Error(`资源 ${bundle.archive} 缺少可下载地址`);
        }
        bundle.url = `${baseUrl}/${bundle.url.replace(/^\//, '')}`;
    }

    emitStatus({ status: 'resource-downloading', bundle: bundleName, archive: bundle.archive, percent: 0, transferred: 0, total: bundle.size || 0 });
    Log.info('[ResourceManager] downloading archive', { archive: bundle.archive, url: bundle.url });
    await downloadToFile(bundle.url, archivePath, (downloaded, total) => {
        const safeTotal = total || bundle.size || 0;
        emitStatus({
            status: 'resource-downloading',
            bundle: bundleName,
            archive: bundle.archive,
            transferred: downloaded,
            total: safeTotal,
            percent: safeTotal > 0 ? Math.round((downloaded / safeTotal) * 100) : 0,
        });
    });

    const sha256 = fileSha256(archivePath);
    if (sha256 !== bundle.sha256) {
        throw new Error(`资源包校验失败: ${bundle.archive}`);
    }

    emitStatus({ status: 'resource-downloaded', bundle: bundleName, archive: bundle.archive, percent: 100 });
    return archivePath;
}

async function installBundle(bundleName: string, bundle: ResourceBundleInfo, state: LocalResourceState) {
    emitStatus({ status: 'resource-installing', bundle: bundleName, archive: bundle.archive, step: 'download' });
    const archivePath = await ensureArchive(bundleName, bundle);
    const installTempRoot = getBundleTempRoot();
    const bundleTempDir = path.join(installTempRoot, `${bundleName}-${Date.now()}`);
    const bundleRoot = getBundleRoot(bundleName);
    const backupDir = `${bundleRoot}.bak`;

    rmIfExists(bundleTempDir);
    ensureDir(bundleTempDir);
    emitStatus({ status: 'resource-installing', bundle: bundleName, archive: bundle.archive, step: 'extract' });
    await extractZip(archivePath, bundleTempDir);

    rmIfExists(backupDir);
    if (fs.existsSync(bundleRoot)) {
        fs.renameSync(bundleRoot, backupDir);
    }

    try {
        ensureDir(path.dirname(bundleRoot));
        emitStatus({ status: 'resource-installing', bundle: bundleName, archive: bundle.archive, step: 'replace' });
        fs.renameSync(bundleTempDir, bundleRoot);
        rmIfExists(backupDir);
    } catch (error) {
        rmIfExists(bundleRoot);
        if (fs.existsSync(backupDir)) {
            fs.renameSync(backupDir, bundleRoot);
        }
        throw error;
    }

    state.bundles[bundleName] = {
        version: bundle.version,
        sha256: bundle.sha256,
        installedAt: new Date().toISOString(),
        path: bundleRoot,
    };
    emitStatus({ status: 'resource-installed', bundle: bundleName, archive: bundle.archive, percent: 100 });
}

export async function checkResourceBundles(options: { installMissing?: boolean } = {}) {
    const manifest = await resolveManifest();
    if (!manifest) {
        return { manifest: null, missingRequired: [], pending: [], installed: [] };
    }

    const state = readJsonFile<LocalResourceState>(getLocalStatePath(), {
        manifestVersion: manifest.manifestVersion,
        appVersion: manifest.appVersion,
        bundles: {},
    });

    const pending: string[] = [];
    const missingRequired: string[] = [];
    const installed: string[] = [];

    ensureDir(AppEnv.resourceBundleRoot);
    ensureDir(AppEnv.resourceStateRoot);
    ensureDir(getBundleTempRoot());

    for (const [bundleName, bundle] of Object.entries(manifest.bundles)) {
        const bundleDir = getBundleRoot(bundleName);
        const local = state.bundles[bundleName];

        const bundleReady = isBundleReady(bundleName, bundleDir);
        if (!local && bundleReady) {
            state.bundles[bundleName] = {
                version: bundle.version,
                sha256: bundle.sha256,
                installedAt: new Date().toISOString(),
                path: bundleDir,
            };
            emitStatus({ status: 'resource-ready', bundle: bundleName, archive: bundle.archive, prebundled: true });
            continue;
        }
        if (local?.version === bundle.version && bundleReady) {
            continue;
        }

        if (local?.version === bundle.version && !bundleReady) {
            Log.warn('[ResourceManager] bundle directory invalid, forcing reinstall', { bundleName, bundleDir });
        }
        pending.push(bundleName);
        if (bundle.required) {
            missingRequired.push(bundleName);
        }

        if (options.installMissing) {
            try {
                await installBundle(bundleName, bundle, state);
                installed.push(bundleName);
            } catch (error: any) {
                emitStatus({ status: 'error', message: `bundle ${bundleName}: ${error?.message || String(error)}` });
                Log.error('[ResourceManager] install bundle failed', { bundleName, message: error?.message || String(error) });
                if (bundle.required) {
                    throw error;
                }
            }
        }
    }

    state.manifestVersion = manifest.manifestVersion;
    state.appVersion = manifest.appVersion;
    writeJsonFile(getLocalStatePath(), state);

    return { manifest, missingRequired, pending, installed };
}
