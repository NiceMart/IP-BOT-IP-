/**
 * 应用配置初始化模块
 * 在应用启动时自动检查并初始化应用配置（包括字幕模板）
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { Log } from '../log/main';
import DB from '../db/main';
import { getCommonResourcePath } from '../../lib/resource-path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 读取默认字幕模板配置文件
 */
const loadDefaultSubtitleTemplates = (): any | null => {
  try {
    // 尝试多个可能的路径
    const possiblePaths = [
      // 优先尝试使用统一资源路径工具（支持开发和生产环境）
      getCommonResourcePath('config/default-subtitle-templates.json'),
      path.join(__dirname, '../../config/default-subtitle-templates.json'),
      path.join(__dirname, '../../../config/default-subtitle-templates.json'),
      path.join(process.cwd(), 'electron/config/default-subtitle-templates.json'),
      path.join(process.cwd(), 'dist-electron/config/default-subtitle-templates.json'),
    ];

    let configPath: string | null = null;
    let configContent: string | null = null;

    for (const tryPath of possiblePaths) {
      console.log('[initAppConfig] 尝试字幕模板配置路径:', tryPath);
      if (fs.existsSync(tryPath)) {
        configPath = tryPath;
        configContent = fs.readFileSync(tryPath, 'utf-8');
        console.log('[initAppConfig] ✅ 找到字幕模板配置文件:', tryPath);
        break;
      }
    }

    if (!configPath || !configContent) {
      console.warn('[initAppConfig] ⚠️ 字幕模板配置文件不存在，将使用系统默认值');
      Log.warn('initAppConfig.loadSubtitleTemplates', '字幕模板配置文件不存在');
      return null;
    }

    const config = JSON.parse(configContent);

    console.log('[initAppConfig] 成功加载字幕模板配置:', {
      version: config.version,
      templateCount: config.subtitleTemplates?.length || 0,
      keywordGroupCount: config.keywordGroups?.length || 0
    });

    Log.info('initAppConfig.loadSubtitleTemplates', '成功加载字幕模板配置', {
      version: config.version,
      templateCount: config.subtitleTemplates?.length || 0,
      keywordGroupCount: config.keywordGroups?.length || 0
    });

    return config;
  } catch (error) {
    console.error('[initAppConfig] 加载字幕模板配置失败:', error);
    Log.error('initAppConfig.loadSubtitleTemplates', '加载字幕模板配置失败', { error });
    return null;
  }
};

/**
 * 初始化字幕模板配置
 * 在Electron主进程中，将字幕样式初始化到数据库
 */
const initSubtitleTemplates = async (config: any): Promise<void> => {
  try {
    if (!config?.subtitleTemplates || config.subtitleTemplates.length === 0) {
      console.warn('[initAppConfig] 没有字幕模板需要初始化');
      return;
    }

    // 🔧 新增：将字幕样式插入到数据库
    if (DB) {
      for (const template of config.subtitleTemplates) {
        if (template.config?.subtitleStyle) {
          const style = template.config.subtitleStyle;

          // 确保有必要的时间戳
          const now = Date.now();
          const createdAt = style.createdAt || now;
          const updatedAt = style.updatedAt || now;

          try {
            // 检查样式是否已存在
            const existing = await DB.first('SELECT id FROM subtitle_styles WHERE id = ?', [style.id]);

            if (!existing) {
              // 插入新样式
              const sql = `
                INSERT INTO subtitle_styles
                (id, name, description, preview, fontName, fontSize, fontColor, outlineColor,
                 outlineWidth, shadowOffset, shadowColor, shadowBlur, backgroundColor,
                 backgroundOpacity, position, alignment, is_system, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;

              await DB.insert(sql, [
                style.id,
                style.name,
                style.description,
                style.preview,
                style.fontName,
                style.fontSize,
                style.fontColor,
                style.outlineColor,
                style.outlineWidth,
                style.shadowOffset,
                style.shadowColor,
                style.shadowBlur,
                style.backgroundColor,
                style.backgroundOpacity,
                style.position,
                style.alignment,
                1, // is_system = true
                createdAt,
                updatedAt
              ]);

              console.log('[initAppConfig] ✅ 字幕样式已插入数据库:', style.id);
            } else {
              console.log('[initAppConfig] ℹ️ 字幕样式已存在，跳过插入:', style.id);
            }
          } catch (error) {
            console.warn('[initAppConfig] 字幕样式插入失败:', error);
          }
        }
      }
    }

    console.log('[initAppConfig] ✅ 字幕模板配置已加载, 总数:', config.subtitleTemplates.length);
    Log.info('initAppConfig.initSubtitleTemplates', '字幕模板配置已加载', {
      count: config.subtitleTemplates.length,
      note: '字幕样式已初始化到数据库'
    });
  } catch (error) {
    console.error('[initAppConfig] 字幕模板初始化失败:', error);
    Log.error('initAppConfig.initSubtitleTemplates', '字幕模板初始化失败', { error });
  }
};

/**
 * 初始化关键词分组
 * 将默认关键词分组保存到数据库，首次启动时自动导入
 */
const initKeywordGroups = async (config: any): Promise<void> => {
  try {
    if (!config?.keywordGroups || config.keywordGroups.length === 0) {
      console.warn('[initAppConfig] 没有关键词分组需要初始化');
      return;
    }

    let insertedCount = 0;
    let skippedCount = 0;

    for (const group of config.keywordGroups) {
      try {
        // 检查分组是否已存在
        const existing = await DB.first(
          'SELECT id FROM keyword_groups WHERE id = ?',
          [group.id]
        );

        if (!existing) {
          // 准备数据
          const now = Date.now();
          const keywordsJson = JSON.stringify(group.keywords || []);
          const styleOverrideJson = group.styleOverride ? JSON.stringify(group.styleOverride) : null;
          const effectConfigJson = group.effectConfig ? JSON.stringify(group.effectConfig) : null;
          const styleConfigJson = group.styleConfig ? JSON.stringify(group.styleConfig) : null;

          // 插入新分组
          await DB.execute(`
            INSERT INTO keyword_groups (
              id, name, description, keywords, color, effectId,
              styleOverride, effectConfig, styleConfig,
              createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            group.id,
            group.name,
            group.description || '',
            keywordsJson,
            group.color || null,
            group.effectId || null,
            styleOverrideJson,
            effectConfigJson,
            styleConfigJson,
            group.createdAt || now,
            group.updatedAt || now
          ]);

          insertedCount++;
          console.log(`[initAppConfig] ✅ 关键词分组已插入数据库: ${group.name} (${group.id})`);
        } else {
          skippedCount++;
          console.log(`[initAppConfig] ℹ️ 关键词分组已存在，跳过: ${group.name} (${group.id})`);
        }
      } catch (error) {
        console.warn(`[initAppConfig] 关键词分组插入失败: ${group.name}`, error);
      }
    }

    console.log(`[initAppConfig] ✅ 关键词分组初始化完成: 新增 ${insertedCount} 个，跳过 ${skippedCount} 个`);
    Log.info('initAppConfig.initKeywordGroups', '关键词分组初始化完成', {
      total: config.keywordGroups.length,
      inserted: insertedCount,
      skipped: skippedCount
    });
  } catch (error) {
    console.error('[initAppConfig] 关键词分组初始化失败:', error);
    Log.error('initAppConfig.initKeywordGroups', '关键词分组初始化失败', { error });
  }
};

/**
 * 初始化应用配置
 * 此函数应在 initSystemTemplates 之后调用
 */
export const initAppConfig = async (): Promise<void> => {
  try {
    console.log('[initAppConfig] 开始初始化应用配置');
    Log.info('initAppConfig.start', '开始初始化应用配置');

    // 加载字幕模板配置
    const config = loadDefaultSubtitleTemplates();
    console.log('[initAppConfig] 加载配置结果:', {
      configExists: !!config,
      hasSubtitleTemplates: !!config?.subtitleTemplates,
      subtitleTemplatesLength: config?.subtitleTemplates?.length || 0,
      hasKeywordGroups: !!config?.keywordGroups,
      keywordGroupsLength: config?.keywordGroups?.length || 0
    });

    if (!config) {
      console.warn('[initAppConfig] 无法加载配置，跳过初始化');
      Log.warn('initAppConfig.start', '无法加载配置，跳过初始化');
      return;
    }

    // 初始化字幕模板
    if (config.subtitleTemplates && config.subtitleTemplates.length > 0) {
      console.log('[initAppConfig] 开始初始化字幕模板，数量:', config.subtitleTemplates.length);
      await initSubtitleTemplates(config);
    } else {
      console.warn('[initAppConfig] 没有字幕模板需要初始化');
    }

    // 初始化关键词分组
    if (config.keywordGroups && config.keywordGroups.length > 0) {
      console.log('[initAppConfig] 开始初始化关键词分组，数量:', config.keywordGroups.length);
      await initKeywordGroups(config);
    } else {
      console.warn('[initAppConfig] 没有关键词分组需要初始化');
    }

    console.log('[initAppConfig] ✅ 应用配置初始化完成');
    Log.info('initAppConfig.complete', '应用配置初始化完成', {
      version: config.version,
      templateCount: config.subtitleTemplates?.length || 0,
      keywordGroupCount: config.keywordGroups?.length || 0
    });
  } catch (error) {
    console.error('[initAppConfig] 应用配置初始化过程出错:', error);
    Log.error('initAppConfig.error', '应用配置初始化过程出错', { error });
    // 不抛出错误，避免影响应用启动
  }
};

/**
 * 初始化音色预缓存
 * 优先从应用资源复制，如果不存在则在后台异步预缓存
 * 不阻塞应用启动
 */
export const initVoicePreCache = async (): Promise<void> => {
  try {
    // 动态导入，避免循环依赖
    const { preCacheSystemVoices, isAllVoicesCached, copyPreCacheFromResources, clearLegacyPreCacheFiles } = await import('../aliyun/voicePreCache');

    // 检查是否已经全部缓存
    if (isAllVoicesCached()) {
      clearLegacyPreCacheFiles();
      console.log('[initAppConfig] ✅ 所有默认音色已预缓存，无需再处理');
      Log.info('initAppConfig.voicePreCache', '所有默认音色已预缓存');
      return;
    }

    // 尝试从应用资源目录复制（用于打包分发）
    console.log('[initAppConfig] 尝试从应用资源复制预缓存文件...');
    const copiedFromResources = await copyPreCacheFromResources();

    if (copiedFromResources) {
      console.log('[initAppConfig] ✅ 从应用资源复制预缓存文件成功');
      Log.info('initAppConfig.voicePreCache', '从应用资源复制预缓存文件成功');
      clearLegacyPreCacheFiles();
      // 再次检查是否全部缓存了
      if (isAllVoicesCached()) {
        return;
      }
    }

    console.log('[initAppConfig] 开始异步预缓存系统默认音色...');
    Log.info('initAppConfig.voicePreCache.start', '开始异步预缓存系统默认音色');

    // 获取阿里云API Key（如果配置了的话）
    try {
      const dashscopeConfig = await DB.first(
        'SELECT * FROM model_provider WHERE id = ?',
        ['dashscope']
      );

      if (dashscopeConfig && dashscopeConfig.data) {
        const providerData = typeof dashscopeConfig.data === 'string'
          ? JSON.parse(dashscopeConfig.data)
          : dashscopeConfig.data;

        const apiKey = providerData.apiKey;

        if (apiKey) {
          // 在后台异步预缓存，不等待完成，不阻塞应用启动
          preCacheSystemVoices(apiKey, false).then(() => {
            console.log('[initAppConfig] ✅ 音色预缓存生成完成');
            Log.info('initAppConfig.voicePreCache.complete', '音色预缓存生成完成');
          }).catch((error: any) => {
            console.warn('[initAppConfig] 音色预缓存失败（不影响应用使用）:', error.message);
            Log.warn('initAppConfig.voicePreCache.error', '音色预缓存失败', { error: error.message });
          });
        } else {
          console.log('[initAppConfig] 阿里云API Key未配置，跳过自动预缓存');
          Log.info('initAppConfig.voicePreCache.skip', '阿里云API Key未配置');
        }
      } else {
        console.log('[initAppConfig] 阿里云百炼未配置，跳过自动预缓存');
        Log.info('initAppConfig.voicePreCache.skip', '阿里云百炼未配置');
      }
    } catch (error: any) {
      console.warn('[initAppConfig] 获取阿里云配置失败，跳过自动预缓存:', error.message);
      Log.warn('initAppConfig.voicePreCache.getConfigError', '获取阿里云配置失败', { error: error.message });
    }
  } catch (error: any) {
    console.error('[initAppConfig] 音色预缓存初始化失败:', error);
    Log.error('initAppConfig.voicePreCache.initError', '音色预缓存初始化失败', { error: error.message });
    // 不抛出错误，避免影响应用启动
  }
};

export default {
  initAppConfig,
  initVoicePreCache,
};
