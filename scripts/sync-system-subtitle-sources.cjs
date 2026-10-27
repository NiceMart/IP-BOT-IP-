const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const tsSourcePath = path.join(repoRoot, 'src', 'config', 'systemSubtitleTemplates.ts');
const runtimeDatabasePath = path.join(repoRoot, 'data', 'database.db');
const runtimeExportPath = path.join(repoRoot, 'build', 'runtime-system-subtitle-templates.json');
const previewAssetDir = path.join(repoRoot, 'electron', 'resources', 'extra', 'common', 'cover-templates');
const packagedPreviewPrefix = 'extra/common/cover-templates';
const inlineTemplateIds = new Set([
    'template_system_11',
    'template_system_22',
    'template_system_33',
    'template_system_44',
    'template_system_55',
    'template_system_66',
    'template_system_77',
    'template_system_88',
]);
const defaultTriggeredSoundConfig = {
    volume: 0.7,
    pitch: 1,
    fadeIn: 0,
    fadeOut: 50,
    triggerTime: 'start',
};

const systemTemplateJsonPaths = [
    path.join(repoRoot, 'electron', 'config', 'system-templates.json'),
    path.join(repoRoot, 'electron', 'resources', 'extra', 'common', 'config', 'system-templates.json'),
];

const defaultSubtitleTemplateJsonPaths = [
    path.join(repoRoot, 'electron', 'config', 'default-subtitle-templates.json'),
    path.join(repoRoot, 'electron', 'resources', 'extra', 'common', 'config', 'default-subtitle-templates.json'),
];

const isAbsoluteLocalPath = (value) => /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\');

const stripMachineSpecificFontPaths = (value) => {
    if (Array.isArray(value)) {
        return value.map(stripMachineSpecificFontPaths);
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    const next = {};
    for (const [key, child] of Object.entries(value)) {
        if (key === 'fontPath' && typeof child === 'string' && isAbsoluteLocalPath(child)) {
            continue;
        }
        next[key] = stripMachineSpecificFontPaths(child);
    }
    return next;
};

const ensureBundledPreviewImage = (templateId, imagePath) => {
    if (!imagePath || typeof imagePath !== 'string') {
        return imagePath;
    }

    const ext = path.extname(imagePath) || '.png';
    const fileName = `subtitle-preview-${templateId}${ext.toLowerCase()}`;
    const bundledRelativePath = `${packagedPreviewPrefix}/${fileName}`;
    const bundledAbsolutePath = path.join(previewAssetDir, fileName);

    fs.mkdirSync(previewAssetDir, { recursive: true });

    if (isAbsoluteLocalPath(imagePath)) {
        if (fs.existsSync(imagePath)) {
            const shouldCopy =
                !fs.existsSync(bundledAbsolutePath) ||
                fs.statSync(bundledAbsolutePath).size !== fs.statSync(imagePath).size;
            if (shouldCopy) {
                fs.copyFileSync(imagePath, bundledAbsolutePath);
            }
            return bundledRelativePath;
        }

        if (fs.existsSync(bundledAbsolutePath)) {
            return bundledRelativePath;
        }

        return imagePath;
    }

    return imagePath;
};

const normalizeTemplateForPackaging = (template) => {
    const normalized = stripMachineSpecificFontPaths(JSON.parse(JSON.stringify(template)));
    const previewImage = normalized?.config?.previewConfig?.backgroundImage;
    const bundledPreview = ensureBundledPreviewImage(normalized.id, previewImage);
    if (bundledPreview) {
        normalized.config.previewConfig.backgroundImage = bundledPreview;
    }

    if (inlineTemplateIds.has(normalized.id) && Array.isArray(normalized?.config?.keywordGroupsStyles)) {
        const soundEffects = ['bubble', null, null, 'ding'];
        normalized.config.keywordGroupsStyles = normalized.config.keywordGroupsStyles.map((group, index) => {
            if (index > 3 || !group || typeof group !== 'object') {
                return group;
            }

            const soundEffectId = soundEffects[index];
            return {
                ...group,
                soundEffectId,
                soundEffectConfig: soundEffectId ? { ...defaultTriggeredSoundConfig } : null,
            };
        });
    }

    return normalized;
};

const readTemplatesFromRuntimeDatabase = () => {
    if (!fs.existsSync(runtimeExportPath)) {
        return null;
    }

    try {
        const templates = JSON.parse(fs.readFileSync(runtimeExportPath, 'utf8'));
        if (!Array.isArray(templates) || templates.length !== 16) {
            return null;
        }
        return templates;
    } catch (error) {
        console.warn('[sync-system-subtitle-sources] failed to read runtime export:', error?.message || error);
        return null;
    }
};

const readTemplatesFromTsSource = () => {
    const source = fs.readFileSync(tsSourcePath, 'utf8');
    const match = source.match(/export const SYSTEM_TEMPLATES = (\[[\s\S]*?\]);/);
    if (!match) {
        throw new Error(`Failed to locate SYSTEM_TEMPLATES in ${tsSourcePath}`);
    }

    const templates = JSON.parse(match[1]);
    if (!Array.isArray(templates) || templates.length !== 16) {
        throw new Error(`Expected 16 canonical system templates, received ${Array.isArray(templates) ? templates.length : 'invalid data'}`);
    }

    return templates;
};

const readCanonicalTemplates = () => {
    const dbTemplates = readTemplatesFromRuntimeDatabase();
    if (dbTemplates) {
        return {
            source: 'runtime-db-export',
            templates: dbTemplates.map(normalizeTemplateForPackaging),
        };
    }

    return {
        source: 'ts-source',
        templates: readTemplatesFromTsSource().map(normalizeTemplateForPackaging),
    };
};

const writeJsonFile = (filePath, updater) => {
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const next = updater(existing);
    fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
};

const syncSystemSubtitleSources = () => {
    const { source, templates } = readCanonicalTemplates();
    const syncedAt = new Date().toISOString();

    for (const filePath of systemTemplateJsonPaths) {
        writeJsonFile(filePath, (json) => ({
            ...json,
            subtitleTemplates: templates,
            timestamp: syncedAt,
        }));
    }

    for (const filePath of defaultSubtitleTemplateJsonPaths) {
        writeJsonFile(filePath, (json) => ({
            ...json,
            subtitleTemplates: templates,
            timestamp: syncedAt,
        }));
    }

    return {
        count: templates.length,
        ids: templates.map((template) => template.id),
        syncedAt,
        source,
    };
};

if (require.main === module) {
    const result = syncSystemSubtitleSources();
    console.log('[sync-system-subtitle-sources] synced canonical system subtitle templates', result);
}

module.exports = {
    syncSystemSubtitleSources,
};
