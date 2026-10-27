import systemTemplatesConfig from '../../electron/resources/extra/common/config/system-templates.json';

const rawSystemTemplates = Array.isArray(systemTemplatesConfig?.subtitleTemplates)
  ? systemTemplatesConfig.subtitleTemplates
  : [];

const getSystemTemplateOrderScore = (template: any): [number, number, string] => {
  const id = String(template?.id || '');
  const name = String(template?.name || '');
  const source = `${id} ${name}`;
  const numberMatch = source.match(/(\d{2})/);
  const numericOrder = numberMatch ? Number(numberMatch[1]) : Number.MAX_SAFE_INTEGER;
  const modeOrder = /inline/i.test(source) && !/classic/i.test(source) ? 0 : 1;

  return [modeOrder, numericOrder, name];
};

export const SYSTEM_TEMPLATES = [...rawSystemTemplates].sort((left: any, right: any) => {
  const leftScore = getSystemTemplateOrderScore(left);
  const rightScore = getSystemTemplateOrderScore(right);

  if (leftScore[0] !== rightScore[0]) {
    return leftScore[0] - rightScore[0];
  }

  if (leftScore[1] !== rightScore[1]) {
    return leftScore[1] - rightScore[1];
  }

  return leftScore[2].localeCompare(rightScore[2]);
});

export const isSystemTemplate = (templateId: string): boolean =>
  SYSTEM_TEMPLATES.some((template: any) => template.id === templateId);
