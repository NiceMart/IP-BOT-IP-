/**
 * 音效系统模块入口
 */

import { initSoundEffectDb, initBuiltinSoundEffects } from './main';

/**
 * 初始化音效系统
 * @param dbInstance 数据库实例
 */
async function init(dbInstance: any) {
  // 初始化数据库连接
  initSoundEffectDb(dbInstance);

  // 初始化系统内置音效
  await initBuiltinSoundEffects();
}

export default {
  init
};
