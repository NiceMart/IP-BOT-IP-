import * as path from 'path';
import * as fs from 'fs';
import DB from './main';
import { Log } from '../log/main';
import { getCommonResourcePath } from '../../lib/resource-path';
import { AppEnv } from '../env';

interface BuiltinAvatar {
    name: string;
    fileName: string;
}

const BUILTIN_AVATARS: BuiltinAvatar[] = [
    { name: '魅力洋妞', fileName: '魅力洋妞.mp4' },
    { name: '清纯御姐', fileName: '清纯御姐.mp4' },
    { name: '温婉少妇', fileName: '温婉少妇.mp4' },
];

const getAvatarSourcePath = (fileName: string): string => {
    return getCommonResourcePath(path.join('shuiziren', fileName));
};

const getHubDir = (): string => {
    return path.join(AppEnv.dataRoot, 'hub', 'file');
};

const copyToHub = (srcPath: string, destDir: string, fileName: string): string => {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const baseName = path.basename(fileName, path.extname(fileName));
    const ext = path.extname(fileName);
    let destPath = path.join(destDir, fileName);
    let counter = 1;

    while (fs.existsSync(destPath)) {
        destPath = path.join(destDir, `${baseName}_${counter}${ext}`);
        counter++;
    }

    fs.copyFileSync(srcPath, destPath);
    return destPath;
};

export const initBuiltinAvatars = async (): Promise<void> => {
    try {
        Log.info('initBuiltinAvatars.start', '开始检查内置形象');

        const hubDir = getHubDir();
        let imported = 0;

        for (const avatar of BUILTIN_AVATARS) {
            try {
                const existing = await DB.first(
                    `SELECT id FROM data_video_template WHERE name = ?`,
                    [avatar.name]
                );

                if (existing) {
                    Log.info('initBuiltinAvatars.exists', '形象已存在', { name: avatar.name });
                    continue;
                }

                const srcPath = getAvatarSourcePath(avatar.fileName);

                if (!fs.existsSync(srcPath)) {
                    Log.warn('initBuiltinAvatars.fileNotFound', '内置形象文件不存在', { path: srcPath });
                    continue;
                }

                const savedPath = copyToHub(srcPath, hubDir, avatar.fileName);

                await DB.insert(
                    `INSERT INTO data_video_template (name, video, info) VALUES (?, ?, ?)`,
                    [avatar.name, savedPath, JSON.stringify({})]
                );

                imported++;
                Log.info('initBuiltinAvatars.imported', '已导入内置形象', {
                    name: avatar.name,
                    path: savedPath,
                });
            } catch (avatarError) {
                Log.error('initBuiltinAvatars.avatarError', '导入单个形象失败', {
                    name: avatar.name,
                    error: avatarError,
                });
            }
        }

        Log.info('initBuiltinAvatars.complete', '内置形象初始化完成', { imported });
    } catch (error) {
        Log.error('initBuiltinAvatars.error', '内置形象初始化失败', { error });
    }
};
