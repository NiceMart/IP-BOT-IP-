const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const BASE_DIR = path.join(__dirname, '../electron/resources/extra');

// 下载进度显示
function downloadFile(url, destPath, description) {
    return new Promise((resolve, reject) => {
        console.log(`\n📥 开始下载: ${description}`);
        console.log(`   URL: ${url}`);
        console.log(`   目标: ${destPath}`);

        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);

        protocol.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // 处理重定向
                file.close();
                fs.unlinkSync(destPath);
                return downloadFile(response.headers.location, destPath, description)
                    .then(resolve)
                    .catch(reject);
            }

            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;
            let lastPercent = 0;

            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                const percent = Math.floor((downloadedSize / totalSize) * 100);
                if (percent > lastPercent && percent % 10 === 0) {
                    console.log(`   进度: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB / ${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
                    lastPercent = percent;
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`   ✅ 下载完成: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`);
                resolve();
            });

            file.on('error', (err) => {
                fs.unlinkSync(destPath);
                reject(err);
            });
        }).on('error', (err) => {
            fs.unlinkSync(destPath);
            reject(err);
        });
    });
}

// 解压 ZIP 文件
function extractZip(zipPath, destDir) {
    console.log(`\n📦 解压文件: ${zipPath}`);
    console.log(`   目标目录: ${destDir}`);

    try {
        // 使用 PowerShell 解压（Windows 内置）
        execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
            stdio: 'inherit'
        });
        console.log('   ✅ 解压完成');
    } catch (error) {
        console.error('   ❌ 解压失败:', error.message);
        throw error;
    }
}

async function main() {
    console.log('🚀 开始下载 ZhenQianBa 打包所需的外部依赖\n');
    console.log('=' .repeat(60));

    // 1. 下载 Python 3.12 嵌入式版本
    console.log('\n📦 步骤 1/4: 下载 Python 3.12 嵌入式版本');
    const pythonDir = path.join(BASE_DIR, 'common/python');
    await fs.ensureDir(pythonDir);

    if (!fs.existsSync(path.join(pythonDir, 'python.exe'))) {
        const pythonZip = path.join(BASE_DIR, 'python-3.12.0-embed-amd64.zip');

        await downloadFile(
            'https://www.python.org/ftp/python/3.12.0/python-3.12.0-embed-amd64.zip',
            pythonZip,
            'Python 3.12 嵌入式版本 (约 15MB)'
        );

        extractZip(pythonZip, pythonDir);
        fs.unlinkSync(pythonZip);

        console.log('\n   🔧 配置 Python 环境...');

        // 修改 python312._pth 以启用 site-packages
        const pthFile = path.join(pythonDir, 'python312._pth');
        if (fs.existsSync(pthFile)) {
            let content = fs.readFileSync(pthFile, 'utf-8');
            content = content.replace('#import site', 'import site');
            if (!content.includes('Lib\\site-packages')) {
                content = content.trim() + '\nLib\\site-packages\n';
            }
            fs.writeFileSync(pthFile, content);
            console.log('   ✅ python312._pth 配置完成');
        }

        // 下载 get-pip.py
        console.log('\n   📥 下载 pip 安装脚本...');
        const getPipPath = path.join(pythonDir, 'get-pip.py');
        await downloadFile(
            'https://bootstrap.pypa.io/get-pip.py',
            getPipPath,
            'get-pip.py'
        );

        // 安装 pip
        console.log('\n   🔧 安装 pip...');
        execSync(`"${path.join(pythonDir, 'python.exe')}" "${getPipPath}"`, {
            stdio: 'inherit',
            cwd: pythonDir
        });

        console.log('\n   ✅ Python 环境准备完成');
    } else {
        console.log('   ⏭️  Python 已存在，跳过下载');
    }

    // 2. 安装 Python 依赖
    console.log('\n📦 步骤 2/4: 安装 Python 依赖');
    const requirementsPath = path.join(__dirname, '../python/requirements.txt');

    if (fs.existsSync(requirementsPath)) {
        console.log('   📋 从 requirements.txt 安装依赖...');
        console.log('   ⚠️  这可能需要 5-10 分钟，请耐心等待...\n');

        try {
            execSync(
                `"${path.join(pythonDir, 'python.exe')}" -m pip install -r "${requirementsPath}" --target="${path.join(pythonDir, 'Lib/site-packages')}"`,
                {
                    stdio: 'inherit',
                    cwd: pythonDir
                }
            );
            console.log('\n   ✅ Python 依赖安装完成');
        } catch (error) {
            console.error('\n   ❌ Python 依赖安装失败');
            console.error('   请手动执行:');
            console.error(`   cd "${pythonDir}"`);
            console.error(`   python.exe -m pip install -r "${requirementsPath}" --target="./Lib/site-packages"`);
        }
    } else {
        console.log('   ⚠️  未找到 requirements.txt，跳过依赖安装');
    }

    // 3. 下载 FFmpeg
    console.log('\n📦 步骤 3/4: 下载 FFmpeg');
    const ffmpegDir = path.join(BASE_DIR, 'win-x86');
    await fs.ensureDir(ffmpegDir);

    if (!fs.existsSync(path.join(ffmpegDir, 'ffmpeg.exe'))) {
        console.log('\n   ⚠️  FFmpeg 需要手动下载');
        console.log('   原因: GitHub Releases 文件太大，需要浏览器下载');
        console.log('\n   请按照以下步骤操作:');
        console.log('   1. 打开浏览器访问: https://github.com/BtbN/FFmpeg-Builds/releases');
        console.log('   2. 下载: ffmpeg-master-latest-win64-gpl.zip');
        console.log('   3. 解压后，将 bin 目录下的文件复制到:');
        console.log(`      ${ffmpegDir}`);
        console.log('   4. 确保包含: ffmpeg.exe 和 ffprobe.exe\n');
    } else {
        console.log('   ⏭️  FFmpeg 已存在，跳过下载');
    }

    // 4. 下载 Chromium (通过 puppeteer)
    console.log('\n📦 步骤 4/4: 准备 Chromium 浏览器');
    const chromiumDir = path.join(BASE_DIR, 'common/chromium');
    await fs.ensureDir(chromiumDir);

    if (!fs.existsSync(path.join(chromiumDir, 'chrome-win'))) {
        console.log('   🔧 通过 puppeteer 下载 Chromium...');
        console.log('   ⚠️  这可能需要几分钟...\n');

        try {
            // 检查 puppeteer 是否已安装
            const puppeteerPath = path.join(__dirname, '../node_modules/puppeteer');
            if (!fs.existsSync(puppeteerPath)) {
                console.log('   ❌ 未找到 puppeteer，请先运行: npm install');
            } else {
                // 查找 puppeteer 下载的 Chromium
                const localChromium = path.join(puppeteerPath, '.local-chromium');
                if (fs.existsSync(localChromium)) {
                    // 复制 Chromium
                    const chromiumVersions = fs.readdirSync(localChromium);
                    if (chromiumVersions.length > 0) {
                        const latestVersion = chromiumVersions[0];
                        const chromeSrc = path.join(localChromium, latestVersion, 'chrome-win');

                        if (fs.existsSync(chromeSrc)) {
                            console.log(`   📋 复制 Chromium 从 puppeteer...`);
                            await fs.copy(chromeSrc, path.join(chromiumDir, 'chrome-win'));
                            console.log('   ✅ Chromium 准备完成');
                        }
                    }
                } else {
                    console.log('   ⚠️  puppeteer 未下载 Chromium');
                    console.log('   解决方案: 运行一次开发环境，Chromium 会自动下载');
                }
            }
        } catch (error) {
            console.error('   ❌ Chromium 准备失败:', error.message);
        }
    } else {
        console.log('   ⏭️  Chromium 已存在，跳过下载');
    }

    // 5. 下载 AI 模型
    console.log('\n📦 步骤 5/5: 下载 AI 模型');
    const modelsDir = path.join(BASE_DIR, 'common/models');
    await fs.ensureDir(modelsDir);

    const u2netPath = path.join(modelsDir, 'u2net.onnx');
    if (!fs.existsSync(u2netPath)) {
        console.log('   ⚠️  U2-Net 模型需要通过 rembg 触发下载');
        console.log('\n   请按照以下步骤操作:');
        console.log('   1. 确保上面的 Python 依赖已安装完成');
        console.log('   2. 运行以下命令触发模型下载:');
        console.log(`      "${path.join(pythonDir, 'python.exe')}" -c "from rembg import remove, new_session; session = new_session('u2net')"`);
        console.log('   3. 模型会下载到用户目录，然后复制到:');
        console.log(`      ${u2netPath}`);
        console.log('   4. Windows 模型位置通常在: %USERPROFILE%\\.u2net\\u2net.onnx\n');
    } else {
        console.log('   ⏭️  U2-Net 模型已存在，跳过下载');
    }

    // 最终检查
    console.log('\n' + '='.repeat(60));
    console.log('📊 外部依赖下载状态检查:');
    console.log('='.repeat(60));

    const checks = [
        { name: 'Python', path: path.join(pythonDir, 'python.exe') },
        { name: 'pip', path: path.join(pythonDir, 'Scripts/pip.exe') },
        { name: 'FFmpeg', path: path.join(ffmpegDir, 'ffmpeg.exe') },
        { name: 'FFprobe', path: path.join(ffmpegDir, 'ffprobe.exe') },
        { name: 'Chromium', path: path.join(chromiumDir, 'chrome-win/chrome.exe') },
        { name: 'U2-Net 模型', path: u2netPath }
    ];

    let allComplete = true;
    for (const check of checks) {
        const exists = fs.existsSync(check.path);
        console.log(`${exists ? '✅' : '❌'} ${check.name}: ${exists ? '已准备' : '缺失'}`);
        if (!exists) allComplete = false;
    }

    console.log('\n' + '='.repeat(60));
    if (allComplete) {
        console.log('🎉 所有外部依赖准备完成！');
        console.log('\n下一步:');
        console.log('1. 运行: npm run prepare-package  (复制项目资源)');
        console.log('2. 运行: npm run build:win       (开始打包)');
    } else {
        console.log('⚠️  部分依赖需要手动准备');
        console.log('请查看上面的提示信息完成剩余步骤');
    }
    console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
