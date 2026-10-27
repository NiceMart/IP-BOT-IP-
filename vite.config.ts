/* Modified for IP Bot: publication preparation, configuration or security changes. See CHANGELOG.md. */
import fs from "node:fs";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import pkg from "./package.json";
import path from "node:path";
import { AppConfig } from "./src/config";
import dayjs from "dayjs";
import { loadLocalConfig } from "./scripts/local-config.cjs";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
    const localConfig = loadLocalConfig(__dirname);
    const publicConfig = { APP_NAME: localConfig.APP_NAME || "IP Bot", AUTH_SERVER_URL: localConfig.AUTH_SERVER_URL || "http://127.0.0.1:3002" };
    const isServe = command === "serve";
    const isBuild = command === "build";

    // In dev, Electron keeps loading preload/main bundles from dist-electron.
    // Deleting that directory during config evaluation can leave renderer reloads
    // without a preload script, which makes window.$mapi disappear.
    if (isBuild) {
        fs.rmSync("dist-electron", { recursive: true, force: true });
    }

    const sourcemap = isServe || !!process.env.VSCODE_DEBUG;
    const minify = !isServe; // 生产环境启用压缩，开发环境禁用便于调试

    // 🔧 只将 Node.js 原生模块和 Electron 相关模块标记为 external
    // 前端框架(vue, vue-router, pinia等)和 HTTP 客户端(axios)必须被打包到渲染进程中
    const externalPackages = [
        "electron",
        "@electron/remote",
        "@electron-toolkit/preload",
        "@electron-toolkit/utils",
        "better-sqlite3",
        "sharp",
        "playwright",
        "puppeteer",
        "@devicefarmer/adbkit",
        "systeminformation",
        "ali-oss",
        "bcryptjs",
        "jsonwebtoken",
        "uuid",
        "chardet",
        "iconv-lite",
        "yauzl",
        "fix-path",
        "electron-context-menu",
        "bufferutil",
        "utf-8-validate",
        "node-mac-permissions",
    ];

    return {
        define: { __IPBOT_PUBLIC_CONFIG__: JSON.stringify(publicConfig) },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        plugins: [
            vue({
                template: {
                    compilerOptions: {
                        isCustomElement: tag => {
                            if (["webview"].includes(tag)) {
                                return true;
                            }
                            return false;
                        },
                    },
                },
            }),
            {
                name: "add-build-time",
                generateBundle() {
                    const buildId = dayjs().format("YYYYMMDDHHmmss");
                    this.emitFile({
                        type: "asset",
                        fileName: "build.json",
                        source: JSON.stringify(
                            {
                                buildId,
                            },
                            null,
                            2
                        ),
                    });
                },
            },
            {
                name: "process-variables",
                closeBundle() {
                    const files = [
                        "splash.html",
                        "index.html",
                        "page/about.html",
                        "page/feedback.html",
                        "page/guide.html",
                        "page/monitor.html",
                        "page/payment.html",
                        "page/setup.html",
                        "page/user.html",
                        "page/log.html",
                    ];
                    files.forEach(f => {
                        const p = path.resolve(__dirname, "dist", f);
                        if (!fs.existsSync(p)) {
                            return;
                        }
                        let html = fs.readFileSync(p, "utf-8");
                        for (const key in AppConfig) {
                            html = html.replace(new RegExp(`%${key}%`, "g"), AppConfig[key]);
                        }
                        fs.writeFileSync(p, html, "utf-8");
                    });
                },
            },
            electron([
                {
                    // Shortcut of `build.lib.entry`
                    entry: "electron/main/index.ts",
                    onstart({ startup }) {
                        if (process.env.VSCODE_DEBUG) {
                            console.log(/* For `.vscode/.debug.script.mjs` */ "[startup] Electron App");
                        } else if (process.env.EXTERNAL_ELECTRON_DEV === "1") {
                            console.log("[startup] external Electron launcher enabled, skip vite-plugin-electron auto startup");
                        } else {
                            startup();
                        }
                    },
                    vite: {
                        define: { __IPBOT_AUTH_SERVER_URL__: JSON.stringify(publicConfig.AUTH_SERVER_URL) },
                        build: {
                            sourcemap,
                            minify: minify,
                            outDir: "dist-electron/main",
                            rollupOptions: {
                                // Some third-party Node.js libraries may not be built correctly by Vite, especially `C/C++` addons,
                                // we can use `external` to exclude them to ensure they work correctly.
                                // Others need to put them in `dependencies` to ensure they are collected into `app.asar` after the app is built.
                                // Of course, this is not absolute, just this way is relatively simple. :)
                                external: externalPackages,
                                output: {
                                    // 使用 CommonJS 格式，避免 asar 包中的 ES 模块解析问题
                                    format: 'cjs',
                                    inlineDynamicImports: true,
                                },
                            },
                        },
                    },
                },
                {
                    // Shortcut of `build.rollupOptions.input`.
                    // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                    entry: "electron/preload/index.ts",
                    onstart({ reload }) {
                        // Notify the Renderer process to reload the page when the Preload scripts build is complete,
                        // instead of restarting the entire Electron App.
                        reload();
                    },
                    vite: {
                        build: {
                            target: "es2015",
                            sourcemap: undefined, // #332
                            minify: minify,
                            outDir: "dist-electron/preload",
                            lib: {
                                formats: ["cjs"],
                                fileName: "index",
                            },
                            rollupOptions: {
                                external: externalPackages,
                                output: {
                                    format: "cjs",
                                    // entryFileNames: '[name].cjs',  // 由 lib.fileName 控制
                                    strict: true,
                                },
                            },
                        },
                    },
                },
            ]),
            renderer(),
        ],
        build: {
            sourcemap: sourcemap,
            // 🔧 启用 CSS 代码分割
            cssCodeSplit: true,
            // 🔧 启用打包压缩 (使用 esbuild，内置无需安装)
            minify: minify ? 'esbuild' : false,
            // 🔧 分包策略 - 优化加载性能
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, "index.html"),
                    about: path.resolve(__dirname, "page/about.html"),
                    feedback: path.resolve(__dirname, "page/feedback.html"),
                    user: path.resolve(__dirname, "page/user.html"),
                    guide: path.resolve(__dirname, "page/guide.html"),
                    setup: path.resolve(__dirname, "page/setup.html"),
                    payment: path.resolve(__dirname, "page/payment.html"),
                    monitor: path.resolve(__dirname, "page/monitor.html"),
                    log: path.resolve(__dirname, "page/log.html"),
                },
                output: {
                    // 🔧 分包命名策略
                    manualChunks: (id) => {
                        // Vue 核心库 - 单独打包，长期缓存
                        if (id.includes('node_modules/vue')) {
                            return 'vue-vendor';
                        }
                        // Arco Design UI 库 - 单独打包
                        if (id.includes('node_modules/@arco-design')) {
                            return 'arco-vendor';
                        }
                        // 大型第三方库 - 单独打包
                        if (id.includes('node_modules/pinia') ||
                            id.includes('node_modules/axios') ||
                            id.includes('node_modules/lodash') ||
                            id.includes('node_modules/dayjs')) {
                            return 'common-vendor';
                        }
                        // Electron 相关
                        if (id.includes('node_modules/electron')) {
                            return 'electron-vendor';
                        }
                        // 其他 node_modules
                        if (id.includes('node_modules')) {
                            return 'misc-vendor';
                        }
                    },
                    // 🔧 静态资源命名
                    assetFileNames: (assetInfo) => {
                        const info = assetInfo.name || '';
                        if (/\.(woff2?|eot|ttf|otf)$/i.test(info)) {
                            return 'fonts/[name][extname]';
                        }
                        if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(info)) {
                            return 'images/[name][extname]';
                        }
                        if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i.test(info)) {
                            return 'media/[name][extname]';
                        }
                        return 'assets/[name][extname]';
                    },
                },
                // 🔧 渲染进程只排除 Node.js 原生模块,前端框架需要被打包
                external: externalPackages,
            },
            // 🔧 启用分块预加载提示
            chunkSizeWarningLimit: 500,
        },
        server: {
            // 忽略不需要监听的目录，大幅减少文件句柄数量
            // 修复 Vite 进程有 50,755 个文件句柄导致卡死的问题
            watch: {
                ignored: [
                    '**/node_modules/**',
                    '**/dist-release/**',
                    '**/dist/**',
                    '**/dist-electron/**',
                    '**/electron/resources/extra/**',
                    '**/Tapnow-Studio---main/**',
                    '**/activation-server/**',
                    '**/data/**',
                    '**/.git/**',
                ],
            },
            ...((process.env.VITE_DEV_SERVER_URL || pkg.debug?.env?.VITE_DEV_SERVER_URL)
                ? (() => {
                    const url = new URL(process.env.VITE_DEV_SERVER_URL || pkg.debug.env.VITE_DEV_SERVER_URL);
                    return {
                        host: url.hostname,
                        port: +url.port,
                        strictPort: true,
                    };
                })()
                : {}),
        },
    };
});
