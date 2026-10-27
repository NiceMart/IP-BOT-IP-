const fs = require('fs-extra');
const path = require('path');
const { syncSystemSubtitleSources } = require('./sync-system-subtitle-sources.cjs');

async function preparePackage() {
    console.log('📦 开始准备打包资源...\n');
    console.log('='.repeat(60));

    // 0. 从 sensitive.config.json 同步品牌信息到 electron-builder.json5 和 package.json
    console.log('\n0️⃣ 同步品牌信息...');
    const sensitiveConfigPath = path.join(__dirname, '../sensitive.config.json');
    if (fs.existsSync(sensitiveConfigPath)) {
        try {
            const sensitive = JSON.parse(fs.readFileSync(sensitiveConfigPath, 'utf-8'));

            // 更新 electron-builder.json5
            const builderPath = path.join(__dirname, '../electron-builder.json5');
            if (fs.existsSync(builderPath)) {
                let builderContent = fs.readFileSync(builderPath, 'utf-8');
                if (sensitive.APP_NAME) {
                    builderContent = builderContent.replace(
                        /"productName"\s*:\s*"[^"]*"/,
                        `"productName": "${sensitive.APP_NAME}"`
                    );
                }
                if (sensitive.APP_ID) {
                    builderContent = builderContent.replace(
                        /"appId"\s*:\s*"[^"]*"/,
                        `"appId": "${sensitive.APP_ID}"`
                    );
                }
                fs.writeFileSync(builderPath, builderContent, 'utf-8');
                console.log(`   ✅ electron-builder.json5 已同步 (productName: ${sensitive.APP_NAME})`);
            }

            // 更新 package.json
            const pkgPath = path.join(__dirname, '../package.json');
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                if (sensitive.APP_PACKAGE_NAME) pkg.name = sensitive.APP_PACKAGE_NAME;
                if (sensitive.APP_DESCRIPTION) pkg.description = sensitive.APP_DESCRIPTION;
                fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
                console.log(`   ✅ package.json 已同步 (name: ${sensitive.APP_PACKAGE_NAME})`);
            }
        } catch (err) {
            console.warn('   ⚠️ 同步品牌信息失败:', err.message);
        }
    } else {
        console.log('   ⚠️ 未找到 sensitive.config.json，跳过品牌同步');
    }

    const extraDir = path.join(__dirname, '../electron/resources/extra');
    const commonDir = path.join(extraDir, 'common');

    // 0. 发布前同步系统字幕模板，避免安装包带入旧候选模板或旧音效配置
    console.log('\n0️⃣ 同步系统字幕模板...');
    const syncResult = syncSystemSubtitleSources();
    console.log(`   ✅ 已同步 ${syncResult.count} 个系统字幕模板到发布配置\n`);

    // 0.5 应用贴牌图片
    console.log('\n0️⃣ 应用贴牌图片...');
    const brandingScriptPath = path.join(__dirname, '../branding/apply-branding.cjs');
    if (fs.existsSync(brandingScriptPath)) {
        try {
            require(brandingScriptPath);
        } catch (err) {
            console.warn('   ⚠️ 应用贴牌图片失败:', err.message);
        }
    } else {
        console.log('   ⚠️ 未找到 branding/apply-branding.cjs，跳过贴牌图片');
    }

    // 1. 确保目录存在
    console.log('\n1️⃣ 确保目录结构存在...');
    await fs.ensureDir(path.join(commonDir, 'python'));
    await fs.ensureDir(path.join(commonDir, 'chromium'));
    await fs.ensureDir(path.join(commonDir, 'python-scripts'));
    await fs.ensureDir(path.join(commonDir, 'models'));
    await fs.ensureDir(path.join(commonDir, 'fonts'));
    await fs.ensureDir(path.join(commonDir, 'bgm'));
    await fs.ensureDir(path.join(commonDir, 'demo'));
    await fs.ensureDir(path.join(commonDir, 'config'));
    await fs.ensureDir(path.join(commonDir, 'cover-templates'));
    await fs.ensureDir(path.join(extraDir, 'win-x86'));
    console.log('   ✅ 目录结构准备完成\n');

    // 2. 复制 Python 脚本
    console.log('2️⃣ 复制 Python 脚本...');
    const pythonSrc = path.join(__dirname, '../python');
    const pythonDest = path.join(commonDir, 'python-scripts');
    const pythonFilter = (src) => {
        const normalizedSrc = src.replace(/\\/g, '/');
        const fileName = path.basename(normalizedSrc).toLowerCase();

        if (normalizedSrc.includes('/__pycache__/') || fileName.endsWith('.pyc')) {
            return false;
        }

        if (
            fileName.includes('.backup') ||
            fileName.endsWith('.bak') ||
            fileName.includes('backup_') ||
            fileName.startsWith('test_')
        ) {
            return false;
        }

        return true;
    };

    if (fs.existsSync(pythonSrc)) {
        await copyWithLockTolerance(pythonSrc, pythonDest, {
            overwrite: true,
            filter: pythonFilter
        });
        const fileCount = await countFiles(pythonDest);
        console.log(`   ✅ Python 脚本复制到 python-scripts 完成 (${fileCount} 个文件)`);

        const pythonRuntimeDir = path.join(commonDir, 'python');
        await copyWithLockTolerance(pythonSrc, pythonRuntimeDir, {
            overwrite: true,
            filter: pythonFilter
        });
        console.log(`   ✅ Python 脚本复制到 python 运行时目录完成\n`);
    } else {
        console.log('   ⚠️  Python 脚本目录不存在，跳过\n');
    }

    // 3. 复制字体
    console.log('3️⃣ 复制字体文件...');
    const fontSrc = path.join(__dirname, '../ziti');
    const fontDest = path.join(commonDir, 'fonts/ziti');

    if (fs.existsSync(fontSrc)) {
        await copyWithLockTolerance(fontSrc, fontDest, { overwrite: true });
        const fileCount = await countFiles(fontDest);
        const totalSize = await getDirSize(fontDest);
        console.log(`   ✅ 字体复制完成 (${fileCount} 个文件, ${(totalSize / 1024 / 1024).toFixed(2)} MB)\n`);
    } else {
        console.log('   ⚠️  字体目录不存在，跳过\n');
    }

    // 4. 复制 BGM
    console.log('4️⃣ 复制背景音乐...');
    const bgmSrc = path.join(__dirname, '../bgm');
    const bgmDest = path.join(commonDir, 'bgm');

    if (fs.existsSync(bgmSrc)) {
        await copyWithLockTolerance(bgmSrc, bgmDest, { overwrite: true });
        const fileCount = await countFiles(bgmDest);
        const totalSize = await getDirSize(bgmDest);
        console.log(`   ✅ BGM 复制完成 (${fileCount} 个文件, ${(totalSize / 1024 / 1024).toFixed(2)} MB)\n`);
    } else {
        console.log('   ⚠️  BGM 目录不存在，跳过\n');
    }

    // 5. 复制 Demo
    console.log('5️⃣ 复制演示文件...');
    const demoSrc = path.join(__dirname, '../demo');
    const demoDest = path.join(commonDir, 'demo');

    if (fs.existsSync(demoSrc)) {
        await copyWithLockTolerance(demoSrc, demoDest, { overwrite: true });
        const fileCount = await countFiles(demoDest);
        const totalSize = await getDirSize(demoDest);
        console.log(`   ✅ Demo 复制完成 (${fileCount} 个文件, ${(totalSize / 1024 / 1024).toFixed(2)} MB)\n`);
    } else {
        console.log('   ⚠️  Demo 目录不存在，跳过\n');
    }

    // 6. 复制配置文件
    console.log('6️⃣ 复制配置文件...');
    const configDest = path.join(commonDir, 'config');

    const configFiles = [
        {
            src: path.join(__dirname, '../electron/config/default-templates.json'),
            dest: path.join(configDest, 'default-templates.json'),
            name: 'default-templates.json'
        },
        {
            src: path.join(__dirname, '../electron/config/default-subtitle-templates.json'),
            dest: path.join(configDest, 'default-subtitle-templates.json'),
            name: 'default-subtitle-templates.json'
        },
        {
            src: path.join(__dirname, '../python/preset_templates.json'),
            dest: path.join(configDest, 'preset_templates.json'),
            name: 'preset_templates.json'
        },
        {
            src: path.join(__dirname, '../electron/config/default-ipagent-config.json'),
            dest: path.join(configDest, 'default-ipagent-config.json'),
            name: 'default-ipagent-config.json'
        },
        {
            src: path.join(__dirname, '../electron/resources/extra/common/config/system-templates.json'),
            dest: path.join(configDest, 'system-templates.json'),
            name: 'system-templates.json (系统模板配置 - 8套字幕+8套封面)'
        }
    ];

    let copiedCount = 0;
    for (const file of configFiles) {
        if (fs.existsSync(file.src)) {
            const samePath = path.resolve(file.src) === path.resolve(file.dest);
            if (samePath) {
                const size = (await fs.stat(file.src)).size;
                console.log(`   ℹ️  ${file.name} 已在目标位置 (${(size / 1024).toFixed(2)} KB)`);
                copiedCount++;
                continue;
            }
            await copyWithLockTolerance(file.src, file.dest, { overwrite: true });
            const size = (await fs.stat(file.dest)).size;
            console.log(`   ✅ ${file.name} (${(size / 1024).toFixed(2)} KB)`);
            copiedCount++;
        } else {
            console.log(`   ⚠️  ${file.name} - 源文件不存在`);
        }
    }
    console.log(`   📊 配置文件复制完成 (${copiedCount}/${configFiles.length})\n`);

    // 7. 检查外部依赖
    console.log('7️⃣ 检查外部依赖...');

    // FFmpeg DLL 文件列表
    const ffmpegDlls = [
        'avcodec-61.dll',
        'avdevice-61.dll',
        'avfilter-10.dll',
        'avformat-61.dll',
        'avutil-59.dll',
        'postproc-58.dll',
        'swresample-5.dll',
        'swscale-8.dll'
    ];

    // 动态查找最新的 Playwright Chromium 版本
    const playwrightDir = path.join(commonDir, 'playwright');
    let playwrightChromiumCheck = null;
    if (await fs.pathExists(playwrightDir)) {
        const chromiumDirs = (await fs.readdir(playwrightDir))
            .filter(f => f.startsWith('chromium-'))
            .sort()
            .reverse();
        if (chromiumDirs.length > 0) {
            const latestChromium = chromiumDirs[0];
            const chromePath = path.join(playwrightDir, latestChromium, 'chrome-win64/chrome.exe');
            const chromePathAlt = path.join(playwrightDir, latestChromium, 'chrome-win/chrome.exe');
            playwrightChromiumCheck = {
                name: `Playwright Chromium (${latestChromium})`,
                path: await fs.pathExists(chromePath) ? chromePath : chromePathAlt
            };
        }
    }

    const checks = [
        { name: 'Python 环境', path: path.join(commonDir, 'python/python.exe') },
        { name: 'Python 依赖 (opencv)', path: path.join(commonDir, 'python/Lib/site-packages/cv2') },
        { name: 'FFmpeg (win-x86)', path: path.join(extraDir, 'win-x86/ffmpeg.exe') },
        { name: 'FFprobe (win-x86)', path: path.join(extraDir, 'win-x86/ffprobe.exe') },
        ...ffmpegDlls.map(dll => ({ name: `FFmpeg DLL (${dll})`, path: path.join(extraDir, `win-x86/${dll}`) })),
        ...(playwrightChromiumCheck ? [playwrightChromiumCheck] : []),
        { name: 'U2-Net 模型', path: path.join(commonDir, 'models/u2net.onnx') },
    ];

    let allOk = true;
    for (const check of checks) {
        const exists = await fs.pathExists(check.path);
        if (exists) {
            console.log(`   ✅ ${check.name}`);
        } else {
            console.log(`   ❌ ${check.name} - 缺失`);
            allOk = false;
        }
    }

    console.log('\n' + '='.repeat(60));

    if (!allOk) {
        console.log('⚠️  警告：某些外部依赖缺失');
        console.log('\n请先运行: node scripts/download-dependencies.js');
        console.log('参考文档: C:\\aigcpanel-main\\打包方案.md 的 "阶段 1: 准备外部依赖"\n');
        console.log('='.repeat(60));
        process.exit(1);
    } else {
        console.log('✅ 所有资源准备完成！可以开始打包了');
        console.log('\n下一步:');
        console.log('  npm run build:win    # 开始打包 Windows 版本');
        console.log('  npm run build:mac    # 开始打包 macOS 版本');
        console.log('\n📝 字幕模板说明:');
        console.log('  系统默认字幕模板配置:');
        console.log('  • 位置: electron/config/default-subtitle-templates.json');
        console.log('  • 功能: 包含所有参数（普通字幕、关键词特效、标题字幕、音效）');
        console.log('\n导出字幕模板功能:');
        console.log('  • 用户在应用中导出字幕模板为 JSON 文件');
        console.log('  • 其他用户可通过导入功能导入这些 JSON 文件');
        console.log('  • 支持备份、分享、版本控制');
        console.log('\n='.repeat(60));
    }
}

async function copyWithLockTolerance(src, dest, options = {}) {
    try {
        await fs.copy(src, dest, options);
        return true;
    } catch (error) {
        if (error && error.code === 'EPERM') {
            console.warn(`   ⚠️ 跳过被占用的复制目标: ${dest}`);
            console.warn(`      原因: ${error.message}`);
            return false;
        }
        throw error;
    }
}

// 辅助函数：统计文件数量
async function countFiles(dir) {
    let count = 0;

    async function walk(directory) {
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
    }

    if (await fs.pathExists(dir)) {
        await walk(dir);
    }

    return count;
}

// 辅助函数：计算目录大小
async function getDirSize(dir) {
    let size = 0;

    async function walk(directory) {
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
    }

    if (await fs.pathExists(dir)) {
        await walk(dir);
    }

    return size;
}

preparePackage().catch(console.error);
