const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const rootDir = path.join(__dirname, '..')
const brandingDir = __dirname

const logoSrc = path.join(brandingDir, 'logo.png')
const loginBgSrc = path.join(brandingDir, 'login-bg.png')
const qrcodeWishSrc = path.join(brandingDir, 'qrcode-wish.png')

const hasLogo = fs.existsSync(logoSrc)
const hasLoginBg = fs.existsSync(loginBgSrc)
const hasQrcode = fs.existsSync(qrcodeWishSrc)

if (!hasLogo && !hasLoginBg && !hasQrcode) {
    console.log('\n🎨 贴牌图片：未找到任何图片，跳过\n')
    return
}

;(async () => {
    console.log('\n🎨 应用贴牌图片...\n')

    let applied = 0
    let skipped = 0

    function ensureDir(filePath) {
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
    }

    function copyFile(src, dest) {
        if (!fs.existsSync(src)) {
            console.log(`  ⏭️  跳过 ${path.basename(src)}（源文件不存在）`)
            skipped++
            return false
        }
        ensureDir(dest)
        fs.copyFileSync(src, dest)
        console.log(`  ✅ ${path.basename(src)} → ${dest}`)
        applied++
        return true
    }

    async function resizePng(src, dest, size) {
        if (!fs.existsSync(src)) {
            console.log(`  ⏭️  跳过生成 ${path.basename(dest)}（源文件不存在）`)
            skipped++
            return false
        }
        ensureDir(dest)
        try {
            execSync(`magick "${src}" -resize ${size}x${size} "${dest}"`, { stdio: 'pipe' })
            console.log(`  ✅ logo.png → ${path.basename(dest)} (${size}x${size})`)
            applied++
            return true
        } catch {
            try {
                const sharp = require('sharp')
                const buf = fs.readFileSync(src)
                const data = await sharp(buf).resize(size, size).png().toBuffer()
                fs.writeFileSync(dest, data)
                console.log(`  ✅ logo.png → ${path.basename(dest)} (${size}x${size}, sharp)`)
                applied++
                return true
            } catch {
                try {
                    fs.copyFileSync(src, dest)
                    console.log(`  ⚠️ ImageMagick/sharp不可用，直接复制 logo.png → ${path.basename(dest)}`)
                    applied++
                    return true
                } catch (e) {
                    console.log(`  ❌ 生成 ${path.basename(dest)} 失败: ${e.message}`)
                    skipped++
                    return false
                }
            }
        }
    }

    async function pngToIco(src, dest) {
        if (!fs.existsSync(src)) {
            console.log(`  ⏭️  跳过生成 ${path.basename(dest)}（源文件不存在）`)
            skipped++
            return false
        }
        ensureDir(dest)
        try {
            execSync(`magick "${src}" -resize 256x256 -define icon:auto-resize=256,128,64,48,32,16 "${dest}"`, { stdio: 'pipe' })
            console.log(`  ✅ logo.png → ${path.basename(dest)} (.ico)`)
            applied++
            return true
        } catch {
            try {
                const sharp = require('sharp')
                const buf = fs.readFileSync(src)
                const sizes = [16, 32, 48, 64, 128, 256]
                const pngBuffers = await Promise.all(sizes.map(size =>
                    sharp(buf).resize(size, size).png().toBuffer()
                ))
                const headerSize = 6
                const entrySize = 16
                const numImages = pngBuffers.length
                const dataOffset = headerSize + entrySize * numImages
                const header = Buffer.alloc(headerSize)
                header.writeUInt16LE(0, 0)
                header.writeUInt16LE(1, 2)
                header.writeUInt16LE(numImages, 4)
                const entries = []
                let offset = dataOffset
                for (let i = 0; i < numImages; i++) {
                    const entry = Buffer.alloc(entrySize)
                    const size = sizes[i]
                    entry.writeUInt8(size >= 256 ? 0 : size, 0)
                    entry.writeUInt8(size >= 256 ? 0 : size, 1)
                    entry.writeUInt8(0, 2)
                    entry.writeUInt8(0, 3)
                    entry.writeUInt16LE(1, 4)
                    entry.writeUInt16LE(32, 6)
                    entry.writeUInt32LE(pngBuffers[i].length, 8)
                    entry.writeUInt32LE(offset, 12)
                    entries.push(entry)
                    offset += pngBuffers[i].length
                }
                const ico = Buffer.concat([header, ...entries, ...pngBuffers])
                fs.writeFileSync(dest, ico)
                console.log(`  ✅ logo.png → ${path.basename(dest)} (.ico, sharp)`)
                applied++
                return true
            } catch (e) {
                console.log(`  ❌ 生成 ${path.basename(dest)} 失败: ${e.message}`)
                skipped++
                return false
            }
        }
    }

    if (hasLogo) {
        console.log('  📋 从 logo.png 自动生成所有Logo相关文件：\n')

        copyFile(logoSrc, path.join(rootDir, 'public/logo.png'))
        const svgSrc = path.join(brandingDir, 'ip-bot-logo.svg')
        if (fs.existsSync(svgSrc)) {
            copyFile(svgSrc, path.join(rootDir, 'public/logo.svg'))
            copyFile(svgSrc, path.join(rootDir, 'src/assets/image/logo.svg'))
            copyFile(svgSrc, path.join(rootDir, 'user-server/public/logo.svg'))
        }
        const sharp = require('sharp')
        const iconSizes = [['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024]]
        const chunks = await Promise.all(iconSizes.map(async ([type,size]) => {
            const png = await sharp(logoSrc).resize(size,size).png().toBuffer()
            const header = Buffer.alloc(8); header.write(type,0,4,'ascii'); header.writeUInt32BE(png.length+8,4)
            return Buffer.concat([header,png])
        }))
        const header = Buffer.alloc(8); header.write('icns',0,4,'ascii'); header.writeUInt32BE(8+chunks.reduce((n,c)=>n+c.length,0),4)
        fs.writeFileSync(path.join(rootDir,'electron/resources/build/logo.icns'),Buffer.concat([header,...chunks]))
        await sharp(logoSrc).greyscale().png().toFile(path.join(rootDir,'electron/resources/build/logo-gray.png'))
        const templateSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path d=\"M256 142V182\" stroke=\"black\" stroke-width=\"20\" stroke-linecap=\"round\"/><circle cx=\"256\" cy=\"125\" r=\"17\" fill=\"black\"/><path fill=\"black\" fill-rule=\"evenodd\" d=\"M188 178H324C360 178 388 206 388 242V292C388 328 360 356 324 356H224L166 396V349C140 340 124 317 124 290V242C124 206 152 178 188 178ZM199 246a13 13 0 0 0 0 26h12a13 13 0 0 0 0-26ZM301 246a13 13 0 0 0 0 26h12a13 13 0 0 0 0-26Z\"/></svg>"
        for (const [name,size] of [['iconTemplate.png',22],['iconTemplate@2x.png',44]]) {
            const dest = path.join(rootDir,'electron/resources/extra/osx/tray',name); ensureDir(dest)
            await sharp(Buffer.from(templateSvg)).resize(size,size).png().toFile(dest)
        }


        await resizePng(logoSrc, path.join(rootDir, 'electron/resources/build/logo.png'), 1024)
        await resizePng(logoSrc, path.join(rootDir, 'electron/resources/build/logo_1024x1024.png'), 1024)
        await resizePng(logoSrc, path.join(rootDir, 'electron/resources/build/tray.png'), 32)
        await resizePng(logoSrc, path.join(rootDir, 'electron/resources/extra/common/tray/icon.png'), 32)

        await pngToIco(logoSrc, path.join(rootDir, 'electron/resources/build/logo.ico'))
        await pngToIco(logoSrc, path.join(rootDir, 'electron/resources/build/tray.ico'))
        await pngToIco(logoSrc, path.join(rootDir, 'electron/resources/extra/common/tray/icon.ico'))

        console.log('')
    } else {
        console.log('  ⚠️ 未找到 logo.png，跳过Logo相关文件生成\n')
    }

    if (hasLoginBg) {
        copyFile(loginBgSrc, path.join(rootDir, 'public/login-bg.png'))
        copyFile(loginBgSrc, path.join(rootDir, 'user-server/public/login-bg.png'))
    } else {
        console.log('  ⏭️  跳过 login-bg.png（未提供）')
        skipped++
    }

    if (hasQrcode) {
        copyFile(qrcodeWishSrc, path.join(rootDir, 'src/assets/image/qrcode-wish.png'))
    } else {
        console.log('  ⏭️  跳过 qrcode-wish.png（未提供）')
        skipped++
    }

    if (hasLogo) {
        copyFile(logoSrc, path.join(rootDir, 'user-server/public/logo.png'))
    }

    console.log(`\n📊 完成：应用 ${applied} 个，跳过 ${skipped} 个`)
    if (!hasLogo) {
        console.log('💡 提示：提供 logo.png 后可自动生成 ico/托盘图标/多尺寸Logo')
    }
    console.log('💡 接下来运行 npm run build:win 即可封包\n')
})()
