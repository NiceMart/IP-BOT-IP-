/**
 * 系统默认模板初始化模块
 * 在应用启动时自动检查并初始化系统默认模板
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import DB from './main';
import { Log } from '../log/main';
import { AppEnv } from '../env';
import { getCommonResourcePath } from '../../lib/resource-path';
import { isPackaged } from '../../lib/env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CoverTemplate {
  id: string;
  name: string;
  description: string;
  is_system: number;
  config: any;
  thumbnailPath?: string;
}

interface SubtitleStyle {
  id: string;
  name: string;
  description: string;
  preview: string;
  is_system: number;
  fontName: string;
  fontSize: number;
  fontColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadowOffset?: number;
  shadowColor?: string;
  shadowBlur?: number;
  backgroundColor: string;
  backgroundOpacity: number;
  position: string;
  alignment: string;
}

interface SubtitleTemplate {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  readonly?: boolean;
  createdAt: number;
  config: any;
}

interface SystemTemplatesConfig {
  version: string;
  description: string;
  timestamp: string;
  subtitleTemplates: SubtitleTemplate[];
  coverTemplates: CoverTemplate[];
}

interface DefaultTemplatesConfig {
  version: string;
  description: string;
  coverTemplates: CoverTemplate[];
  subtitleStyles: SubtitleStyle[];
}

interface PendingInlineRestoreResult {
  templates: SubtitleTemplate[];
  forceRestoreIds: Set<string>;
  pendingFilePath: string | null;
}

const DEV_INLINE_RESTORE_PENDING_FILE = 'restore-inline-templates.pending.json';
const DEV_SYSTEM_TEMPLATES_MARKER_FILE = 'dev-system-templates.seeded.json';
const FORMAL_INLINE_SYSTEM_TEMPLATE_IDS = new Set([
  'template_system_11',
  'template_system_22',
  'template_system_33',
  'template_system_44',
  'template_system_55',
  'template_system_66',
  'template_system_77',
  'template_system_88',
]);

const syncFormalInlineTemplateSoundEffects = (
  templateId: string,
  bundledKeywordGroupsStyles: any,
  existingKeywordGroupsStyles: any,
): { keywordGroupsStyles: any; updated: boolean } => {
  if (!FORMAL_INLINE_SYSTEM_TEMPLATE_IDS.has(templateId)) {
    return { keywordGroupsStyles: existingKeywordGroupsStyles, updated: false };
  }

  if (!Array.isArray(bundledKeywordGroupsStyles)) {
    return { keywordGroupsStyles: existingKeywordGroupsStyles, updated: false };
  }

  if (!Array.isArray(existingKeywordGroupsStyles)) {
    return { keywordGroupsStyles: bundledKeywordGroupsStyles, updated: true };
  }

  let updated = false;
  const mergedKeywordGroupsStyles = bundledKeywordGroupsStyles.map((bundledGroup, index) => {
    const existingGroup = existingKeywordGroupsStyles[index];
    if (!existingGroup) {
      updated = true;
      return bundledGroup;
    }

    const mergedGroup = {
      ...existingGroup,
    };

    if (Object.prototype.hasOwnProperty.call(bundledGroup, 'soundEffectId')) {
      const nextSoundEffectId = bundledGroup.soundEffectId ?? null;
      if ((existingGroup.soundEffectId ?? null) !== nextSoundEffectId) {
        updated = true;
      }
      mergedGroup.soundEffectId = nextSoundEffectId;
    }

    if (Object.prototype.hasOwnProperty.call(bundledGroup, 'soundEffectConfig')) {
      const nextSoundEffectConfig = bundledGroup.soundEffectConfig ?? null;
      if (JSON.stringify(existingGroup.soundEffectConfig ?? null) !== JSON.stringify(nextSoundEffectConfig)) {
        updated = true;
      }
      mergedGroup.soundEffectConfig = nextSoundEffectConfig;
    }

    return mergedGroup;
  });

  if (existingKeywordGroupsStyles.length > bundledKeywordGroupsStyles.length) {
    mergedKeywordGroupsStyles.push(...existingKeywordGroupsStyles.slice(bundledKeywordGroupsStyles.length));
  }

  return { keywordGroupsStyles: mergedKeywordGroupsStyles, updated };
};

const getDevSystemTemplatesMarkerPath = (): string => {
  const baseDir = AppEnv.dataRoot || process.cwd();
  return path.join(baseDir, DEV_SYSTEM_TEMPLATES_MARKER_FILE);
};

const writeDevSystemTemplatesMarker = (reason: string): void => {
  if (isProductionMode()) {
    return;
  }

  const markerPath = getDevSystemTemplatesMarkerPath();

  try {
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(markerPath, JSON.stringify({
      reason,
      timestamp: Date.now(),
    }, null, 2), 'utf8');
    Log.info('initSystemTemplates.writeDevMarker', '已写入开发环境系统模板初始化标记', {
      markerPath,
      reason,
    });
  } catch (error) {
    Log.warn('initSystemTemplates.writeDevMarker', '写入开发环境系统模板初始化标记失败', {
      markerPath,
      reason,
      error,
    });
  }
};

const shouldSkipDevSystemTemplateInit = async (): Promise<boolean> => {
  if (isProductionMode()) {
    return false;
  }

  const markerPath = getDevSystemTemplatesMarkerPath();
  if (fs.existsSync(markerPath)) {
    Log.info('initSystemTemplates.skipDevInit', '检测到开发环境初始化标记，跳过系统模板自动同步', {
      markerPath,
    });
    return true;
  }

  return false;
};

/**
 * 确保表中存在 is_system 列
 */
const ensureIsSystemColumn = async (): Promise<void> => {
  try {
    // 检查并添加 cover_templates 表的 is_system 列
    try {
      await DB.execute(`
        ALTER TABLE cover_templates
        ADD COLUMN is_system INTEGER DEFAULT 0
      `);
      Log.info('initSystemTemplates.ensureIsSystemColumn', '已添加 is_system 列到 cover_templates');
    } catch (error: any) {
      // 列已存在时会抛出错误，忽略
      if (error.message && error.message.includes('duplicate column name')) {
        Log.info('initSystemTemplates.ensureIsSystemColumn', 'cover_templates 的 is_system 列已存在');
      } else {
        Log.warn('initSystemTemplates.ensureIsSystemColumn', 'cover_templates 列检查警告', { error: error.message });
      }
    }

    // 检查并添加 subtitle_styles 表的 is_system 列
    try {
      await DB.execute(`
        ALTER TABLE subtitle_styles
        ADD COLUMN is_system INTEGER DEFAULT 0
      `);
      Log.info('initSystemTemplates.ensureIsSystemColumn', '已添加 is_system 列到 subtitle_styles');
    } catch (error: any) {
      // 列已存在时会抛出错误，忽略
      if (error.message && error.message.includes('duplicate column name')) {
        Log.info('initSystemTemplates.ensureIsSystemColumn', 'subtitle_styles 的 is_system 列已存在');
      } else {
        Log.warn('initSystemTemplates.ensureIsSystemColumn', 'subtitle_styles 列检查警告', { error: error.message });
      }
    }
  } catch (error) {
    Log.error('initSystemTemplates.ensureIsSystemColumn', '确保列存在时出错', { error });
  }
};

/**
 * 读取系统模板配置文件 (system-templates.json)
 */
const loadSystemTemplatesConfig = (): SystemTemplatesConfig | null => {
  try {
    // 尝试多个可能的路径
    const possiblePaths = [
      // 优先尝试使用统一资源路径工具（支持开发和生产环境）
      getCommonResourcePath('config/system-templates.json'),
      // 关键修复：直接使用 process.resourcesPath（生产环境）
      process.resourcesPath ? path.join(process.resourcesPath, 'extra/common/config/system-templates.json') : '',
      path.join(__dirname, '../config/system-templates.json'),
      path.join(__dirname, '../../config/system-templates.json'),
      path.join(process.cwd(), 'electron/config/system-templates.json'),
      path.join(process.cwd(), 'dist-electron/config/system-templates.json'),
      // 添加更多备用路径
      path.join(process.cwd(), 'resources/extra/common/config/system-templates.json'),
    ].filter(p => p); // 过滤空路径

    let configPath: string | null = null;
    let configContent: string | null = null;

    console.log('[initSystemTemplates] 开始搜索 system-templates.json');
    console.log('[initSystemTemplates] process.resourcesPath:', process.resourcesPath);
    console.log('[initSystemTemplates] process.cwd():', process.cwd());

    for (const tryPath of possiblePaths) {
      console.log('[initSystemTemplates] 尝试加载系统模板:', tryPath, '存在:', fs.existsSync(tryPath));
      if (fs.existsSync(tryPath)) {
        configPath = tryPath;
        configContent = fs.readFileSync(tryPath, 'utf-8');
        console.log('[initSystemTemplates] ✅ 找到系统模板配置文件:', tryPath);
        break;
      }
    }

    if (!configPath || !configContent) {
      console.warn('[initSystemTemplates] ⚠️ system-templates.json 不存在');
      Log.warn('initSystemTemplates.loadSystemTemplatesConfig', '系统模板配置文件不存在', { possiblePaths });
      return null;
    }

    const config = JSON.parse(configContent) as SystemTemplatesConfig;

    console.log('[initSystemTemplates] 成功加载系统模板配置:', {
      version: config.version,
      subtitleCount: config.subtitleTemplates.length,
      coverCount: config.coverTemplates.length
    });

    Log.info('initSystemTemplates.loadSystemTemplatesConfig', '成功加载系统模板配置', {
      version: config.version,
      subtitleCount: config.subtitleTemplates.length,
      coverCount: config.coverTemplates.length
    });

    return config;
  } catch (error) {
    console.error('[initSystemTemplates] 加载系统模板配置失败:', error);
    Log.error('initSystemTemplates.loadSystemTemplatesConfig', '加载系统模板配置失败', { error });
    return null;
  }
};

const applyPendingInlineTemplateRestore = (
  templates: SubtitleTemplate[],
): PendingInlineRestoreResult => {
  const pendingFilePath = path.join(process.cwd(), DEV_INLINE_RESTORE_PENDING_FILE);
  const enablePendingRestore = process.env.ENABLE_DEV_INLINE_RESTORE === '1';

  if (!enablePendingRestore || isProductionMode() || !fs.existsSync(pendingFilePath)) {
    if (!isProductionMode() && !enablePendingRestore && fs.existsSync(pendingFilePath)) {
      Log.warn('initSystemTemplates.applyPendingInlineTemplateRestore', '检测到待恢复 Inline 模板文件，但已默认忽略。设置 ENABLE_DEV_INLINE_RESTORE=1 可重新启用。', {
        pendingFilePath,
      });
    }

    return {
      templates,
      forceRestoreIds: new Set<string>(),
      pendingFilePath: null,
    };
  }

  try {
    const raw = fs.readFileSync(pendingFilePath, 'utf8');
    const pending = JSON.parse(raw);
    const restoreTemplates = Array.isArray(pending?.subtitleTemplates) ? pending.subtitleTemplates : [];
    const restoreMap = new Map<string, SubtitleTemplate>(
      restoreTemplates
        .filter((item: SubtitleTemplate | null | undefined) => Boolean(item?.id))
        .map((item: SubtitleTemplate) => [item.id, item])
    );

    if (restoreMap.size === 0) {
      return {
        templates,
        forceRestoreIds: new Set<string>(),
        pendingFilePath: null,
      };
    }

    const forceRestoreIds = new Set<string>();
    const mergedTemplates = templates.map((template) => {
      const restoreTemplate = restoreMap.get(template.id);
      if (!restoreTemplate) {
        return template;
      }

      forceRestoreIds.add(template.id);

      return {
        ...template,
        config: {
          ...template.config,
          ...restoreTemplate.config,
          previewConfig: template.config?.previewConfig,
          keywordRenderMode: template.config?.keywordRenderMode,
        },
      };
    });

    Log.info('initSystemTemplates.applyPendingInlineTemplateRestore', '检测到待恢复的 Inline 模板配置', {
      pendingFilePath,
      count: forceRestoreIds.size,
    });

    return {
      templates: mergedTemplates,
      forceRestoreIds,
      pendingFilePath,
    };
  } catch (error) {
    Log.error('initSystemTemplates.applyPendingInlineTemplateRestore', '读取待恢复 Inline 模板配置失败', {
      pendingFilePath,
      error,
    });
    return {
      templates,
      forceRestoreIds: new Set<string>(),
      pendingFilePath: null,
    };
  }
};

/**
 * 读取默认模板配置文件
 */
const loadDefaultTemplatesConfig = (): DefaultTemplatesConfig | null => {
  try {
    // 尝试多个可能的路径
    const possiblePaths = [
      // 优先尝试使用统一资源路径工具（支持开发和生产环境）
      getCommonResourcePath('config/default-templates.json'),
      path.join(__dirname, '../config/default-templates.json'),
      path.join(__dirname, '../../config/default-templates.json'),
      path.join(process.cwd(), 'electron/config/default-templates.json'),
      path.join(process.cwd(), 'dist-electron/config/default-templates.json'),
    ];

    let configPath: string | null = null;
    let configContent: string | null = null;

    for (const tryPath of possiblePaths) {
      console.log('[initSystemTemplates] 尝试路径:', tryPath);
      if (fs.existsSync(tryPath)) {
        configPath = tryPath;
        configContent = fs.readFileSync(tryPath, 'utf-8');
        console.log('[initSystemTemplates] ✅ 找到配置文件:', tryPath);
        break;
      }
    }

    if (!configPath || !configContent) {
      console.error('[initSystemTemplates] ❌ 配置文件不存在，尝试的路径:', possiblePaths);
      Log.error('initSystemTemplates.loadConfig', '配置文件不存在', { possiblePaths });
      return null;
    }

    const config = JSON.parse(configContent) as DefaultTemplatesConfig;

    console.log('[initSystemTemplates] 成功加载配置文件:', {
      version: config.version,
      coverCount: config.coverTemplates.length,
      subtitleCount: config.subtitleStyles.length
    });

    Log.info('initSystemTemplates.loadConfig', '成功加载配置文件', {
      version: config.version,
      coverCount: config.coverTemplates.length,
      subtitleCount: config.subtitleStyles.length
    });

    return config;
  } catch (error) {
    console.error('[initSystemTemplates] 加载配置文件失败:', error);
    Log.error('initSystemTemplates.loadConfig', '加载配置文件失败', { error });
    return null;
  }
};

/**
 * 检查是否在生产模式
 */
const isProductionMode = (): boolean => {
  return isPackaged ||
    process.env.IS_PACKAGED === 'true' ||
    process.env.ELECTRON_ENV_PROD === '1' ||
    process.env.ELECTRON_ENV_PROD === 'true' ||
    process.env.NODE_ENV === 'production';
};

/**
 * 初始化字幕模板
 * 从 system-templates.json 导入字幕模板到数据库
 */
const initSubtitleTemplates = async (
  templates: SubtitleTemplate[],
  options?: {
    forceRestoreIds?: Set<string>;
  }
): Promise<void> => {
  try {
    const now = Date.now();
    const isProd = isProductionMode();
    const forceRestoreIds = options?.forceRestoreIds || new Set<string>();
    const systemTemplateIds = templates.filter(template => template.isSystem).map(template => template.id);

    if (systemTemplateIds.length > 0) {
      const placeholders = systemTemplateIds.map(() => '?').join(', ');
      await DB.execute(
        `DELETE FROM subtitle_templates
         WHERE is_system = 1
         AND id NOT IN (${placeholders})`,
        systemTemplateIds
      );
    }

    for (const template of templates) {
      const { id, name, description, isSystem, createdAt, config } = template;
      const configJson = JSON.stringify(config);

      // 在生产模式下，字幕模板设为只读
      const readonly = isProd ? 1 : 0;

      // 检查模板是否已存在
      const existing = await DB.first(
        `SELECT id, is_system, config FROM subtitle_templates WHERE id = ?`,
        [id]
      );

      if (existing) {
        // 开发环境下保留数据库中的系统模板修改，避免每次重启都被配置文件覆盖。
        // 生产环境仍然与配置文件保持同步，确保用户侧系统模板一致。
        if (isSystem && isProd) {
          await DB.execute(
            `UPDATE subtitle_templates
             SET name = ?, description = ?, config = ?, is_system = ?, readonly = ?, updated_at = ?
             WHERE id = ?`,
            [name, description, configJson, 1, readonly, now, id]
          );
          Log.info('initSystemTemplates.updateSubtitleTemplate', '同步字幕模板配置', { id, name });
          console.log(`[initSystemTemplates] ✅ 字幕模板已同步: ${name}`);
        } else if (isSystem) {
          if (forceRestoreIds.has(id)) {
            await DB.execute(
              `UPDATE subtitle_templates
               SET name = ?, description = ?, config = ?, is_system = ?, readonly = ?, updated_at = ?
               WHERE id = ?`,
              [name, description, configJson, 1, readonly, now, id]
            );
            Log.info('initSystemTemplates.restoreDevSubtitleTemplate', '开发环境恢复系统字幕模板配置', { id, name });
            console.log(`[initSystemTemplates] ℹ️ 开发环境恢复系统字幕模板: ${name}`);
            continue;
          }

          let existingConfig: Record<string, any> = {};
          let shouldBackfillPreview = false;

          try {
            existingConfig = existing.config ? JSON.parse(existing.config) : {};
            const existingPreview = existingConfig.previewConfig || {};
            shouldBackfillPreview = !(
              existingPreview.backgroundImage ||
              existingPreview.backgroundKey ||
              (Array.isArray(existingPreview.titleTexts) && existingPreview.titleTexts.length > 0) ||
              (Array.isArray(existingPreview.subtitleTexts) && existingPreview.subtitleTexts.length > 0)
            );
          } catch (error) {
            shouldBackfillPreview = true;
            Log.warn('initSystemTemplates.parseDevSubtitleTemplate', '开发环境解析系统字幕模板失败，尝试回填预览配置', { id, name, error });
          }

          const soundSyncResult = syncFormalInlineTemplateSoundEffects(
            id,
            config.keywordGroupsStyles,
            existingConfig.keywordGroupsStyles,
          );

          if (shouldBackfillPreview || soundSyncResult.updated) {
            const mergedConfig = {
              ...existingConfig,
              ...(soundSyncResult.updated ? {
                keywordGroupsStyles: soundSyncResult.keywordGroupsStyles,
              } : {}),
              previewConfig: {
                ...(config.previewConfig || {}),
                ...(existingConfig.previewConfig || {}),
              },
            };

            await DB.execute(
              `UPDATE subtitle_templates
               SET config = ?, is_system = ?, readonly = ?, updated_at = ?
               WHERE id = ?`,
              [JSON.stringify(mergedConfig), 1, readonly, now, id]
            );
            Log.info('initSystemTemplates.backfillDevSubtitleTemplateConfig', '开发环境补齐系统字幕模板配置', {
              id,
              name,
              previewBackfilled: shouldBackfillPreview,
              inlineSoundSynced: soundSyncResult.updated,
            });
            console.log(`[initSystemTemplates] ℹ️ 开发环境补齐系统字幕模板配置: ${name}`);
          } else {
            Log.info('initSystemTemplates.keepDevSubtitleTemplate', '开发环境保留数据库中的系统字幕模板', { id, name });
            console.log(`[initSystemTemplates] ℹ️ 开发环境保留系统字幕模板: ${name}`);
          }
        } else {
          // 用户创建的模板，不覆盖
          Log.info('initSystemTemplates.checkSubtitleTemplate', '用户自定义模板已存在，保留用户数据', { id, name });
        }
        continue;
      } else {
        // 插入新的字幕模板
        await DB.execute(
          `INSERT INTO subtitle_templates (id, name, description, config, is_system, readonly, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, name, description, configJson, isSystem ? 1 : 0, readonly, createdAt, now]
        );

        Log.info('initSystemTemplates.insertSubtitleTemplate', '创建字幕模板', { id, name });
        console.log(`[initSystemTemplates] ✅ 创建字幕模板: ${name}`);
      }
    }

    Log.info('initSystemTemplates.initSubtitleTemplates', '字幕模板初始化完成', {
      count: templates.length,
      production: isProd
    });
  } catch (error) {
    Log.error('initSystemTemplates.initSubtitleTemplates', '字幕模板初始化失败', { error });
    throw error;
  }
};

/**
 * 初始化封面模板
 */
const initCoverTemplates = async (templates: CoverTemplate[]): Promise<void> => {
  try {
    const now = Date.now();
    const isProd = isProductionMode();

    for (const template of templates) {
      const { id, name, description, is_system, config, thumbnailPath } = template;
      const configJson = JSON.stringify(config);

      // 在生产模式下，封面模板设为只读
      const readonly = isProd ? 1 : 0;

      // 检查模板是否已存在
      const existing = await DB.first(
        `SELECT id, is_system FROM cover_templates WHERE id = ?`,
        [id]
      );

      if (existing) {
        // 开发环境下保留数据库中的系统模板修改，避免每次重启都被配置文件覆盖。
        // 生产环境仍然与配置文件保持同步，确保用户侧系统模板一致。
        if (is_system === 1 && isProd) {
          await DB.execute(
            `UPDATE cover_templates
             SET name = ?, config = ?, thumbnail_path = ?, is_system = ?, readonly = ?, updated_at = ?
             WHERE id = ?`,
            [name, configJson, thumbnailPath || null, is_system, readonly, now, id]
          );
          Log.info('initSystemTemplates.updateCoverTemplate', '同步封面模板配置', { id, name });
          console.log(`[initSystemTemplates] ✅ 封面模板已同步: ${name}`);
        } else if (is_system === 1) {
          Log.info('initSystemTemplates.keepDevCoverTemplate', '开发环境保留数据库中的系统封面模板', { id, name });
          console.log(`[initSystemTemplates] ℹ️ 开发环境保留系统封面模板: ${name}`);
        } else if (existing.is_system !== 1) {
          // 这是用户创建的模板，绝对不覆盖
          Log.info('initSystemTemplates.checkCoverTemplate', '用户自定义模板已存在，保留用户数据', { id, name });
        }
        continue;
      } else {
        // 插入新的系统模板
        await DB.execute(
          `INSERT INTO cover_templates (id, name, config, is_system, readonly, created_at, updated_at, thumbnail_path)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, name, configJson, is_system, readonly, now, now, thumbnailPath || null]
        );

        Log.info('initSystemTemplates.insertCoverTemplate', '创建系统封面模板', { id, name });
        console.log(`[initSystemTemplates] ✅ 创建系统模板: ${name}`);
      }
    }

    Log.info('initSystemTemplates.initCoverTemplates', '封面模板初始化完成', {
      count: templates.length,
      production: isProd
    });
  } catch (error) {
    Log.error('initSystemTemplates.initCoverTemplates', '封面模板初始化失败', { error });
    throw error;
  }
};

/**
 * 初始化字幕样式
 */
const initSubtitleStyles = async (styles: SubtitleStyle[]): Promise<void> => {
  try {
    const now = Date.now();

    for (const style of styles) {
      const {
        id, name, description, preview, is_system,
        fontName, fontSize, fontColor, outlineColor, outlineWidth,
        shadowOffset, shadowColor, shadowBlur,
        backgroundColor, backgroundOpacity, position, alignment
      } = style;

      // 检查样式是否已存在
      const existing = await DB.first(
        `SELECT id, is_system FROM subtitle_styles WHERE id = ?`,
        [id]
      );

      if (existing) {
        // 🔧 关键修复：不覆盖已存在的样式（无论是系统样式还是用户样式）
        // 原因：如果覆盖已存在的样式，会导致用户保存的自定义设置被抹掉
        // 只更新系统样式标记，不覆盖样式内容
        if (existing.is_system === 1) {
          // 这是一个系统样式，保持其原样（不更新内容）
          Log.info('initSystemTemplates.checkSubtitleStyle', '系统字幕样式已存在，跳过覆盖', { id, name });
        } else {
          // 这是用户创建的样式，绝对不覆盖
          Log.info('initSystemTemplates.checkSubtitleStyle', '用户自定义样式已存在，保留用户数据', { id, name });
        }
      } else {
        // 插入新的系统样式
        await DB.execute(
          `INSERT INTO subtitle_styles (
            id, name, description, preview, is_system,
            fontName, fontSize, fontColor, outlineColor, outlineWidth,
            shadowOffset, shadowColor, shadowBlur,
            backgroundColor, backgroundOpacity, position, alignment,
            createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, name, description, preview, is_system,
            fontName, fontSize, fontColor, outlineColor, outlineWidth,
            shadowOffset || 2, shadowColor || '#000000', shadowBlur || 4,
            backgroundColor, backgroundOpacity, position, alignment,
            now, now
          ]
        );

        Log.info('initSystemTemplates.insertSubtitleStyle', '创建系统字幕样式', { id, name });
      }
    }

    Log.info('initSystemTemplates.initSubtitleStyles', '字幕样式初始化完成', {
      count: styles.length
    });
  } catch (error) {
    Log.error('initSystemTemplates.initSubtitleStyles', '字幕样式初始化失败', { error });
    throw error;
  }
};

/**
 * 初始化所有系统默认模板
 * 此函数应在应用启动时调用
 */
export const initSystemTemplates = async (): Promise<void> => {
  try {
    Log.info('initSystemTemplates.start', '开始初始化系统默认模板');

    // 首先确保 is_system 列存在
    await ensureIsSystemColumn();

    if (await shouldSkipDevSystemTemplateInit()) {
      return;
    }

    // 优先读取系统模板配置（包含字幕和封面）
    const systemConfig = loadSystemTemplatesConfig();
    if (systemConfig) {
      const pendingInlineRestore = applyPendingInlineTemplateRestore(systemConfig.subtitleTemplates || []);

      // 初始化字幕模板
      if (pendingInlineRestore.templates.length > 0) {
        await initSubtitleTemplates(pendingInlineRestore.templates, {
          forceRestoreIds: pendingInlineRestore.forceRestoreIds,
        });
      }

      if (pendingInlineRestore.pendingFilePath) {
        fs.unlinkSync(pendingInlineRestore.pendingFilePath);
        Log.info('initSystemTemplates.applyPendingInlineTemplateRestore', '已清理待恢复 Inline 模板标记文件', {
          pendingFilePath: pendingInlineRestore.pendingFilePath,
        });
      }

      // 初始化封面模板（从 system-templates.json）
      if (systemConfig.coverTemplates && systemConfig.coverTemplates.length > 0) {
        await initCoverTemplates(systemConfig.coverTemplates);
      }

      Log.info('initSystemTemplates.complete', '系统模板初始化完成', {
        version: systemConfig.version,
        subtitleCount: systemConfig.subtitleTemplates.length,
        coverCount: systemConfig.coverTemplates.length
      });

      if (!isProductionMode()) {
        writeDevSystemTemplatesMarker('seeded-from-system-templates');
      }
    } else {
      // 如果 system-templates.json 不存在，回退到加载 default-templates.json
      console.warn('[initSystemTemplates] 无法加载 system-templates.json，尝试加载 default-templates.json');
      const config = loadDefaultTemplatesConfig();
      if (!config) {
        Log.error('initSystemTemplates.start', '无法加载任何配置文件，跳过初始化');
        return;
      }

      // 初始化封面模板
      if (config.coverTemplates && config.coverTemplates.length > 0) {
        await initCoverTemplates(config.coverTemplates);
      }

      // 初始化字幕样式
      if (config.subtitleStyles && config.subtitleStyles.length > 0) {
        await initSubtitleStyles(config.subtitleStyles);
      }

      Log.info('initSystemTemplates.complete', '系统默认模板初始化完成（从 default-templates.json）', {
        version: config.version,
        coverCount: config.coverTemplates.length,
        subtitleCount: config.subtitleStyles.length
      });

      if (!isProductionMode()) {
        writeDevSystemTemplatesMarker('seeded-from-default-templates');
      }
    }
  } catch (error) {
    Log.error('initSystemTemplates.error', '系统模板初始化过程出错', { error });
    // 不抛出错误，避免影响应用启动
  }
};

/**
 * 检查并修复缺失的系统模板
 * 可用于运行时检查
 */
export const checkAndRepairSystemTemplates = async (): Promise<{
  success: boolean;
  repairedCover: number;
  repairedSubtitle: number;
}> => {
  try {
    const config = loadDefaultTemplatesConfig();
    if (!config) {
      return { success: false, repairedCover: 0, repairedSubtitle: 0 };
    }

    let repairedCover = 0;
    let repairedSubtitle = 0;

    // 检查封面模板
    for (const template of config.coverTemplates) {
      const existing = await DB.first(
        `SELECT id FROM cover_templates WHERE id = ?`,
        [template.id]
      );

      if (!existing) {
        repairedCover++;
      }
    }

    // 检查字幕样式
    for (const style of config.subtitleStyles) {
      const existing = await DB.first(
        `SELECT id FROM subtitle_styles WHERE id = ?`,
        [style.id]
      );

      if (!existing) {
        repairedSubtitle++;
      }
    }

    // 如果有缺失，执行修复
    if (repairedCover > 0 || repairedSubtitle > 0) {
      await initSystemTemplates();
    }

    return { success: true, repairedCover, repairedSubtitle };
  } catch (error) {
    Log.error('checkAndRepairSystemTemplates.error', '检查修复失败', { error });
    return { success: false, repairedCover: 0, repairedSubtitle: 0 };
  }
};
