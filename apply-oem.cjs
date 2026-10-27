#!/usr/bin/env node
/**
 * OEM配置自动应用脚本
 * 使用方法：node apply-oem.cjs
 */

// 强制使用 UTF-8 输出（解决 Windows 控制台中文乱码）
if (process.platform === 'win32') {
    try { require('child_process').execSync('chcp 65001', { stdio: 'ignore' }); } catch (e) { }
}

const fs = require('fs');
const path = require('path');

// 读取OEM配置
const oemConfig = require('./oem-config.cjs');

console.log('========================================');
console.log('OEM Config Apply Start');
console.log('Brand:', oemConfig.brandName);
console.log('Slogan:', oemConfig.brandSlogan);
console.log('API:', oemConfig.apiBaseUrl);
console.log('========================================\n');

// 通用替换函数（带调试信息）
function replaceInFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return false;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    for (const [pattern, replacement] of replacements) {
        const before = content;
        content = content.replace(pattern, replacement);
        if (content !== before) {
            changed = true;
            console.log('  [CHANGED] pattern matched: ' + pattern);
        } else {
            console.log('  [SKIP] pattern not matched: ' + pattern);
        }
    }
    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
    return changed;
}

// ========== 1. 更新所有 config.ts 文件 ==========
const configDirs = [
    'src',
    'ktt/src',
    'typ/src',
    'qeg/src',
    'qpy/src',
    'jrd/src',
    'erb/src',
    'flm/src',
    'ixu/src',
    'cal/src',
    'apg/src',
    'uti/src',
    'ceb/src',
    'jdq/src',
    'mfw/src'
];

const apiUrl = oemConfig.apiBaseUrl || '';
const brandName = oemConfig.brandName || '';
const brandSlogan = oemConfig.brandSlogan || '';

let configUpdated = 0;
configDirs.forEach(dir => {
    const configPath = path.join(__dirname, dir, 'config.ts');
    if (!fs.existsSync(configPath)) return;

    console.log('\nProcessing: ' + configPath);

    const replacements = [
        // name: "任意内容"  →  name: "新品牌名"
        [/name:\s*"[^"]*"/, 'name: "' + brandName + '"'],
        // title: "任意内容"  →  title: "新品牌名"
        [/title:\s*"[^"]*"/, 'title: "' + brandName + '"'],
        // slogan: "任意内容"  →  slogan: "新标语"
        [/slogan:\s*"[^"]*"/, 'slogan: "' + brandSlogan + '"'],
    ];

    if (apiUrl) {
        // apiBaseUrl: `任意内容`  →  apiBaseUrl: `新地址`（反引号格式）
        replacements.push([/apiBaseUrl:\s*`[^`]*`/, 'apiBaseUrl: `' + apiUrl + '`']);
        // apiBaseUrl: "任意内容"  →  apiBaseUrl: "新地址"（双引号格式兜底）
        replacements.push([/apiBaseUrl:\s*"[^"]*"/, 'apiBaseUrl: "' + apiUrl + '"']);
    }

    const ok = replaceInFile(configPath, replacements);
    if (ok) {
        configUpdated++;
        console.log('  [OK] Updated: ' + configPath);
    } else {
        console.log('  [WARN] Nothing changed in: ' + configPath);
    }
});

console.log('\nTotal config.ts files updated: ' + configUpdated + '\n');

// ========== 1.5 更新 electron 端的认证服务器地址 ==========
if (apiUrl) {
    const authConfigPath = path.join(__dirname, 'electron/mapi/auth/config.ts');
    // 从 apiBaseUrl 提取基础地址（去掉末尾的 /api）
    const baseServerUrl = apiUrl.replace(/\/api\/?$/, '');

    console.log('Processing auth config: ' + authConfigPath);
    const ok = replaceInFile(authConfigPath, [
        [/AUTH_SERVER_URL\s*=\s*process\.env\.AUTH_SERVER_URL\s*\|\|\s*'[^']*'/, "AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || '" + baseServerUrl + "'"],
        [/AUTH_SERVER_URL\s*=\s*process\.env\.AUTH_SERVER_URL\s*\|\|\s*"[^"]*"/, 'AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || "' + baseServerUrl + '"'],
    ]);
    if (ok) {
        console.log('  [OK] AUTH_SERVER_URL -> ' + baseServerUrl + '\n');
    } else {
        console.log('  [WARN] AUTH_SERVER_URL pattern not matched\n');
    }
}

// ========== 2. 复制二维码图片 ==========
const qrcodeDirs = [
    'src/assets/image',
    'ktt/src/assets/image',
    'typ/src/assets/image',
    'qeg/src/assets/image',
    'qpy/src/assets/image',
    'jrd/src/assets/image',
    'erb/src/assets/image',
    'flm/src/assets/image',
    'ixu/src/assets/image',
    'cal/src/assets/image',
    'apg/src/assets/image',
    'uti/src/assets/image',
    'ceb/src/assets/image',
    'jdq/src/assets/image',
    'mfw/src/assets/image'
];

const sourceQrcode = path.join(__dirname, oemConfig.qrcodePath);
if (fs.existsSync(sourceQrcode)) {
    let qrcodeUpdated = 0;
    qrcodeDirs.forEach(dir => {
        const targetDir = path.join(__dirname, dir);
        if (fs.existsSync(targetDir)) {
            const targetPath = path.join(targetDir, 'qrcode-wish.png');
            fs.copyFileSync(sourceQrcode, targetPath);
            qrcodeUpdated++;
            console.log('[OK] Copied qrcode to: ' + targetPath);
        }
    });
    console.log('\nTotal qrcode files copied: ' + qrcodeUpdated + '\n');
} else {
    console.error('[WARN] Qrcode file not found: ' + sourceQrcode);
}

// ========== 3. 复制 LOGO 图片 ==========
const logoDirs = [
    { src: 'public', file: 'logo.svg' },
    { src: 'electron/resources/build', file: 'logo.png' },
];
const sourceLogo = oemConfig.logoPath ? path.join(__dirname, oemConfig.logoPath) : null;
if (sourceLogo && fs.existsSync(sourceLogo)) {
    const publicDir = path.join(__dirname, 'public');
    if (fs.existsSync(publicDir)) {
        fs.copyFileSync(sourceLogo, path.join(publicDir, 'logo.png'));
        console.log('[OK] Copied logo.png to public/');
    }
    const buildDir = path.join(__dirname, 'electron/resources/build');
    if (fs.existsSync(buildDir)) {
        fs.copyFileSync(sourceLogo, path.join(buildDir, 'logo.png'));
        console.log('[OK] Copied logo.png to electron/resources/build/');
    }
    const allPublicDirs = fs.readdirSync(__dirname).filter(d => {
        const sub = path.join(__dirname, d, 'public');
        return fs.existsSync(sub) && d !== 'node_modules';
    });
    allPublicDirs.forEach(d => {
        const target = path.join(__dirname, d, 'public', 'logo.png');
        try { fs.copyFileSync(sourceLogo, target); console.log('[OK] Copied logo to ' + d + '/public/'); } catch(e) {}
    });
    console.log('');
} else {
    console.log('[INFO] No logoPath configured or file not found, skipping logo copy\n');
}

// ========== 3.5 复制图标（ICO/ICNS） ==========
const sourceIcon = oemConfig.iconPath ? path.join(__dirname, oemConfig.iconPath) : null;
if (sourceIcon && fs.existsSync(sourceIcon)) {
    const buildDir = path.join(__dirname, 'electron/resources/build');
    if (fs.existsSync(buildDir)) {
        const sharp = require('sharp');
        const iconBuf = fs.readFileSync(sourceIcon);

        (async () => {
            try {
                await sharp(iconBuf).resize(256, 256).png().toFile(path.join(buildDir, 'logo.png'));
                console.log('[OK] Generated logo.png (256x256)');

                const png256 = await sharp(iconBuf).resize(256, 256).png().toBuffer();
                const png128 = await sharp(iconBuf).resize(128, 128).png().toBuffer();
                const png64 = await sharp(iconBuf).resize(64, 64).png().toBuffer();
                const png48 = await sharp(iconBuf).resize(48, 48).png().toBuffer();
                const png32 = await sharp(iconBuf).resize(32, 32).png().toBuffer();
                const png16 = await sharp(iconBuf).resize(16, 16).png().toBuffer();

                // ICO format: header(6) + 1 entry(16) + PNG data
                const icoHeader = Buffer.alloc(6);
                icoHeader.writeUInt16LE(0, 0);
                icoHeader.writeUInt16LE(1, 2);
                icoHeader.writeUInt16LE(1, 4);

                const icoEntry = Buffer.alloc(16);
                icoEntry[0] = 0;
                icoEntry[1] = 0;
                icoEntry.writeUInt16LE(1, 2);
                icoEntry.writeUInt16LE(32, 4);
                icoEntry.writeUInt32LE(png256.length, 8);
                icoEntry.writeUInt32LE(22, 12);

                const ico = Buffer.concat([icoHeader, icoEntry, png256]);
                fs.writeFileSync(path.join(buildDir, 'logo.ico'), ico);
                console.log('[OK] Generated logo.ico');

                // ICNS: simple icon resource with PNG payloads
                const icnsIcon = Buffer.alloc(4);
                icnsIcon.write('icns', 0);
                const icnsRsrc24 = Buffer.alloc(8);
                icnsRsrc24.write('ic24', 0);
                icnsRsrc24.writeUInt32BE(png256.length + 8, 4);
                const icnsRsrc12 = Buffer.alloc(8);
                icnsRsrc12.write('ic12', 0);
                icnsRsrc12.writeUInt32BE(png128.length + 8, 4);
                const icnsRsrc08 = Buffer.alloc(8);
                icnsRsrc08.write('ic08', 0);
                icnsRsrc08.writeUInt32BE(png256.length + 8, 4);
                const totalSize = 4 + 4 + (8 + png256.length) + (8 + png128.length) + (8 + png256.length);
                const icnsSizeBuf = Buffer.alloc(4);
                icnsSizeBuf.writeUInt32BE(totalSize, 0);
                const icns = Buffer.concat([icnsIcon, icnsSizeBuf, icnsRsrc24, png256, icnsRsrc12, png128, icnsRsrc08, png256]);
                fs.writeFileSync(path.join(buildDir, 'logo.icns'), icns);
                console.log('[OK] Generated logo.icns');

                // tray icon: 16x16 PNG
                fs.writeFileSync(path.join(buildDir, 'tray.png'), png16);
                fs.writeFileSync(path.join(buildDir, 'tray.ico'), Buffer.concat([
                    (() => { const h = Buffer.alloc(6); h.writeUInt16LE(0,0); h.writeUInt16LE(1,2); h.writeUInt16LE(1,4); return h; })(),
                    (() => { const e = Buffer.alloc(16); e.writeUInt16LE(1,2); e.writeUInt16LE(32,4); e.writeUInt32BE(png16.length,8); e.writeUInt32BE(22,12); return e; })(),
                    png16
                ]));
                console.log('[OK] Generated tray.png and tray.ico');

            } catch(err) {
                console.warn('[WARN] sharp not available, copying icon.png as-is. Install sharp for auto ICO/ICNS conversion:', err.message);
                fs.copyFileSync(sourceIcon, path.join(buildDir, 'logo.png'));
            }
        })();
    }
    console.log('');
} else {
    console.log('[INFO] No iconPath configured or file not found, skipping icon generation\n');
}

// ========== 3.6 复制登录页背景图 ==========
const sourceLoginBg = oemConfig.loginBgPath ? path.join(__dirname, oemConfig.loginBgPath) : null;
if (sourceLoginBg && fs.existsSync(sourceLoginBg)) {
    const loginBgTarget = path.join(__dirname, 'public', 'login-bg.png');
    fs.copyFileSync(sourceLoginBg, loginBgTarget);
    console.log('[OK] Copied login-bg.png to public/');

    const allPublicDirs2 = fs.readdirSync(__dirname).filter(d => {
        const sub = path.join(__dirname, d, 'public');
        return fs.existsSync(sub) && d !== 'node_modules';
    });
    allPublicDirs2.forEach(d => {
        const target = path.join(__dirname, d, 'public', 'login-bg.png');
        try { fs.copyFileSync(sourceLoginBg, target); console.log('[OK] Copied login-bg to ' + d + '/public/'); } catch(e) {}
    });
    console.log('');
} else {
    console.log('[INFO] No loginBgPath configured or file not found, skipping login background\n');
}

// ========== 4. 更新 electron-builder.json5 ==========
const builderConfigPath = path.join(__dirname, 'electron-builder.json5');
if (fs.existsSync(builderConfigPath)) {
    console.log('Processing: ' + builderConfigPath);
    const ok = replaceInFile(builderConfigPath, [
        [/"appId":\s*"[^"]*"/, '"appId": "' + oemConfig.brandShortName + '"'],
        [/"productName":\s*"[^"]*"/, '"productName": "' + oemConfig.brandName + '"'],
        [/"identityName":\s*"[^"]*"/, '"identityName": "' + oemConfig.brandShortName + '"'],
        [/"publisherDisplayName":\s*"[^"]*"/, '"publisherDisplayName": "' + oemConfig.brandDisplayName + '"'],
        [/"maintainer":\s*"[^"]*"/, '"maintainer": "' + oemConfig.brandDisplayName + '"'],
    ]);
    if (ok) console.log('[OK] electron-builder.json5 updated\n');
}

console.log('========================================');
console.log('OEM Apply Done!');
console.log('NEXT STEP: run npm run build to rebuild');
console.log('========================================\n');
