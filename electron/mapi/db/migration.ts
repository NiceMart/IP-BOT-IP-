import StorageMain from "../storage/main";
import Files from "../file/main";

const versions = [
    {
        version: 0,
        up: async (db: DB) => {
            // await db.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)`);
            // console.log('db.insert', await db.insert(`INSERT INTO users (name, email) VALUES (?, ?)`,['Alice', 'alice@example.com']));
            // console.log('db.select', await db.select(`SELECT * FROM users`));
            // console.log('db.first', await db.first(`SELECT * FROM users`));
        },
    },
    {
        version: 1,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS data_sound_tts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    serverName TEXT,
                    serverTitle TEXT,
                    serverVersion TEXT,
                    text TEXT,
                    param TEXT,

                    status TEXT,
                    statusMsg TEXT,
                    jobResult TEXT,
                    startTime INTEGER,
                    endTime INTEGER,
                    resultWav TEXT
            )`);
            await db.execute(`CREATE TABLE IF NOT EXISTS data_sound_clone (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    serverName TEXT,
                    serverTitle TEXT,
                    serverVersion TEXT,
                    promptName TEXT,
                    promptWav TEXT,
                    promptText TEXT,
                    text TEXT,
                    param TEXT,

                    status TEXT,
                    statusMsg TEXT,
                    jobResult TEXT,
                    startTime INTEGER,
                    endTime INTEGER,
                    resultWav TEXT
            )`);
            await db.execute(`CREATE TABLE IF NOT EXISTS data_video_template (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    name TEXT,
                    video TEXT
            )`);
            await db.execute(`CREATE TABLE IF NOT EXISTS data_video_gen (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    serverName TEXT,
                    serverTitle TEXT,
                    serverVersion TEXT,
                    videoTemplateId INTEGER,
                    videoTemplateName TEXT,
                    soundType TEXT,
                    soundTtsId INTEGER,
                    soundTtsText TEXT,
                    soundCloneId INTEGER,
                    soundCloneText TEXT,

                    param TEXT,

                    status TEXT,
                    statusMsg TEXT,
                    jobResult TEXT,
                    startTime INTEGER,
                    endTime INTEGER,
                    resultMp4 TEXT
            )`);
        },
    },
    {
        version: 2,
        up: async (db: DB) => {
            await db.execute(`ALTER TABLE data_sound_tts ADD COLUMN result TEXT`);
            await db.execute(`ALTER TABLE data_sound_clone ADD COLUMN result TEXT`);
            await db.execute(`ALTER TABLE data_video_gen ADD COLUMN result TEXT`);
        },
    },
    {
        version: 3,
        up: async (db: DB) => {
            await db.execute(`ALTER TABLE data_video_gen ADD COLUMN soundCustomFile TEXT`);
        },
    },
    {
        version: 4,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS data_task (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,

                   createdAt INTEGER DEFAULT (strftime('%s', 'now')),
                   updatedAt INTEGER DEFAULT (strftime('%s', 'now')),

                   biz TEXT,

                   status TEXT,
                   statusMsg TEXT,
                   startTime INTEGER,
                   endTime INTEGER,

                   serverName TEXT,
                   serverTitle TEXT,
                   serverVersion TEXT,

                   param TEXT,
                   jobResult TEXT,
                   modelConfig TEXT,
                   result TEXT

            )`);
        },
    },
    {
        version: 5,
        up: async (db: DB) => {
            // await db.execute(`DELETE FROM data_task where 1=1`);
            // SoundClone
            let records = await db.select(`SELECT * FROM data_sound_clone`);
            for (const r of records) {
                const values = [
                    "SoundClone",
                    r.status,
                    r.statusMsg,
                    r.startTime,
                    r.endTime,
                    r.serverName,
                    r.serverTitle,
                    r.serverVersion,
                    r.param,
                    r.jobResult,
                    JSON.stringify({
                        promptName: r.promptName,
                        promptWav: r.promptWav,
                        promptText: r.promptText,
                        text: r.text,
                    }),
                    JSON.stringify({
                        url: r.resultWav,
                    }),
                ];
                await db.insert(
                    `INSERT INTO data_task
                    (biz, status, statusMsg, startTime, endTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig,  result)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    values
                );
            }
            // SoundTts
            records = await db.select(`SELECT * FROM data_sound_tts`);
            for (const r of records) {
                const values = [
                    "SoundTts",
                    r.status,
                    r.statusMsg,
                    r.startTime,
                    r.endTime,
                    r.serverName,
                    r.serverTitle,
                    r.serverVersion,
                    r.param,
                    r.jobResult,
                    JSON.stringify({
                        text: r.text,
                    }),
                    JSON.stringify({
                        url: r.resultWav,
                    }),
                ];
                await db.insert(
                    `INSERT INTO data_task
                                 (biz, status, statusMsg, startTime, endTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig,  result)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    values
                );
            }
            // VideoGen
            records = await db.select(`SELECT * FROM data_video_gen`);
            for (const r of records) {
                const values = [
                    "VideoGen",
                    r.status,
                    r.statusMsg,
                    r.startTime,
                    r.endTime,
                    r.serverName,
                    r.serverTitle,
                    r.serverVersion,
                    r.param,
                    r.jobResult,
                    JSON.stringify({
                        videoTemplateId: r.videoTemplateId,
                        videoTemplateName: r.videoTemplateName,
                        soundType: r.soundType,
                        soundTtsId: r.soundTtsId,
                        soundTtsText: r.soundTtsText,
                        soundCloneId: r.soundCloneId,
                        soundCloneText: r.soundCloneText,
                        soundCustomFile: r.soundCustomFile,
                    }),
                    JSON.stringify({
                        url: r.resultMp4,
                    }),
                ];
                await db.insert(
                    `INSERT INTO data_task
                                 (biz, status, statusMsg, startTime, endTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig,  result)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    values
                );
            }
        },
    },
    {
        version: 6,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS data_storage (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,

                   createdAt INTEGER DEFAULT (strftime('%s', 'now')),
                   updatedAt INTEGER DEFAULT (strftime('%s', 'now')),

                   biz TEXT,

                   title TEXT,
                   sort INTEGER,
                   content TEXT

            )`);
        },
    },
    {
        version: 7,
        up: async (db: DB) => {
            const records = await StorageMain.get("soundClonePrompt", "records", []);
            for (const r of records) {
                const values = [
                    "SoundPrompt",
                    r.name,
                    JSON.stringify({
                        url: r.promptWav,
                        promptText: r.promptText,
                    }),
                ];
                await db.insert(
                    `INSERT INTO data_storage (biz, title, content)
                                 VALUES (?, ?, ?)`,
                    values
                );
            }
        },
    },
    {
        version: 8,
        up: async (db: DB) => {
            await db.execute(`ALTER TABLE data_task ADD COLUMN title TEXT`);
            const records = await db.select(`SELECT * FROM data_task`);
            for (const r of records) {
                let modelConfig: any = {};
                try {
                    modelConfig = JSON.parse(r.modelConfig);
                } catch (e) {
                    modelConfig = {};
                }
                let title = "";
                if (r.biz === "SoundTts" || r.biz === "SoundClone") {
                    title = Files.textToName(modelConfig.text);
                } else if (r.biz === "VideoGen") {
                    title = Files.textToName([modelConfig.videoTemplateName, modelConfig.soundTtsText].join("_"));
                } else if (r.biz === "VideoGenFlow") {
                    title = Files.textToName([modelConfig.videoTemplateName, modelConfig.text].join("_"));
                }
                await db.execute(`UPDATE data_task SET title = ? WHERE id = ?`, [title, r.id]);
            }
        },
    },
    {
        version: 9,
        up: async (db: DB) => {
            const records = await db.select(`SELECT * FROM data_task where biz in ('SoundTts', 'SoundClone')`);
            for (const r of records) {
                const modelConfigOld = JSON.parse(r.modelConfig);
                const paramOld = JSON.parse(r.param);
                const modelConfig: any = {
                    type: r.biz,
                    ttsParam: r.biz === "SoundTts" ? paramOld : undefined,
                    cloneParam: r.biz === "SoundClone" ? paramOld : undefined,
                    ...modelConfigOld,
                };
                const values = [
                    "SoundGenerate",
                    r.title,
                    r.status,
                    r.statusMsg,
                    r.startTime,
                    r.endTime,
                    r.serverName,
                    r.serverTitle,
                    r.serverVersion,
                    JSON.stringify({}),
                    r.jobResult,
                    JSON.stringify(modelConfig),
                    r.result,
                ];
                await db.insert(
                    `INSERT INTO data_task
                                 (biz, title, status, statusMsg, startTime, endTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig,  result)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    values
                );
                await db.execute(`DELETE FROM data_task WHERE id = ?`, [r.id]);
            }
        },
    },
    {
        version: 10,
        up: async (db: DB) => {
            await db.execute(`ALTER TABLE data_task
                ADD COLUMN type INTEGER DEFAULT 1`);
        },
    },
    {
        version: 11,
        up: async (db: DB) => {
            await db.execute(`ALTER TABLE data_video_template
                ADD COLUMN info TEXT`);
        },
    },
    {
        version: 12,
        up: async (db: DB) => {
            // 平台账号表
            await db.execute(`CREATE TABLE IF NOT EXISTS platform_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                nickname TEXT,
                uid TEXT,
                avatar TEXT,
                cookies TEXT,
                tokens TEXT,
                loginStatus TEXT DEFAULT 'pending',
                expiresAt INTEGER,
                createdAt INTEGER,
                updatedAt INTEGER
            )`);

            // 发布任务表
            await db.execute(`CREATE TABLE IF NOT EXISTS publish_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                videoPath TEXT,
                coverPath TEXT,
                platforms TEXT,
                publishConfig TEXT,
                scheduledTime INTEGER,
                status TEXT DEFAULT 'pending',
                createdAt INTEGER,
                updatedAt INTEGER
            )`);

            // 发布历史表
            await db.execute(`CREATE TABLE IF NOT EXISTS publish_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                taskId INTEGER,
                platform TEXT,
                accountId INTEGER,
                videoUrl TEXT,
                videoId TEXT,
                status TEXT,
                errorMessage TEXT,
                publishedAt INTEGER,
                viewCount INTEGER DEFAULT 0,
                likeCount INTEGER DEFAULT 0
            )`);

            // 创建索引
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts(platform)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_publish_tasks_status ON publish_tasks(status)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_publish_history_taskId ON publish_history(taskId)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_publish_history_platform ON publish_history(platform)`);
        },
    },
    {
        version: 13,
        up: async (db: DB) => {
            // 封面模板表
            await db.execute(`CREATE TABLE IF NOT EXISTS cover_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                thumbnail_path TEXT,
                config TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )`);

            // 创建索引以提升查询性能
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_cover_templates_created_at ON cover_templates(created_at DESC)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_cover_templates_name ON cover_templates(name)`);
        },
    },
    {
        version: 14,
        up: async (db: DB) => {
            // 关键词分组表 - 用于字幕特效管理
            await db.execute(`CREATE TABLE IF NOT EXISTS keyword_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                keywords TEXT NOT NULL,
                color TEXT,
                effectId TEXT,
                styleOverride TEXT,
                effectConfig TEXT,
                styleConfig TEXT,
                createdAt INTEGER,
                updatedAt INTEGER
            )`);

            // 创建索引以提升查询性能
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_keyword_groups_name ON keyword_groups(name)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_keyword_groups_createdAt ON keyword_groups(createdAt DESC)`);
        },
    },
    {
        version: 15,
        up: async (db: DB) => {
            // 字幕样式表 - 用于保存字幕样式配置
            await db.execute(`CREATE TABLE IF NOT EXISTS subtitle_styles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                preview TEXT,
                fontName TEXT NOT NULL,
                fontSize INTEGER,
                fontColor TEXT,
                outlineColor TEXT,
                outlineWidth INTEGER,
                shadowOffset INTEGER,
                backgroundColor TEXT,
                backgroundOpacity REAL,
                position TEXT,
                alignment TEXT,
                createdAt INTEGER,
                updatedAt INTEGER
            )`);

            // 创建索引以提升查询性能
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_subtitle_styles_name ON subtitle_styles(name)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_subtitle_styles_createdAt ON subtitle_styles(createdAt DESC)`);
        },
    },
    {
        version: 16,
        up: async (db: DB) => {
            // 为 cover_templates 表添加 is_system 字段，标识系统默认模板
            await db.execute(`
                ALTER TABLE cover_templates
                ADD COLUMN is_system INTEGER DEFAULT 0
            `);

            // 为 subtitle_styles 表添加 is_system 字段，标识系统默认样式
            await db.execute(`
                ALTER TABLE subtitle_styles
                ADD COLUMN is_system INTEGER DEFAULT 0
            `);

            console.log('[Migration v16] 已添加 is_system 字段到 cover_templates 和 subtitle_styles 表');
        },
    },
    {
        version: 17,
        up: async (db: DB) => {
            // 为 subtitle_styles 表添加 shadowColor 和 shadowBlur 字段
            try {
                await db.execute(`
                    ALTER TABLE subtitle_styles
                    ADD COLUMN shadowColor TEXT DEFAULT '#000000'
                `);
                console.log('[Migration v17] 已添加 shadowColor 字段到 subtitle_styles 表');
            } catch (error: any) {
                if (!error.message?.includes('duplicate column')) {
                    throw error;
                }
            }

            try {
                await db.execute(`
                    ALTER TABLE subtitle_styles
                    ADD COLUMN shadowBlur INTEGER DEFAULT 4
                `);
                console.log('[Migration v17] 已添加 shadowBlur 字段到 subtitle_styles 表');
            } catch (error: any) {
                if (!error.message?.includes('duplicate column')) {
                    throw error;
                }
            }
        },
    },
    {
        version: 18,
        up: async (db: DB) => {
            console.log('[Migration v18] 开始处理封面模板系统迁移');

            try {
                // 第一步：删除旧的系统模板（system-cover-01/02/03/04）
                const oldSystemTemplates = [
                    'system-cover-01',
                    'system-cover-02',
                    'system-cover-03',
                    'system-cover-04'
                ];

                for (const templateId of oldSystemTemplates) {
                    try {
                        await db.execute(
                            `DELETE FROM cover_templates WHERE id = ?`,
                            [templateId]
                        );
                        console.log(`[Migration v18] ✅ 已删除旧系统模板: ${templateId}`);
                    } catch (error) {
                        // 如果模板不存在，忽略错误（新用户的情况）
                        console.log(`[Migration v18] ℹ️ 旧系统模板不存在（预期行为）: ${templateId}`);
                    }
                }

                // 第二步：将4个自定义模板标记为新的系统模板（仅对现有模板操作）
                const newSystemTemplates = [
                    '485183be-6eed-4eae-b74a-8591f08b69fa',  // 黄白实描
                    '8f17c467-c69c-45b2-8011-94a6c3071d16',  // 斜黄白
                    '6404718a-1b1c-4148-9807-ad3c57a53e0c',  // 蓝底白字
                    '705fa010-5bf3-4041-b624-0fd364bea5ad'   // 大四字报
                ];

                for (const templateId of newSystemTemplates) {
                    try {
                        const result = await db.execute(
                            `UPDATE cover_templates SET is_system = 1 WHERE id = ?`,
                            [templateId]
                        );
                        console.log(`[Migration v18] ✅ 已标记为系统模板: ${templateId}`);
                    } catch (error) {
                        // 如果模板不存在，忽略（新用户的情况）
                        console.log(`[Migration v18] ℹ️ 模板不存在，跳过标记: ${templateId}`);
                    }
                }

                console.log('[Migration v18] ✅ 封面模板系统迁移完成（仅对现有模板生效）');
                console.log('[Migration v18] 💡 提示：新用户请运行 \"ipAgent:exportCoverTemplatesToConfig\" 来导出这4个模板到配置文件');
            } catch (error: any) {
                console.error('[Migration v18] ❌ 迁移失败:', error);
                throw error;
            }
        },
    },
    {
        version: 19,
        up: async (db: DB) => {
            console.log('[Migration v19] 开始音效系统初始化');

            try {
                // 第一步：创建音效库表
                await db.execute(`CREATE TABLE IF NOT EXISTS sound_effects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    category TEXT,
                    type TEXT,
                    audio_source TEXT,
                    volume REAL DEFAULT 0.7,
                    duration REAL,
                    metadata TEXT,
                    created_at INTEGER,
                    updated_at INTEGER,
                    is_system INTEGER DEFAULT 0
                )`);
                console.log('[Migration v19] ✅ 创建 sound_effects 表');

                // 第二步：创建用户自定义音效表
                await db.execute(`CREATE TABLE IF NOT EXISTS user_sound_effects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    file_path TEXT NOT NULL,
                    duration REAL,
                    file_size INTEGER,
                    created_at INTEGER,
                    updated_at INTEGER
                )`);
                console.log('[Migration v19] ✅ 创建 user_sound_effects 表');

                // 第三步：检查并添加 keyword_groups 新字段
                try {
                    await db.execute(`ALTER TABLE keyword_groups ADD COLUMN sound_effect_id TEXT`);
                    console.log('[Migration v19] ✅ 为 keyword_groups 添加 sound_effect_id 列');
                } catch (error: any) {
                    if (error.message?.includes('duplicate')) {
                        console.log('[Migration v19] ℹ️ sound_effect_id 列已存在，跳过');
                    } else {
                        throw error;
                    }
                }

                try {
                    await db.execute(`ALTER TABLE keyword_groups ADD COLUMN sound_effect_config TEXT`);
                    console.log('[Migration v19] ✅ 为 keyword_groups 添加 sound_effect_config 列');
                } catch (error: any) {
                    if (error.message?.includes('duplicate')) {
                        console.log('[Migration v19] ℹ️ sound_effect_config 列已存在，跳过');
                    } else {
                        throw error;
                    }
                }

                console.log('[Migration v19] ✅ 音效系统初始化完成');
            } catch (error: any) {
                console.error('[Migration v19] ❌ 迁移失败:', error);
                throw error;
            }
        },
    },
    {
        version: 20,
        up: async (db: DB) => {
            console.log('[Migration v20] 开始贴纸系统初始化');

            try {
                // 添加 stickerId 列
                try {
                    await db.execute(`ALTER TABLE keyword_groups ADD COLUMN stickerId TEXT`);
                    console.log('[Migration v20] ✅ 为 keyword_groups 添加 stickerId 列');
                } catch (error: any) {
                    if (error.message?.includes('duplicate')) {
                        console.log('[Migration v20] ℹ️ stickerId 列已存在，跳过');
                    } else {
                        throw error;
                    }
                }

                // 添加 stickerConfig 列
                try {
                    await db.execute(`ALTER TABLE keyword_groups ADD COLUMN stickerConfig TEXT`);
                    console.log('[Migration v20] ✅ 为 keyword_groups 添加 stickerConfig 列');
                } catch (error: any) {
                    if (error.message?.includes('duplicate')) {
                        console.log('[Migration v20] ℹ️ stickerConfig 列已存在，跳过');
                    } else {
                        throw error;
                    }
                }

                // 添加 effectDuration 列
                try {
                    await db.execute(`ALTER TABLE keyword_groups ADD COLUMN effectDuration REAL`);
                    console.log('[Migration v20] ✅ 为 keyword_groups 添加 effectDuration 列');
                } catch (error: any) {
                    if (error.message?.includes('duplicate')) {
                        console.log('[Migration v20] ℹ️ effectDuration 列已存在，跳过');
                    } else {
                        throw error;
                    }
                }

                console.log('[Migration v20] ✅ 贴纸系统初始化完成');
            } catch (error: any) {
                console.error('[Migration v20] ❌ 迁移失败:', error);
                throw error;
            }
        },
    },
    {
        version: 21,
        up: async (db: DB) => {
            console.log('[Migration v21] 开始更新平台账号昵称');

            try {
                // 更新所有平台账号的昵称为"用户"
                await db.execute(`
                    UPDATE platform_accounts
                    SET nickname = '用户'
                    WHERE nickname IN ('抖音用户', '快手用户', '视频号用户', '小红书用户')
                `);

                console.log('[Migration v21] ✅ 已更新所有平台账号昵称为"用户"');
            } catch (error: any) {
                console.error('[Migration v21] ❌ 迁移失败:', error);
                throw error;
            }
        },
    },
    {
        version: 22,
        up: async (db: DB) => {
            console.log('[Migration v22] 开始创建用户认证系统表');

            try {
                // 创建 users 表 - 用户基本信息
                await db.execute(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    avatar TEXT,
                    role TEXT DEFAULT 'user',
                    status TEXT DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login_at DATETIME
                )`);
                console.log('[Migration v22] ✅ 创建 users 表');

                // 创建 user_subscriptions 表 - 用户订阅时长管理
                await db.execute(`CREATE TABLE IF NOT EXISTS user_subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER UNIQUE NOT NULL,
                    subscription_type TEXT DEFAULT 'trial',
                    expires_at DATETIME NOT NULL,
                    trial_started_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`);
                console.log('[Migration v22] ✅ 创建 user_subscriptions 表');

                // 创建 user_time_logs 表 - 时长变更日志
                await db.execute(`CREATE TABLE IF NOT EXISTS user_time_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    operator_id INTEGER,
                    action TEXT NOT NULL,
                    days_added INTEGER,
                    previous_expires_at DATETIME,
                    new_expires_at DATETIME,
                    reason TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (operator_id) REFERENCES users(id)
                )`);
                console.log('[Migration v22] ✅ 创建 user_time_logs 表');

                // 创建 password_resets 表 - 密码重置记录（管理员手动重置）
                await db.execute(`CREATE TABLE IF NOT EXISTS password_resets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    operator_id INTEGER,
                    old_password_hash TEXT,
                    reset_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    reason TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (operator_id) REFERENCES users(id)
                )`);
                console.log('[Migration v22] ✅ 创建 password_resets 表');

                console.log('[Migration v22] ✅ 用户认证系统表创建完成');
            } catch (error: any) {
                console.error('[Migration v22] ❌ 迁移失败:', error);
                throw error;
            }
        },
    },
    {
        version: 23,
        up: async (db: DB) => {
            console.log('[Migration v23] 开始创建字幕模板表和添加 readonly 列');

            try {
                // 创建 subtitle_templates 表 - 用于保存字幕模板
                await db.execute(`CREATE TABLE IF NOT EXISTS subtitle_templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    config TEXT,
                    is_system INTEGER DEFAULT 0,
                    readonly INTEGER DEFAULT 0,
                    created_at INTEGER,
                    updated_at INTEGER
                )`);
                console.log('[Migration v23] ✅ 创建 subtitle_templates 表');

                // 为 cover_templates 表添加 readonly 列（如果不存在）
                try {
                    await db.execute(`
                        ALTER TABLE cover_templates
                        ADD COLUMN readonly INTEGER DEFAULT 0
                    `);
                    console.log('[Migration v23] ✅ 为 cover_templates 表添加 readonly 列');
                } catch (error: any) {
                    if (error.message && error.message.includes('duplicate column name')) {
                        console.log('[Migration v23] ℹ️ cover_templates 表已有 readonly 列');
                    } else {
                        throw error;
                    }
                }

                // 为 subtitle_templates 表创建索引
                await db.execute(`CREATE INDEX IF NOT EXISTS idx_subtitle_templates_name ON subtitle_templates(name)`);
                await db.execute(`CREATE INDEX IF NOT EXISTS idx_subtitle_templates_is_system ON subtitle_templates(is_system)`);
                console.log('[Migration v23] ✅ 创建 subtitle_templates 表的索引');

                console.log('[Migration v23] ✅ 字幕模板表创建完成');
            } catch (error: any) {
                console.error('[Migration v23] ❌ 迁移失败:', error);
                throw error;
            }
        },
    },
    {
        version: 24,
        up: async (db: DB) => {
            console.log('[Migration v24] 开始创建素材库表');
            await db.execute(`CREATE TABLE IF NOT EXISTS data_video_material (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                type TEXT NOT NULL,
                info TEXT,
                createdAt INTEGER,
                updatedAt INTEGER
            )`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_video_material_updatedAt ON data_video_material(updatedAt DESC)`);
            console.log('[Migration v24] 素材库表创建完成');
        },
    },
];

export default {
    versions,
};
