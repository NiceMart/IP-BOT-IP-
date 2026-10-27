// @ts-nocheck
/**
 * 关键词分组管理器 - KeywordGroupManager
 * 负责管理关键词分组的增删改查和查询操作
 */

import {
  KeywordGroup,
  KeywordStyle,
  EffectConfig,
  KeywordGroupQueryResult,
  EffectType
} from '../../types/smartSubtitle';

/**
 * 关键词分组管理器
 */
export class KeywordGroupManager {
  private groups: Map<string, KeywordGroup> = new Map();
  private keywordToGroupMap: Map<string, string> = new Map(); // 快速查询：关键词 -> 分组ID

  constructor() {
    // 【修复】禁用自动加载默认分组，避免重复添加
    // this.initializeDefaultGroups();
  }

  /**
   * 初始化默认分组
   */
  private initializeDefaultGroups(): void {
    // 创建默认分组示例 - 与VideoIPAgent.vue中的keywordTabOptions保持一致
    const defaultGroups: KeywordGroup[] = [
      {
        id: 'group_keyemphasis',
        name: '重点词/成语词',
        keywords: ['出类拔萃', '如火如荼', '众志成城', '厚积薄发', '不负韶华', '砥砺前行', '关键', '重要', '核心', '主要', '重点'],
        effectConfig: {
          type: EffectType.PULSE_SCALE,
          duration: 600,
          delay: 0,
          intensity: 0.8
        },
        styleConfig: {
          fontSize: 64,
          fontColor: '#FFD700',      // 金色
          outlineColor: '#FF8C00',
          outlineWidth: 2
        },
        createdAt: Date.now()
      },
      {
        id: 'group_description',
        name: '描述词',
        keywords: ['美丽', '壮观', '精彩', '震撼', '独特', '优秀', '绚丽', '壮观'],
        effectConfig: {
          type: EffectType.GLOW_EFFECT,
          duration: 800,
          delay: 0,
          intensity: 0.9
        },
        styleConfig: {
          fontSize: 64,
          fontColor: '#32CD32',      // 酸橙绿
          outlineColor: '#228B22',
          outlineWidth: 2
        },
        createdAt: Date.now()
      },
      {
        id: 'group_emotion',
        name: '情感词',
        keywords: ['激动', '振奋', '温暖', '感动', '骄傲', '热血', '兴奋', '欣慰'],
        effectConfig: {
          type: EffectType.HEART_PULSE,
          duration: 1000,
          delay: 0,
          intensity: 1.0
        },
        styleConfig: {
          fontSize: 64,
          fontColor: '#FF1493',      // 深粉红色
          outlineColor: '#FF69B4',
          outlineWidth: 2
        },
        createdAt: Date.now()
      },
      {
        id: 'group_action',
        name: '行动词',
        keywords: ['奋斗', '努力', '前进', '拼搏', '坚持', '创新', '突破', '发展'],
        effectConfig: {
          type: EffectType.SHAKING,
          duration: 500,
          delay: 0,
          intensity: 0.9
        },
        styleConfig: {
          fontSize: 64,
          fontColor: '#FF8800',      // 橙色
          outlineColor: '#FF4500',
          outlineWidth: 2
        },
        createdAt: Date.now()
      }
    ];

    // 加载默认分组到内存
    defaultGroups.forEach(group => this.addGroup(group));
  }

  /**
   * 手动加载默认分组（如果需要的话）
   */
  public loadDefaultGroups(): void {
    console.log('[KeywordGroupManager] 手动加载默认分组');
    this.initializeDefaultGroups();
  }

  /**
   * 添加一个分组
   */
  addGroup(group: KeywordGroup): void {
    // 验证必要字段
    if (!group.id || !group.name || !group.keywords) {
      throw new Error('分组数据不完整，缺少必要字段');
    }

    // 兼容旧数据：如果缺少 effectConfig 或 styleConfig，提供默认值
    if (!group.effectConfig) {
      console.warn(`[KeywordGroupManager] 分组 "${group.name}" 缺少 effectConfig，使用默认值`);
      group.effectConfig = {
        type: 'none' as any,
        duration: 600,
        delay: 0,
        intensity: 0.8
      };
    }

    if (!group.styleConfig) {
      console.warn(`[KeywordGroupManager] 分组 "${group.name}" 缺少 styleConfig，使用默认值`);
      group.styleConfig = {
        fontSize: 64,
        fontColor: '#FFFFFF',
        outlineColor: '#000000',
        outlineWidth: 2
      };
    }

    // 添加到Map
    this.groups.set(group.id, group);

    // 更新关键词索引
    group.keywords.forEach(keyword => {
      this.keywordToGroupMap.set(keyword, group.id);
    });

    console.log(`[KeywordGroupManager] 分组已添加: ${group.name} (${group.id})`);
  }

  /**
   * 删除一个分组
   */
  deleteGroup(groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.warn(`[KeywordGroupManager] 分组不存在: ${groupId}`);
      return false;
    }

    // 从关键词索引中移除
    group.keywords.forEach(keyword => {
      this.keywordToGroupMap.delete(keyword);
    });

    // 从分组Map中移除
    this.groups.delete(groupId);
    console.log(`[KeywordGroupManager] 分组已删除: ${group.name}`);
    return true;
  }

  /**
   * 更新一个分组
   */
  updateGroup(groupId: string, updates: Partial<KeywordGroup>): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.warn(`[KeywordGroupManager] 分组不存在: ${groupId}`);
      return false;
    }

    // 如果更新了关键词列表，需要重建索引
    if (updates.keywords) {
      // 删除旧的关键词索引
      group.keywords.forEach(keyword => {
        this.keywordToGroupMap.delete(keyword);
      });

      // 添加新的关键词索引
      updates.keywords.forEach(keyword => {
        this.keywordToGroupMap.set(keyword, groupId);
      });
    }

    // 合并更新
    const updatedGroup: KeywordGroup = {
      ...group,
      ...updates,
      id: group.id,  // 保持ID不变
      createdAt: group.createdAt, // 保持创建时间
      updatedAt: Date.now()
    };

    this.groups.set(groupId, updatedGroup);
    console.log(`[KeywordGroupManager] 分组已更新: ${updatedGroup.name}`);
    return true;
  }

  /**
   * 获取一个分组
   */
  getGroup(groupId: string): KeywordGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * 获取所有分组
   */
  getAllGroups(): KeywordGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * 根据关键词查询所属分组
   */
  queryKeyword(keyword: string): KeywordGroupQueryResult {
    const groupId = this.keywordToGroupMap.get(keyword);

    if (groupId) {
      const group = this.groups.get(groupId);
      if (group) {
        return {
          word: keyword,
          groupId,
          group,
          matchType: 'exact'
        };
      }
    }

    // 尝试部分匹配（如果关键词是某个分组关键词的子字符串）
    for (const [storedKeyword, gId] of this.keywordToGroupMap) {
      if (storedKeyword.includes(keyword) || keyword.includes(storedKeyword)) {
        const group = this.groups.get(gId);
        if (group) {
          return {
            word: keyword,
            groupId: gId,
            group,
            matchType: 'partial'
          };
        }
      }
    }

    // 未找到匹配
    return {
      word: keyword,
      matchType: 'none'
    };
  }

  /**
   * 批量查询多个关键词
   */
  queryKeywords(keywords: string[]): KeywordGroupQueryResult[] {
    return keywords.map(keyword => this.queryKeyword(keyword));
  }

  /**
   * 向现有分组添加关键词
   */
  addKeywordToGroup(groupId: string, keyword: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.warn(`[KeywordGroupManager] 分组不存在: ${groupId}`);
      return false;
    }

    // 检查关键词是否已存在
    if (group.keywords.includes(keyword)) {
      console.warn(`[KeywordGroupManager] 关键词已存在于分组中: ${keyword}`);
      return false;
    }

    // 检查关键词是否已在其他分组中
    if (this.keywordToGroupMap.has(keyword)) {
      const existingGroupId = this.keywordToGroupMap.get(keyword);
      console.warn(`[KeywordGroupManager] 关键词已存在于其他分组中: ${keyword} (${existingGroupId})`);
      return false;
    }

    // 添加关键词
    group.keywords.push(keyword);
    this.keywordToGroupMap.set(keyword, groupId);
    group.updatedAt = Date.now();

    console.log(`[KeywordGroupManager] 关键词已添加到分组: ${keyword} -> ${group.name}`);
    return true;
  }

  /**
   * 从分组中移除关键词
   */
  removeKeywordFromGroup(groupId: string, keyword: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.warn(`[KeywordGroupManager] 分组不存在: ${groupId}`);
      return false;
    }

    const index = group.keywords.indexOf(keyword);
    if (index === -1) {
      console.warn(`[KeywordGroupManager] 关键词不在该分组中: ${keyword}`);
      return false;
    }

    group.keywords.splice(index, 1);
    this.keywordToGroupMap.delete(keyword);
    group.updatedAt = Date.now();

    console.log(`[KeywordGroupManager] 关键词已从分组中移除: ${keyword}`);
    return true;
  }

  /**
   * 获取关键词的特效配置
   */
  getEffectConfigForKeyword(keyword: string): EffectConfig | undefined {
    const result = this.queryKeyword(keyword);
    if (result.group) {
      return result.group.effectConfig;
    }
    return undefined;
  }

  /**
   * 获取关键词的样式配置
   */
  getStyleConfigForKeyword(keyword: string): KeywordStyle | undefined {
    const result = this.queryKeyword(keyword);
    if (result.group) {
      return result.group.styleConfig;
    }
    return undefined;
  }

  /**
   * 清除所有分组（主要用于测试）
   */
  clear(): void {
    this.groups.clear();
    this.keywordToGroupMap.clear();
    console.log(`[KeywordGroupManager] 所有分组已清除`);
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalGroups: number;
    totalKeywords: number;
    groupDetails: Array<{ name: string; keywordCount: number }>;
  } {
    return {
      totalGroups: this.groups.size,
      totalKeywords: this.keywordToGroupMap.size,
      groupDetails: this.getAllGroups().map(group => ({
        name: group.name,
        keywordCount: group.keywords.length
      }))
    };
  }
}

/**
 * 导出单例实例
 */
export const keywordGroupManager = new KeywordGroupManager();
