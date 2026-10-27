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
    console.log('🚀 开始下载 ZhenQianBa 打包所需的外部依赖（国内镜像版本）\n');
    console.log('=' .repeat(60));

    // 1. 下载 Python 3.12 嵌入式版本（使用淘宝镜像）
    console.log('\n📦 步骤 1/5: 下载 Python 3.12 嵌入式版本（国内镜像）');
    const pythonDir = path.join(BASE_DIR, 'common/python');
    await fs.ensureDir(pythonDir);

    if (!fs.existsSync(path.join(pythonDir, 'python.exe'))) {
        const pythonZip = path.join(BASE_DIR, 'python-3.12.0-embed-amd64.zip');

        // 尝试多个镜像源
        const mirrors = [
            'https://registry.npmmirror.com/-/binary/python/3.12.0/python-3.12.0-embed-amd64.zip',
            'https://npm.taobao.org/mirrors/python/3.12.0/python-3.12.0-embed-amd64.zip',
        ];

        let downloaded = false;
        for (const mirror of mirrors) {
            try {
                console.log(`\n   尝试镜像: ${mirror}`);
                await downloadFile(mirror, pythonZip, 'Python 3.12 嵌入式版本 (约 15MB)');
                downloaded = true;
                break;
            } catch (error) {
                console.log(`   ❌ 该镜像下载失败，尝试下一个...`);
            }
        }

        if (!downloaded) {
            console.log('\n   ❌ 所有镜像下载失败！');
            console.log('   请手动下载:');
            console.log('   1. 浏览器访问: https://registry.npmmirror.com/binary.html?path=python/');
            console.log('   2. 找到 3.12.0/python-3.12.0-embed-amd64.zip');
            console.log('   3. 下载后解压到: ' + pythonDir);
            console.log('');
        } else {
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

            // 下载 get-pip.py（使用国内镜像）
            console.log('\n   📥 下载 pip 安装脚本（国内镜像）...');
            const getPipPath = path.join(pythonDir, 'get-pip.py');

            try {
                await downloadFile(
                    'https://bootstrap.pypa.io/get-pip.py',
                    getPipPath,
                    'get-pip.py'
                );
            } catch (error) {
                console.log('   ⚠️  下载失败，使用备用地址...');
                await downloadFile(
                    'https://registry.npmmirror.com/-/binary/python-get-pip/get-pip.py',
                    getPipPath,
                    'get-pip.py (备用)'
                );
            }

            // 安装 pip
            console.log('\n   🔧 安装 pip...');
            execSync(`"${path.join(pythonDir, 'python.exe')}" "${getPipPath}"`, {
                stdio: 'inherit',
                cwd: pythonDir
            });

            console.log('\n   ✅ Python 环境准备完成');
        }
    } else {
        console.log('   ⏭️  Python 已存在，跳过下载');
    }

    // 2. 配置 pip 使用国内镜像
    console.log('\n📦 步骤 2/5: 配置 pip 使用国内镜像');

    const pipConfDir = path.join(pythonDir, 'pip');
    const pipConfFile = path.join(pipConfDir, 'pip.ini');

    await fs.ensureDir(pipConfDir);

    const pipConfig = `[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple
trusted-host = pypi.tuna.tsinghua.edu.cn
`;

    fs.writeFileSync(pipConfFile, pipConfig);
    console.log('   ✅ pip 配置完成（使用清华镜像）');

    // 3. 安装 Python 依赖
    console.log('\n📦 步骤 3/5: 安装 Python 依赖（使用清华镜像）');
    const requirementsPath = path.join(__dirname, '../python/requirements.txt');

    if (fs.existsSync(requirementsPath) && fs.existsSync(path.join(pythonDir, 'python.exe'))) {
        console.log('   📋 从 requirements.txt 安装依赖...');
        console.log('   ⚠️  这可能需要 10-20 分钟，请耐心等待...\n');

        try {
            execSync(
                `"${path.join(pythonDir, 'python.exe')}" -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r "${requirementsPath}" --target="${path.join(pythonDir, 'Lib/site-packages')}"`,
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
            console.error(`   python.exe -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r "${requirementsPath}" --target="./Lib/site-packages"`);
        }
    } else {
        console.log('   ⚠️  未找到 requirements.txt 或 Python，跳过依赖安装');
    }

    // 4. FFmpeg 手动下载提示
    console.log('\n📦 步骤 4/5: FFmpeg（需要手动下载）');
    const ffmpegDir = path.join(BASE_DIR, 'win-x86');
    await fs.ensureDir(ffmpegDir);

    if (!fs.existsSync(path.join(ffmpegDir, 'ffmpeg.exe'))) {
        console.log('\n   ⚠️  FFmpeg 需要手动下载（文件较大 ~100MB）');
        console.log('\n   方案1 - 使用 GitHub 代理下载:');
        console.log('   https://ghproxy.com/https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip');
        console.log('\n   方案2 - 从百度网盘/阿里云盘分享获取（如果有的话）');
        console.log('\n   下载后:');
        console.log('   1. 解压 zip 文件');
        console.log('   2. 进入 bin 目录');
        console.log('   3. 复制 ffmpeg.exe 和 ffprobe.exe 到:');
        console.log(`      ${ffmpegDir}`);
        console.log('');
    } else {
        console.log('   ⏭️  FFmpeg 已存在，跳过下载');
    }

    // 5. Chromium
    console.log('\n📦 步骤 5/5: Chromium 浏览器');
    const chromiumDir = path.join(BASE_DIR, 'common/chromium');
    await fs.ensureDir(chromiumDir);

    if (!fs.existsSync(path.join(chromiumDir, 'chrome-win'))) {
        console.log('   🔧 尝试从 puppeteer 复制 Chromium...');

        try {
            const puppeteerPath = path.join(__dirname, '../node_modules/puppeteer');
            if (!fs.existsSync(puppeteerPath)) {
                console.log('   ⚠️  未找到 puppeteer');
                console.log('\n   请使用淘宝镜像安装 puppeteer:');
                console.log('   set PUPPETEER_DOWNLOAD_HOST=https://registry.npmmirror.com/-/binary/chromium-browser-snapshots');
                console.log('   npm install puppeteer');
                console.log('   然后重新运行此脚本\n');
            } else {
                const localChromium = path.join(puppeteerPath, '.local-chromium');
                if (fs.existsSync(localChromium)) {
                    const chromiumVersions = fs.readdirSync(localChromium);
                    if (chromiumVersions.length > 0) {
                        const latestVersion = chromiumVersions[0];
                        const chromeSrc = path.join(localChromium, latestVersion, 'chrome-win');

                        if (fs.existsSync(chromeSrc)) {
                            console.log(`   📋 复制 Chromium...`);
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
        console.log('   ⏭️  Chromium 已存在，跳过');
    }

    // 6. AI 模型
    console.log('\n📦 步骤 6/6: AI 模型');
    const modelsDir = path.join(BASE_DIR, 'common/models');
    await fs.ensureDir(modelsDir);

    const u2netPath = path.join(modelsDir, 'u2net.onnx');
    if (!fs.existsSync(u2netPath)) {
        console.log('   ⚠️  U2-Net 模型需要在安装完 Python 依赖后下载');
        console.log('\n   请执行以下命令:');
        console.log(`   "${path.join(pythonDir, 'python.exe')}" -c "from rembg import remove, new_session; session = new_session('u2net')"`);
        console.log('\n   模型会下载到: %USERPROFILE%\\.u2net\\u2net.onnx');
        console.log('   然后复制到: ' + u2netPath);
        console.log('');
    } else {
        console.log('   ⏭️  U2-Net 模型已存在');
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
