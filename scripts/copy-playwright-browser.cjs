const fs = require('fs-extra');
const path = require('path');

/**
 * 复制 Playwright 浏览器到项目打包资源目录
 * 从开发环境的缓存直接复制到打包目录
 */

async function copyPlaywrightBrowser() {
    console.log('🚀 开始复制 Playwright 浏览器到打包资源目录\n');
    console.log('='.repeat(60));

    // 目标目录：项目打包资源
    const targetDir = path.join(__dirname, '../electron/resources/extra/common/playwright');
    await fs.ensureDir(targetDir);

    // 源目录：Playwright 的缓存位置（开发环境）
    const sourcePaths = [
        // Windows: %APPDATA%/ms-playwright
        path.join(process.env.APPDATA || '', 'ms-playwright'),
        // Windows: %LOCALAPPDATA%/ms-playwright
        path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'),
        // Mac/Linux: ~/.cache/ms-playwright
        path.join(process.env.HOME || '', '.cache/ms-playwright'),
    ];

    let sourceDir = null;
    for (const p of sourcePaths) {
        if (fs.existsSync(p)) {
            console.log(`✅ 找到 Playwright 缓存目录: ${p}`);
            sourceDir = p;
            break;
        }
    }

    if (!sourceDir) {
        console.error('❌ 未找到 Playwright 浏览器缓存目录');
        console.error('\n请先运行以下命令下载 Playwright 浏览器:');
        console.error('  npx playwright install chromium');
        console.error('\n或者运行一次开发环境，Playwright 会自动下载浏览器');
        process.exit(1);
    }

    // 查找 chromium 浏览器版本
    console.log('\n🔍 查找 Chromium 浏览器版本...');
    const files = await fs.readdir(sourceDir);
    const chromiumDirs = files.filter(f => f.startsWith('chromium-'));

    if (chromiumDirs.length === 0) {
        console.error('❌ 未找到 Chromium 浏览器');
        console.error('请先运行: npx playwright install chromium');
        process.exit(1);
    }

    console.log(`✅ 找到 ${chromiumDirs.length} 个 Chromium 版本:`);
    chromiumDirs.forEach((dir, index) => {
        console.log(`   ${index + 1}. ${dir}`);
    });

    // 只复制最新版本以减小打包体积
    const latestChromium = chromiumDirs.sort().reverse()[0];
    console.log(`\n📌 只打包最新版本: ${latestChromium}`);
    console.log('   (其他版本将被跳过以减小打包体积)\n');

    console.log('📋 开始复制浏览器文件...');
    console.log('⚠️  这可能需要几分钟，请耐心等待...\n');

    let totalSize = 0;
    let fileCount = 0;

    for (const chromiumDir of [latestChromium]) {
        const sourceChromiumPath = path.join(sourceDir, chromiumDir);
        const targetChromiumPath = path.join(targetDir, chromiumDir);

        console.log(`📦 复制: ${chromiumDir}`);
        console.log(`   源: ${sourceChromiumPath}`);
        console.log(`   目标: ${targetChromiumPath}`);

        try {
            // 复制整个目录
            await fs.copy(sourceChromiumPath, targetChromiumPath, {
                overwrite: true,
                filter: (src) => {
                    // 排除不必要的文件以减小体积
                    const excludePatterns = [
                        '.isolatedStorage',
                        'CrashpadMetrics',
                        '.lock',
                        'SingletonLock',
                        'SingletonSocket',
                        'SingletonCookie'
                    ];

                    const shouldInclude = !excludePatterns.some(pattern => src.includes(pattern));
                    return shouldInclude;
                }
            });

            // 计算大小
            const size = await getDirSize(targetChromiumPath);
            totalSize += size;

            const count = await countFiles(targetChromiumPath);
            fileCount += count;

            console.log(`   ✅ 复制完成 (${(size / 1024 / 1024).toFixed(2)} MB, ${count} 个文件)\n`);

        } catch (error) {
            console.error(`   ❌ 复制失败:`, error.message);
        }
    }

    console.log('='.repeat(60));
    console.log('🎉 Playwright 浏览器复制完成！');
    console.log(`\n📊 统计信息:`);
    console.log(`   总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   文件数: ${fileCount} 个`);
    console.log(`   目标目录: ${targetDir}`);

    // 验证浏览器可执行文件
    console.log('\n🔍 验证浏览器可执行文件...');
    for (const chromiumDir of chromiumDirs) {
        const chromePath = path.join(targetDir, chromiumDir, 'chrome-win64/chrome.exe');
        const chromePathAlt = path.join(targetDir, chromiumDir, 'chrome-win/chrome.exe');

        if (fs.existsSync(chromePath)) {
            console.log(`   ✅ ${chromiumDir}/chrome-win64/chrome.exe`);
        } else if (fs.existsSync(chromePathAlt)) {
            console.log(`   ✅ ${chromiumDir}/chrome-win/chrome.exe`);
        } else {
            console.log(`   ❌ ${chromiumDir} - 未找到 chrome.exe`);
        }
    }

    console.log('\n='.repeat(60));
    console.log('✅ 完成！现在可以运行打包命令了:');
    console.log('   npm run prepare-package  # 准备打包资源');
    console.log('   npm run build:win        # 开始打包');
    console.log('='.repeat(60) + '\n');
}

// 辅助函数：计算目录大小
async function getDirSize(dir) {
    let size = 0;

    async function walk(directory) {
        try {
            const files = await fs.readdir(directory);
            for (const file of files) {
                const filePath = path.join(directory, file);
                const stat = await fs.stat(filePath);
                if (stat.isDirectory()) {
                    await walk(filePath);
                } else {
                    size += stat.size;
                }
            }
        } catch (error) {
            // 忽略权限错误
        }
    }

    if (await fs.pathExists(dir)) {
        await walk(dir);
    }

    return size;
}

// 辅助函数：统计文件数量
async function countFiles(dir) {
    let count = 0;

    async function walk(directory) {
        try {
            const files = await fs.readdir(directory);
            for (const file of files) {
                const filePath = path.join(directory, file);
                const stat = await fs.stat(filePath);
                if (stat.isDirectory()) {
                    await walk(filePath);
                } else {
                    count++;
                }
            }
        } catch (error) {
            // 忽略权限错误
        }
    }

    if (await fs.pathExists(dir)) {
        await walk(dir);
    }

    return count;
}

copyPlaywrightBrowser().catch(console.error);
