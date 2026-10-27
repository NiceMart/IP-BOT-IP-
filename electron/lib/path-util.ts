import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export function normalizePath(filePath: string): string {
    if (!filePath) return filePath;
    return path.normalize(filePath);
}

export function normalizeOutputPath(filePath: string): string {
    if (!filePath) return filePath;

    if (os.platform() !== 'win32') return filePath;

    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return path.normalize(filePath);
}

export function normalizePaths(filePaths: string[]): string[] {
    return filePaths.map(p => normalizePath(p));
}

export function quotePath(filePath: string): string {
    if (filePath.includes(' ') && !filePath.startsWith('"')) {
        return `"${filePath}"`;
    }
    return filePath;
}

export function createSafeTempPath(extension: string): string {
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `temp_${timestamp}_${random}.${extension}`;
    return path.join(tempDir, filename);
}
