// @ts-nocheck
/**
 * 瀛楀箷鐢熸垚涓绘湇鍔?
 * 鏁村悎鎵€鏈夊姛鑳斤紝鎻愪緵瀹屾暣鐨勫瓧骞曠敓鎴愭祦绋?
 */

import { LevenshteinMatcher } from '@/lib/algorithms/Levenshtein';
import { ASSGenerator } from '@/lib/subtitle/ASSGenerator';
import { DrawtextGenerator, DrawtextEffectPresets } from '@/lib/subtitle/DrawtextGenerator';
import { SmartLayoutManager } from '@/lib/subtitle/SmartLayoutManager';
import { SoundEffectGenerator } from '@/service/SoundEffectGenerator';
import type {
  ZimuConfig,
  CorrectedSegment,
  KeywordMatch,
  ArrangedSubtitle,
  LayoutConstraints,
  SubtitleLine,
  SubtitleFrame,
  FFmpegCommand,
  GenerationResult,
  GenerationStatistics,
  ASSStyleConfig,
  ASSDialogueEvent
} from '@/service/ZimuShengcheng.types';
import type { EffectType } from '@/types/smartSubtitle';

export class ZimuShengcheng {
  private config: ZimuConfig;
  private correctedSegments: CorrectedSegment[] = [];
  private keywordMatches: KeywordMatch[] = [];
  private arrangedSubtitles: ArrangedSubtitle[] = [];
  private statistics: GenerationStatistics;

  constructor() {
    this.statistics = {
      totalSegments: 0,
      correctedCount: 0,
      keywordCount: 0,
      normalSubtitles: 0,
      effectSubtitles: 0,
      renderTime: 0,
      processingTime: 0
    };
  }

  /**
   * 涓绘柟娉曪細鐢熸垚瀛楀箷
   * @param config 瀛楀箷鐢熸垚閰嶇疆
   * @returns 鐢熸垚缁撴灉
   */
  async generate(config: ZimuConfig): Promise<GenerationResult> {
    const startTime = Date.now();

    try {
      config.funasrSegments = this.normalizeSegmentTimeline(
        this.normalizeFunasrSegmentsToMilliseconds(config.funasrSegments)
      );
      this.config = config;

      console.log('[ZimuShengcheng] 寮€濮嬬敓鎴愬瓧骞?..', {
        videoPath: config.videoPath,
        userText: String(config.userText || '').substring(0, 50) + '...',
        segments: config.funasrSegments.length,
        subtitleStyle: {
          fontName: config.subtitleStyle?.fontName,
          fontSize: config.subtitleStyle?.fontSize,
          fontColor: config.subtitleStyle?.fontColor,
          backgroundColor: config.subtitleStyle?.backgroundColor
        },
        keywordGroupsCount: config.keywordGroups?.length || 0
      });

      // 1. 鏂囨淇
      console.log('[ZimuShengcheng] 姝ラ1: 鏂囨淇...');
      this.correctedSegments = config.skipTextCorrection
        ? config.funasrSegments.map(seg => ({
            text: this.removePunctuation(String(seg?.text || '')),
            originalText: String(seg?.text || ''),
            start: seg.start,
            end: seg.end,
            corrected: false,
            confidence: 1.0,
            charTimings: this.buildCleanedCharTimings(seg)
          }))
        : this.correctText(
            config.userText,
            config.funasrSegments
          );

      // 馃啎 鍏抽敭淇锛氱洿鎺ヤ粠鏁版嵁搴撹幏鍙栨渶鏂扮殑鍏抽敭璇嶅垎缁勬暟鎹紝纭繚璐寸焊閰嶇疆鏄渶鏂扮殑
      try {
        console.log('[ZimuShengcheng] 馃攧 姝ｅ湪浠庢暟鎹簱鑾峰彇鏈€鏂板叧閿瘝鍒嗙粍鏁版嵁...');
        // 鍔ㄦ€佸鍏ヤ互閬垮厤寰幆渚濊禆
        const KeywordGroupService = (await import('./KeywordGroupService')).default;
        const freshGroups = await KeywordGroupService.getAllGroups();

        if (freshGroups && freshGroups.length > 0 && config.keywordGroups) {
          const freshGroupsMap = new Map(freshGroups.map((g: any) => [g.id, g]));

          let updatedCount = 0;
          config.keywordGroups.forEach((group: any) => {
            const freshGroup = freshGroupsMap.get(group.id);
            if (freshGroup) {
              // 浠呮洿鏂拌创绾哥浉鍏崇殑鏍稿績瀛楁锛屼繚鐣欏墠绔紶閫掔殑鍏朵粬鐘舵€?
              if (freshGroup.stickerId) {
                group.stickerId = freshGroup.stickerId;
                group.stickerConfig = freshGroup.stickerConfig;
                updatedCount++;
              }
            }
          });
          console.log(`[ZimuShengcheng] 鉁?宸插悓姝?${updatedCount} 涓垎缁勭殑璐寸焊鏁版嵁`);
        }
      } catch (error) {
        console.warn('[ZimuShengcheng] 鈿狅笍 鏃犳硶浠庢暟鎹簱鍚屾鏈€鏂板垎缁勬暟鎹?', error);
      }

      // 2. 鍏抽敭璇嶅尮閰?
      console.log('[ZimuShengcheng] 姝ラ2: 鍏抽敭璇嶅尮閰?..');
      console.log('[ZimuShengcheng] keywordGroups鍙傛暟:', {
        hasKeywordGroups: !!config.keywordGroups,
        keywordGroupsLength: config.keywordGroups?.length || 0,
        keywordGroups: config.keywordGroups?.map((g: any) => ({
          id: g.id,
          name: g.name,
          keywordsCount: g.keywords?.length || 0,
          effectId: g.effectId,
          stickerId: g.stickerId,  // 馃攳 鍏抽敭锛氭鏌tickerId鏄惁瀛樺湪
          stickerConfig: g.stickerConfig,
          keywords: g.keywords?.slice(0, 3)
        }))
      });
      this.keywordMatches = this.matchKeywords(
        this.correctedSegments,
        config.keywordGroups
      );
      console.log('[ZimuShengcheng] 鍏抽敭璇嶅尮閰嶇粨鏋?', {
        matchesCount: this.keywordMatches.length,
        matches: this.keywordMatches.slice(0, 5).map(m => ({
          keyword: m.keyword,
          effectType: m.effectType,
          isAnimated: m.isAnimated,
          stickerId: (m as any).stickerId,  // 馃攳 鍏抽敭锛氭鏌tickerId鏄惁浼犻€?
          stickerConfig: (m as any).stickerConfig,
          startTime: m.startTime,
          endTime: m.endTime
        }))
      });

      // 3. 鏅鸿兘鎺掑垪
      console.log('[ZimuShengcheng] 姝ラ3: 鏅鸿兘瀛楀箷鎺掑垪...');

      // 馃攳 鍏抽敭璇婃柇锛氭鏌ョ涓€鏉″瓧骞曠殑鏃堕棿鍊?
      if (this.correctedSegments.length > 0) {
        const firstSeg = this.correctedSegments[0];
        console.log('[ZimuShengcheng] 鉁?绗竴鏉orrectedSegment鏃堕棿:', {
          start: firstSeg.start,
          end: firstSeg.end,
          startType: typeof firstSeg.start,
          endType: typeof firstSeg.end,
          text: firstSeg.text.substring(0, 30)
        });
      }

      this.arrangedSubtitles = this.arrangeSubtitles(
        this.correctedSegments,
        this.keywordMatches,
        config
      );
      // 馃攳 鍏抽敭璇婃柇锛氭鏌ョ涓€鏉rrangedSubtitle鐨勬椂闂村€?
      if (this.arrangedSubtitles.length > 0) {
        const firstArranged = this.arrangedSubtitles[0];
        console.log('[ZimuShengcheng] 鉁?绗竴鏉rrangedSubtitle鏃堕棿:', {
          start: firstArranged.start,
          end: firstArranged.end,
          startType: typeof firstArranged.start,
          endType: typeof firstArranged.end,
          type: firstArranged.type,
          text: firstArranged.text.substring(0, 30)
        });
      }

      console.log(`[ZimuShengcheng] 瀛楀箷鎺掑垪瀹屾垚: ${this.arrangedSubtitles.length}鏉?(鏅€?${this.arrangedSubtitles.filter(s => s.type === 'normal').length} 鐗规晥:${this.arrangedSubtitles.filter(s => s.type !== 'normal').length})`);


      // 4. 鐢熸垚ASS鏂囦欢
      console.log('[ZimuShengcheng] 姝ラ4: 鐢熸垚ASS鏂囦欢...');
      const assFiles = await this.generateASSFiles(this.arrangedSubtitles, config);

      // 5. 棰勮В鏋愭墍鏈夊瓧浣撹矾寰勶紙浣跨敤瀛椾綋绠＄悊鍣ˋPI鑾峰彇缁濆璺緞锛?
      console.log('[ZimuShengcheng] 姝ラ5: 棰勮В鏋愬瓧浣撹矾寰?..');
      // 鉁?鏂板锛氬鏋滃惎鐢ㄦ爣棰樺瓧骞曪紝涔熼渶瑕侀瑙ｆ瀽鏍囬瀛楀箷鐨勫瓧浣?
      if (config.titleSubtitleConfig && config.titleSubtitleConfig.enabled && config.titleSubtitleConfig.lines) {
        for (const line of config.titleSubtitleConfig.lines) {
          if (line.fontName) {
            // 鉁?淇锛氬厛妫€鏌ョ紦瀛橈紝濡傛灉鏈夊氨鐩存帴浣跨敤锛屽惁鍒欒В鏋?
            if (this.fontPathCache.has(line.fontName)) {
              // 缂撳瓨鍛戒腑锛岀洿鎺ユ洿鏂?fontPath
              const cachedPath = this.fontPathCache.get(line.fontName)!;
              line.fontPath = cachedPath;
              console.log(`[ZimuShengcheng] 鏍囬瀛楀箷瀛椾綋浣跨敤缂撳瓨: ${line.fontName} -> ${cachedPath}`);
            } else {
              console.log(`[ZimuShengcheng] 棰勮В鏋愭爣棰樺瓧骞曞瓧浣? ${line.fontName}`);
              // 浣跨敤瀛椾綋绠＄悊鍣ˋPI瑙ｆ瀽瀛椾綋璺緞
              try {
                if (typeof window !== 'undefined' && window.$mapi?.fontManager?.findFontPath) {
                  const result = await window.$mapi.fontManager.findFontPath(line.fontName, 400);
                  if (result && result.success && result.data) {
                    const safeFontPath = await this.copyFontToSafePath(result.data, line.fontName);
                    this.fontPathCache.set(line.fontName, safeFontPath);
                    // 鉁?鏇存柊閰嶇疆涓殑瀛椾綋璺緞
                    line.fontPath = safeFontPath;
                    console.log(`[ZimuShengcheng] 鏍囬瀛楀箷瀛椾綋瑙ｆ瀽鎴愬姛: ${line.fontName} -> ${safeFontPath}`);
                  }
                }
              } catch (error) {
                console.warn(`[ZimuShengcheng] 鏍囬瀛楀箷瀛椾綋瑙ｆ瀽澶辫触: ${line.fontName}`, error);
                // 浣跨敤鍥為€€鏂规
                const fallbackPath = this.resolveFontPathSync(line.fontName);
                this.fontPathCache.set(line.fontName, fallbackPath);
                line.fontPath = fallbackPath;
              }
            }
          }
        }
      }
      await this.preResolveFontPaths(this.arrangedSubtitles);

      // 6. 鐢熸垚drawtext鍛戒护
      console.log('[ZimuShengcheng] 姝ラ6: 鐢熸垚drawtext鍛戒护...');
      const drawtextCommands = this.generateDrawtextCommands(
        this.arrangedSubtitles,
        config.fontDir
      );
      console.log('[ZimuShengcheng] drawtext鍛戒护鐢熸垚瀹屾垚:', {
        commandCount: drawtextCommands.length,
        arrangedSubtitlesCount: this.arrangedSubtitles.length,
        normalCount: this.arrangedSubtitles.filter(s => s.type === 'normal').length,
        effectCount: this.arrangedSubtitles.filter(s => s.type !== 'normal').length
      });

      // 馃啎 姝ラ 6.2: 鏀堕泦璐寸焊绱犳潗
      console.log('[ZimuShengcheng] 姝ラ6.2: 鏀堕泦璐寸焊绱犳潗...');

      // 鑾峰彇璧勬簮璺緞
      const path = await import('path');
      let resourcesPath = path.join(process.cwd(), 'electron/resources/extra');

      try {
        // @ts-ignore
        if (window.$mapi && window.$mapi.app && window.$mapi.app.getResourcesPath) {
          // @ts-ignore
          resourcesPath = await window.$mapi.app.getResourcesPath();
          console.log(`[ZimuShengcheng] 鉁?璧勬簮璺緞: ${resourcesPath}`);
        } else {
          console.log(`[ZimuShengcheng] 鈩癸笍 浣跨敤 fallback 璧勬簮璺緞: ${resourcesPath}`);
        }
      } catch (e) {
        console.warn(`[ZimuShengcheng] 鈿狅笍 鑾峰彇璧勬簮璺緞澶辫触锛屼娇鐢?fallback: ${resourcesPath}`, e);
      }

      const stickerAssets = this.collectStickerAssets(this.arrangedSubtitles, resourcesPath);
      console.log('[ZimuShengcheng] 璐寸焊绱犳潗鏀堕泦缁撴灉:', {
        count: stickerAssets.length,
        assets: stickerAssets.map(a => ({
          path: a.path,
          instancesCount: a.instances.length,
          instances: a.instances
        }))
      });
      console.log('[ZimuShengcheng] 璐寸焊绱犳潗鏀堕泦瀹屾垚:', {
        uniqueStickers: stickerAssets.length,
        details: stickerAssets.map(s => ({ path: s.path, count: s.instances.length }))
      });

      // 馃啎 姝ラ 6.5: 鐢熸垚闊虫晥锛堝鏋滃惎鐢級
      let soundAudioFilters: string[] = [];
      let soundInstances: any[] = [];

      if (config.soundEffectSettings?.enabled) {
        console.log('[ZimuShengcheng] 姝ラ6.5: 鐢熸垚闊虫晥...');
        try {
          // 楠岃瘉闊虫晥閰嶇疆
          const validation = SoundEffectGenerator.validateSoundConfig(config.keywordGroups);
          if (!validation.valid) {
            console.warn('[ZimuShengcheng] 闊虫晥閰嶇疆楠岃瘉澶辫触:', validation.errors);
          }

          // 鐢熸垚闊虫晥
          const soundResult = await SoundEffectGenerator.generateSoundTrack(
            this.arrangedSubtitles,
            this.keywordMatches,
            config.keywordGroups
          );

          soundAudioFilters = soundResult.ffmpegAudioFilters;
          soundInstances = soundResult.soundInstances;

          console.log('[ZimuShengcheng] 闊虫晥鐢熸垚瀹屾垚:', {
            soundInstancesCount: soundInstances.length,
            audioFiltersCount: soundAudioFilters.length
          });
        } catch (error) {
          console.warn('[ZimuShengcheng] 闊虫晥鐢熸垚澶辫触锛岀户缁鐞嗚棰戯紙涓嶅惈闊虫晥锛?', error);
          // 闊虫晥鐢熸垚澶辫触涓嶄腑鏂祦绋?
        }
      }

      // 6.5 鐢熸垚鏍囬瀛楀箷drawtext鍛戒护锛堝鏋滃惎鐢級
      let titleDrawtextCommands: string[] = [];
      if (config.titleSubtitleConfig && config.titleSubtitleConfig.enabled) {
        console.log('[ZimuShengcheng] 姝ラ6.5: 鐢熸垚鏍囬瀛楀箷...');
        try {
          titleDrawtextCommands = DrawtextGenerator.generateTitleSubtitle(
            config.titleSubtitleConfig,
            config.videoWidth,
            config.videoHeight,
            this.normalizeMillisecondsToSeconds(config.videoDuration || 0)
          );
          console.log('[ZimuShengcheng] 鏍囬瀛楀箷鐢熸垚瀹屾垚锛屽懡浠ゆ暟:', titleDrawtextCommands.length);
        } catch (error) {
          console.error('[ZimuShengcheng] 鏍囬瀛楀箷鐢熸垚澶辫触:', error);
          // 鏍囬瀛楀箷鐢熸垚澶辫触涓嶄腑鏂祦绋?
        }
      }

      // 7. 鏋勫缓FFmpeg鍛戒护锛堢函drawtext鏂规锛氫笉鍐嶄娇鐢ˋSS鏂囦欢锛?
      console.log('[ZimuShengcheng] 姝ラ7: 鏋勫缓FFmpeg鍛戒护锛堢函drawtext鏂规锛?..');

      // 鉁?鍚堝苟鏍囬瀛楀箷鍜屾櫘閫氬瓧骞曠殑drawtext鍛戒护
      // 鏍囬瀛楀箷浼樺厛娓叉煋锛堜綔涓哄簳灞傦級锛岀劧鍚庢槸鏅€氬瓧骞?鐗规晥瀛楀箷锛堜綔涓轰笂灞傦級
      const combinedDrawtextCommands = [
        ...titleDrawtextCommands,  // 鏍囬瀛楀箷鍏堟坊鍔?
        ...drawtextCommands         // 鏅€?鐗规晥瀛楀箷鍚庢坊鍔?
      ];

      // 銆愯皟璇曘€戣緭鍑?drawtextCommands 璇︽儏
      console.log('[ZimuShengcheng] 鍚堝苟鍚庣殑 drawtextCommands 鏁伴噺:', combinedDrawtextCommands.length);
      console.log('[ZimuShengcheng] 鍏朵腑鏍囬瀛楀箷:', titleDrawtextCommands.length, '鏅€氬瓧骞?', drawtextCommands.length);
      combinedDrawtextCommands.forEach((cmd, i) => {
        console.log(`[ZimuShengcheng] drawtextCommand[${i}]:`, cmd.substring(0, 200) + (cmd.length > 200 ? '...' : ''));
      });

      // 馃啎 鏂板锛氫紶閫掗煶鏁堝疄渚嬬敤浜庨煶棰戞贩闊?
      const ffmpegCmd = this.buildFFmpegCommand(
        config.videoPath,
        config.outputPath,
        [], // 銆愮函drawtext鏂规銆戜笉鍐嶄紶閫扐SS鏂囦欢
        combinedDrawtextCommands,  // 鉁?浣跨敤鍚堝苟鍚庣殑鍛戒护
        config.fontDir,
        soundInstances,  // 闊虫晥瀹炰緥
        stickerAssets    // 馃啎 璐寸焊绱犳潗
      );

      // 8. 鎵ц娓叉煋
      console.log('[ZimuShengcheng] 姝ラ8: 鎵цFFmpeg娓叉煋...');
      const renderStartTime = Date.now();
      await this.executeFFmpeg(ffmpegCmd);
      this.statistics.renderTime = (Date.now() - renderStartTime) / 1000;

      // 9. 鐢熸垚璋冭瘯鏂囦欢锛堝寘鍚墍鏈夊瓧骞曡缁嗕俊鎭級
      console.log('[ZimuShengcheng] 姝ラ9: 鐢熸垚璋冭瘯鏂囦欢...');
      const debugPath = await this.generateDebugFile(this.arrangedSubtitles, drawtextCommands, config);

      // 10. 鐢熸垚SRT鏂囦欢锛堢敤浜庡睍绀哄拰涓嬭浇锛?
      console.log('[ZimuShengcheng] 姝ラ10: 鐢熸垚SRT鏂囦欢...');
      const srtPath = await this.generateSRTFile(this.correctedSegments, config);

      // 11. 缁熻淇℃伅
      this.statistics.totalSegments = this.correctedSegments.length;
      this.statistics.correctedCount = this.correctedSegments.filter(s => s.corrected).length;
      this.statistics.keywordCount = this.keywordMatches.length;
      this.statistics.normalSubtitles = this.arrangedSubtitles.filter(s => s.type === 'normal').length;
      this.statistics.effectSubtitles = this.arrangedSubtitles.filter(s => s.type !== 'normal').length;
      this.statistics.processingTime = (Date.now() - startTime) / 1000;

      console.log('[ZimuShengcheng] 字幕生成完成:', this.statistics);

      // 馃啎 鐢讳腑鐢诲鐞嗭細鍦ㄥ瓧骞曠敓鎴愬畬鎴愬悗搴旂敤鐢讳腑鐢绘晥鏋?
      let finalOutputPath = config.outputPath;
      if (config.videoMixCutSettings?.enabled) {
          try {
              console.log('[ZimuShengcheng] 寮€濮嬪簲鐢ㄧ敾涓敾鏁堟灉...');
              const { FixedModeProcessor, KeywordModeProcessor, SubtitleModeProcessor, FFmpegCommandBuilder } =
                  await import('../lib/mixCutVideo');

              let replacements: any[] = [];
              const mixCutConfig = config.videoMixCutSettings;

              // 鏍规嵁妯″紡澶勭悊
              if (mixCutConfig.mode === 'fixed' && mixCutConfig.fixedModeConfig) {
                  console.log('[ZimuShengcheng] 使用固定模式处理画中画');
                  replacements = FixedModeProcessor.process(
                      mixCutConfig.fixedModeConfig,
                      config.videoDuration || 0
                  );
              } else if (mixCutConfig.mode === 'keyword' && mixCutConfig.keywordModeConfig) {
                  console.log('[ZimuShengcheng] 浣跨敤鍏抽敭璇嶆ā寮忓鐞嗙敾涓敾');
                  // 鍏抽敭璇嶆ā寮忛渶瑕佸瓧骞曡褰曪紝杩欓噷鏆備笉鏀寔
                  console.warn('[ZimuShengcheng] 关键词模式暂不支持');
              } else if (mixCutConfig.mode === 'subtitle' && mixCutConfig.subtitleModeConfig) {
                  console.log('[ZimuShengcheng] 使用字幕模式处理画中画');
                  // 瀛楀箷妯″紡闇€瑕佸瓧骞曡褰曪紝杩欓噷鏆備笉鏀寔
                  console.warn('[ZimuShengcheng] 瀛楀箷妯″紡鏆備笉鏀寔');
              }

              if (replacements.length > 0) {
                  console.log('[ZimuShengcheng] 生成画中画片段:', replacements.length);
                  const mixCutOutputPath = config.outputPath.replace(/\.mp4$/, '_mixcut.mp4');

                  const ffmpegCmd = FFmpegCommandBuilder.buildOverlayCommand(
                      config.outputPath,  // 杈撳叆锛氬甫瀛楀箷鐨勮棰?
                      replacements,       // 鐢讳腑鐢荤墖娈甸厤缃?
                      mixCutOutputPath,   // 杈撳嚭锛氬甫瀛楀箷+鐢讳腑鐢荤殑瑙嗛
                      { width: config.videoWidth, height: config.videoHeight }
                  );

                  console.log('[ZimuShengcheng] 鎵ц鐢讳腑鐢籉Fmpeg鍛戒护...');
                  await this.executeFFmpeg(ffmpegCmd);

                  finalOutputPath = mixCutOutputPath;
                  console.log('[ZimuShengcheng] 鉁?鐢讳腑鐢诲鐞嗗畬鎴?', finalOutputPath);
              } else {
                  console.log('[ZimuShengcheng] 娌℃湁鐢熸垚鐢讳腑鐢荤墖娈碉紝璺宠繃澶勭悊');
              }
          } catch (error: any) {
              console.error('[ZimuShengcheng] 鉂?鐢讳腑鐢诲鐞嗗け璐?', error);
              // 涓嶆姏鍑洪敊璇紝缁х画杩斿洖鍘熻棰?
          }
      }

      try {
        const _u = JSON.parse(localStorage.getItem('auth_user') || '{}');
        window.require('electron').ipcRenderer.invoke('auth:reportGeneration', {
          userId: _u.id,
          type: 'subtitle',
          detail: `字幕生成:${this.statistics?.totalSubtitles || 0}条`
        });
      } catch (e) {}

      return {
        success: true,
        outputPath: finalOutputPath,
        srtPath: srtPath,
        debugPath: debugPath,
        message: '瀛楀箷鐢熸垚鎴愬姛',
        statistics: this.statistics
      };

    } catch (error: any) {
      console.error('[ZimuShengcheng] 瀛楀箷鐢熸垚澶辫触:', error);
      return {
        success: false,
        message: '瀛楀箷鐢熸垚澶辫触: ' + error.message,
        error
      };
    }
  }

  // ==================== 姝ラ1: 鏂囨淇 ====================

  /**
   * 绉婚櫎鏂囨湰涓殑鎵€鏈夋爣鐐圭鍙?
   * 鍖呮嫭涓枃鏍囩偣銆佽嫳鏂囨爣鐐广€佺壒娈婄鍙风瓑
   * @private
   */
  private removePunctuation(text: string): string {
    if (!text) return '';

    // 涓枃鏍囩偣绗﹀彿锛氾紝銆傦紒锛燂紱锛氥€侊紙锛夈€屻€嶃€庛€忋€愩€戙€娿€嬧€︹€斅?"
    // 鑻辨枃鏍囩偣绗﹀彿锛?.!?;:()[]{}""''''
    // 鍏朵粬绗﹀彿锛欯#$%^&*-_+=|\<>~`
    const punctuationRegex = /[锛屻€傦紒锛燂紱锛氥€侊紙锛夈€屻€嶃€庛€忋€愩€戙€娿€嬧€︹€斅?"锛屻€傦紒锛燂紱锛氥€侊紙锛夈€屻€嶃€庛€忋€愩€戙€娿€嬧€︹€斅?.\\!?;:\\(\\)\\[\\]\\{\\}\"'"'"@#$%^&*\\-_+=|\\\\<>~`]/g;

    const cleaned = text.replace(punctuationRegex, ' ').replace(/\s+/g, ' ').trim();

    // console.log(`[ZimuShengcheng.removePunctuation] 绉婚櫎鏍囩偣绗﹀彿: "${text}" -> "${cleaned}"`);

    return cleaned;
  }

  /**
   * 淇ASR璇嗗埆缁撴灉锛屾浛鎹负鐢ㄦ埛杈撳叆鐨勬纭枃妗?
   * @private
   */
  private correctText(
    userText: string,
    asrSegments: any[]
  ): CorrectedSegment[] {
    if (!userText || userText.trim() === '') {
      // 濡傛灉鐢ㄦ埛娌℃湁杈撳叆鏂囨锛岀洿鎺ヤ娇鐢ˋSR缁撴灉
      return asrSegments.map(seg => ({
        text: this.removePunctuation(seg.text),
        originalText: seg.text,
        start: seg.start,
        end: seg.end,
        corrected: false,
        confidence: 1.0,
        charTimings: this.buildCleanedCharTimings(seg)
      }));
    }

    // 浣跨敤Levenshtein绠楁硶淇
    // 使用Levenshtein算法修正
    const correctedSegments = LevenshteinMatcher.correctText(userText, asrSegments);
    const cleanedCorrectedSegments = correctedSegments.map(seg => ({
      ...seg,
      text: this.removePunctuation(seg.text)
    }));

    const validOriginalSegments = asrSegments.filter(seg => {
      const cleanedText = this.removePunctuation(String(seg?.text || ''));
      return cleanedText.trim().length > 0;
    });

    if (validOriginalSegments.length > 1 && cleanedCorrectedSegments.length <= 1) {
      console.warn('[ZimuShengcheng] Levenshtein correction collapsed subtitle segments, fallback to original segmentation', {
        originalCount: validOriginalSegments.length,
        correctedCount: cleanedCorrectedSegments.length,
      });

      return validOriginalSegments.map(seg => ({
        text: this.removePunctuation(String(seg.text || '')),
        originalText: seg.text,
        start: seg.start,
        end: seg.end,
        corrected: false,
        confidence: 1.0,
        charTimings: this.buildCleanedCharTimings(seg)
      }));
    }

    return cleanedCorrectedSegments;
  }

  private normalizeMillisecondsToSeconds(timeValue: number): number {
    if (!Number.isFinite(timeValue) || timeValue <= 0) {
      return 0;
    }

    return timeValue > 1000 ? timeValue / 1000 : timeValue;
  }

  private normalizeFunasrSegmentsToMilliseconds(segments: any[] = []): any[] {
    if (!Array.isArray(segments) || segments.length === 0) {
      return [];
    }

    if (!this.shouldTreatTimelineAsSeconds(segments)) {
      return segments;
    }

    console.log('[ZimuShengcheng] 检测到秒级时间轴，统一转换为毫秒');
    return segments.map((segment: any) => ({
      ...segment,
      start: Number(segment.start || 0) * 1000,
      end: Number(segment.end || 0) * 1000,
      words: Array.isArray(segment.words)
        ? segment.words.map((word: any) => ({
            ...word,
            start: Number(word.start || 0) * 1000,
            end: Number(word.end || 0) * 1000
          }))
        : segment.words,
      timestamp: Array.isArray(segment.timestamp)
        ? segment.timestamp.map((pair: any) => Array.isArray(pair) && pair.length >= 2
            ? [Number(pair[0] || 0) * 1000, Number(pair[1] || 0) * 1000]
            : pair)
        : segment.timestamp
    }));
  }

  private shouldTreatTimelineAsSeconds(segments: any[]): boolean {
    const validSegments = segments.filter((segment: any) =>
      Number.isFinite(Number(segment?.start)) && Number.isFinite(Number(segment?.end))
    );
    if (validSegments.length === 0) {
      return false;
    }

    const maxEnd = Math.max(...validSegments.map((segment: any) => Number(segment.end)));
    const maxDuration = Math.max(...validSegments.map((segment: any) => Number(segment.end) - Number(segment.start)));

    // 只用时间范围判断是否为秒级时间轴。
    // 前端按比例切段后会产生“毫秒但带小数”的合法数据，不能再用小数作为秒级依据。
    return maxEnd <= 600 && maxDuration <= 30;
  }

  private normalizeSegmentTimeline<T extends { text?: string; start: number; end: number }>(segments: T[] = []): T[] {
    if (!Array.isArray(segments) || segments.length === 0) {
      return [];
    }

    const duplicateThresholdMs = 1;
    const invalidDurationPaddingMs = 1;

    const sortableSegments = segments
      .map((segment, index) => {
        const text = typeof segment?.text === 'string' ? segment.text : String(segment?.text ?? '');
        const start = Number(segment?.start ?? 0);
        const end = Number(segment?.end ?? 0);

        if (!Number.isFinite(start) || !Number.isFinite(end)) {
          return null;
        }

        return {
          index,
          segment: {
            ...segment,
            text,
            start: Math.max(0, start),
            end: Math.max(0, end)
          } as T
        };
      })
      .filter((item): item is { index: number; segment: T } => Boolean(item))
      .filter(({ segment }) => segment.text.trim().length > 0)
      .sort((a, b) => {
        if (a.segment.start !== b.segment.start) {
          return a.segment.start - b.segment.start;
        }
        if (a.segment.end !== b.segment.end) {
          return a.segment.end - b.segment.end;
        }
        return a.index - b.index;
      });

    const normalized: T[] = [];
    const removedEmpty = segments.length - sortableSegments.length;
    let mergedDuplicates = 0;
    let fixedInvalidDurations = 0;

    for (const { segment } of sortableSegments) {
      const normalizedStart = Math.max(0, segment.start);
      const normalizedEnd = segment.end > normalizedStart
        ? segment.end
        : normalizedStart + invalidDurationPaddingMs;
      const current = {
        ...segment,
        start: normalizedStart,
        end: normalizedEnd
      } as T;
      if (normalizedEnd !== segment.end) {
        fixedInvalidDurations += 1;
      }
      const previous = normalized[normalized.length - 1];

      if (previous) {
        const isNearDuplicate =
          previous.text.trim() === current.text.trim() &&
          Math.abs(previous.start - current.start) <= duplicateThresholdMs &&
          Math.abs(previous.end - current.end) <= duplicateThresholdMs;

        if (isNearDuplicate) {
          previous.end = Math.max(previous.end, current.end);
          mergedDuplicates += 1;
          continue;
        }

      }

      normalized.push(current);
    }

    if (removedEmpty > 0 || mergedDuplicates > 0 || fixedInvalidDurations > 0) {
      console.log('[ZimuShengcheng] 时间轴校验完成:', {
        before: segments.length,
        after: normalized.length,
        removedEmpty,
        mergedDuplicates,
        fixedInvalidDurations
      });
    }

    return normalized;
  }
  private normalizeArrangedNormalSubtitles(subtitles: ArrangedSubtitle[] = []): ArrangedSubtitle[] {
    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      return [];
    }

    const duplicateThresholdMs = 1;
    const invalidDurationPaddingMs = 1;
    const sorted = [...subtitles].sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      if (a.end !== b.end) {
        return a.end - b.end;
      }
      return a.text.localeCompare(b.text);
    });

    const normalized: ArrangedSubtitle[] = [];
    let mergedDuplicates = 0;
    let fixedInvalidDurations = 0;

    for (const subtitle of sorted) {
      const normalizedStart = Math.max(0, subtitle.start);
      const normalizedEnd = subtitle.end > normalizedStart
        ? subtitle.end
        : normalizedStart + invalidDurationPaddingMs;
      const current: ArrangedSubtitle = {
        ...subtitle,
        start: normalizedStart,
        end: normalizedEnd
      };
      if (normalizedEnd !== subtitle.end) {
        fixedInvalidDurations += 1;
      }
      const previous = normalized[normalized.length - 1];

      if (previous) {
        const isNearDuplicate =
          previous.text.trim() === current.text.trim() &&
          Math.abs(previous.start - current.start) <= duplicateThresholdMs &&
          Math.abs(previous.end - current.end) <= duplicateThresholdMs;

        if (isNearDuplicate) {
          previous.end = Math.max(previous.end, current.end);
          mergedDuplicates += 1;
          continue;
        }

      }

      normalized.push(current);
    }

    if (mergedDuplicates > 0 || fixedInvalidDurations > 0) {
      console.log('[ZimuShengcheng] 普通字幕输出时间轴校验完成:', {
        before: subtitles.length,
        after: normalized.length,
        mergedDuplicates,
        fixedInvalidDurations
      });
    }

    return normalized;
  }
  private buildSegmentCharTimings(segment: any): Array<{ start: number; end: number }> {
    const text = String(segment?.text || '');
    if (!text) {
      return [];
    }

    const segmentStart = Number(segment?.start || 0);
    const segmentEnd = Number(segment?.end || 0);
    const fallbackDuration = (segmentEnd - segmentStart) / Math.max(text.length, 1);
    const fallbackTimings = Array.from({ length: text.length }, (_, index) => ({
      start: segmentStart + index * fallbackDuration,
      end: segmentStart + (index + 1) * fallbackDuration
    }));

    const words = Array.isArray(segment?.words) ? segment.words : [];
    if (words.length === 0) {
      return fallbackTimings;
    }

    const preciseTimings: Array<{ start: number; end: number } | null> = Array(text.length).fill(null);
    let searchStart = 0;

    for (const word of words) {
      const wordText = String(word?.word ?? word?.text ?? '');
      const wordStart = Number(word?.start);
      const wordEnd = Number(word?.end);
      if (!wordText || !Number.isFinite(wordStart) || !Number.isFinite(wordEnd) || wordEnd <= wordStart) {
        continue;
      }

      const wordIndex = text.indexOf(wordText, searchStart);
      if (wordIndex === -1) {
        continue;
      }

      const wordCharDuration = (wordEnd - wordStart) / Math.max(wordText.length, 1);
      for (let i = 0; i < wordText.length && wordIndex + i < preciseTimings.length; i++) {
        preciseTimings[wordIndex + i] = {
          start: wordStart + i * wordCharDuration,
          end: wordStart + (i + 1) * wordCharDuration
        };
      }

      searchStart = wordIndex + wordText.length;
    }

    return preciseTimings.map((timing, index) => timing || fallbackTimings[index]);
  }

  private buildCleanedCharTimings(segment: any): Array<{ start: number; end: number }> {
    const text = String(segment?.text || '');
    const rawCharTimings = this.buildSegmentCharTimings(segment);
    const cleanedTimings: Array<{ start: number; end: number }> = [];

    for (let i = 0; i < text.length; i++) {
      if (this.removePunctuation(text[i])) {
        cleanedTimings.push(rawCharTimings[i]);
      }
    }

    return cleanedTimings;
  }

  private getSegmentRangeTiming(
    segment: CorrectedSegment,
    startIndex: number,
    endIndex: number
  ): { start: number; end: number } {
    const safeStartIndex = Math.max(0, Math.min(startIndex, segment.text.length));
    const safeEndIndex = Math.max(safeStartIndex, Math.min(endIndex, segment.text.length));

    if (Array.isArray(segment.charTimings) && segment.charTimings.length >= safeEndIndex && safeEndIndex > safeStartIndex) {
      return {
        start: segment.charTimings[safeStartIndex].start,
        end: segment.charTimings[safeEndIndex - 1].end
      };
    }

    const charDuration = (segment.end - segment.start) / Math.max(segment.text.length, 1);
    return {
      start: segment.start + safeStartIndex * charDuration,
      end: segment.start + safeEndIndex * charDuration
    };
  }

  // ==================== 姝ラ2: 鍏抽敭璇嶅尮閰?====================

  /**
   * 鍖归厤鍏抽敭璇嶏紝鎵惧嚭鍝簺鏂囧瓧闇€瑕佸簲鐢ㄧ壒鏁?
   * @private
   */
  private matchKeywords(
    segments: CorrectedSegment[],
    keywordGroups: any[]
  ): KeywordMatch[] {
    const matches: KeywordMatch[] = [];

    // 馃敡 淇锛氫娇鐢?Set 杩借釜宸插尮閰嶇殑鍏抽敭璇嶏紝闃叉閲嶅
    const matchedPositions = new Set<string>();

    if (!keywordGroups || keywordGroups.length === 0) {
      return matches;
    }

    console.log('[ZimuShengcheng.matchKeywords] 馃攳 寮€濮嬪尮閰嶅叧閿瘝:', {
      keywordGroupsCount: keywordGroups.length,
      segmentsCount: segments.length
    });

    // 馃攳 璋冭瘯锛氭鏌ユ瘡涓垎缁勭殑璐寸焊閰嶇疆
    keywordGroups.forEach((group, idx) => {
      console.log(`[ZimuShengcheng.matchKeywords] 鍒嗙粍 #${idx} "${group.name}" 璐寸焊閰嶇疆:`, {
        stickerId: group.stickerId,
        hasStickerConfig: !!group.stickerConfig,
        rawGroup: group
      });
    });

    for (const segment of segments) {
      const text = segment.text;
      let index = 0;

      for (const group of keywordGroups) {
        if (!group.keywords || group.keywords.length === 0) continue;

        for (const kwObj of group.keywords) {
          const keyword = typeof kwObj === 'string' ? kwObj : kwObj.keyword;
          if (!keyword) continue;

          // 娓呯悊鍏抽敭璇嶄腑鐨勬爣鐐圭鍙凤紝纭繚涓庡凡娓呯悊鐨勬枃鏈浉鍖归厤
          const cleanedKeyword = this.removePunctuation(keyword);
          if (!cleanedKeyword) continue; // 濡傛灉娓呯悊鍚庝负绌猴紝璺宠繃

          // 鏌ユ壘鍏抽敭璇嶅湪鏂囨湰涓殑绗竴涓綅缃紙鍙尮閰嶄竴娆★級
          let pos = text.indexOf(cleanedKeyword, index);
          if (pos !== -1) {
            // 馃敡 鍒涘缓鍞竴鐨勪綅缃甼ey锛岀敤浜庡幓閲?
            const positionKey = `${segment.start.toFixed(3)}-${segment.end.toFixed(3)}-${cleanedKeyword}-${pos}`;

            // 濡傛灉璇ヤ綅缃殑鍏抽敭璇嶅凡缁忚鍖归厤杩囷紝璺宠繃锛堝彧淇濈暀绗竴涓垎缁勭殑鍖归厤锛?
            if (matchedPositions.has(positionKey)) {
              console.log(`[ZimuShengcheng.matchKeywords] 跳过重复关键词匹配: "${keyword}" @ ${pos}`);
              continue;
            }

            matchedPositions.add(positionKey);
            console.log(`[ZimuShengcheng.matchKeywords] 匹配关键词: "${cleanedKeyword}"`);

            // 馃敡 浼樺厛妫€鏌ュ崟涓叧閿瘝椤圭洰鐨勭壒鏁堬紝濡傛灉娌℃湁鍒欎娇鐢ㄥ垎缁勭骇鍒殑鐗规晥
            const keywordItem = typeof kwObj === 'string' ? null : kwObj;

            // 浼樺厛绾э細鍗曚釜鍏抽敭璇嶉」鐩壒鏁?> 鍒嗙粍绾у埆鐗规晥 > 榛樿鐗规晥
            let rawEffectId = keywordItem?.effectId || group.effectId || group.effectConfig?.type || 'pulse-scale';

            // 銆愯皟璇曟棩蹇椼€戞樉绀哄摢涓骇鍒殑鐗规晥琚娇鐢?
            if (keywordItem?.effectId) {
              console.log('[ZimuShengcheng] 使用关键词级特效:', {
                keyword,
                effectId: keywordItem.effectId,
                source: 'keyword-item'
              });
            } else if (group.effectId) {
              console.log('[ZimuShengcheng] 使用分组级特效:', {
                keyword,
                effectId: group.effectId,
                source: 'group'
              });
            }

            const effectType = this.normalizeEffectType(rawEffectId);

            // 鍒ゆ柇鏄惁涓哄甫鍔ㄧ敾鐨勭壒鏁?
            const isAnimated = this.isAnimatedEffect(effectType);

            // 銆愯皟璇曟棩蹇椼€戣褰昬ffectId杞崲鍜屽姩鐢诲垽鏂?
            if (rawEffectId || group.effectId) {
              console.log('[ZimuShengcheng] 关键词特效类型:', {
                keyword,
                rawEffectId,
                normalizedEffectType: effectType,
                isAnimated,
                groupId: group.id,
                groupName: group.name
              });
            }

            // 鏋勫缓鏍峰紡锛氫紭鍏堜娇鐢ㄥ崟涓叧閿瘝椤圭洰鐨勬牱寮忥紝鍏舵浣跨敤鍒嗙粍鏍峰紡
            const style = keywordItem?.styleOverride ?
              this.buildKeywordStyleFromConfig(keywordItem.styleOverride) :
              this.buildKeywordStyle(group);

            // 璁＄畻鏃堕棿
            const { start: startTime, end: endTime } = this.getSegmentRangeTiming(
              segment,
              pos,
              pos + cleanedKeyword.length
            );

            // 馃敡 浣跨敤鍗曚釜鍏抽敭璇嶉」鐩殑鐗规晥閰嶇疆锛屽鏋滄病鏈夊垯浣跨敤鍒嗙粍閰嶇疆
            const itemEffectConfig = keywordItem?.effectConfig;
            const groupEffectConfig = group.effectConfig;
            const effectConfig = itemEffectConfig || groupEffectConfig || {
              type: effectType,
              duration: 600,
              delay: 0,
              intensity: 0.8
            };

            // 馃敡 淇锟斤拷锟芥纭鐞?effectDuration 鍗曚綅
            // 纭繚 duration 浠ョ涓哄崟浣嶏紝鐒跺悗杞负姣
            let durationInSeconds = itemEffectConfig?.duration || groupEffectConfig?.duration || this.config.minSubtitleDuration || 2;

            // 濡傛灉 duration 宸茬粡寰堝ぇ锛堣秴杩?00锛夛紝鍋囪瀹冨凡缁忔槸姣锛岃浆鎹㈠洖绉?
            if (durationInSeconds > 100) {
              durationInSeconds = durationInSeconds / 1000;
            }

            // 纭繚鏈€灏忔椂闀夸负 0.1 绉掞紝鏈€澶т负瀛楀箷瀹為檯鏃堕暱鐨?0鍊?
            const minDuration = 0.1;
            const maxDuration = (endTime - startTime) * 10;
            const finalDuration = Math.max(minDuration, Math.min(durationInSeconds, maxDuration));

            const matchData: KeywordMatch = {
              keyword: cleanedKeyword, // 浣跨敤娓呯悊鍚庣殑鍏抽敭璇?
              startIndex: pos,
              endIndex: pos + cleanedKeyword.length,
              startTime,
              endTime,
              groupId: group.id,
              groupName: group.name,
              effectType,
              isAnimated,
              style,
              // 馃敡 瀹屾暣鐨勭壒鏁堥厤缃紙鏉ヨ嚜鍗曚釜璇嶆眹鎴栧垎缁勶級
              effectConfig,
              effectStyle: style,
              effectIntensity: itemEffectConfig?.intensity || groupEffectConfig?.intensity || 0.8,
              // 杞崲涓烘绉掞紙纭繚鍗曚綅涓€鑷达級
              effectDuration: finalDuration * 1000,
              // 馃啎 浼犻€掕创绾搁厤缃?- 浼樺厛浠庨《灞傝鍙栵紙涓庝繚瀛橀€昏緫涓€鑷达級
              stickerId: (group as any).stickerId || group.styleOverride?.stickerId || group.styleConfig?.stickerId,
              stickerConfig: (group as any).stickerConfig || group.styleOverride?.stickerConfig || group.styleConfig?.stickerConfig
            };

            matches.push(matchData);

            console.log('[ZimuShengcheng.matchKeywords] 添加关键词匹配:', {
              originalKeyword: keyword,
              cleanedKeyword,
              effectType,
              hasItemEffect: !!keywordItem?.effectId,
              hasGroupEffect: !!group.effectId,
              startTime,
              endTime
            });

            // 馃啎 鍙尮閰嶄竴娆★紝涓嶅啀缁х画鏌ユ壘璇ュ叧閿瘝鐨勫叾浠栧嚭鐜颁綅缃?
          }
        }
      }
    }

    console.log('[ZimuShengcheng] 匹配到关键词数量:', matches.length);
    return matches;
  }

  /**
   * 灏?effectId锛坘ebab-case锛夎浆鎹负 SNAKE_CASE 鏍煎紡
   * 渚嬪锛?pulse-scale' -> 'PULSE_SCALE'
   * @private
   */
  private normalizeEffectType(effectId: string | undefined): string {
    if (!effectId || effectId === 'none') {
      return 'PULSE_SCALE'; // 榛樿鐗规晥
    }

    // 濡傛灉宸茬粡鏄?SNAKE_CASE 鏍煎紡锛岀洿鎺ヨ繑鍥?
    if (/^[A-Z_]+$/.test(effectId)) {
      return effectId;
    }

    // 杞崲 kebab-case 鎴?camelCase 鍒?SNAKE_CASE
    return effectId
      .replace(/-/g, '_')  // 灏嗚繛瀛楃鏇挎崲涓轰笅鍒掔嚎
      .replace(/([a-z])([A-Z])/g, '$1_$2')  // 澶勭悊椹煎嘲鍛藉悕
      .toUpperCase();  // 杞负澶у啓
  }

  /**
   * 鍒ゆ柇鐗规晥鏄惁涓哄甫鍔ㄧ敾鐨勭壒鏁?
   * @private
   * 銆愬己鍒舵ā寮忋€戞墍鏈夊叧閿瘝閮戒娇鐢ㄥ姩鐢荤壒鏁堬紝涓嶅彈闄愬埗
   */
  private isAnimatedEffect(effectType: EffectType | string): boolean {
    // 銆愬己鍒惰繑鍥?true銆戠‘淇濇墍鏈夊叧閿瘝閮芥樉绀轰负鍔ㄧ敾鐗规晥
    console.log(`[ZimuShengcheng.isAnimatedEffect] 强制返回 true, effectType=${effectType}`);
    return true;
  }

  /**
   * 鏋勫缓鍏抽敭璇嶆牱寮?
   * @private
   */
  private buildKeywordStyle(group: any): any {
    // 浼樺厛浣跨敤styleOverride锛屽叾娆tyleConfig锛屾渶鍚庝娇鐢ㄩ粯璁ゅ€?
    const style = group.styleOverride || group.styleConfig || {};

    // 鉁?娣诲姞璇婃柇鏃ュ織锛氳褰曟牱寮忔瀯寤鸿繃绋?
    console.log('[ZimuShengcheng] 构建关键词样式:', {
      groupId: group.id,
      groupName: group.name,
      styleOverride: group.styleOverride,
      styleConfig: group.styleConfig,
      finalStyle: {
        fontName: style.fontName || this.config.subtitleStyle.fontName,
        fontSize: style.fontSize || this.config.subtitleStyle.fontSize * 1.5,
        fontColor: style.fontColor || '#FFD700'
      }
    });

    return {
      fontName: style.fontName || this.config.subtitleStyle.fontName,
      fontSize: style.fontSize || this.config.subtitleStyle.fontSize * 1.5, // 鐗规晥瀛楀箷榛樿澶?.5鍊?
      fontColor: style.fontColor || '#FFD700', // 榛樿閲戣壊
      outlineColor: style.outlineColor || '#FF8C00',
      // 馃敡 淇锛氫娇鐢??? 鍏佽0鍊硷紙鏃犳弿杈癸級
      outlineWidth: style.outlineWidth ?? 4,
      shadowColor: style.shadowColor,
      shadowBlur: style.shadowBlur,
      shadowOffset: style.shadowOffset,
      backgroundColor: style.backgroundColor || 'transparent',
      backgroundOpacity: style.backgroundOpacity || 0
    };
  }

  /**
   * 馃敡 淇锛氫粠styleConfig鏋勫缓KeywordStyle
   * @private
   */
  private buildKeywordStyleFromConfig(styleConfig: any): KeywordStyle {
    if (!styleConfig) {
      return this.buildKeywordStyle({ styleConfig: {} });
    }

    return {
      fontName: styleConfig.fontName || this.config.subtitleStyle.fontName,
      fontSize: styleConfig.fontSize || this.config.subtitleStyle.fontSize * 1.5,
      fontColor: styleConfig.fontColor || '#FFD700',
      outlineColor: styleConfig.outlineColor || '#FF8C00',
      // 馃敡 淇锛氫娇鐢??? 鍏佽0鍊硷紙鏃犳弿杈癸級
      outlineWidth: styleConfig.outlineWidth ?? 4,
      shadowColor: styleConfig.shadowColor,
      shadowBlur: styleConfig.shadowBlur,
      backgroundColor: styleConfig.backgroundColor || 'transparent',
      backgroundOpacity: styleConfig.backgroundOpacity || 0
    };
  }

  // ==================== 姝ラ3: 鏅鸿兘鎺掑垪 ====================

  /**
   * 鏅鸿兘鎺掑垪瀛楀箷锛屽鐞嗘崲琛屻€佹崲甯с€佺壒鏁堝瓧骞曞畾浣嶇瓑
   * @private
   */
  private arrangeSubtitles(
    segments: CorrectedSegment[],
    keywords: KeywordMatch[],
    config: ZimuConfig
  ): ArrangedSubtitle[] {
    const arranged: ArrangedSubtitle[] = [];

    // 馃敡 娣诲姞鍏ㄥ眬鍘婚噸Set,闃叉鍚屼竴涓叧閿瘝琚涓猻egment閲嶅鍒涘缓
    const createdEffectSubtitles = new Set<string>();

    // 璋冭瘯鏃ュ織锛氭鏌ラ厤缃?
    console.log('[ZimuShengcheng.arrangeSubtitles] 馃敡 閰嶇疆妫€鏌?', {
      configMinSubtitleDuration: config.minSubtitleDuration,
      thisConfigMinSubtitleDuration: this.config?.minSubtitleDuration,
      keywordsCount: keywords.length
    });

    // 璁＄畻甯冨眬绾︽潫
    const constraints = this.calculateLayoutConstraints(config);

    // 馃敡 淇锛氳繃婊ゆ帀鍙寘鍚?\n 鎴栫┖鐧界殑 segments锛岄槻姝㈢敓鎴愮┖鐧藉瓧骞?
    const validSegments = segments.filter(seg => {
      const trimmed = seg.text.trim();
      // 鍙繚鐣欓潪绌虹殑涓斾笉鍙槸鎹㈣绗︾殑 segments
      const isValid = trimmed.length > 0 && !trimmed.match(/^[\s\n\r\t"'""'']+$/);
      if (!isValid && seg.text) {
        console.log(`[ZimuShengcheng.arrangeSubtitles] 杩囨护鎺夌┖鐧芥: "${seg.text}"`, {
          originalText: seg.text,
          trimmed: trimmed,
          reason: trimmed.length === 0 ? '瀹屽叏绌虹櫧' : '鍙寘鍚崲琛岀'
        });
      }
      return isValid;
    });

    console.log(`[ZimuShengcheng.arrangeSubtitles] Segment 杩囨护: ${segments.length} -> ${validSegments.length}`, {
      filtered: segments.length - validSegments.length
    });

    for (const segment of validSegments) {
      // 妫€鏌ヨ娈垫槸鍚﹀寘鍚叧閿瘝
      // 鏀逛负鍩轰簬鏃堕棿鐨勫尮閰嶏紝閬垮厤閲嶅鍖归厤
      const segmentKeywords: KeywordMatch[] = [];
      console.log('[ZimuShengcheng] 检查 segment 中的关键词:', {
        segmentText: segment.text.substring(0, 30),
        segmentTime: `${segment.start.toFixed(3)}-${segment.end.toFixed(3)}`,
        totalKeywords: keywords.length
      });

      // 浣跨敤鏃堕棿鑼冨洿鍖归厤锛岃€屼笉鏄枃鏈悳绱?
      for (const kw of keywords) {
        // 妫€鏌ュ叧閿瘝鐨勬椂闂存槸鍚︿笌褰撳墠segment閲嶅彔
        if ((kw.startTime >= segment.start && kw.startTime < segment.end) ||
          (kw.endTime > segment.start && kw.endTime <= segment.end) ||
          (kw.startTime <= segment.start && kw.endTime >= segment.end)) {
          // 鍏抽敭璇嶅嚭鐜板湪姝egment涓?
          segmentKeywords.push(kw);
          console.log(`[ZimuShengcheng] 关键词时间匹配成功: "${kw.keyword}"`, {
            segmentTime: `${segment.start.toFixed(3)}-${segment.end.toFixed(3)}`,
            keywordTime: `${kw.startTime.toFixed(3)}-${kw.endTime.toFixed(3)}`,
            segmentPreview: segment.text.substring(0, 30) + "..."
          });
        }
      }

      // 鉁?娣诲姞璇婃柇鏃ュ織
      if (segmentKeywords.length > 0) {
        console.log('[ZimuShengcheng] segment 中找到关键词:', {
          segmentText: segment.text.substring(0, 30),
          segmentTime: `${segment.start.toFixed(3)}-${segment.end.toFixed(3)}`,
          keywords: segmentKeywords.map(kw => ({
            keyword: kw.keyword,
            time: `${kw.startTime.toFixed(3)}-${kw.endTime.toFixed(3)}`,
            isAnimated: kw.isAnimated,
            effectType: kw.effectType
          }))
        });
      }

      // 銆愭柊绛栫暐銆戞棤璁烘槸鍚︽湁鍏抽敭璇嶏紝閮藉垱寤轰竴涓畬鏁寸殑鏅€氬瓧骞曪紙鍖呭惈鎵€鏈夊師濮嬫枃鏈級
      // 鏅€氬瓧骞曟樉绀哄畬鏁寸殑鍘熷鏂囨湰锛屾爣鐐圭鍙锋浛鎹负绌烘牸
      const normalSubtitle = this.createNormalSubtitle(segment, config, constraints, segmentKeywords);
      if (normalSubtitle) {
        arranged.push(normalSubtitle);
      }

      if (this.isInlineKeywordRenderMode(config)) {
        continue;
      }

      if ((normalSubtitle as any)?._suppressEffectSubtitle) {
        console.log('[ZimuShengcheng] 当前字幕以普通字幕整句显示，跳过浮动关键词特效:', {
          segmentText: segment.text.substring(0, 30),
          keywordCount: segmentKeywords.length
        });
        continue;
      }

      // 濡傛灉鏈夊叧閿瘝锛屼负姣忎釜鍏抽敭璇嶅垱寤虹壒鏁堝瓧骞?      // 鐗规晥瀛楀箷鍜屾櫘閫氬瓧骞曞苟琛屾樉绀猴紝浜掍笉骞叉壈
      if (segmentKeywords.length > 0) {
        // 馃敡 鍏抽敭淇锛氭鏌ユ槸鍚︽湁澶氫釜鍏抽敭璇嶅悓鏃跺嚭鐜?
        // 濡傛灉鏈夊涓瓧骞曞悓鏃舵樉绀猴紝浣跨敤闈欐€佺壒鏁堣€屼笉鏄姩鐢荤壒鏁?
        // 杩欐牱鍙互閬垮厤鍔ㄧ敾浣嶇疆鍙樺寲瀵艰嚧鐨勮仛闆嗛棶棰?
        const hasMultipleSimultaneous = segmentKeywords.some((kw1, i) =>
          segmentKeywords.some((kw2, j) =>
            i !== j &&
            kw1.startTime < kw2.endTime && kw2.startTime < kw1.endTime
          )
        );

        for (const keyword of segmentKeywords) {
          // 馃敡 妫€鏌ユ槸鍚﹀凡缁忓垱寤鸿繃杩欎釜鐗规晥瀛楀箷(鍩轰簬鍏抽敭璇嶆枃鏈?鏃堕棿)
          const effectKey = `${keyword.keyword}-${keyword.startTime.toFixed(3)}-${keyword.endTime.toFixed(3)}`;
          if (createdEffectSubtitles.has(effectKey)) {
            console.log('[ZimuShengcheng] 跳过重复特效字幕:', {
              keyword: keyword.keyword,
              time: `${keyword.startTime.toFixed(2)}s-${keyword.endTime.toFixed(2)}s`
            });
            continue;
          }
          createdEffectSubtitles.add(effectKey);

          // 涓鸿鍏抽敭璇嶅垱寤轰竴涓椂闂寸墖娈靛璞?
          const keywordPart = {
            text: keyword.keyword,
            start: keyword.startTime,
            end: keyword.endTime,
            isKeyword: true
          };

          // 馃敡 鍏抽敭锛氬鏋滄湁澶氫釜瀛楀箷鍚屾椂鍑虹幇锛岄兘浣跨敤闈欐€佺壒鏁?
          // 杩欐牱閬垮厤浜嗗姩鐢讳綅缃彉鍖栭棶棰橈紝淇濊瘉瀛楀箷鍋滅暀鍦ㄥ垎閰嶇殑浣嶇疆
          if (keyword.isAnimated && !hasMultipleSimultaneous) {
            // 鍗曚釜瀛楀箷涓旀湁鍔ㄧ敾锛氬垱寤哄姩鐢荤壒鏁堝瓧骞?
            const effectSubtitle = this.createAnimatedEffectSubtitle(keywordPart, keyword, config);
            arranged.push(effectSubtitle);
            console.log('[ZimuShengcheng] 创建动画特效字幕:', {
              keyword: keyword.keyword,
              effectType: keyword.effectType,
              type: effectSubtitle.type
            });
          } else {
            // 澶氫釜鍚屾椂鍑虹幇 鎴?涓嶅甫鍔ㄧ敾锛氬垱寤洪潤鎬佺壒鏁堝瓧骞?
            const effectSubtitle = this.createStaticEffectSubtitle(keywordPart, keyword, config);
            arranged.push(effectSubtitle);
            console.log('[ZimuShengcheng] 创建静态特效字幕:', {
              keyword: keyword.keyword,
              type: effectSubtitle.type,
              hasMultiple: hasMultipleSimultaneous
            });
          }
        }
      }
    }

    // 馃敡 鏀硅繘锛氭€绘槸鍚敤鏅鸿兘甯冨眬锛屼絾瀹冧細鏅鸿兘鍒ゆ柇鏄惁闇€瑕佽皟鏁?
    // 濡傛灉娌℃湁瀹為檯鐨勫爢鍙狅紙澶氫釜瀛楀箷鍚屾椂鏄剧ず锛夛紝瀹冨皢淇濇寔鐢ㄦ埛鐨勫師濮嬪潗鏍?
    // 濡傛灉鏈夊爢鍙狅紝鎵嶄細搴旂敤鍒嗘暎绠楁硶锛岄槻姝㈠瓧骞曢噸鍙?

    console.log('[ZimuShengcheng.arrangeSubtitles] 鍚敤鏅鸿兘纰版挒妫€娴嬶紙鏅鸿兘妯″紡 - 浠呭湪鏈夊爢鍙犳椂璋冩暣锛?', {
      total: arranged.length,
      normal: arranged.filter(s => s.type === 'normal').length,
      effect_complex: arranged.filter(s => s.type === 'effect_complex').length,
      effect_simple: arranged.filter(s => s.type === 'effect_simple').length
    });

    // 馃敡 淇绔栧睆瑙嗛瀛楀箷浣嶇疆锛氭娴嬭棰戞柟鍚戯紝涓虹珫灞忔坊鍔犳洿澶х殑瀹夊叏杈硅窛
    const isPortrait = config.videoHeight > config.videoWidth;
    // 瀵逛簬绔栧睆瑙嗛锛屼娇鐢ㄦ洿灏忕殑杈硅窛鐧惧垎姣旓紙纭繚瀛楀箷涓嶄細瓒呭嚭灞忓箷锛?
    // 绔栧睆锛氫娇鐢?4% 鐨勫瀭鐩磋竟璺濓紙鐩告瘮妯睆鐨?10%锛?
    // 杩欐牱 1280px 楂樼殑瑙嗛锛歮argin = 51px锛堟瘮鍘熸潵鐨?128px 鏇村畨鍏級
    const verticalMarginPercent = isPortrait ? 0.04 : 0.1;
    const horizontalMarginPercent = isPortrait ? 0.05 : 0.1;

    const layoutManager = new SmartLayoutManager(
      config.videoWidth,
      config.videoHeight,
      config.videoWidth * horizontalMarginPercent,  // horizontalMargin
      config.videoHeight * verticalMarginPercent    // verticalMargin
    );

    // 馃敡 淇绔栧睆瑙嗛瀛楀箷Y鍧愭爣璁＄畻
    // 鍏抽敭鏀硅繘锛?
    // 1. 搴曢儴瀹夊叏鍖哄煙 = 瑙嗛楂樺害 - 瀛椾綋澶у皬 * 1.8 - 50px锛堜负涓嬮檷绾跨暀鍑虹┖闂达級
    // 2. 椤堕儴瀹夊叏鍖哄煙 = 瀛椾綋澶у皬 + 50px
    const fontSize = config.subtitleStyle.fontSize || 48;
    const bottomSafeY = config.videoHeight - fontSize * 1.8 - 50;  // 搴曢儴瀹夊叏Y鍧愭爣
    const topSafeY = fontSize + 50;  // 椤堕儴瀹夊叏Y鍧愭爣

    // 馃敡 璁＄畻鐗规晥瀛楀箷鐨刌鍧愭爣
    // 閲嶈锛氬鏋滅敤鎴峰湪璁剧疆鐣岄潰鏄庣‘璁剧疆浜嗗潗鏍囷紝淇濈暀鐢ㄦ埛璁剧疆锛堝嵆浣胯秴鍑哄畨鍏ㄨ寖鍥达級
    // 鍙湁褰撶敤鎴蜂娇鐢ㄩ粯璁ゅ€兼椂锛屾墠搴旂敤瀹夊叏杈圭晫
    let effectSubtitleY: number;
    let isUserCustomY = false;

    if (config.effectSubtitleY !== undefined && config.effectSubtitleY !== null) {
      // 鐢ㄦ埛鏄庣‘璁剧疆浜嗗潗鏍?- 淇濈暀鐢ㄦ埛璁剧疆
      effectSubtitleY = config.videoHeight * (100 - config.effectSubtitleY) / 100;
      isUserCustomY = true;
      if (effectSubtitleY < topSafeY || effectSubtitleY > bottomSafeY) {
        console.warn('[ZimuShengcheng.arrangeSubtitles] 鈿狅笍 鐢ㄦ埛璁剧疆鐨勭壒鏁堝瓧骞昚鍧愭爣瓒呭嚭瀹夊叏鑼冨洿:', {
          userY: effectSubtitleY,
          瀹夊叏鑼冨洿: `${topSafeY}px - ${bottomSafeY}px`,
          鎻愮ず: '杩欏彲鑳藉鑷村瓧骞曡秴鍑哄睆骞曪紝寤鸿璋冩暣璁剧疆'
        });
      }
    } else {
      // 鐢ㄦ埛鏈缃潗鏍?- 浣跨敤淇鍚庣殑榛樿鍊硷紙甯﹀畨鍏ㄨ竟鐣岋級
      effectSubtitleY = bottomSafeY;
      isUserCustomY = false;
    }

    console.log('[ZimuShengcheng.arrangeSubtitles] 特效字幕 Y 坐标校验:', {
      userSetting: config.effectSubtitleY,
      computedY: effectSubtitleY.toFixed(1),
      isUserCustomY: isUserCustomY ? 'yes' : 'no',
      safeRange: `${topSafeY}px - ${bottomSafeY}px`,
      videoHeight: config.videoHeight,
      orientation: isPortrait ? 'portrait' : 'landscape',
      fontSize
    });

    // 璋冪敤鐗规晥瀛楀箷纰版挒妫€娴嬪拰宸﹀彸鍒嗘暎璋冩暣
    console.log('[ZimuShengcheng.arrangeSubtitles] 馃攳 甯冨眬璋冩暣鍓嶏紝鐗规晥瀛楀箷浣嶇疆:', arranged
      .filter(s => s.type === 'effect_complex' || s.type === 'effect_simple')
      .slice(0, 5)
      .map((s, i) => ({
        index: i,
        text: s.text.substring(0, 15),
        type: s.type,
        x: s.position.x.toFixed(0),
        y: s.position.y.toFixed(0),
        animationType: s.animationConfig?.parameters?.effectType
      }))
    );

    const layoutResult = layoutManager.resolveEffectSubtitleCollisions(
      arranged,
      {
        effectSubtitleY: effectSubtitleY,
        minHorizontalGap: config.subtitleStyle.fontSize * 1.2,
        maxHorizontalOffset: config.videoWidth * 0.35,
        screenWidth: config.videoWidth,
        videoWidth: config.videoWidth,  // 閬胯璁＄畻闇€瑕?
        videoHeight: config.videoHeight,
        avoidanceConfig: config.avoidanceConfig  // 馃敡 鍏抽敭锛氫紶鍏ラ伩璁╅厤缃?
      }
    );

    console.log('[ZimuShengcheng.arrangeSubtitles] 馃攳 甯冨眬璋冩暣鍚庯紝鐗规晥瀛楀箷浣嶇疆锛堣缁嗭級:', layoutResult
      .filter(s => s.type === 'effect_complex' || s.type === 'effect_simple')
      .map((s, i) => ({
        index: i,
        text: s.text.substring(0, 15),
        type: s.type,
        x: s.position.x.toFixed(0),
        y: s.position.y.toFixed(0),
        animationType: s.animationConfig?.parameters?.effectType
      }))
    );

    // 馃挕 鍏抽敭璇婃柇锛氭樉绀烘墍鏈夌壒鏁堝瓧骞曠殑X鍧愭爣
    const effectSubtitlesAfter = layoutResult.filter(s => s.type === 'effect_complex' || s.type === 'effect_simple');
    console.log('[ZimuShengcheng.arrangeSubtitles] 馃挕 璋冩暣鍚庢墍鏈夌壒鏁堝瓧骞曠殑X鍧愭爣:');
    effectSubtitlesAfter.forEach((s, i) => {
      console.log(`  [${i}] ${s.text}: x=${s.position.x.toFixed(0)}`);
    });

    console.log('[ZimuShengcheng.arrangeSubtitles] 纰版挒妫€娴嬪畬鎴愶紝缁撴灉鏁伴噺:', layoutResult.length);

    // 馃敡 鍏抽敭妫€鏌ワ細楠岃瘉SmartLayoutManager鍓嶅悗鐨勭壒鏁堝瓧骞曟暟閲忓拰浣嶇疆
    const effectSubtitlesBefore = arranged.filter(s => s.type === 'effect_complex' || s.type === 'effect_simple');
    const effectSubtitlesAfterLayout = layoutResult.filter(s => s.type === 'effect_complex' || s.type === 'effect_simple');

    console.log('[ZimuShengcheng.arrangeSubtitles] 馃敡 SmartLayoutManager鍓嶅悗瀵规瘮:');
    console.log(`  璋冪敤鍓嶇壒鏁堝瓧骞曟暟: ${effectSubtitlesBefore.length}`);
    console.log(`  璋冪敤鍚庣壒鏁堝瓧骞曟暟: ${effectSubtitlesAfterLayout.length}`);

    if (effectSubtitlesBefore.length === 0) {
      console.warn('[ZimuShengcheng.arrangeSubtitles] 鈿狅笍 娌℃湁鎵惧埌鐗规晥瀛楀箷锛乤rranged鏁扮粍涓彲鑳芥病鏈夋纭殑瀛楀箷');
    }

    console.log('[ZimuShengcheng.arrangeSubtitles] 璋冪敤鍚庣殑鐗规晥瀛楀箷浣嶇疆:');
    effectSubtitlesAfterLayout.forEach((s, i) => {
      console.log(`  [${i}] \"${s.text}\": x=${s.position.x.toFixed(0)} (搴旇!=960), type=${s.type}`);
    });

    if (effectSubtitlesAfterLayout.length > 0 && effectSubtitlesAfterLayout.every(s => Math.abs(s.position.x - 960) < 10)) {
      console.error('[ZimuShengcheng.arrangeSubtitles] 鉂?涓ラ噸闂锛歋martLayoutManager娌℃湁淇敼鐗规晥瀛楀箷鐨勪綅缃紒鎵€鏈変綅缃兘杩樻槸960');
    }

    // 馃敡 鏈€鍚庣殑寮哄埗淇锛氭牴鎹椂闂撮噸鍙犲垎缁勭壒鏁堝瓧骞曪紝纭繚澶氫釜鍚屾椂鍑虹幇鐨勫瓧骞曡兘鍒嗘暎浣嶇疆
    // 杩欐槸涓€涓?fallback锛屼互闃?SmartLayoutManager 娌℃湁姝ｇ‘璧蜂綔鐢?
    const effectSubtitleGroups: ArrangedSubtitle[][] = [];

    for (const subtitle of effectSubtitlesAfterLayout) {
      // 馃敡 鏀硅繘锛氭鏌ヤ笌鐜版湁鍒嗙粍鏄惁鏈夋椂闂撮噸鍙狅紝鑰屼笉鏄‘鍒囧尮閰?
      let foundGroup = false;

      for (const group of effectSubtitleGroups) {
        // 妫€鏌ュ綋鍓嶅瓧骞曟槸鍚︿笌璇ュ垎缁勪腑鐨勪换浣曞瓧骞曟湁鏃堕棿閲嶅彔
        const hasOverlap = group.some(s =>
          (subtitle.start < s.end && subtitle.end > s.start)
        );

        if (hasOverlap) {
          group.push(subtitle);
          foundGroup = true;
          break;
        }
      }

      // 濡傛灉娌℃湁鎵惧埌鏈夐噸鍙犵殑鍒嗙粍锛屽垱寤烘柊鍒嗙粍
      if (!foundGroup) {
        effectSubtitleGroups.push([subtitle]);
      }
    }

    console.log('[ZimuShengcheng.arrangeSubtitles] 馃敡 寮哄埗浣嶇疆淇 - 鏃堕棿閲嶅彔鍒嗙粍:', {
      totalSubtitles: effectSubtitlesAfterLayout.length,
      groupCount: effectSubtitleGroups.length,
      groupSizes: effectSubtitleGroups.map(g => g.length)
    });

    let correctedCount = 0;
    for (let groupIdx = 0; groupIdx < effectSubtitleGroups.length; groupIdx++) {
      const group = effectSubtitleGroups[groupIdx];

      if (group.length === 1) {
        // 鍗曚釜瀛楀箷锛氫綅缃敱 SmartLayoutManager 璁＄畻锛屾棤闇€寮哄埗淇
        // 銆愪慨澶嶃€戜笉鍐嶅己鍒惰缃綅缃紝淇濈暀 SmartLayoutManager 鐨勭粨鏋?
        const sub = group[0];
        console.log(`[ZimuShengcheng.arrangeSubtitles] 鉁?鍗曚釜瀛楀箷淇濈暀SmartLayoutManager浣嶇疆: "${sub.text}" x=${sub.position.x.toFixed(0)}`);
      } else {
        // 澶氫釜瀛楀箷鍚屾椂鍑虹幇锛氫綅缃敱 SmartLayoutManager 鐨?left-to-right 閫昏緫澶勭悊
        // 銆愪慨澶嶃€戜笉鍐嶅己鍒惰缃綅缃紝淇濈暀 SmartLayoutManager 璁＄畻鐨勫乏鍒板彸鎺掑垪
        console.log(`[ZimuShengcheng.arrangeSubtitles] 鉁?澶氬瓧骞曚繚鐣橲martLayoutManager鐨勫乏鍒板彸鎺掑垪: ${group.map(s => s.text).join(', ')}`);
        const positions = [
          config.videoWidth * 0.25,    // 绗竴涓? 宸?
          config.videoWidth * 0.5,     // 绗簩涓? 涓?
          config.videoWidth * 0.75,    // 绗笁涓? 鍙?
        ];

        // 銆愪慨澶嶃€戜笉鍐嶅己鍒堕噸鏂板垎閰嶄綅缃?- SmartLayoutManager 宸茬粡澶勭悊浜嗗乏鍒板彸鐨勫畨鎺?
        // 淇濈暀鍘熸湁鐨?SmartLayoutManager 璁＄畻缁撴灉
        console.log(`[ZimuShengcheng.arrangeSubtitles] 鉁?澶氬瓧骞曠殑SmartLayoutManager浣嶇疆宸蹭繚鐣欙紙涓嶈鐩栵級:`,
          group.map((s, i) => `[${i}] "${s.text}" x=${s.position.x.toFixed(0)}`).join(', ')
        );
      }
    }

    console.log(`[ZimuShengcheng.arrangeSubtitles] 强制位置修正完成，修正了 ${correctedCount} 个字幕`);

    // 馃敡 鍚敤澶氳鎹㈣鍔熻兘锛氬鏅€氬瓧骞曡繘琛岃嚜鍔ㄦ崲琛屽鐞?
    const normalSubtitles = layoutResult.filter(s => s.type === 'normal');
    const otherSubtitles = layoutResult.filter(s => s.type !== 'normal');

    if (normalSubtitles.length > 0) {
      console.log('[ZimuShengcheng.arrangeSubtitles] 瀵规櫘閫氬瓧骞曞惎鐢ㄨ嚜鍔ㄦ崲琛屽鐞?..', {
        normalSubtitleCount: normalSubtitles.length,
        constraints: {
          maxLines: constraints.maxLines,
          maxCharsPerLine: constraints.maxCharsPerLine,
          lineHeight: constraints.lineHeight
        }
      });

      let optimizedNormalSubtitles: ArrangedSubtitle[] = [];
      try {
        optimizedNormalSubtitles = this.optimizeLayout(normalSubtitles, constraints);

        console.log('[ZimuShengcheng.arrangeSubtitles] 鑷姩鎹㈣澶勭悊瀹屾垚:', {
          before: normalSubtitles.length,
          after: optimizedNormalSubtitles.length,
          newLineCount: optimizedNormalSubtitles.length - normalSubtitles.length
        });
      } catch (err) {
        console.error('[ZimuShengcheng.arrangeSubtitles] 鉂?optimizeLayout 涓ラ噸閿欒锛岄檷绾т娇鐢ㄥ師濮嬫櫘閫氬瓧骞?', err);
        // 鍙戠敓閿欒鏃讹紝纭繚涓嶄涪澶卞瓧骞曪紝鐩存帴浣跨敤鍘熷鐨?normalSubtitles
        optimizedNormalSubtitles = normalSubtitles;
      }

      optimizedNormalSubtitles = this.normalizeArrangedNormalSubtitles(optimizedNormalSubtitles);

      // 鍚堝苟浼樺寲鍚庣殑鏅€氬瓧骞曞拰鍏朵粬瀛楀箷
      return [...optimizedNormalSubtitles, ...otherSubtitles];
    }

    return layoutResult;
  }

  /**
   * 璁＄畻甯冨眬绾︽潫
   * @private
   */
  private calculateLayoutConstraints(config: ZimuConfig): LayoutConstraints {
    const usableWidth = config.videoWidth * 0.8;

    // 馃敡 銆愪慨澶嶃€戞牴鎹棰戞柟鍚戯紙妯睆/绔栧睆锛変娇鐢ㄤ笉鍚岀殑瀹夊叏绯绘暟
    // 绔栧睆瑙嗛鏈韩灏辩獎锛屼絾鐢ㄦ埛鍙嶉闀挎枃鏈粛浼氳瑁佹帀锛岄渶瑕佽繘涓€姝ュ噺灏忔瘮渚?
    // 妯睆瑙嗛瀹斤紝鍙互浣跨敤鏇翠繚瀹堢殑姣斾緥纭繚涓嶈秴鍑?
    const isPortrait = config.videoHeight > config.videoWidth;
    // 馃敡 淇锛氭彁楂樺搴︽瘮渚嬪埌 0.75锛岀粰澶氳瑷€鍏呰冻鐨勬樉绀虹┖闂?
    // 0.68 澶繚瀹堬紝瀵艰嚧淇勮銆佹棩鏂囩瓑鏂囧瓧杩囧害鎴柇
    // 0.75 瀵规墍鏈夎瑷€閮芥洿鍙嬪ソ
    const widthRatio = isPortrait ? 0.68 : 0.76;

    const conservativeUsableWidth = config.videoWidth * widthRatio;
    const maxCharsPerLine = Math.floor(conservativeUsableWidth / config.subtitleStyle.fontSize);
    const horizontalMargin = (config.videoWidth - conservativeUsableWidth) / 2;

    // 馃敡 璋冭瘯锛氳緭鍑鸿绠楄繃绋嬶紝甯姪璇婃柇鎹㈣闂
    console.log('[ZimuShengcheng.calculateLayoutConstraints] 馃挕 甯冨眬绾︽潫璁＄畻:', {
      videoWidth: config.videoWidth,
      videoHeight: config.videoHeight,
      isPortrait: isPortrait,
      widthRatio: widthRatio,
      fontSize: config.subtitleStyle.fontSize,
      usableWidth: usableWidth.toFixed(2),
      conservativeUsableWidth: conservativeUsableWidth.toFixed(2),
      maxCharsPerLine: maxCharsPerLine,
      maxLines: 2,  // 闄愬埗鏈€澶?琛?
      horizontalMargin: horizontalMargin.toFixed(2),
      note: `${isPortrait ? '绔栧睆' : '妯睆'}瑙嗛浣跨敤${widthRatio}姣斾緥`
    });

    return {
      maxLines: 6,  // 馃敡 鍏佽鏈€澶?琛屾媶鍒嗭紙姣忓抚2琛岋紝鏈€澶?甯э級锛屾墍鏈夊唴瀹瑰畬鏁存樉绀?
      maxCharsPerLine,
      lineHeight: config.subtitleStyle.fontSize * 1.12,
      horizontalMargin,
      verticalMargin: config.videoHeight * 0.08,
      videoWidth: config.videoWidth,  // 馃敡 娣诲姞瑙嗛瀹藉害锛屼緵optimizeLayout浣跨敤
      videoHeight: config.videoHeight,  // 馃敡 娣诲姞瑙嗛楂樺害锛屼緵optimizeLayout浣跨敤
      effectSpacing: 2 // 鐗规晥瀛楀箷涓庢櫘閫氬瓧骞曠殑闂磋窛锛堝瓧绗︽暟锛?
    };
  }

  /**
   * 灏嗘爣鐐圭鍙锋浛鎹负绌烘牸浣滀负鍗犱綅绗?
   * 鐢ㄤ簬淇濈暀鍘熷鏂囨湰鐨勪綅缃拰闀垮害
   * @private
   */
  private normalizeTextForDisplay(text: string): string {
    // 馃敡 鏀硅繘锛氬垹闄ゆ爣鐐圭鍙疯€屼笉鏄浛鎹负绌烘牸
    // 鍘熷洜锛氭爣鐐规浛鎹负绌烘牸浼氬鑷存枃鏈彉闀匡紝浣跨敤鏇村灞忓箷瀹藉害
    // 鍒犻櫎鏍囩偣鍙互璁╂枃鏈洿绱у噾锛岄槻姝㈣秴鍑哄睆骞曞彸杈圭晫

    // 鍒犻櫎涓枃鏍囩偣绗﹀彿 (鍖呮嫭涓枃寮曞彿"")
    let normalized = text.replace(/[锛屻€傦紒锛燂紱锛氥€屻€嶃€庛€忥紙锛夈€?"]/g, '');

    // 鍒犻櫎甯歌鑻辨枃鏍囩偣绗﹀彿
    normalized = normalized.replace(/[,.!?;:\(\)\[\]{}"\'"]/g, '');

    console.log(`[ZimuShengcheng.normalizeTextForDisplay] 鏍囩偣澶勭悊:`, {
      original: text.substring(0, 30),
      normalized: normalized.substring(0, 30),
      lengthBefore: text.length,
      lengthAfter: normalized.length
    });

    return normalized;
  }

  /**
   * 灏嗘钀芥寜鍏抽敭璇嶆媶鍒?
   * @private
   */
  private splitSegmentByKeywords(
    segment: CorrectedSegment,
    keywords: KeywordMatch[]
  ): Array<{ text: string; start: number; end: number; isKeyword: boolean }> {
    const parts: any[] = [];
    const text = segment.text;
    let lastIndex = 0;

    // 鎸夊叧閿瘝浣嶇疆鎺掑簭
    const sortedKeywords = keywords.sort((a, b) => a.startIndex - b.startIndex);

    for (const kw of sortedKeywords) {
      // 鍏抽敭璇嶄箣鍓嶇殑鏅€氭枃鏈?
      if (kw.startIndex > lastIndex) {
        const beforeText = text.substring(lastIndex, kw.startIndex);
        const beforeTiming = this.getSegmentRangeTiming(segment, lastIndex, kw.startIndex);
        parts.push({
          text: beforeText,
          start: beforeTiming.start,
          end: beforeTiming.end,
          isKeyword: false
        });
      }

      // 鍏抽敭璇嶆湰韬?
      parts.push({
        text: kw.keyword,
        start: kw.startTime,
        end: kw.endTime,
        isKeyword: true
      });

      lastIndex = kw.endIndex;
    }

    // 鍓╀綑鐨勬櫘閫氭枃鏈?
    if (lastIndex < text.length) {
      const afterText = text.substring(lastIndex);
      const afterTiming = this.getSegmentRangeTiming(segment, lastIndex, text.length);
      parts.push({
        text: afterText,
        start: afterTiming.start,
        end: afterTiming.end,
        isKeyword: false
      });
    }

    return parts;
  }

  private buildNormalSubtitleDisplayText(
    segment: CorrectedSegment,
    keywords: KeywordMatch[],
    config: Pick<ZimuConfig, 'keywordRenderMode'>
  ): { text: string; suppressEffectSubtitle: boolean } {
    const originalText = typeof segment?.text === 'string' ? segment.text : String(segment?.text ?? '');
    if (!originalText || this.isInlineKeywordRenderMode(config) || !Array.isArray(keywords) || keywords.length === 0) {
      return {
        text: originalText,
        suppressEffectSubtitle: false
      };
    }

    const nonKeywordText = this.splitSegmentByKeywords(segment, [...keywords])
      .filter((part) => !part.isKeyword)
      .map((part) => part.text || '')
      .join('')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const normalizedOriginal = this.normalizeTextForDisplay(originalText).trim();
    const normalizedRemaining = this.normalizeTextForDisplay(nonKeywordText).trim();
    const remainingRatio = normalizedOriginal.length > 0
      ? normalizedRemaining.length / normalizedOriginal.length
      : 0;

    // If keywords cover almost the whole sentence, keep the full subtitle and
    // suppress the floating effect subtitle to avoid both skipping and overlap.
    if (!normalizedRemaining || remainingRatio < 0.35) {
      console.log('[ZimuShengcheng] 关键词覆盖比例过高，保留整句普通字幕并关闭浮动特效:', {
        originalText: originalText.substring(0, 30),
        remainingText: nonKeywordText.substring(0, 30),
        remainingRatio
      });
      return {
        text: originalText,
        suppressEffectSubtitle: true
      };
    }

    console.log('[ZimuShengcheng] 浮动关键词模式下剔除普通字幕中的关键词文本:', {
      originalText: originalText.substring(0, 30),
      keywordCount: keywords.length,
      resultText: nonKeywordText.substring(0, 30),
      remainingRatio
    });

    return {
      text: nonKeywordText,
      suppressEffectSubtitle: false
    };
  }

  /**
   * 鍒涘缓鏅€氬瓧骞?
   * @private
   */
  private createNormalSubtitle(
    segment: any,
    config: ZimuConfig,
    constraints: LayoutConstraints,
    segmentKeywords: KeywordMatch[] = []
  ): ArrangedSubtitle | null {
    // 馃敡 淇绔栧睆瑙嗛瀛楀箷浣嶇疆锛氭敼杩沋鍧愭爣璁＄畻
    const fontSize = config.subtitleStyle.fontSize || 48;
    const isPortrait = config.videoHeight > config.videoWidth;

    // 馃搷 鏀硅繘鐨勫簳閮╕鍧愭爣璁＄畻锛?
    // 鑰冭檻瀛椾綋涓嬮檷绾匡紙fontSize * 1.8锛夊拰瀹夊叏杈硅窛锛?0px锛?
    // 杩欑‘淇濇櫘閫氬瓧骞曚笉浼氳秴鍑哄睆骞曞簳閮?
    const bottomY = config.videoHeight - fontSize * 1.8 - 50;

    // 娣诲姞杈圭晫鍊肩‘淇漎鍧愭爣濮嬬粓鏈夋晥
    const topSafeY = fontSize + 50;
    const bottomSafeY = bottomY;

    // 鏅€氬瓧骞曚娇鐢ㄥ師濮嬫椂闀匡紝涓嶅彈minSubtitleDuration褰卞搷
    // minSubtitleDuration浠呮帶鍒剁壒鏁堝瓧骞?
    const start = segment.start;
    const end = segment.end;

    const alignment = config.subtitleStyle.alignment || 'center';
    const displayDecision = this.buildNormalSubtitleDisplayText(segment, segmentKeywords, config);
    const displayText = displayDecision.text;
    if (!displayText.trim()) {
      console.log('[ZimuShengcheng] 普通字幕被关键词特效完全覆盖，跳过基础字幕层:', {
        segmentText: String(segment?.text || '').substring(0, 30),
        keywordCount: segmentKeywords.length
      });
      return null;
    }

    const anchorX = (() => {
      if (config.normalSubtitleX !== undefined && config.normalSubtitleX !== null) {
        return config.videoWidth * config.normalSubtitleX / 100;
      }

      if (alignment === 'right') {
        return config.videoWidth * 0.86;
      }

      if (alignment === 'left') {
        return config.videoWidth * 0.14;
      }

      return config.videoWidth / 2;
    })();

    return {
      type: 'normal',
      // 馃敡 淇濈暀鍘熷鏂囨湰锛堝甫鏍囩偣绗﹀彿锛夛紝鐢ㄤ簬鏅鸿兘鎹㈣
      // normalize澶勭悊锛堟妸鏍囩偣绗﹀彿鏇挎崲鎴愮┖鏍硷級灏嗗湪generateDrawtextCommands鏃惰繘琛?
      text: displayText,
      start,
      end,
      position: {
        x: anchorX,
        // 馃敡 淇Y鍧愭爣锛?
        // 濡傛灉鐢ㄦ埛鏄惧紡璁剧疆锛屼繚鐣欑敤鎴疯缃紙鍗充娇瓒呭嚭瀹夊叏鑼冨洿锛?
        // 濡傛灉鏈缃紝浣跨敤淇鍚庣殑榛樿鍊硷紙鑰冭檻鏂囧瓧楂樺害鍜屽畨鍏ㄨ竟璺濓級
        y: (() => {
          const requestedPosition = config.subtitleStyle?.position || 'bottom';
          const manualY = config.normalSubtitleY !== undefined && config.normalSubtitleY !== null
            ? config.videoHeight * (100 - config.normalSubtitleY) / 100
            : null;
          const semanticY = requestedPosition === 'top'
            ? topSafeY
            : requestedPosition === 'center'
              ? Math.round(config.videoHeight * 0.5)
              : bottomY;
          const isManualPositionCompatible = manualY !== null && (
            requestedPosition === 'top'
              ? manualY <= config.videoHeight * 0.45
              : requestedPosition === 'center'
                ? manualY >= config.videoHeight * 0.3 && manualY <= config.videoHeight * 0.7
                : manualY >= config.videoHeight * 0.55
          );

          if (manualY !== null && isManualPositionCompatible) {
            // 鐢ㄦ埛鏄庣‘璁剧疆浜嗗潗鏍?- 淇濈暀鐢ㄦ埛璁剧疆
            const userY = Math.max(topSafeY, Math.min(manualY, bottomSafeY));
            if (userY < topSafeY || userY > bottomSafeY) {
              console.warn('[createNormalSubtitle] 鈿狅笍 鐢ㄦ埛璁剧疆鐨勬櫘閫氬瓧骞昚瓒呭嚭瀹夊叏鑼冨洿:', { userY, 瀹夊叏鑼冨洿: `${topSafeY}-${bottomSafeY}` });
            }
            return userY;
          } else {
            // 鐢ㄦ埛鏈缃?- 浣跨敤淇鍚庣殑瀹夊叏榛樿鍊?
            return bottomY;
          }
        })(),
        alignment
      },
      style: {
        fontName: config.subtitleStyle.fontName,
        fontSize: config.subtitleStyle.fontSize,
        fontColor: config.subtitleStyle.fontColor,
        outlineColor: config.subtitleStyle.outlineColor,
        outlineWidth: config.subtitleStyle.outlineWidth,
        backgroundColor: config.subtitleStyle.backgroundColor,
        backgroundOpacity: config.subtitleStyle.backgroundOpacity,
        shadowOffset: config.subtitleStyle.shadowOffset,
        shadowColor: config.subtitleStyle.shadowColor,
        shadowBlur: config.subtitleStyle.shadowBlur
      },
      layer: 'drawtext', // 銆愮函drawtext鏂规銆戞櫘閫氬瓧骞曚篃鐢╠rawtext娓叉煋
      ...(displayDecision.suppressEffectSubtitle ? { _suppressEffectSubtitle: true } : {})
    };
  }

  /**
   * 馃啎 鑾峰彇鍏抽敭璇嶇粍鐨勪綅缃厤缃?
   * @private
   */
  private getGroupPosition(groupName: string, config: ZimuConfig): import('./ZimuShengcheng.types').KeywordGroupPositionConfig | undefined {
    return config.keywordGroupPositions?.find(p => p.groupName === groupName);
  }

  /**
   * 馃啎 浼扮畻瀛楀箷灏哄锛堢敤浜庣鎾炴娴嬶級
   * @private
   */
  private estimateSubtitleDimensions(
    text: string,
    fontSize: number,
    fontName?: string
  ): { width: number; height: number } {
    // 浼扮畻鍏紡锛堝熀浜庡父瑙佸瓧浣撶殑瀹介珮姣旓級
    // 涓枃瀛楃锛氬搴︾害绛変簬 fontSize锛岄珮搴︾害绛変簬 fontSize
    // 鑻辨枃瀛楃锛氬搴︾害绛変簬 fontSize * 0.6锛岄珮搴︾害绛変簬 fontSize

    const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishCharCount = (text.match(/[a-zA-Z]/g) || []).length;
    const otherCharCount = text.length - chineseCharCount - englishCharCount;

    // 浼扮畻瀹藉害锛堝儚绱狅級
    const estimatedWidth =
      (chineseCharCount * fontSize) +
      (englishCharCount * fontSize * 0.6) +
      (otherCharCount * fontSize * 0.5) +  // 鏁板瓧銆佺鍙风瓑
      (fontSize * 0.3);  // 瀛楅棿璺?

    // 浼扮畻楂樺害锛堝儚绱狅級= 瀛椾綋楂樺害 + 涓婁笅杈硅窛
    const estimatedHeight = fontSize + fontSize * 0.3;

    return {
      width: Math.ceil(estimatedWidth),
      height: Math.ceil(estimatedHeight)
    };
  }

  /**
   * 鍒涘缓甯﹀姩鐢荤殑鐗规晥瀛楀箷
   * @private
   */
  private createAnimatedEffectSubtitle(
    part: any,
    keyword: KeywordMatch,
    config: ZimuConfig
  ): ArrangedSubtitle {
    // 馃敡 淇锛氱壒鏁堝瓧骞曞簲璇ラ潬杩戞櫘閫氬瓧骞曞簳閮紝鑰屼笉鏄浐瀹氬湪涓婃柟30%
    // 瀵逛簬绔栧睆瑙嗛锛屽瓧骞曚綅缃渶瑕佺壒娈婂鐞?
    const isPortrait = config.videoHeight > config.videoWidth;
    const fontSize = config.subtitleStyle.fontSize || 48;

    // 馃啎 鑾峰彇鍏抽敭璇嶇粍鐨勪綅缃厤缃?
    const groupPosition = this.getGroupPosition(keyword.groupName, config);

    // 馃搷 鏀硅繘鐨刌鍧愭爣璁＄畻閫昏緫锛?
    // 搴曢儴瀹夊叏浣嶇疆锛歷ideoHeight - fontSize * 1.8 - 50锛堣€冭檻涓嬮檷绾垮拰杈硅窛锛?
    // 杩欑‘淇濇枃瀛椾笉浼氳秴鍑哄睆骞曚笅鏂?
    const bottomY = config.videoHeight - fontSize * 1.8 - 50;
    const topY = bottomY - fontSize - 5; // 鐗规晥瀛楀箷鍦ㄦ櫘閫氬瓧骞曚笂鏂?

    // 馃敡 淇锛氫娇鐢ㄥ叧閿瘝涓殑鏍峰紡閰嶇疆瑕嗙洊榛樿鏍峰紡
    const effectStyle = {
      ...keyword.style,
      // 濡傛灉鍏抽敭璇嶆湁鐗规畩鏍峰紡锛屼娇鐢ㄥ叧閿瘝鐨勬牱寮?
      ...(keyword.effectStyle || {})
    };

    // 馃敡 鏂板锛氬簲鐢ㄦ渶灏忔椂闀块檺鍒跺埌鐗规晥瀛楀箷
    let start = part.start;
    let end = part.end;
    const actualDuration = end - start;
    if (config.minSubtitleDuration && actualDuration < config.minSubtitleDuration) {
      end = start + config.minSubtitleDuration;
      console.log('[createAnimatedEffectSubtitle] 搴旂敤鏈€灏忔椂闀块檺鍒?', {
        keyword: part.text,
        originalDuration: actualDuration,
        minDuration: config.minSubtitleDuration,
        newEnd: end
      });
    }

    // 璋冭瘯鏃ュ織锛氳緭鍑洪厤缃殑鏈€灏忔椂闀?
    console.log('[createAnimatedEffectSubtitle] 馃敡 璋冭瘯淇℃伅:', {
      keyword: part.text,
      configMinDuration: config.minSubtitleDuration,
      thisConfigMinDuration: this.config?.minSubtitleDuration,
      finalDuration: (config.minSubtitleDuration || 2) * 1000,
      start,
      end
    });

    // 馃啎 璁＄畻瀛楀箷灏哄锛堢敤浜庣鎾炴娴嬶級
    const dimensions = this.estimateSubtitleDimensions(part.text, fontSize);

    // 馃啎 璁＄畻瀹為檯缁撴潫鏃堕棿锛堣€冭檻鍔ㄧ敾鏃堕暱锛?
    // 馃敡 浼樺厛浣跨敤鍒嗙粍鐨?effectDuration锛屾病鏈夊垯浣跨敤鍏ㄥ眬榛樿鍊?
    const keywordGroup = config.keywordGroups?.find(g => g.name === keyword.groupName);
    const groupEffectDuration = keywordGroup?.effectDuration;
    const animationDurationSeconds = groupEffectDuration ?? config.minSubtitleDuration ?? 2;
    // 馃敡 淇锛歴tart/end 鏄绉掞紝闇€瑕佸皢绉掕浆鎹负姣
    const animationDurationMs = animationDurationSeconds * 1000;
    const actualEnd = Math.max(end, start + animationDurationMs);
    console.log('[createAnimatedEffectSubtitle] effectiveEnd璁＄畻:', {
      text: part.text,
      groupName: keyword.groupName,
      groupEffectDuration: groupEffectDuration,
      globalMinDuration: config.minSubtitleDuration,
      usedDuration: animationDurationSeconds,
      animationDurationMs: animationDurationMs,
      start: start.toFixed(2),
      end: end.toFixed(2),
      effectiveEnd: actualEnd.toFixed(2)
    });

    // 馃啎 浣跨敤Group浣嶇疆鎴栧叏灞€浣嶇疆
    const effectX = groupPosition?.effectX ?? config.effectSubtitleX ?? 50;
    const hasCustomEffectY = groupPosition?.effectY !== undefined ||
      (config.effectSubtitleY !== undefined && config.effectSubtitleY !== null);
    const effectYPixel = hasCustomEffectY
      ? config.videoHeight * (100 - (groupPosition?.effectY ?? config.effectSubtitleY ?? 50)) / 100
      : topY;

    const subtitle: ArrangedSubtitle = {
      type: 'effect_complex',
      text: part.text,
      start: start,
      end: end,
      position: {
        // 馃啎 浣跨敤Group鍧愭爣鎴栧叏灞€鍧愭爣锛堢櫨鍒嗘瘮杞儚绱狅級
        x: config.videoWidth * effectX / 100,
        // 馃啎 Y鍧愭爣璁＄畻锛氭湭鏄惧紡閰嶇疆鏃堕粯璁ゆ斁鍦ㄦ櫘閫氬瓧骞曚笂鏂癸紝閬垮厤鍜屽熀纭€瀛楀箷鍙犲瓧
        y: (() => {
          const topBound = fontSize + 50;  // 椤堕儴瀹夊叏杈圭晫
          const bottomBound = config.videoHeight - fontSize * 1.8 - 50;  // 搴曢儴瀹夊叏杈圭晫
          const calcY = effectYPixel;

          if (calcY < topBound || calcY > bottomBound) {
            console.warn('[createAnimatedEffectSubtitle] 鈿狅笍 璁剧疆鐨勭壒鏁堝瓧骞昚瓒呭嚭瀹夊叏鑼冨洿:', {
              groupName: keyword.groupName,
              calcY,
              瀹夊叏鑼冨洿: `${topBound}-${bottomBound}`
            });
          }
          return calcY;
        })(),
        alignment: 'center'
      },

      // 馃啎 鏂板瀛楁
      width: dimensions.width,          // 瀛楀箷瀹藉害
      height: dimensions.height,        // 瀛楀箷楂樺害
      keywordGroup: keyword.groupName,  // 鍏抽敭璇嶇粍鍚嶇О
      effectiveEnd: actualEnd,          // 瀹為檯缁撴潫鏃堕棿锛堣€冭檻鍔ㄧ敾鏃堕暱锛?

      style: effectStyle,
      layer: 'drawtext', // 浣跨敤drawtext娓叉煋
      animationConfig: {
        type: 'slide',
        duration: animationDurationSeconds * 1000,  // 馃敡 浣跨敤鍒嗙粍鐨?effectDuration
        delay: 0,
        // 馃敡 浠庡叧閿瘝鐨勭壒鏁堥厤缃腑鑾峰彇瀹屾暣鍙傛暟
        intensity: keyword.effectIntensity || 0.8,
        parameters: {
          effectType: keyword.effectType || 'SLIDE_IN_UP',
          // 馃敡 浼犻€掑畬鏁寸殑鐗规晥閰嶇疆鍙傛暟
          effectConfig: keyword.effectConfig,
          effectStyle: keyword.effectStyle,
          // 馃敡 纭繚duration鍚屾锛氫娇鐢ㄥ垎缁勭殑 effectDuration
          duration: animationDurationSeconds * 1000,
          // 馃敡 鍏抽敭锛氭爣璁版鍔ㄧ敾闇€瑕佺瓑寰呬綅缃垎閰嶅畬鎴愬悗鍐嶇敓鎴?
          waitForPositionAssignment: true
        },
        // 馃啎 浼犻€掕创绾镐俊鎭?
        stickerId: keyword.stickerId,
        stickerConfig: keyword.stickerConfig
      }
    };

    // 馃攳 璋冭瘯锛氳緭鍑鸿创绾镐俊鎭?
    console.log(`[createAnimatedEffectSubtitle] 鍒涘缓鐗规晥瀛楀箷锛岃创绾镐俊鎭?`, {
      text: part.text,
      groupName: keyword.groupName,
      stickerId: keyword.stickerId,
      hasStickerConfig: !!keyword.stickerConfig,
      animationConfigStickerId: subtitle.animationConfig?.stickerId
    });

    return subtitle;
  }

  /**
   * 鍒涘缓闈欐€佺壒鏁堝瓧骞曪紙涓嶅甫鍔ㄧ敾锛?
   * @private
   */
  private createStaticEffectSubtitle(
    part: any,
    keyword: KeywordMatch,
    config: ZimuConfig
  ): ArrangedSubtitle {
    // 馃敡 淇绔栧睆瑙嗛瀛楀箷浣嶇疆锛氭敼杩沋鍧愭爣璁＄畻
    const fontSize = config.subtitleStyle.fontSize || 48;
    const isPortrait = config.videoHeight > config.videoWidth;

    // 馃啎 鑾峰彇鍏抽敭璇嶇粍鐨勪綅缃厤缃?
    const groupPosition = this.getGroupPosition(keyword.groupName, config);

    // 馃搷 鏀硅繘鐨勫簳閮╕鍧愭爣璁＄畻锛?
    // 闈欐€佺壒鏁堝瓧骞曚篃浣跨敤瀹夊叏搴曢儴浣嶇疆
    const bottomY = config.videoHeight - fontSize * 1.8 - 50;

    // 娣诲姞杈圭晫鍊?
    const topSafeY = fontSize + 50;
    const bottomSafeY = bottomY;

    // 馃敡 鏂板锛氬簲鐢ㄦ渶灏忔椂闀块檺鍒跺埌闈欐€佺壒鏁堝瓧骞?
    let start = part.start;
    let end = part.end;
    const actualDuration = end - start;
    if (config.minSubtitleDuration && actualDuration < config.minSubtitleDuration) {
      end = start + config.minSubtitleDuration;
      console.log('[createStaticEffectSubtitle] 搴旂敤鏈€灏忔椂闀块檺鍒?', {
        keyword: part.text,
        originalDuration: actualDuration,
        minDuration: config.minSubtitleDuration,
        newEnd: end
      });
    }

    // 馃啎 璁＄畻瀛楀箷灏哄
    const dimensions = this.estimateSubtitleDimensions(part.text, fontSize);

    // 馃啎 浣跨敤Group浣嶇疆鎴栧叏灞€浣嶇疆
    const effectX = groupPosition?.effectX ?? config.effectSubtitleX ?? 50;
    const hasCustomEffectY = groupPosition?.effectY !== undefined ||
      (config.effectSubtitleY !== undefined && config.effectSubtitleY !== null);
    const effectYPixel = hasCustomEffectY
      ? config.videoHeight * (100 - (groupPosition?.effectY ?? config.effectSubtitleY ?? 50)) / 100
      : Math.max(topSafeY, Math.min(bottomY - fontSize - 5, bottomSafeY));

    return {
      type: 'effect_simple',
      text: part.text,
      start: start,
      end: end,
      position: {
        // 馃啎 浣跨敤Group鍧愭爣鎴栧叏灞€鍧愭爣锛堢櫨鍒嗘瘮杞儚绱狅級
        x: config.videoWidth * effectX / 100,
        // 馃啎 Y鍧愭爣璁＄畻锛氭湭鏄惧紡閰嶇疆鏃堕粯璁ゆ斁鍦ㄦ櫘閫氬瓧骞曚笂鏂癸紝閬垮厤鍜屽熀纭€瀛楀箷鍙犲瓧
        y: (() => {
          const calcY = effectYPixel;
          if (calcY < topSafeY || calcY > bottomSafeY) {
            console.warn('[createStaticEffectSubtitle] 鈿狅笍 璁剧疆鐨勯潤鎬佺壒鏁堝瓧骞昚瓒呭嚭瀹夊叏鑼冨洿:', {
              groupName: keyword.groupName,
              calcY,
              瀹夊叏鑼冨洿: `${topSafeY}-${bottomSafeY}`
            });
          }
          return calcY;
        })(),
        alignment: 'center'
      },

      // 馃啎 鏂板瀛楁
      width: dimensions.width,          // 瀛楀箷瀹藉害
      height: dimensions.height,        // 瀛楀箷楂樺害
      keywordGroup: keyword.groupName,  // 鍏抽敭璇嶇粍鍚嶇О
      effectiveEnd: end,                // 瀹為檯缁撴潫鏃堕棿锛堥潤鎬佺壒鏁堟棤鍔ㄧ敾鏃堕暱锛?

      style: keyword.style,
      layer: 'ass_effect', // 浣跨敤ASS娓叉煋
      // 馃啎 浼犻€掕创绾镐俊鎭?
      stickerId: keyword.stickerId,
      stickerConfig: keyword.stickerConfig,
      // 馃敡 淇锛氭坊鍔犵壒鏁堢被鍨嬮厤缃紝纭繚effect_simple涔熻兘搴旂敤姝ｇ‘鐨勭壒鏁?
      animationConfig: keyword.effectType ? {
        type: 'slide', // 鍔ㄧ敾绫诲瀷鍗犱綅
        duration: keyword.effectDuration || 2000,
        intensity: keyword.intensity || 0.8,
        delay: 0,
        parameters: {
          effectType: keyword.effectType, // 淇濆瓨鐪熷疄鐨勭壒鏁堢被鍨嬶紙濡侱ANMAKU銆丄RC_TEXT锛?
          speed: keyword.speed || 1.0
        }
      } : undefined
    };
  }

  /**
   * 浼樺寲甯冨眬锛堝鐞嗘崲琛屽拰鎹㈠抚閫昏緫锛?
   * 閲嶆柊璁捐锛氬疄鐜板畬鏁寸殑鏅鸿兘鎺掔増閫昏緫
   * @private
   */
  private optimizeLayout(
    subtitles: ArrangedSubtitle[],
    constraints: LayoutConstraints
  ): ArrangedSubtitle[] {
    const optimized: ArrangedSubtitle[] = [];
    const MAX_LINES = constraints.maxLines || 2;

    // 馃敡 鏀硅繘锛氭洿绮剧‘鐨勫搴﹁绠楋紝鑰冭檻瀹為檯瀛椾綋瀹藉害姣斾緥
    // 鏍规嵁澶у鏁扮瓑瀹芥垨姣斾緥瀛椾綋鐨勭壒鎬э細
    // - 涓枃瀛楃瀹藉害 鈮?瀛椾綋楂樺害锛堟鏂瑰舰锛?
    // - 鑻辨枃瀛楁瘝骞冲潎瀹藉害 鈮?瀛椾綋楂樺害 * 0.5
    // - 鏁板瓧瀹藉害 鈮?瀛椾綋楂樺害 * 0.5
    // - 鏍囩偣绗﹀彿瀹藉害 鈮?瀛椾綋楂樺害 * 0.3
    const calculateDisplayLength = (text: string): number => {
      let length = 0;
      for (const char of text) {
        if (/[\u4e00-\u9fff]/.test(char)) {
          // 涓枃瀛楃锛氬崰1涓瓧浣撳搴?
          length += 1;
        } else if (/[\u3040-\u309f]/.test(char)) {
          // 馃啎 鏃ユ枃骞冲亣鍚嶏紙銇?銈擄級锛氬崰1涓瓧浣撳搴?
          length += 1;
        } else if (/[\u30a0-\u30ff]/.test(char)) {
          // 馃啎 鏃ユ枃鐗囧亣鍚嶏紙銈?銉达級锛氬崰1涓瓧浣撳搴?
          length += 1;
        } else if (/[\uac00-\ud7af]/.test(char)) {
          // 馃啎 闊╂枃锛堦皜-頌ｏ級锛氬崰1涓瓧浣撳搴?
          length += 1;
        } else if (/[\u0400-\u04ff]/.test(char)) {
          // 馃啎 瑗块噷灏斿瓧姣嶏紙淇勮銆佷箤鍏嬪叞璇瓑锛夛細鍗?.65涓瓧浣撳搴?
          // 璁╀縿璇瓧绗︽洿鎺ヨ繎鑻辨枃瀹藉害锛岃繖鏍疯兘鏄剧ず鏇村鏂囧瓧
          length += 0.65;
        } else if (/[a-zA-Z0-9]/.test(char)) {
          // 鑻辨枃瀛楁瘝鍜屾暟瀛楋細鍗?.6涓瓧浣撳搴?
          length += 0.6;
        } else if (/[\s\t\r\n]/.test(char)) {
          // 绌烘牸绛夛細鍗?.3涓瓧浣撳搴?
          length += 0.3;
        } else {
          // 鏍囩偣绗﹀彿绛夛細鍗?.35涓瓧浣撳搴?
          length += 0.35;
        }
      }
      return length;
    };

    // 鏅鸿兘鎹㈣锛氳タ鏂囨寜鍗曡瘝杈圭晫锛屼腑鏂囨寜瀛楃
    // 馃敡 淇锛氶伩鍏嶆妸鍗曡瘝浠庝腑闂存埅鏂紙濡?"Zweig" 琚媶鎴?"Zwe" 鍜?"ig"锛?
    const smartLineBreak = (text: string, maxCharsPerLine: number): string[] => {
      const lines: string[] = [];

      // 馃敡 銆愪慨澶嶃€戣皟鏁村畨鍏ㄧ郴鏁板埌 0.95锛岀粰浜堝厖瓒崇殑鏄剧ず绌洪棿
      const safetyMargin = 0.95;
      const safeMaxCharsPerLine = maxCharsPerLine * safetyMargin;

      // 馃敡 鍒ゆ柇鏄惁涓昏鏄腑鏂?鏃ユ枃/闊╂枃鏂囨湰
      const cjkCharCount = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || []).length;
      const isMostlyCJK = cjkCharCount > text.length * 0.3;

      if (isMostlyCJK) {
        // 馃敡 涓棩闊╂枃鏈細鎸夊瓧绗︽媶鍒嗭紙淇濇寔鍘熸湁閫昏緫锛?
        let currentLine = '';
        let currentLength = 0;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const charLength = calculateDisplayLength(char);

          if (currentLength + charLength > safeMaxCharsPerLine && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = '';
            currentLength = 0;

            if (lines.length >= MAX_LINES) {
              const remainingChars = text.substring(i);
              let truncatedLine = '';
              let truncatedLength = 0;
              for (const c of remainingChars) {
                const cLen = calculateDisplayLength(c);
                if (truncatedLength + cLen <= maxCharsPerLine) {
                  truncatedLine += c;
                  truncatedLength += cLen;
                } else {
                  break;
                }
              }
              if (truncatedLine.length < remainingChars.length) {
                truncatedLine += '...';
              }
              lines[lines.length - 1] += truncatedLine;
              return lines.slice(0, MAX_LINES);
            }
          }
          currentLine += char;
          currentLength += charLength;
        }

        if (currentLine.length > 0) {
          if (lines.length < MAX_LINES) {
            lines.push(currentLine);
          } else {
            lines[lines.length - 1] += currentLine;
          }
        }
      } else {
        // 馃敡 銆愬叧閿慨澶嶃€戣タ鏂囷紙鑻辨枃銆佸痉鏂囥€佷縿鏂囩瓑锛夛細鎸夊崟璇嶈竟鐣屾媶鍒?
        // 閬垮厤鎶?"Zweig" 鎷嗘垚 "Zwe" 鍜?"ig"
        const words = text.split(/\s+/);
        let currentLine = '';
        let currentLength = 0;

        for (const word of words) {
          const wordLength = calculateDisplayLength(word);
          const spaceLength = currentLine ? calculateDisplayLength(' ') : 0;
          const testLength = currentLength + spaceLength + wordLength;

          if (testLength > safeMaxCharsPerLine && currentLine.length > 0) {
            // 褰撳墠琛屽凡婊★紝淇濆瓨骞跺紑濮嬫柊琛?
            lines.push(currentLine.trim());
            currentLine = word;
            currentLength = wordLength;

            if (lines.length >= MAX_LINES) {
              // 宸茶揪鍒版渶澶ц鏁帮紝澶勭悊鍓╀綑鍐呭
              const remainingWords = words.slice(words.indexOf(word));
              let truncatedLine = remainingWords.join(' ');
              const truncatedLength = calculateDisplayLength(truncatedLine);

              if (truncatedLength > maxCharsPerLine) {
                // 鎴柇澶暱鐨勫唴瀹?
                let finalLine = '';
                let finalLength = 0;
                for (const w of remainingWords) {
                  const wLen = calculateDisplayLength(w);
                  const sLen = finalLine ? 0.3 : 0;  // 绌烘牸瀹藉害
                  if (finalLength + sLen + wLen <= maxCharsPerLine) {
                    finalLine += (finalLine ? ' ' : '') + w;
                    finalLength += sLen + wLen;
                  } else {
                    break;
                  }
                }
                if (finalLine.length < truncatedLine.length) {
                  finalLine += '...';
                }
                truncatedLine = finalLine;
              }

              lines[lines.length - 1] = truncatedLine;
              break;
            }
          } else {
            // 娣诲姞鍗曡瘝鍒板綋鍓嶈
            currentLine += (currentLine ? ' ' : '') + word;
            currentLength = calculateDisplayLength(currentLine);
          }
        }

        // 娣诲姞鏈€鍚庝竴琛?
        if (currentLine.length > 0 && lines.length < MAX_LINES) {
          lines.push(currentLine.trim());
        }
      }

      // 馃敡 璇婃柇鏃ュ織锛堝凡绠€鍖栵級
      // console.log('[ZimuShengcheng.smartLineBreak] 鉁?鎷嗗垎瀹屾垚:', { ... });

      return lines.slice(0, MAX_LINES);
    };

    // 馃敡 璁＄畻鏂囨湰瀹藉害鐨勮緟鍔╁嚱鏁帮紙涓?SmartLayoutManager 淇濇寔涓€鑷达級
    const calculateTextWidth = (text: string, fontSize: number): number => {
      let width = 0;
      for (const char of text) {
        if (/[\u4e00-\u9fff]/.test(char)) {
          width += fontSize * 0.9; // 涓枃瀛楃
        } else if (/[\u3040-\u309f]/.test(char)) {
          width += fontSize * 0.9; // 鏃ユ枃骞冲亣鍚?
        } else if (/[\u30a0-\u30ff]/.test(char)) {
          width += fontSize * 0.9; // 鏃ユ枃鐗囧亣鍚?
        } else if (/[\uac00-\ud7af]/.test(char)) {
          width += fontSize * 0.9; // 闊╂枃
        } else if (/[\u0400-\u04ff]/.test(char)) {
          width += fontSize * 0.65; // 瑗块噷灏斿瓧姣嶏紙淇勮銆佷箤鍏嬪叞璇瓑锛?
        } else if (/[a-zA-Z0-9]/.test(char)) {
          width += fontSize * 0.5; // 鑻辨枃瀛楁瘝鍜屾暟瀛?
        } else {
          width += fontSize * 0.3; // 鍏朵粬瀛楃
        }
      }
      // 馃敡 銆愪慨澶嶃€戞瀬澶у箙搴﹀鍔犲畨鍏ㄧ郴鏁帮紝浠?1.6 -> 2.0锛岀‘淇濈粷瀵逛笉浼氳秴鍑哄睆骞?
      // FFmpeg drawtext 鐨勫疄闄呮覆鏌撳搴︿笌浼扮畻鍊煎樊寮傚緢澶э紝蹇呴』浣跨敤鏋侀珮鐨勫畨鍏ㄨ竟璺?
      // 鐢ㄦ埛鍙嶉锛氬嵆浣?1.6 绯绘暟锛岄暱鏂囨湰鏈€鍚庣殑瀛椾粛浼氳瑁佹帀锛岃鏄庡疄闄呭搴﹁繙澶т簬浼扮畻
      // 浣跨敤 2.0 绯绘暟鎰忓懗鐫€浼扮畻瀹藉害鏄疄闄呯殑涓ゅ€嶏紝纭繚缁濆瀹夊叏
      return width * 2.0;
    };

    // 馃敡 淇锛氱洿鎺ヤ娇鐢ㄥ疄闄呯殑瑙嗛瀹藉害锛岃€屼笉鏄及绠?
    // 浠巆onstraints鎺ㄥ锛歝onstraints.maxCharsPerLine = (videoWidth * 0.8) / fontSize
    // 鎵€浠?videoWidth = (maxCharsPerLine * fontSize) / 0.8
    // 浣嗘渶鐩存帴鐨勬柟寮忥細usableWidth = videoWidth * 0.8锛宼herefore videoWidth = usableWidth / 0.8
    // 鑰?horizontalMargin = videoWidth * 0.1锛屾墍浠?videoWidth = horizontalMargin * 10
    const firstSubtitle = subtitles[0];
    if (!firstSubtitle) {
      return optimized;
    }
    const estimatedScreenWidth = constraints.videoWidth;

    // 澶勭悊姣忎釜瀛楀箷
    for (const subtitle of subtitles) {
      // 馃敡 銆愬叧閿鏌ャ€戝鏋滃瓧骞曞凡缁忓湪 VideoSubtitle.ts 涓垎鎵瑰鐞嗚繃锛岃烦杩?optimizeLayout
      // 杩欎簺瀛楀箷宸茬粡鏈夋纭殑鏃堕棿鍒嗛厤锛屼笉搴旇鍐嶈鎷嗗垎鎴愬琛屽悓鏃舵樉绀?
      if ((subtitle as any)._skipOptimizeLayout) {
        console.log('[ZimuShengcheng.optimizeLayout] 鈴笍  璺宠繃宸插垎鎵瑰瓧骞?', {
          text: subtitle.text.substring(0, 30),
          start: subtitle.start,
          end: subtitle.end,
          reason: '姝ゅ瓧骞曞凡缁忚繃鍒嗘壒澶勭悊锛屼笉闇€瑕佸啀娆′紭鍖栧竷灞€'
        });
        optimized.push(subtitle);
        continue;
      }

      const displayLength = calculateDisplayLength(subtitle.text);

      // 馃敡 娣诲姞杈圭晫妫€鏌ワ細纭繚瀛楀箷鏂囨湰涓嶈秴鍑哄睆骞?
      let textWidth = calculateTextWidth(subtitle.text, subtitle.style.fontSize);

      // 馃敡 銆愭柊澧炪€戝鏋滃瓧骞曟湁鑳屾櫙锛屽鍔犲搴︽潵琛ュ伩鍓嶅悗娣诲姞鐨勭┖鏍?
      // DrawtextGenerator 涓細涓烘湁鑳屾櫙鐨勫瓧骞曞墠鍚庡悇娣诲姞4涓崐瑙掔┖鏍?
      // 姣忎釜鍗婅绌烘牸瀹藉害绾︿负 fontSize * 0.3锛屾墍浠ユ€诲鍔?4*2*0.3 = 2.4*fontSize
      const hasBackground = subtitle.style.backgroundColor &&
        subtitle.style.backgroundColor !== 'transparent' &&
        subtitle.style.backgroundOpacity !== undefined &&
        subtitle.style.backgroundOpacity > 0;
      if (hasBackground) {
        const spaceWidth = subtitle.style.fontSize * 2.4;  // 鍓嶅悗鍚?涓┖鏍肩殑瀹藉害
        textWidth += spaceWidth;
        // console.log('[ZimuShengcheng.optimizeLayout] 馃敡 瀛楀箷鏈夎儗鏅紝澧炲姞瀹藉害琛ュ伩绌烘牸:', { ... });
      }

      const maxTextWidth = estimatedScreenWidth - 2 * constraints.horizontalMargin;

      // 馃敡 鍏抽敭淇锛氭鏌ユ枃鏈槸鍚﹀お闀匡紝鏃犺濡備綍璋冩暣閮戒細瓒呭嚭灞忓箷
      // 濡傛灉鏄紝寮哄埗鏍囪涓洪渶瑕佹崲琛?
      let forceLineBreak = false;
      if (textWidth > maxTextWidth) {
        forceLineBreak = true;
        console.warn('[ZimuShengcheng.optimizeLayout] 鈿狅笍 鏂囨湰瀹藉害瓒呰繃鍙敤灞忓箷瀹藉害锛屽己鍒舵崲琛?', {
          text: subtitle.text.substring(0, 50),
          textWidth: textWidth.toFixed(2),
          maxTextWidth: maxTextWidth.toFixed(2),
          overflow: (textWidth - maxTextWidth).toFixed(2)
        });
      }

      // 馃敡 鏅鸿兘璋冩暣绛栫暐 - 鐭枃鏈娇鐢ㄥ睆骞曚腑蹇冿紝闀挎枃鏈皟鏁翠互闃茶秴鍑哄睆骞?
      const screenCenterX = estimatedScreenWidth / 2;
      const leftBound = constraints.horizontalMargin + textWidth / 2;
      const rightBound = estimatedScreenWidth - constraints.horizontalMargin - textWidth / 2;

      let adjustedX = screenCenterX;  // 榛樿浣跨敤灞忓箷涓績
      let positionAdjustmentReason = '浣跨敤灞忓箷涓績';

      // 鍙湁鍦ㄤ笉闇€瑕佸己鍒舵崲琛屾椂鎵嶈皟鏁翠綅缃?
      if (!forceLineBreak) {
        if (screenCenterX < leftBound) {
          adjustedX = leftBound;
          positionAdjustmentReason = '鏂囨湰澶暱锛屽乏杈圭晫璋冩暣';
        } else if (screenCenterX > rightBound) {
          adjustedX = rightBound;
          positionAdjustmentReason = '鏂囨湰澶暱锛屽彸杈圭晫璋冩暣';
        }
      }

      // console.log('[ZimuShengcheng.optimizeLayout] 鍗曡瀛楀箷X鍧愭爣:', { ... });

      // 馃敡 璋冭瘯锛氳緭鍑烘瘡涓瓧骞曠殑鎹㈣鍒ゆ柇璇︽儏锛堝凡绠€鍖栵級
      // console.log('[ZimuShengcheng.optimizeLayout] 馃挕 瀛楀箷鎹㈣鍒ゆ柇:', { ... });

      // 濡傛灉瀛楀箷闀垮害瓒呰繃闄愬埗锛屾垨鏂囨湰瀹藉害瓒呰繃灞忓箷锛岄渶瑕佹崲琛?
      if (displayLength > constraints.maxCharsPerLine || forceLineBreak) {
        const lines = this.shouldUseInlineKeywordOverlay()
          ? this.rebalanceInlineKeywordLines(subtitle.text, smartLineBreak(subtitle.text, constraints.maxCharsPerLine))
          : smartLineBreak(subtitle.text, constraints.maxCharsPerLine);

        // 馃敡 娣诲姞璇婃柇鏃ュ織锛氭樉绀簊martLineBreak鐨勮缁嗚緭鍑猴紙宸茬畝鍖栵級
        // console.log('[ZimuShengcheng.optimizeLayout] 馃攳 smartLineBreak璇︾粏杈撳嚭:', { ... });

        if (lines.length > 1) {
          // 澶氳瀛楀箷锛氬垱寤哄涓瓧骞曞璞★紝姣忚涓€涓?
          const lineHeight = constraints.lineHeight;
          const originalDuration = subtitle.end - subtitle.start;

          // 馃敡 鍏抽敭淇锛氫负澶氳瀛楀箷璋冩暣baseY锛岀‘淇濅笉瓒呭嚭灞忓箷搴曢儴
          // 鍘熷baseY鏄负鍗曡璁捐鐨勶紝澶氳闇€瑕佸悜涓婄Щ鍔ㄤ互鐣欏嚭瓒冲绌洪棿
          // 浣嗚繖鍙鍓?琛屾湁鏁堬紝绗?琛屽強浠ュ悗鏄崟鐙樉绀哄湪涓嬩竴甯э紝涓嶉渶瑕佽皟鏁?
          const linesToDisplay = Math.min(lines.length, 2);  // 褰撳墠甯ф渶澶氭樉绀?琛?
          const totalHeight = linesToDisplay * lineHeight;
          const screenBottom = constraints.videoHeight - constraints.verticalMargin;  // 灞忓箷搴曢儴瀹夊叏浣嶇疆
          const multilineLift = linesToDisplay > 1 ? Math.round(lineHeight * 0.55) : 0;
          const adjustedBaseY = Math.max(
            constraints.verticalMargin + lineHeight,
            Math.min(subtitle.position.y - multilineLift, screenBottom - totalHeight + lineHeight)
          );

          // console.log('[ZimuShengcheng.optimizeLayout] 馃搹 澶氳瀛楀箷Y鍧愭爣璋冩暣:', { ... });

          // 馃敡 銆愭牳蹇冩敼杩涖€戝琛屽瓧骞曟寜鏃堕棿姣斾緥鍒嗗抚鏄剧ず
          // 姣忓抚鏈€澶?琛岋紝鍦ㄥ師濮嬫椂闂存鍐呭钩鍧囧垎閰嶏紝涓嶆埅鏂换浣曞唴瀹?
          // 渚嬪锛?琛屽唴瀹瑰湪2绉掑唴锛屾媶鍒嗕负锛氱1-2琛?0-1绉掞紝绗?-4琛?1-2绉?
          const LINES_PER_FRAME = 2;
          const totalFrames = Math.ceil(lines.length / LINES_PER_FRAME);
          const frameWeights = Array.from({ length: totalFrames }, (_, frameIndex) => {
            const frameLines = lines.slice(frameIndex * LINES_PER_FRAME, (frameIndex + 1) * LINES_PER_FRAME);
            const frameTextWeight = frameLines.reduce((sum, frameLine) => sum + Math.max(1, calculateDisplayLength(frameLine)), 0);
            return Math.max(1, frameTextWeight);
          });
          const totalFrameWeight = frameWeights.reduce((sum, weight) => sum + weight, 0);
          const frameTimings = frameWeights.map((weight, frameIndex) => {
            const startRatio = frameWeights.slice(0, frameIndex).reduce((sum, item) => sum + item, 0) / totalFrameWeight;
            const endRatio = frameWeights.slice(0, frameIndex + 1).reduce((sum, item) => sum + item, 0) / totalFrameWeight;
            return {
              start: subtitle.start + originalDuration * startRatio,
              end: subtitle.start + originalDuration * endRatio
            };
          });

          // console.log('[ZimuShengcheng.optimizeLayout] 馃搻 澶氳瀛楀箷鍒嗗抚澶勭悊:', { ... });

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const frameIndex = Math.floor(i / LINES_PER_FRAME); // 灞炰簬绗嚑甯?
            const positionInFrame = i % LINES_PER_FRAME; // 鍦ㄨ繖涓€甯т腑鐨勪綅缃?(0 鎴?1)
            const linesInThisFrame = Math.min(LINES_PER_FRAME, lines.length - frameIndex * LINES_PER_FRAME);

            // 馃敡 銆愭牳蹇冦€戣绠楄繖涓€琛岀殑鏃堕棿娈?
            const lineStartTime = frameTimings[frameIndex].start;
            const lineEndTime = frameTimings[frameIndex].end;

            // console.log(`[ZimuShengcheng.optimizeLayout] 馃敡 鍒涘缓绗?{i + 1}琛屽瓧骞?`, { ... });

            // 馃敡 璁＄畻Y鍧愭爣锛氭瘡甯у唴鐨勮浣跨敤鐩稿悓鐨勫瀭鐩撮棿璺濋€昏緫
            // 濡傛灉杩欏抚鍙湁1琛岋紝鏀惧湪搴曢儴锛涘鏋滄湁2琛岋紝绗?琛屽湪涓婏紝绗?琛屽湪涓?
            let lineY: number;
            if (linesInThisFrame === 1) {
              lineY = adjustedBaseY; // 鍗曡鏀惧湪搴曢儴
            } else {
              // 2琛屾椂锛歱ositionInFrame=0 鍦ㄤ笂鏂癸紝positionInFrame=1 鍦ㄤ笅鏂?
              lineY = adjustedBaseY - (linesInThisFrame - 1 - positionInFrame) * lineHeight;
            }

            // console.log(`[ZimuShengcheng.optimizeLayout] 馃啎 绗?{i + 1}琛孻鍧愭爣璁＄畻:`, { ... });

            // 馃敡 浣跨敤灞忓箷涓績瀵归綈
            const screenCenterX = constraints.videoWidth / 2;
            const lineX = screenCenterX;

            // console.log(`[ZimuShengcheng.optimizeLayout] 澶氳瀛楀箷绗?{i + 1}琛屽潗鏍?`, { ... });

            const lineSubtitle: ArrangedSubtitle = {
              type: subtitle.type,
              text: line,
              start: lineStartTime,
              // 馃敡 鎵€鏈夎浣跨敤鐩稿悓鐨勬寔缁椂闀匡紙濡傛灉鍐呭杈冮暱锛岃嚜鍔ㄥ欢闀匡級
              end: lineEndTime,
              position: {
                x: lineX,
                y: lineY,
                alignment: subtitle.position.alignment || 'center'
              },
              style: {
                ...subtitle.style,
                fontSize: subtitle.style.fontSize // 淇濇寔鍘熷瀛椾綋澶у皬锛岀‘淇濆琛屽瓧浣撲竴鑷?
              },
              layer: subtitle.layer
            };

            // 濡傛灉鏈夊姩鐢婚厤缃紝涔熷鍒惰繃鏉?
            if (subtitle.animationConfig) {
              lineSubtitle.animationConfig = subtitle.animationConfig;
            }

            // console.log(`[ZimuShengcheng.optimizeLayout] 鉁?绗?{i + 1}琛屽瓧骞曞璞″凡鍒涘缓锛屽嵆灏唒ush鍒皁ptimized鏁扮粍`, { ... });

            optimized.push(lineSubtitle);
          }

          // console.log(`[ZimuShengcheng.optimizeLayout] 鉁?澶氳瀛楀箷澶勭悊瀹屾垚锛宱ptimized鏁扮粍涓凡娣诲姞${lines.length}涓瓧骞昤, { ... });
        } else {
          // 馃敡 鍏抽敭淇锛氬綋 forceLineBreak 涓?true 鏃讹紝鍗充娇 smartLineBreak 鍙繑鍥?1 琛岋紝
          // 涔熷簲璇ヤ娇鐢?screenCenterX 鑰屼笉鏄?adjustedX锛岀‘淇濇枃鏈眳涓榻?
          // adjustedX 鍙兘琚缃负杈圭晫鍊硷紙leftBound 鎴?rightBound锛夛紝瀵艰嚧鏂囨湰鍋忓悜鍙宠竟
          const finalX = forceLineBreak ? (constraints.videoWidth / 2) : adjustedX;

          // console.log('[ZimuShengcheng.optimizeLayout] 鍗曡瀛楀箷浣嶇疆鏈€缁堢‘瀹?', { ... });

          optimized.push({
            ...subtitle,
            position: {
              ...subtitle.position,
              x: finalX
            }
          });
        }
      } else {
        // 瀛楀箷闀垮害鍦ㄩ檺鍒跺唴锛屼娇鐢ㄨ皟鏁村悗鐨刋鍧愭爣
        optimized.push({
          ...subtitle,
          position: {
            ...subtitle.position,
            x: adjustedX
          }
        });
      }
    }

    console.log(`[ZimuShengcheng.optimizeLayout] 优化完成: ${subtitles.length} -> ${optimized.length} 个字幕`);
    return optimized;
  }

  // ==================== 姝ラ4-5: 鐢熸垚ASS鍜宒rawtext ====================

  /**
   * 鐢熸垚ASS鏂囦欢锛堟櫘閫氬瓧骞曞眰鍜岀畝鍗曠壒鏁堝眰锛?
   * @private
   */
  private async generateASSFiles(
    subtitles: ArrangedSubtitle[],
    config: ZimuConfig
  ): Promise<string[]> {
    const files: string[] = [];

    // 1. 鏅€氬瓧骞曞眰
    const normalSubtitles = subtitles.filter(s => s.layer === 'ass_normal');
    if (normalSubtitles.length > 0) {
      const normalFile = await this.generateNormalASSFile(normalSubtitles, config);
      files.push(normalFile);
    }

    // 2. 鐗规晥瀛楀箷灞傦紙ASS锛?
    const effectSubtitles = subtitles.filter(s => s.layer === 'ass_effect');
    if (effectSubtitles.length > 0) {
      const effectFile = await this.generateEffectASSFile(effectSubtitles, config);
      files.push(effectFile);
    }

    return files;
  }

  /**
   * 鐢熸垚鏅€氬瓧骞旳SS鏂囦欢
   * @private
   */
  private async generateNormalASSFile(
    subtitles: ArrangedSubtitle[],
    config: ZimuConfig
  ): string {
    // 鍒涘缓鏍峰紡
    const normalStyle = ASSGenerator.convertRenderStyleToASS(
      'Normal',
      subtitles[0].style,
      config.videoHeight
    );

    // 鍒涘缓浜嬩欢
    const events = subtitles.map(s =>
      ASSGenerator.subtitleToDialogue(s, 'Normal')
    );

    // 鐢熸垚ASS鍐呭
    const assContent = ASSGenerator.generate(
      events,
      [normalStyle],
      { width: config.videoWidth, height: config.videoHeight, fontDir: config.fontDir }
    );

    // 淇濆瓨鏂囦欢
    const tempDir = await this.getTempDir();
    const filePath = `${tempDir}/layer1_normal_${Date.now()}.ass`;
    await ASSGenerator.saveToFile(assContent, filePath);

    return filePath;
  }

  /**
   * 鐢熸垚鐗规晥瀛楀箷ASS鏂囦欢
   * @private
   */
  private async generateEffectASSFile(
    subtitles: ArrangedSubtitle[],
    config: ZimuConfig
  ): Promise<string> {
    // 鍒涘缓鏍峰紡锛堥噾鑹茬壒鏁堬級
    const effectStyle = this.createGoldEffectStyle(config);

    // 鍒涘缓浜嬩欢锛堝甫ASS鐗规晥鏍囩锛?
    const events: ASSDialogueEvent[] = subtitles.map(s => {
      const event = ASSGenerator.subtitleToDialogue(s, 'GoldEffect');

      // 娣诲姞缂╂斁鏁堟灉鏍囩
      event.text = ASSGenerator.generateScaleEffect(
        s.text,
        s.position.x,
        s.position.y,
        effectStyle.primaryColour
      );

      return event;
    });

    // 鐢熸垚ASS鍐呭
    const assContent = ASSGenerator.generate(
      events,
      [effectStyle],
      { width: config.videoWidth, height: config.videoHeight, fontDir: config.fontDir }
    );

    // 淇濆瓨鏂囦欢
    const tempDir = await this.getTempDir();
    const filePath = `${tempDir}/layer2_effects_${Date.now()}.ass`;
    await ASSGenerator.saveToFile(assContent, filePath);

    return filePath;
  }

  /**
   * 鐢熸垚drawtext鍛戒护锛堢函drawtext鏂规锛氭墍鏈夊瓧骞曢兘鐢╠rawtext娓叉煋锛?
   * @private
   */
  private generateDrawtextCommands(
    subtitles: ArrangedSubtitle[],
    fontDir: string
  ): string[] {
    const commands: string[] = [];

    console.log('[ZimuShengcheng.generateDrawtextCommands] 寮€濮嬬敓鎴愶紝瀛楀箷鏁伴噺:', subtitles.length);

    // 馃攳 鍏抽敭璇婃柇锛氭鏌ョ涓€鏉″瓧骞曠殑鏃堕棿
    if (subtitles.length > 0) {
      const first = subtitles[0];
      console.log('[ZimuShengcheng] 鉁?绗竴鏉″瓧骞曠殑鏃堕棿淇℃伅:', {
        start: first.start,
        end: first.end,
        startSec: (first.start / 1000).toFixed(2),
        endSec: (first.end / 1000).toFixed(2),
        text: first.text.substring(0, 30),
        type: first.type
      });
    }

    // 銆愮函drawtext鏂规銆戝鐞嗘墍鏈夊瓧骞曪紝涓嶅尯鍒唋ayer
    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i];
      try {
        // 馃攳 鍙褰曠1鏉″瓧骞曠殑璇︾粏淇℃伅
        if (i === 0) {
          console.log(`[ZimuShengcheng] 绗竴鏉″瓧骞曡鎯? 绫诲瀷=${subtitle.type}, 鏂囧瓧="${subtitle.text.substring(0, 30)}", 鏃堕棿=${subtitle.start.toFixed(2)}s-${subtitle.end.toFixed(2)}s`);
        }

        if (subtitle.type === 'normal') {
          const inlineModeEnabled = this.shouldUseInlineKeywordOverlay();
          if (i === 0) {
            console.log('[ZimuShengcheng.generateDrawtextCommands] inline妯″紡妫€鏌?', {
              keywordRenderMode: this.config?.keywordRenderMode,
              inlineModeEnabled,
              keywordMatches: this.keywordMatches.length,
              hasEffectSubtitles: this.arrangedSubtitles.some((subtitle) => subtitle.type !== 'normal'),
              groupsWithEffectId: (this.config?.keywordGroups || []).filter((group: any) => !!group?.effectId).length
            });
          }

          let primaryCommand = '';
          if (inlineModeEnabled) {
            const inlineCommands = this.generateInlineKeywordOverlayDrawtexts(subtitle, fontDir);
            console.log('[ZimuShengcheng.generateDrawtextCommands] inline 高亮命令:', {
              subtitle: subtitle.text.substring(0, 30),
              count: inlineCommands.length,
              overlayMode: inlineCommands.length > 0
            });

            if (inlineCommands.length > 0) {
              commands.push(...inlineCommands);
              primaryCommand = inlineCommands[0];
            } else {
              const baseNormalCommand = this.generateNormalDrawtext(subtitle, fontDir);
              commands.push(baseNormalCommand);
              primaryCommand = baseNormalCommand;
            }
          } else {
            const baseNormalCommand = this.generateNormalDrawtext(subtitle, fontDir);
            commands.push(baseNormalCommand);
            primaryCommand = baseNormalCommand;
          }

          if (i === 0 && primaryCommand) {
            const enableMatch = primaryCommand.match(/enable='([^']+)'/);
            if (enableMatch) {
              console.log(`[ZimuShengcheng] 鉁?绗竴鏉″瓧骞昬nable: ${enableMatch[1]}`);
            }
          }
        } else if (subtitle.type === 'effect_complex') {
          // 鐗规晥瀛楀箷锛堝甫鍔ㄧ敾锛夛細浣跨敤 drawtext 娓叉煋锛堟敮鎸佸姩鐢绘晥鏋滐級
          // 銆愪慨澶嶃€戣浆鎹㈡椂闂村崟浣嶄负绉?
          const normalizedSubtitle = {
            ...subtitle,
            start: this.normalizeTimeToSeconds(subtitle.start),
            end: this.normalizeTimeToSeconds(subtitle.end)
          };

          const effectType = subtitle.animationConfig?.parameters?.effectType || 'SLIDE_IN_UP';
          const fontfile = this.resolveFontPath(subtitle.style.fontName, fontDir);

          const effectDuration = subtitle.animationConfig?.duration || 2000;
          const effectParams = {
            duration: effectDuration,
            intensity: subtitle.animationConfig?.intensity || 0.8,
            delay: subtitle.animationConfig?.delay || 0,
            speed: subtitle.animationConfig?.parameters?.speed || 1.0,
            ...subtitle.animationConfig?.parameters
          };

          const result = DrawtextGenerator.generateByEffectType(
            normalizedSubtitle,
            fontfile,
            effectType,
            effectParams
          );

          if (Array.isArray(result)) {
            commands.push(...result);
            console.log(`[ZimuShengcheng] 特效字幕命令生成完成，子命令数: ${result.length}`);
          } else {
            commands.push(result);
            console.log(`[ZimuShengcheng] 鉁?鐢熸垚鐗规晥瀛楀箷鍛戒护瀹屾垚`);
          }
        } else if (subtitle.type === 'effect_simple') {
          // 馃敡 淇锛氱畝鍗曠壒鏁堝瓧骞曚篃搴旇搴旂敤鐗规晥鍔ㄧ敾
          // 涔嬪墠閿欒鍦扮洿鎺ョ敓鎴愭櫘閫氬瓧骞曪紝瀵艰嚧DANMAKU銆丄RC_TEXT绛夌壒鏁堜笉鏄剧ず
          const normalizedSubtitle = {
            ...subtitle,
            start: this.normalizeTimeToSeconds(subtitle.start),
            end: this.normalizeTimeToSeconds(subtitle.end)
          };

          const effectType = subtitle.animationConfig?.parameters?.effectType || 'SLIDE_IN_UP';
          const fontfile = this.resolveFontPath(subtitle.style.fontName, fontDir);

            console.log('[ZimuShengcheng] 简单特效字幕生成:', {
            text: subtitle.text.substring(0, 20),
            effectType,
            hasAnimationConfig: !!subtitle.animationConfig
          });

          const effectDuration = subtitle.animationConfig?.duration || 2000;
          const effectParams = {
            duration: effectDuration,
            intensity: subtitle.animationConfig?.intensity || 0.8,
            delay: subtitle.animationConfig?.delay || 0,
            speed: subtitle.animationConfig?.parameters?.speed || 1.0,
            ...subtitle.animationConfig?.parameters
          };

          const result = DrawtextGenerator.generateByEffectType(
            normalizedSubtitle,
            fontfile,
            effectType,
            effectParams
          );

          if (Array.isArray(result)) {
            commands.push(...result);
            console.log(`[ZimuShengcheng] 简单特效字幕命令生成完成，子命令数: ${result.length}`);
          } else {
            commands.push(result);
            console.log('[ZimuShengcheng] 简单特效字幕命令生成完成');
          }
        }
      } catch (error) {
        console.error('[ZimuShengcheng] 生成 drawtext 命令失败:', {
          subtitleText: subtitle.text?.substring(0, 20),
          error: error instanceof Error ? error.message : String(error)
        });

        if (subtitle.type === 'normal') {
          try {
            const fallbackCommand = this.generateSafeNormalDrawtextFallback(subtitle, fontDir);
            commands.push(fallbackCommand);
            console.warn('[ZimuShengcheng] 普通字幕已使用兜底 drawtext 方案恢复输出:', {
              subtitleText: subtitle.text?.substring(0, 20)
            });
          } catch (fallbackError) {
            console.error('[ZimuShengcheng] 普通字幕兜底方案仍然失败:', {
              subtitleText: subtitle.text?.substring(0, 20),
              error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
            });
          }
        }
      }
    }

    console.log('[ZimuShengcheng.generateDrawtextCommands] 鐢熸垚瀹屾垚锛屽懡浠ゆ暟閲?', commands.length);

    // 馃敡 鍙栨秷寮哄埗淇锛氫娇鐢ㄥ疄闄呰绠楃殑鐗规晥瀛楀箷浣嶇疆
    // 涓嶅啀寮哄埗鏇挎崲 x 鍙傛暟涓?100锛岃€屾槸淇濈暀 SmartLayoutManager 璁＄畻鐨勫€?
    const correctedCommands = commands.map((cmd, idx) => {
      const subtitle = subtitles[idx];
      if (!subtitle) return cmd;

      // 馃敡 瀵圭壒鏁堝瓧骞曪細淇濈暀鍘熷鍛戒护锛堝凡鍦╣enerateNormalDrawtext涓娇鐢╬osition.x锛?
      if (subtitle.type === 'effect_complex' || subtitle.type === 'effect_simple') {
        console.log(`[ZimuShengcheng.generateDrawtextCommands] 鉁?鐗规晥瀛楀箷浣跨敤SmartLayoutManager鐨勪綅缃绠?`, {
          text: subtitle.text.substring(0, 15),
          type: subtitle.type,
          position_x: subtitle.position.x,
          command: cmd.substring(0, 100)
        });
      }

      return cmd;  // 淇濈暀鍘熷鍛戒护
    });

    return correctedCommands;
  }

  private isInlineKeywordRenderMode(config: Pick<ZimuConfig, 'keywordRenderMode'> = this.config): boolean {
    return config?.keywordRenderMode === 'inline-emphasis';
  }

  private shouldUseInlineKeywordOverlay(): boolean {
    if (this.isInlineKeywordRenderMode(this.config)) {
      return true;
    }

    const hasKeywordMatches = this.keywordMatches.length > 0;
    const hasEffectSubtitles = this.arrangedSubtitles.some((subtitle) => subtitle.type !== 'normal');
    const hasConfiguredEffectIds = (this.config?.keywordGroups || []).some((group: any) => !!group?.effectId);

    return hasKeywordMatches && !hasEffectSubtitles && !hasConfiguredEffectIds;
  }

  private resolvePreferredNormalSubtitleY(subtitle: ArrangedSubtitle): number {
    const fallbackY = Math.round(subtitle.position.y);
    if (subtitle.type !== 'normal') {
      return fallbackY;
    }

    const fontSize = this.config?.subtitleStyle?.fontSize || subtitle.style?.fontSize || 48;
    const topSafeY = fontSize + 50;
    const bottomSafeY = this.config.videoHeight - fontSize * 1.8 - 50;
    // Respect the y position already calculated by createNormalSubtitle/optimizeLayout.
    // Recomputing here collapses multi-line subtitles back onto a single baseline.
    return Math.max(topSafeY, Math.min(fallbackY, bottomSafeY));
  }

  private generateInlineKeywordOverlayDrawtexts(
    subtitle: ArrangedSubtitle,
    fontDir: string
  ): string[] {
    if (!this.shouldUseInlineKeywordOverlay() || subtitle.type !== 'normal' || this.keywordMatches.length === 0) {
      return [];
    }

    const subtitleText = this.normalizeTextForDisplay(subtitle.text);
    if (!subtitleText.trim()) {
      return [];
    }

    const subtitleStart = this.normalizeTimeToSeconds(subtitle.start);
    const subtitleEnd = this.normalizeTimeToSeconds(subtitle.end);
    const lines = subtitleText.includes('\n') ? subtitleText.split('\n') : [subtitleText];
    const flattenedText = lines.join('');
    const matches = this.resolveInlineKeywordMatches(flattenedText, subtitleStart, subtitleEnd);

    console.log('[ZimuShengcheng.generateInlineKeywordOverlayDrawtexts] 鍖归厤褰撳墠瀛楀箷鐨勫叧閿瘝:', {
      subtitle: subtitle.text.substring(0, 30),
      subtitleStart,
      subtitleEnd,
      totalKeywordMatches: this.keywordMatches.length,
      matchedCount: matches.length,
      matchedKeywords: matches.map((match) => match.keyword),
      matchedRanges: matches.map((match) => `${match.normalizedStartTime.toFixed(3)}-${match.normalizedEndTime.toFixed(3)}`)
    });

    if (matches.length === 0) {
      return [];
    }

    const inlineBaseStyle = this.getInlineBaseStyle(subtitle.style);
    const lineSpacing =
      inlineBaseStyle.backgroundColor &&
      inlineBaseStyle.backgroundColor !== 'transparent' &&
      (inlineBaseStyle.backgroundOpacity ?? 0) > 0
        ? Math.round(inlineBaseStyle.fontSize * 0.18)
        : Math.round(inlineBaseStyle.fontSize * 0.36);
    const lineRuns = this.buildInlineLineRuns(lines, matches, inlineBaseStyle);
    const lineHeights = lineRuns.map((runs) =>
      Math.max(...runs.map((run) => this.estimateInlineRunHeight(run.style)), this.estimateInlineRunHeight(inlineBaseStyle))
    );
    const blockHeight =
      lineHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, lineRuns.length - 1) * lineSpacing;
    const baseY = Math.max(24, Math.min(Math.round(subtitle.position.y), this.config.videoHeight - blockHeight - 24));
    const commands: string[] = [];
    let currentY = baseY;

    lineRuns.forEach((runs, lineIndex) => {
      const lineHeight = lineHeights[lineIndex] || subtitle.style.fontSize;
      const lineWidth = runs.reduce((sum, run, runIndex) => {
        const nextRun = runs[runIndex + 1];
        return sum + this.estimateInlineRunWidth(run.text, run.style) + this.getInlineRunGap(run, nextRun);
      }, 0);
      let currentX = this.computeInlineLineLeftByWidth(
        lineWidth,
        subtitle.position.x,
        subtitle.position.alignment || 'center',
        60
      );

      runs.forEach((run, runIndex) => {
        if (!run.text) {
          return;
        }

        const keywordBaselineOffset = 0;

        const command = this.createInlineTextDrawCommand(
          run.text,
          run.style,
          fontDir,
          currentX,
          currentY + Math.max(0, lineHeight - this.estimateInlineRunHeight(run.style)) + keywordBaselineOffset,
          subtitleStart,
          subtitleEnd
        );
        commands.push(command);
        currentX += this.estimateInlineRunWidth(run.text, run.style) + this.getInlineRunGap(run, runs[runIndex + 1]);
      });

      currentY += lineHeight + lineSpacing;
    });

    return commands;
  }

  private resolveInlineKeywordMatchesFromSubtitle(
    flattenedText: string,
    subtitleStart: number,
    subtitleEnd: number
  ): Array<KeywordMatch & {
    normalizedStartTime: number;
    normalizedEndTime: number;
    occurrenceStart: number;
    occurrenceEnd: number;
  }> {
    const keywordGroups = Array.isArray(this.config?.keywordGroups) ? this.config.keywordGroups : [];
    if (!flattenedText || keywordGroups.length === 0) {
      return [];
    }

    const candidates: Array<KeywordMatch & {
      normalizedStartTime: number;
      normalizedEndTime: number;
      occurrenceStart: number;
      occurrenceEnd: number;
    }> = [];

    for (const group of keywordGroups) {
      const groupKeywords = Array.isArray(group?.keywords) ? group.keywords : [];
      if (groupKeywords.length === 0) {
        continue;
      }

      for (const keywordItem of groupKeywords) {
        const rawKeyword = typeof keywordItem === 'string' ? keywordItem : keywordItem?.keyword;
        const normalizedKeyword = this.normalizeTextForDisplay(String(rawKeyword || ''));
        if (!normalizedKeyword) {
          continue;
        }

        let searchFrom = 0;
        while (searchFrom < flattenedText.length) {
          const occurrenceStart = flattenedText.indexOf(normalizedKeyword, searchFrom);
          if (occurrenceStart === -1) {
            break;
          }

          const style = typeof keywordItem === 'string'
            ? this.buildKeywordStyle(group)
            : keywordItem?.styleOverride
              ? this.buildKeywordStyleFromConfig(keywordItem.styleOverride)
              : this.buildKeywordStyle(group);

          const rawEffectId = (typeof keywordItem === 'string' ? undefined : keywordItem?.effectId) || group?.effectId || group?.effectConfig?.type || 'pulse-scale';
          const effectType = this.normalizeEffectType(rawEffectId);

          candidates.push({
            keyword: normalizedKeyword,
            startIndex: occurrenceStart,
            endIndex: occurrenceStart + normalizedKeyword.length,
            startTime: subtitleStart,
            endTime: subtitleEnd,
            groupId: group?.id || group?.groupId || group?.name || normalizedKeyword,
            groupName: group?.name || group?.groupName || '',
            effectType: effectType as EffectType,
            isAnimated: false,
            style,
            normalizedStartTime: subtitleStart,
            normalizedEndTime: subtitleEnd,
            occurrenceStart,
            occurrenceEnd: occurrenceStart + normalizedKeyword.length
          });

          searchFrom = occurrenceStart + Math.max(1, normalizedKeyword.length);
        }
      }
    }

    const sortedCandidates = candidates.sort((a, b) =>
      a.occurrenceStart - b.occurrenceStart ||
      (b.occurrenceEnd - b.occurrenceStart) - (a.occurrenceEnd - a.occurrenceStart)
    );

    const mergedMatches: Array<KeywordMatch & {
      normalizedStartTime: number;
      normalizedEndTime: number;
      occurrenceStart: number;
      occurrenceEnd: number;
    }> = [];

    for (const candidate of sortedCandidates) {
      const last = mergedMatches[mergedMatches.length - 1];
      if (!last) {
        mergedMatches.push(candidate);
        continue;
      }

      const overlapsOrTouches = candidate.occurrenceStart <= last.occurrenceEnd;
      if (!overlapsOrTouches) {
        mergedMatches.push(candidate);
        continue;
      }

      const lastLength = last.occurrenceEnd - last.occurrenceStart;
      const candidateLength = candidate.occurrenceEnd - candidate.occurrenceStart;
      const dominant = candidateLength > lastLength ? candidate : last;

      last.keyword = flattenedText.slice(
        Math.min(last.occurrenceStart, candidate.occurrenceStart),
        Math.max(last.occurrenceEnd, candidate.occurrenceEnd)
      );
      last.startIndex = Math.min(last.startIndex, candidate.startIndex);
      last.endIndex = Math.max(last.endIndex, candidate.endIndex);
      last.occurrenceStart = Math.min(last.occurrenceStart, candidate.occurrenceStart);
      last.occurrenceEnd = Math.max(last.occurrenceEnd, candidate.occurrenceEnd);
      last.groupId = dominant.groupId;
      last.groupName = dominant.groupName;
      last.effectType = dominant.effectType;
      last.style = dominant.style;
    }

    return mergedMatches.sort((a, b) => a.occurrenceStart - b.occurrenceStart);
  }

  private resolveInlineKeywordMatches(flattenedText: string, subtitleStart: number, subtitleEnd: number): Array<KeywordMatch & {
    normalizedStartTime: number;
    normalizedEndTime: number;
    occurrenceStart: number;
    occurrenceEnd: number;
  }> {
    const usedOccurrences = new Set<number>();

    return this.keywordMatches
      .map((match) => {
        const normalizedKeyword = this.normalizeTextForDisplay(match.keyword);
        if (!normalizedKeyword) {
          return null;
        }

        const normalizedStartTime = this.normalizeTimeToSeconds(match.startTime);
        const normalizedEndTime = this.normalizeTimeToSeconds(match.endTime);
        if (normalizedStartTime >= subtitleEnd || normalizedEndTime <= subtitleStart) {
          return null;
        }

        const occurrenceCandidates = this.findAllInlineTextOccurrences(flattenedText, normalizedKeyword);
        if (occurrenceCandidates.length === 0) {
          return null;
        }

        const occurrenceStart = occurrenceCandidates.find((candidate) => !usedOccurrences.has(candidate));
        if (occurrenceStart === undefined) {
          return null;
        }
        usedOccurrences.add(occurrenceStart);

        return {
          ...match,
          normalizedStartTime,
          normalizedEndTime,
          occurrenceStart,
          occurrenceEnd: occurrenceStart + normalizedKeyword.length
        };
      })
      .filter((match): match is KeywordMatch & {
        normalizedStartTime: number;
        normalizedEndTime: number;
        occurrenceStart: number;
        occurrenceEnd: number;
      } => !!match)
      .sort((a, b) => a.occurrenceStart - b.occurrenceStart || b.occurrenceEnd - a.occurrenceEnd);
  }

  private findAllInlineTextOccurrences(text: string, keyword: string): number[] {
    const occurrences: number[] = [];
    if (!text || !keyword) {
      return occurrences;
    }

    let searchFrom = 0;
    while (searchFrom < text.length) {
      const index = text.indexOf(keyword, searchFrom);
      if (index === -1) {
        break;
      }

      occurrences.push(index);
      searchFrom = index + Math.max(1, keyword.length);
    }

    return occurrences;
  }

  private getInlineProtectedKeywordRanges(text: string): Array<{ start: number; end: number }> {
    const normalizedText = this.normalizeTextForDisplay(text);
    if (!normalizedText || this.keywordMatches.length === 0) {
      return [];
    }

    const rawRanges: Array<{ start: number; end: number }> = [];
    const uniqueKeywords = Array.from(new Set(
      this.keywordMatches
        .map((match) => this.normalizeTextForDisplay(match.keyword))
        .filter((keyword) => !!keyword)
    ));

    uniqueKeywords.forEach((keyword) => {
      this.findAllInlineTextOccurrences(normalizedText, keyword).forEach((start) => {
        rawRanges.push({
          start,
          end: start + keyword.length
        });
      });
    });

    rawRanges.sort((a, b) => a.start - b.start || a.end - b.end);

    return rawRanges.reduce<Array<{ start: number; end: number }>>((merged, current) => {
      const last = merged[merged.length - 1];
      if (!last || current.start > last.end) {
        merged.push({ ...current });
      } else {
        last.end = Math.max(last.end, current.end);
      }
      return merged;
    }, []);
  }

  private rebalanceInlineKeywordLines(text: string, lines: string[]): string[] {
    if (lines.length <= 1) {
      return lines;
    }

    const protectedRanges = this.getInlineProtectedKeywordRanges(text);
    if (protectedRanges.length === 0) {
      return lines;
    }

    const boundaries: number[] = [];
    let consumed = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      consumed += lines[i].length;
      boundaries.push(consumed);
    }

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      const previousBoundary = i === 0 ? 0 : boundaries[i - 1];
      const nextBoundary = i === boundaries.length - 1 ? text.length : boundaries[i + 1];
      const protectedRange = protectedRanges.find((range) => boundary > range.start && boundary < range.end);

      if (!protectedRange) {
        continue;
      }

      const candidateBoundaries = [protectedRange.start, protectedRange.end]
        .filter((candidate) => candidate > previousBoundary && candidate < nextBoundary);

      if (candidateBoundaries.length === 0) {
        continue;
      }

      let bestBoundary = candidateBoundaries[0];
      let bestScore = Number.POSITIVE_INFINITY;

      candidateBoundaries.forEach((candidate) => {
        const leftLength = candidate - previousBoundary;
        const rightLength = nextBoundary - candidate;
        const shorterSide = Math.min(leftLength, rightLength);
        const imbalance = Math.abs(leftLength - rightLength);
        const shortLinePenalty = shorterSide <= 1 ? 1000 : shorterSide <= 2 ? 120 : 0;
        const movementPenalty = Math.abs(candidate - boundary) * 0.25;
        const score = imbalance + shortLinePenalty + movementPenalty;

        if (score < bestScore) {
          bestScore = score;
          bestBoundary = candidate;
        }
      });

      boundaries[i] = bestBoundary;
    }

    const result: string[] = [];
    let start = 0;
    boundaries.forEach((boundary) => {
      result.push(text.slice(start, boundary));
      start = boundary;
    });
    result.push(text.slice(start));

    return result.filter((line) => line.length > 0);
  }

  private buildInlineLineRuns(
    lines: string[],
    matches: Array<KeywordMatch & {
      occurrenceStart: number;
      occurrenceEnd: number;
    }>,
    baseStyle: ArrangedSubtitle['style']
  ): Array<Array<{ text: string; style: ArrangedSubtitle['style']; isKeyword: boolean }>> {
    const lineRuns: Array<Array<{ text: string; style: ArrangedSubtitle['style']; isKeyword: boolean }>> = [];
    let consumed = 0;

    lines.forEach((lineText) => {
      const runs: Array<{ text: string; style: ArrangedSubtitle['style']; isKeyword: boolean }> = [];
      const lineStart = consumed;
      const lineEnd = consumed + lineText.length;
      consumed = lineEnd;

      const lineMatches = matches
        .filter((match) => match.occurrenceStart < lineEnd && match.occurrenceEnd > lineStart)
        .sort((a, b) => a.occurrenceStart - b.occurrenceStart || b.occurrenceEnd - a.occurrenceEnd);

      let cursor = lineStart;
      lineMatches.forEach((match) => {
        const fragmentStart = Math.max(lineStart, match.occurrenceStart);
        const fragmentEnd = Math.min(lineEnd, match.occurrenceEnd);
        if (fragmentStart > cursor) {
          runs.push({
            text: lineText.slice(cursor - lineStart, fragmentStart - lineStart),
            style: { ...baseStyle },
            isKeyword: false
          });
        }

        const keywordText = lineText.slice(fragmentStart - lineStart, fragmentEnd - lineStart);
        runs.push({
          text: keywordText,
          style: {
            ...baseStyle,
            fontName: this.normalizeFontNameValue(match.style?.fontName || baseStyle.fontName),
            fontSize: this.normalizeNumericValue(baseStyle.fontSize, this.config?.subtitleStyle?.fontSize || 48),
            fontColor: this.normalizeColorValue(match.style?.fontColor, baseStyle.fontColor),
            outlineColor: this.normalizeColorValue(match.style?.outlineColor, baseStyle.outlineColor),
            outlineWidth: this.normalizeNumericValue(match.style?.outlineWidth, baseStyle.outlineWidth ?? 0),
            shadowColor: this.normalizeColorValue(match.style?.shadowColor, baseStyle.shadowColor || 'transparent'),
            shadowOffset: this.normalizeNumericValue(match.style?.shadowOffset, baseStyle.shadowOffset ?? 0),
            shadowBlur: this.normalizeNumericValue(match.style?.shadowBlur, baseStyle.shadowBlur ?? 0),
            backgroundColor: this.normalizeColorValue(match.style?.backgroundColor, baseStyle.backgroundColor || 'transparent'),
            backgroundOpacity: this.normalizeNumericValue(match.style?.backgroundOpacity, baseStyle.backgroundOpacity ?? 0)
          },
          isKeyword: true
        });
        cursor = Math.max(cursor, fragmentEnd);
      });

      if (cursor < lineEnd) {
        runs.push({
          text: lineText.slice(cursor - lineStart),
          style: { ...baseStyle },
          isKeyword: false
        });
      }

      lineRuns.push(runs.filter((run) => run.text.length > 0));
    });

    return lineRuns;
  }

  private createInlineTextDrawCommand(
    text: string,
    style: ArrangedSubtitle['style'],
    fontDir: string,
    x: number,
    y: number,
    startTime: number,
    endTime: number
  ): string {
    const fontPath = this.resolveFontPath(style.fontName, fontDir);
    const fontColor = this.convertHexToDrawtext(style.fontColor);
    const outlineColor = this.convertHexToDrawtext(style.outlineColor);
    const escapedText = text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/\n/g, '\\n');

    const config: any = {
      fontfile: fontPath,
      text: escapedText,
      x: `max(18,min(${Math.round(x)},w-text_w-18))`,
      y: `max(24,min(${Math.round(y)},h-text_h-24))`,
      fontsize: style.fontSize,
      fontcolor: fontColor,
      borderw: style.outlineWidth || 0,
      bordercolor: outlineColor,
      enable: `between(t,${startTime.toFixed(3)},${endTime.toFixed(3)})`,
      line_spacing: Math.round(style.fontSize * 0.18)
    };

    const shadowOffset = style.shadowOffset ?? 0;
    if (shadowOffset > 0 && style.shadowColor && style.shadowColor !== 'transparent') {
      config.shadowcolor = this.convertHexToDrawtext(style.shadowColor);
      config.shadowx = shadowOffset;
      config.shadowy = shadowOffset;
    }

    return DrawtextGenerator.generateNormalSubtitle(
      config,
      style.backgroundColor,
      style.backgroundOpacity
    );
  }

  private getInlineBaseStyle(style: ArrangedSubtitle['style']): ArrangedSubtitle['style'] {
    return {
      ...style,
      fontName: this.normalizeFontNameValue(style?.fontName),
      fontSize: this.normalizeNumericValue(style?.fontSize, this.config?.subtitleStyle?.fontSize || 48),
      fontColor: this.normalizeColorValue(style?.fontColor, '#FFFFFF'),
      outlineColor: this.normalizeColorValue(style?.outlineColor, '#000000'),
      outlineWidth: this.normalizeNumericValue(style?.outlineWidth, 0),
      shadowColor: this.normalizeColorValue(style?.shadowColor, 'transparent'),
      shadowOffset: this.normalizeNumericValue(style?.shadowOffset, 0),
      shadowBlur: this.normalizeNumericValue(style?.shadowBlur, 0),
      backgroundColor: this.normalizeColorValue(style?.backgroundColor, 'transparent'),
      backgroundOpacity: this.normalizeNumericValue(style?.backgroundOpacity, 0)
    };
  }

  private estimateInlineRunWidth(text: string, style: ArrangedSubtitle['style']): number {
    const baseWidth = this.estimateInlineTextWidth(text, style.fontSize);
    const outlinePadding = Math.ceil((style.outlineWidth ?? 0) * 2);
    const boldSafety = Math.ceil(style.fontSize * 0.04);
    return baseWidth + outlinePadding + boldSafety;
  }

  private estimateInlineRunHeight(style: ArrangedSubtitle['style']): number {
    return Math.round(style.fontSize + Math.max(4, (style.outlineWidth ?? 0) * 2 + style.fontSize * 0.08));
  }

  private getInlineRunGap(
    currentRun: { text: string; style: ArrangedSubtitle['style']; isKeyword: boolean },
    nextRun?: { text: string; style: ArrangedSubtitle['style']; isKeyword: boolean }
  ): number {
    if (!nextRun) {
      return 0;
    }

    const maxFontSize = Math.max(currentRun.style.fontSize, nextRun.style.fontSize);
    if (currentRun.isKeyword || nextRun.isKeyword) {
      return Math.max(6, Math.round(maxFontSize * 0.12));
    }

    return Math.max(2, Math.round(maxFontSize * 0.04));
  }

  private computeInlineLineLeft(
    text: string,
    fontSize: number,
    anchorX: number,
    alignment: 'left' | 'center' | 'right',
    horizontalMargin: number
  ): number {
    const lineWidth = this.estimateInlineTextWidth(text, fontSize);
    const maxX = Math.max(horizontalMargin, this.config.videoWidth - lineWidth - horizontalMargin);

    if (alignment === 'left') {
      return Math.max(horizontalMargin, Math.min(anchorX, maxX));
    }

    if (alignment === 'right') {
      return Math.max(horizontalMargin, Math.min(anchorX - lineWidth, maxX));
    }

    return Math.max(horizontalMargin, Math.min(anchorX - lineWidth / 2, maxX));
  }

  private computeInlineLineLeftByWidth(
    lineWidth: number,
    anchorX: number,
    alignment: 'left' | 'center' | 'right',
    horizontalMargin: number
  ): number {
    const maxX = Math.max(horizontalMargin, this.config.videoWidth - lineWidth - horizontalMargin);

    if (alignment === 'left') {
      return Math.max(horizontalMargin, Math.min(anchorX, maxX));
    }

    if (alignment === 'right') {
      return Math.max(horizontalMargin, Math.min(anchorX - lineWidth, maxX));
    }

    return Math.max(horizontalMargin, Math.min(anchorX - lineWidth / 2, maxX));
  }

  private estimateInlineTextWidth(text: string, fontSize: number): number {
    let width = 0;

    for (const char of text) {
      width += this.estimateInlineCharWidth(char, fontSize);
    }

    return width;
  }

  private estimateInlineCharWidth(char: string, fontSize: number): number {
    if (char === ' ') {
      return fontSize * 0.35;
    }

    if (/[\u4e00-\u9fff]/.test(char)) {
      return fontSize;
    }

    if (/[\u3040-\u30ff]/.test(char) || /[\uac00-\ud7af]/.test(char)) {
      return fontSize * 0.92;
    }

    if (/[a-zA-Z0-9]/.test(char)) {
      return fontSize * 0.56;
    }

    return fontSize * 0.32;
  }

  /**
   * 鐢熸垚鏅€氬瓧骞曠殑drawtext鍛戒护
   * @private
   */
  private generateNormalDrawtext(
    subtitle: ArrangedSubtitle,
    fontDir: string
  ): string {
    const style = subtitle.style;
    const safeFontName = this.normalizeFontNameValue(style?.fontName);
    const safeFontSize = this.normalizeNumericValue(style?.fontSize, this.config?.subtitleStyle?.fontSize || 48);
    const safeFontColor = this.normalizeColorValue(style?.fontColor, '#FFFFFF');
    const safeOutlineColor = this.normalizeColorValue(style?.outlineColor, '#000000');
    const safeOutlineWidth = this.normalizeNumericValue(style?.outlineWidth, 0);
    const safeBackgroundColor = this.normalizeOptionalColorValue(style?.backgroundColor);
    const safeBackgroundOpacity = this.normalizeNumericValue(style?.backgroundOpacity, 0.85);
    const safeShadowColor = this.normalizeOptionalColorValue(style?.shadowColor);
    const safeShadowOffset = this.normalizeNumericValue(style?.shadowOffset, 0);
    const safePositionX = this.normalizeNumericValue(subtitle?.position?.x, this.config.videoWidth / 2);
    const safePositionY = this.normalizeNumericValue(subtitle?.position?.y, this.config.videoHeight * 0.8);
    const safeAlignment = subtitle?.position?.alignment === 'left' || subtitle?.position?.alignment === 'right'
      ? subtitle.position.alignment
      : 'center';

    // 鉁?娣诲姞璇婃柇鏃ュ織锛氳褰曞瓧浣撹В鏋愯繃绋?
    console.log('[ZimuShengcheng] 生成普通字幕 drawtext 字体信息:', {
      text: subtitle.text.substring(0, 20),
      requestedFontName: safeFontName,
      fontPath: this.fontPathCache.has(safeFontName) ? this.fontPathCache.get(safeFontName) : '未缓存'
    });

    const fontPath = this.resolveFontPath(safeFontName, fontDir);

    // 杞崲棰滆壊鏍煎紡
    const fontColor = this.convertHexToDrawtext(safeFontColor);
    const outlineColor = this.convertHexToDrawtext(safeOutlineColor);

    // 鑳屾櫙棰滆壊锛氫繚鐣欏師濮嬫牸寮忥紙#RRGGBB锛夛紝鐢ㄤ簬鑳屾櫙閫忔槑搴?
    const backgroundColor = safeBackgroundColor || undefined;

    // 鑳屾櫙閫忔槑搴︼細0.85 涓嶉€忔槑搴?= 0.15 閫忔槑搴?
    let bgOpacity = safeBackgroundOpacity;

    // 銆愬叧閿慨澶嶃€戞彁鍓嶅畾涔?dynamicBoxw锛岄伩鍏嶅悗缁唬鐮佸紩鐢ㄦ椂鍑虹幇 ReferenceError
    // 銆愪慨澶嶈儗鏅孩鍑恒€戞牴鎹槸鍚︽湁鑳屾櫙鏉ヨ皟鏁碽oxw
    // 鏈夎儗鏅椂锛岄渶瑕佹洿灏忕殑boxw闃叉鍙宠竟婧㈠嚭
    // 鏃犺儗鏅椂锛屽彲浠ヤ娇鐢ㄦ洿澶х殑boxw鏉ユ樉绀哄畬鏁村瓧骞?
    const hasBackground = backgroundColor && bgOpacity > 0 &&
      backgroundColor.toUpperCase() !== 'TRANSPARENT' &&
      backgroundColor !== 'transparent';

    const horizontalMargin = 60;  // 鍩虹宸﹀彸杈硅窛
    // 銆愪慨澶嶃€戝綋鏈夎儗鏅椂澧炲姞extraSafety锛屾棤鑳屾櫙鏃朵娇鐢ㄦ洿灏忕殑鍊?
    const extraSafety = hasBackground ? 80 : 40;  // 鑳屾櫙鏃?0锛屾棤鑳屾櫙鏃?0
    const dynamicBoxw = this.config.videoWidth - 2 * (horizontalMargin + extraSafety);  // 鍔ㄦ€佽绠?

    // 馃敡 淇锛氭鏌?position.x 鏄惁琚?SmartLayoutManager 鏄惧紡淇敼杩?
    // 濡傛灉 position.x 鏄庢樉涓嶇瓑浜庡睆骞曚腑蹇冿紙鍋忓樊瓒呰繃50px锛夛紝璇存槑琚噸鏂板畾浣嶄簡
    const videoCenterX = this.config.videoWidth / 2;  // 閫氬父鏄?960
    const positionDeviation = Math.abs(safePositionX - videoCenterX);
    const hasExplicitPosition = positionDeviation > 50;  // 濡傛灉鍋忓樊瓒呰繃50px锛岃涓鸿鏄惧紡瀹氫綅

    // 馃敡 寮哄埗淇锛氱壒鏁堝瓧骞曠洿鎺ユ斁鍦ㄥ乏杈癸紝鏅€氬瓧骞曟斁鍦ㄤ腑澶?
    let xExpr: string;

    // 妫€鏌ユ槸鍚︽槸鐗规晥瀛楀箷锛堢壒鏁堝瓧骞曠殑 type 涓嶆槸 'normal'锛?
    const isEffectSubtitle = subtitle.type !== 'normal';

    if (isEffectSubtitle) {
      // 馃敡 淇锛氱壒鏁堝瓧骞曠殑position.x鏄疭martLayoutManager璁＄畻鐨勬按骞充綅缃弬鑰冪偣
      // 鐩存帴灏嗗叾鐢ㄤ簬drawtext鐨剎鍧愭爣锛團Fmpeg浼氫互姝や负鍩哄噯澶勭悊瀵归綈锛?
      const effectX = safePositionX || this.config.videoWidth / 2;
      xExpr = `max(18,min(${effectX},w-text_w-18))`;
      console.log('[ZimuShengcheng.generateNormalDrawtext] 特效字幕使用 SmartLayoutManager 位置:', {
        text: subtitle.text.substring(0, 20),
        type: subtitle.type,
        position_x: safePositionX,
        xExpr: xExpr,
        note: '特效字幕直接使用 SmartLayoutManager 计算的位置'
      });
    } else {
      // 銆愬叧閿慨澶嶃€戞櫘閫氬瓧骞曚篃浣跨敤缁濆瀹氫綅锛岀‘淇?optimizeLayout 璁＄畻鐨?adjustedX 鐢熸晥
      // subtitle.position.x 宸茬粡鍖呭惈浜嗚竟鐣岃皟鏁村悗鐨勪綅缃紙鏉ヨ嚜 optimizeLayout 鐨?adjustedX锛?
      const absoluteX = safePositionX;

      // 鏍规嵁瀵归綈鏂瑰紡璁＄畻鏈€缁堢殑x鍧愭爣
      if (safeAlignment === 'center') {
        // 灞呬腑瀵归綈锛歺鍧愭爣鏄枃鏈腑蹇冪偣锛岄渶瑕佸噺鍘诲崐涓枃鏈搴?
        xExpr = `max(${horizontalMargin},min(${absoluteX}-(text_w/2),w-text_w-${horizontalMargin}))`;
      } else if (safeAlignment === 'right') {
        // 鍙冲榻愶細x鍧愭爣鏄枃鏈彸杈圭紭
        xExpr = `max(${horizontalMargin},min(${absoluteX}-text_w,w-text_w-${horizontalMargin}))`;
      } else {
        // 宸﹀榻愶細x鍧愭爣灏辨槸鏂囨湰宸﹁竟缂?
        xExpr = `max(${horizontalMargin},min(${absoluteX},w-text_w-${horizontalMargin}))`;
      }

      console.log(`[ZimuShengcheng.generateNormalDrawtext] 鏅€氬瓧骞曚娇鐢ㄧ粷瀵瑰畾浣嶏紙纭繚杈圭晫妫€鏌ョ敓鏁堬級:`, {
        text: subtitle.text.substring(0, 20),
        alignment: safeAlignment,
        position_x: safePositionX,
        adjustedX: absoluteX.toFixed(2),
        xExpr: xExpr,
        note: '浣跨敤 optimizeLayout 璁＄畻鐨?adjustedX锛岀‘淇濅笉瓒呭嚭灞忓箷'
      });
    }

    const resolvedY = subtitle.type === 'normal'
      ? this.resolvePreferredNormalSubtitleY({
          ...subtitle,
          position: {
            ...subtitle.position,
            x: safePositionX,
            y: safePositionY,
            alignment: safeAlignment
          },
          style: {
            ...subtitle.style,
            fontName: safeFontName,
            fontSize: safeFontSize
          }
        })
      : Math.round(safePositionY);
    const yExpr = `max(24,min(${resolvedY},h-text_h-24))`;

    // 銆愪慨澶嶃€戞椂闂村崟浣嶈浆鎹細纭繚鏃堕棿鍊兼槸浠ョ涓哄崟浣?
    // 浠庢棩蹇楃湅锛屾椂闂村€奸兘鏄绉掞紙濡?290, 1128.888888888889, 59180锛?
    // 缁熶竴杞崲涓虹锛氶櫎浠?1000
    let startTime = subtitle.start / 1000;
    let endTime = subtitle.end / 1000;

    // 楠岃瘉杞崲鍚庣殑鏃堕棿鍊煎悎鐞嗘€?
    // 纭繚鏃堕棿鍊间笉涓鸿礋鏁?
    startTime = Math.max(0, startTime);
    endTime = Math.max(0, endTime);

    // 鐢熸垚enable琛ㄨ揪寮忥紙浣跨敤杞崲鍚庣殑绉掓暟锛?
    const enableExpr = `between(t,${startTime.toFixed(3)},${endTime.toFixed(3)})`;

    // 馃攳 璇婃柇锛氳緭鍑哄墠3鏉″瓧骞曠殑enable琛ㄨ揪寮忥紙绠€鍗曟柟寮忥級
    // 閫氳繃妫€鏌ュ紑濮嬫椂闂存槸鍚︽槸0鎴栨帴杩戝紑濮嬩綅缃潵鍒ゆ柇鏄惁鏄墠鍑犳潯瀛楀箷
    if (startTime <= 1 || (startTime >= 10 && startTime <= 12) || (startTime >= 15 && startTime <= 16.5)) {
      console.log(`[generateNormalDrawtext] 瀛楀箷enable琛ㄨ揪寮? "${subtitle.text.substring(0, 20)}..." -> enable='${enableExpr}' (start=${startTime.toFixed(2)}s)`);
    }

    // 杞箟鏂囨湰
    // 馃敡 鍏坣ormalize锛堟妸鏍囩偣绗﹀彿鏇挎崲鎴愮┖鏍硷級锛屽啀escape锛堣浆涔夌壒娈婂瓧绗︼級
    const normalizedText = this.normalizeTextForDisplay(subtitle.text);
    const escapedText = normalizedText
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/\n/g, '\\n');

    // 銆愪慨澶嶃€戣儗鏅鑹插鐞嗭細纭繚涓嶅嚭鐜?"TRANSPARENT" 瀛楃涓?
    let validBackgroundColor: string | undefined = backgroundColor;
    if (backgroundColor && (backgroundColor.toUpperCase() === 'TRANSPARENT' || backgroundColor === 'transparent')) {
      // 濡傛灉鑳屾櫙鏄€忔槑鐨勶紝浣跨敤榛戣壊瀹屽叏閫忔槑
      validBackgroundColor = '#000000';
      bgOpacity = 0;  // 瀹屽叏閫忔槑
    }

    // 鏋勫缓drawtext閰嶇疆
    // 馃敡 閲嶈锛氱壒鏁堝瓧骞曞拰鏅€氬瓧骞曚娇鐢ㄤ笉鍚岀殑閰嶇疆
    // 鐗规晥瀛楀箷锛氫笉浣跨敤boxw闄愬埗锛岀洿鎺ヤ娇鐢ㄥ睆骞曞潗鏍?
    // 鏅€氬瓧骞曪細浣跨敤boxw闄愬埗锛岃嚜鍔ㄦ崲琛?

    const config: any = {
      fontfile: fontPath,
      text: escapedText,
      x: xExpr,
      y: yExpr,
      fontsize: safeFontSize,
      fontcolor: fontColor,
      borderw: safeOutlineWidth,
      bordercolor: outlineColor,
      enable: enableExpr
      // 銆愪慨澶嶃€戝彧鍦ㄦ病鏈夎儗鏅椂璁剧疆琛岄棿璺?
      // 濡傛灉鏈夎儗鏅紝琛岄棿璺濅細瀵艰嚧鑳屾櫙妗嗛珮搴﹀鍑轰竴闀挎潯
    };

    // 銆愪慨澶嶃€戝嵆浣挎湁鑳屾櫙涔熼渶瑕佽缃闂磋窛锛屼互閬垮厤澶氳瀛楀箷閲嶅彔
    // 鏈夎儗鏅椂浣跨敤杈冨皬鐨勮闂磋窛锛?5%锛夛紝鏃犺儗鏅椂浣跨敤杈冨ぇ鐨勮闂磋窛锛?0%锛?
    // 娉ㄦ剰锛歨asBackground 宸插湪鍓嶉潰瀹氫箟杩囦簡锛岃繖閲岀洿鎺ヤ娇鐢?
    if (hasBackground) {
      config.line_spacing = Math.round(safeFontSize * 0.15);  // 鏈夎儗鏅椂浣跨敤杈冨皬鐨勮闂磋窛
    } else {
      config.line_spacing = Math.round(safeFontSize * 0.3);   // 鏃犺儗鏅椂澧炲姞琛岄棿璺濓紝鏀瑰杽鍙鎬?
    }

    // 馃敡 鍏抽敭锛氱壒鏁堝瓧骞曞拰鏅€氬瓧骞曢兘浣跨敤缁濆瀹氫綅锛岄兘涓嶄娇鐢╞oxw
    // 鍘熷洜锛氬綋boxw琚缃椂锛屽畠鏀瑰彉浜嗗潗鏍囩郴鐨勮В閲?
    // 涓嶈缃産oxw鏃讹紝x鍧愭爣鏄睆骞曠殑缁濆鍍忕礌鍊?
    // 杩欐牱鎵嶈兘淇濊瘉 optimizeLayout 璁＄畻鐨?adjustedX 鐢熸晥
    // 琛屾崲琛屽凡缁忓湪 optimizeLayout 涓畬鎴愪簡锛堝琛屽瓧骞曞鐞嗗湪绗?450-1538琛岋級

    // 馃啎銆愰煩鏂?鏃ユ枃淇銆戞娴嬪瓧浣撴槸鍚︿负闇€瑕佺壒娈婂鐞嗙殑璇█
    const fontNameLower = safeFontName.toLowerCase();
    const isAsianFont = fontNameLower.includes('malgun') ||
      fontNameLower.includes('noto') ||
      fontNameLower.includes('meiryo') ||
      fontNameLower.includes('simhei') ||
      fontNameLower.includes('simsun') ||
      fontNameLower.includes('yahei');

    // 馃啎銆愬叧閿慨澶嶃€戝浜庝簹娲插瓧浣擄紙闊╂枃銆佹棩鏂囥€佷腑鏂囷級锛屽惎鐢╞oxw鍜宖ix_bounds
    // 浠ラ槻姝㈡枃瀛楄秴鍑哄睆骞?
    if (isAsianFont && !isEffectSubtitle) {
      // 涓轰簹娲茶瑷€鍚敤瀹藉害闄愬埗锛岄槻姝㈣秴鍑哄睆骞?
      // boxw闄愬埗锛氫娇鐢ㄨ棰戝搴︾殑80-90%锛屼负杈硅窛棰勭暀10-20%
      const asianBoxw = Math.floor(this.config.videoWidth * 0.85);
      config.boxw = undefined;
      config.fix_bounds = 1;

      console.log('[ZimuShengcheng] 亚洲字体启用宽度限制:', {
        fontName: style.fontName,
        normalizedFontName: safeFontName,
        boxw: asianBoxw,
        videoWidth: this.config.videoWidth,
        maxWidthPercent: '85%',
        text: subtitle.text.substring(0, 20)
      });
    } else {
      // 鑻辨枃绛夊叾浠栧瓧浣擄細涓嶄娇鐢╞oxw锛屾寜鍘熼€昏緫澶勭悊
      config.boxw = undefined;
      config.fix_bounds = 1;
    }

    // 馃敡 璇婃柇锛氳褰昩oxw閰嶇疆
    console.log('[ZimuShengcheng.generateNormalDrawtext] 普通字幕宽度限制:', {
      text: subtitle.text.substring(0, 30),
      type: subtitle.type,
      videoWidth: this.config.videoWidth,
      horizontalMargin: horizontalMargin,
      extraSafety: extraSafety,
      dynamicBoxw: dynamicBoxw,
      finalBoxw: config.boxw,
      xExpr: xExpr,
      isNormalSubtitle: !isEffectSubtitle
    });

    // 馃敡 璇婃柇锛氳褰曟渶缁堢敓鎴愮殑 x 琛ㄨ揪寮?
    console.log('[ZimuShengcheng.generateNormalDrawtext] 最终 drawtext 参数:', {
      text: subtitle.text.substring(0, 20),
      position_x: safePositionX.toFixed(0),
      xExpr: xExpr,
      yExpr: yExpr,
      alignment: safeAlignment,
      hasExplicitPosition: hasExplicitPosition,
      deviation: (Math.abs(safePositionX - this.config.videoWidth / 2)).toFixed(0)
    });

    const shadowOffset = safeShadowOffset;

    if (shadowOffset > 0 && safeShadowColor && safeShadowColor !== 'transparent') {
      config.shadowcolor = this.convertHexToDrawtext(safeShadowColor);
      config.shadowx = shadowOffset;
      config.shadowy = shadowOffset;
      console.log(`[ZimuShengcheng] 娣诲姞闃村奖鏁堟灉: color=${config.shadowcolor}, offset=${shadowOffset}, outlineWidth=${safeOutlineWidth}`);
    } else {
      console.log(`[ZimuShengcheng] 鏈坊鍔犻槾褰? shadowOffset=${shadowOffset}, shadowColor=${safeShadowColor}`);
    }

    // 鐢熸垚drawtext鍛戒护锛堟敮鎸佽儗鏅€忔槑搴︼級
    return DrawtextGenerator.generateNormalSubtitle(
      config,
      validBackgroundColor,  // 浣跨敤淇鍚庣殑鑳屾櫙棰滆壊
      bgOpacity
    );
  }

  private generateSafeNormalDrawtextFallback(
    subtitle: ArrangedSubtitle,
    fontDir: string
  ): string {
    const fallbackSubtitle: ArrangedSubtitle = {
      ...subtitle,
      position: {
        x: this.normalizeNumericValue(subtitle?.position?.x, this.config.videoWidth / 2),
        y: this.normalizeNumericValue(subtitle?.position?.y, this.config.videoHeight * 0.8),
        alignment: subtitle?.position?.alignment === 'left' || subtitle?.position?.alignment === 'right'
          ? subtitle.position.alignment
          : 'center'
      },
      style: {
        ...subtitle.style,
        fontName: 'Microsoft YaHei Bold',
        fontSize: this.normalizeNumericValue(subtitle?.style?.fontSize, this.config?.subtitleStyle?.fontSize || 48),
        fontColor: this.normalizeColorValue(subtitle?.style?.fontColor, '#FFFFFF'),
        outlineColor: this.normalizeColorValue(subtitle?.style?.outlineColor, '#000000'),
        outlineWidth: this.normalizeNumericValue(subtitle?.style?.outlineWidth, 2),
        backgroundColor: this.normalizeOptionalColorValue(subtitle?.style?.backgroundColor) || 'transparent',
        backgroundOpacity: this.normalizeNumericValue(subtitle?.style?.backgroundOpacity, 0),
        shadowColor: this.normalizeOptionalColorValue(subtitle?.style?.shadowColor),
        shadowOffset: this.normalizeNumericValue(subtitle?.style?.shadowOffset, 0),
        shadowBlur: this.normalizeNumericValue(subtitle?.style?.shadowBlur, 0)
      }
    };

    return this.generateNormalDrawtext(fallbackSubtitle, fontDir);
  }

  // 瀛椾綋璺緞缂撳瓨锛堥伩鍏嶉噸澶嶆煡鎵撅級
  private fontPathCache: Map<string, string> = new Map();

  /**
   * 棰勫厛瑙ｆ瀽鎵€鏈夊瓧浣撹矾寰勶紙寮傛锛屼娇鐢ㄥ瓧浣撶鐞嗗櫒API锛?
   * 鍦ㄧ敓鎴恉rawtext鍛戒护涔嬪墠璋冪敤锛屽皢鎵€鏈夊瓧浣撹矾寰勭紦瀛樿捣鏉?
   * @private
   */
  private async preResolveFontPaths(subtitles: ArrangedSubtitle[]): Promise<void> {
    // 鉁?娣诲姞鍏ㄥ眬瓒呮椂淇濇姢锛氭暣涓瓧浣撹矾寰勯瑙ｆ瀽杩囩▼鏈€澶?绉?
    return Promise.race([
      this._preResolveFontPathsInternal(subtitles),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('瀛椾綋璺緞棰勮В鏋愯秴鏃讹紙5绉掞級锛屽皢浣跨敤鍚屾鏌ユ壘鏂规')), 5000)
      )
    ]).catch((error) => {
      console.warn(`[ZimuShengcheng] 瀛椾綋璺緞棰勮В鏋愬け璐ワ紝灏嗕娇鐢ㄥ悓姝ユ煡鎵炬柟妗?`, error?.message || error);
      // 鍗充娇澶辫触锛屼篃缁х画鎵ц锛屼娇鐢ㄥ悓姝ユ煡鎵炬柟妗?
    });
  }

  private async _preResolveFontPathsInternal(subtitles: ArrangedSubtitle[]): Promise<void> {
    // 鏀堕泦鎵€鏈夊敮涓€鐨勫瓧浣撳悕绉?
    const fontNames = new Set<string>();
    for (const subtitle of subtitles) {
      if (subtitle.style?.fontName) {
        fontNames.add(subtitle.style.fontName);
      }
    }

    console.log(`[ZimuShengcheng] 寮€濮嬮瑙ｆ瀽瀛椾綋璺緞锛屽瓧浣撴暟閲? ${fontNames.size}`);

    // 骞惰瑙ｆ瀽鎵€鏈夊瓧浣撹矾寰勶紙浣跨敤allSettled锛岀‘淇濆嵆浣块儴鍒嗗け璐ヤ篃涓嶅奖鍝嶅叾浠栵級
    const fontPathPromises = Array.from(fontNames).map(async (fontName) => {
      // 濡傛灉宸茬粡缂撳瓨锛岃烦杩?
      if (this.fontPathCache.has(fontName)) {
        return;
      }

      // 鉁?浼樺寲绛栫暐锛氫紭鍏堜娇鐢ㄥ瓧浣撶鐞嗗櫒API锛屽鏋滃け璐ュ垯鍥為€€鍒板悓姝ユ煡鎵?
      // 淇濈暀瓒呮椂鏈哄埗锛岄伩鍏峆ython璋冪敤澶辫触瀵艰嚧闃诲
      try {
        // 灏濊瘯浣跨敤瀛椾綋绠＄悊鍣ˋPI鏌ユ壘瀛椾綋璺緞锛堜紭鍏堟柟妗堬級
        if (typeof window !== 'undefined' && window.$mapi?.fontManager?.findFontPath) {
          try {
            // 鉁?娣诲姞瓒呮椂鏈哄埗锛?绉掕秴鏃讹紝蹇€熷け璐ワ紝閬垮厤闃诲
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('瀛椾綋绠＄悊鍣ˋPI璋冪敤瓒呮椂')), 3000)
            );

            const result = await Promise.race([
              window.$mapi.fontManager.findFontPath(fontName, 400),
              timeoutPromise
            ]) as any;

            if (result && result.success && result.data) {
              // 鉁?妫€鏌ュ瓧浣撹矾寰勬槸鍚﹀寘鍚腑鏂囧瓧绗︼紝濡傛灉鏄垯澶嶅埗鍒颁复鏃剁洰褰曞苟浣跨敤鑻辨枃鏂囦欢鍚?
              const originalFontPath = result.data;
              const safeFontPath = await this.copyFontToSafePath(originalFontPath, fontName);

              this.fontPathCache.set(fontName, safeFontPath);
              console.log(`[ZimuShengcheng] 閫氳繃瀛椾綋绠＄悊鍣ㄦ壘鍒板瓧浣? ${fontName} -> ${safeFontPath}`);
              return;
            }
          } catch (apiError: any) {
            // 瓒呮椂鎴朅PI璋冪敤澶辫触锛屽揩閫熷洖閫€鍒板悓姝ユ煡鎵撅紝涓嶉樆濉炴祦绋?
            console.warn(`[ZimuShengcheng] 瀛椾綋绠＄悊鍣ˋPI璋冪敤澶辫触锛堝揩閫熷洖閫€鍒板悓姝ユ煡鎵撅級: ${fontName}`, apiError?.message || apiError);
            // 涓嶆姏鍑洪敊璇紝缁х画鎵ц鍚屾鏌ユ壘
          }
        }
      } catch (error: any) {
        // 浠讳綍寮傚父閮藉揩閫熸崟鑾凤紝缁х画浣跨敤鍚屾鏌ユ壘
        console.warn(`[ZimuShengcheng] 瀛椾綋绠＄悊鍣ㄦ煡鎵惧紓甯革紙灏嗕娇鐢ㄥ悓姝ユ煡鎵撅級: ${fontName}`, error?.message || error);
      }

      // 鍥為€€鏂规锛氫娇鐢ㄥ悓姝ユ煡鎵鹃€昏緫
      try {
        const fontPath = this.resolveFontPathSync(fontName);
        // 鉁?妫€鏌ュ瓧浣撹矾寰勬槸鍚﹀寘鍚腑鏂囧瓧绗︼紝濡傛灉鏄垯澶嶅埗鍒颁复鏃剁洰褰曞苟浣跨敤鑻辨枃鏂囦欢鍚?
        const safeFontPath = await this.copyFontToSafePath(fontPath, fontName);
        this.fontPathCache.set(fontName, safeFontPath);
        console.log(`[ZimuShengcheng] 浣跨敤鍚屾鍥為€€鏂规鎵惧埌瀛椾綋: ${fontName} -> ${safeFontPath}`);
      } catch (syncError) {
        console.error(`[ZimuShengcheng] 鍚屾鏌ユ壘瀛椾綋澶辫触: ${fontName}`, syncError);
        // 鏈€鍚庣殑鍥為€€锛氫娇鐢ㄩ粯璁ゅ瓧浣?
        const systemRoot = process.env.SystemRoot || 'C:/Windows';
        const defaultFont = `${systemRoot}/Fonts/msyhbd.ttc`;
        this.fontPathCache.set(fontName, defaultFont);
        console.warn(`[ZimuShengcheng] 浣跨敤榛樿瀛椾綋: ${fontName} -> ${defaultFont}`);
      }
    });

    // 浣跨敤allSettled纭繚鎵€鏈塒romise閮藉畬鎴愶紙鏃犺鎴愬姛鎴栧け璐ワ級
    const results = await Promise.allSettled(fontPathPromises);

    // 缁熻鎴愬姛鍜屽け璐ョ殑鏁伴噺
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[ZimuShengcheng] 瀛椾綋璺緞棰勮В鏋愬畬鎴愶紝鎴愬姛: ${successful}, 澶辫触: ${failed}, 缂撳瓨鏁伴噺: ${this.fontPathCache.size}`);
  }

  /**
   * 灏嗗瓧浣撴枃浠跺鍒跺埌涓存椂鐩綍锛屽鏋滆矾寰勫寘鍚潪ASCII瀛楃锛堝涓枃锛夛紝鍒欎娇鐢ㄨ嫳鏂囨枃浠跺悕
   * 閬垮厤 FFmpeg 鍦?Windows 涓婃棤娉曞鐞嗕腑鏂囧瓧浣撹矾寰勭殑闂
   * @private
   */
  /** 校验字体文件魔数（TTF/OTF/TTC），拦截 Git LFS 指针等损坏文件进入渲染管线 */
  private isValidFontFile(filePath: string): boolean {
    try {
      if (typeof window !== 'undefined' && window.require) {
        const fsNode = window.require('fs');
        if (!fsNode.existsSync(filePath) || fsNode.statSync(filePath).size < 128) {
          return false;
        }
        const fd = fsNode.openSync(filePath, 'r');
        const buf = Buffer.alloc(4);
        fsNode.readSync(fd, buf, 0, 4, 0);
        fsNode.closeSync(fd);
        const magic = buf.toString('hex', 0, 4);
        const ascii = buf.toString('latin1', 0, 4);
        return magic === '00010000' || ascii === 'OTTO' || ascii === 'true' || ascii === 'ttcf';
      }
      return true; // 非 Node 环境（无法读文件）时放行，交由 FFmpeg 自行报错
    } catch (error: any) {
      console.warn(`[ZimuShengcheng] 字体文件校验失败: ${filePath}`, error?.message || error);
      return false;
    }
  }

  /** 兜底系统中文字体：逐个校验有效性后返回（避免用到坏字体源） */
  private getFallbackSystemFont(): string {
    const systemRoot = process.env.SystemRoot || 'C:/Windows';
    const candidates = [`${systemRoot}/Fonts/msyh.ttc`, `${systemRoot}/Fonts/simhei.ttf`, `${systemRoot}/Fonts/arial.ttf`];
    for (const candidate of candidates) {
      if (this.isValidFontFile(candidate)) {
        console.warn(`[ZimuShengcheng] 使用兜底系统字体: ${candidate}`);
        return candidate;
      }
    }
    return candidates[0];
  }

  private async copyFontToSafePath(originalFontPath: string, fontName: string): Promise<string> {
    // 妫€鏌ヨ矾寰勬槸鍚﹀寘鍚潪ASCII瀛楃
    const hasNonAscii = /[^\x00-\x7F]/.test(originalFontPath);

    // ✅ 源文件有效性校验：拦截 Git LFS 指针、损坏字体（魔数非 TTF/OTF/TTC）
    if (!this.isValidFontFile(originalFontPath)) {
      console.warn(`[ZimuShengcheng] ⚠️ 字体源文件无效(LFS指针或已损坏)，回退系统字体: ${originalFontPath}`);
      return this.getFallbackSystemFont();
    }

    if (!hasNonAscii) {
      // 璺緞鍙寘鍚獳SCII瀛楃锛岀洿鎺ヨ繑鍥?
      return originalFontPath;
    }

    console.log(`[ZimuShengcheng] 妫€娴嬪埌闈?ASCII 瀛楃锛屽鍒跺埌瀹夊叏璺緞: ${originalFontPath}`);

    try {
      // 鑾峰彇涓存椂鐩綍
      const tempDir = await this.getTempDir();

      // 鐢熸垚瀹夊叏鐨勮嫳鏂囨枃浠跺悕锛氫娇鐢ㄥ瓧浣撳悕绉扮殑鍝堝笇鍊?+ 鎵╁睍鍚?
      const path = await import('path');
      const crypto = await import('crypto');
      const ext = path.extname(originalFontPath);
      const hash = crypto.createHash('md5').update(fontName).digest('hex').substring(0, 8);
      const safeFileName = `font_${hash}${ext}`;
      const safeFontPath = path.join(tempDir, safeFileName).replace(/\\/g, '/');

      // 妫€鏌ュ畨鍏ㄨ矾寰勬槸鍚﹀凡瀛樺湪
      if (typeof window !== 'undefined' && window.$mapi?.file?.exists) {
        const exists = await window.$mapi.file.exists(safeFontPath);
        if (exists && this.isValidFontFile(safeFontPath)) {
          console.log(`[ZimuShengcheng] 鉁?瀹夊叏瀛椾綋璺緞宸插瓨鍦紝鐩存帴浣跨敤: ${safeFontPath}`);
          return safeFontPath;
        }
      } else {
        const fs = await import('fs');
        if (fs.existsSync(safeFontPath) && this.isValidFontFile(safeFontPath)) {
          console.log(`[ZimuShengcheng] 鉁?瀹夊叏瀛椾綋璺緞宸插瓨鍦紝鐩存帴浣跨敤: ${safeFontPath}`);
          return safeFontPath;
        }
      }

      // 澶嶅埗瀛椾綋鏂囦欢鍒颁复鏃剁洰褰?
      if (typeof window !== 'undefined' && window.$mapi?.file?.copy) {
        await window.$mapi.file.copy(originalFontPath, safeFontPath, { isDataPath: false });
      } else {
        const fs = await import('fs');
        const util = await import('util');
        const copyFile = util.promisify(fs.copyFile);
        await copyFile(originalFontPath, safeFontPath);
      }

      // 楠岃瘉澶嶅埗鏄惁鎴愬姛
      let fileExists = false;
      let fileSize = 0;

      if (typeof window !== 'undefined' && window.$mapi?.file?.exists) {
        fileExists = await window.$mapi.file.exists(safeFontPath);
        if (fileExists && window.$mapi?.file?.stat) {
          const stats = await window.$mapi.file.stat(safeFontPath);
          fileSize = stats?.size || 0;
        }
      } else {
        const fs = await import('fs');
        fileExists = fs.existsSync(safeFontPath);
        if (fileExists) {
          const stats = fs.statSync(safeFontPath);
          fileSize = stats.size;
        }
      }

      if (!fileExists) {
        throw new Error(`瀛椾綋鏂囦欢澶嶅埗澶辫触: ${safeFontPath}`);
      }

      if (fileSize === 0 || !this.isValidFontFile(safeFontPath)) {
        throw new Error(`瀛椾綋鏂囦欢澶嶅埗鍚庡ぇ灏忎负 0: ${safeFontPath}`);
      }

      console.log(`[ZimuShengcheng] 鉁?瀛椾綋鏂囦欢宸插鍒跺埌瀹夊叏璺緞: ${originalFontPath} -> ${safeFontPath} (${fileSize} bytes)`);
      return safeFontPath;

    } catch (error: any) {
      // 澶嶅埗澶辫触锛屾姏鍑洪敊璇€屼笉鏄潤榛樺洖閫€
      const errorMsg = `鏃犳硶澶勭悊鍖呭惈涓枃鐨勫瓧浣撹矾寰? ${originalFontPath}. 閿欒: ${error?.message || error}`;
      console.error(`[ZimuShengcheng] 鉂?${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * 鍚屾瑙ｆ瀽瀛椾綋鏂囦欢璺緞锛堝洖閫€鏂规锛?
   * 褰撳瓧浣撶鐞嗗櫒API涓嶅彲鐢ㄦ垨澶辫触鏃朵娇鐢?
   * @private
   */
  private resolveFontPathSync(fontName: string): string {
    const normalizedFontName = this.normalizeFontNameValue(fontName);
    // 鍔ㄦ€佽幏鍙栫郴缁熷瓧浣撶洰褰?
    const systemRoot = process.env.SystemRoot || 'C:/Windows';
    const fontsDir = `${systemRoot}/Fonts`;

    if (!normalizedFontName) {
      return `${fontsDir}/msyhbd.ttc`; // 榛樿瀛椾綋
    }

    // 鍥為€€鏂规锛氬皾璇曞父瑙佺殑绯荤粺瀛椾綋璺緞锛圵indows锛?
    const systemFonts: Record<string, string> = {
      'microsoft yahei': `${fontsDir}/msyh.ttc`,
      '寰蒋闆呴粦': `${fontsDir}/msyh.ttc`,
      'msyh': `${fontsDir}/msyh.ttc`,
      'simhei': `${fontsDir}/simhei.ttf`,
      '榛戜綋': `${fontsDir}/simhei.ttf`,
      'simsun': `${fontsDir}/simsun.ttc`,
      '瀹嬩綋': `${fontsDir}/simsun.ttc`,
      'msyhbd': `${fontsDir}/msyhbd.ttc`
    };

    const fontNameLower = normalizedFontName.toLowerCase().trim();

    // 棣栧厛妫€鏌ョ郴缁熷瓧浣撴槧灏?
    if (systemFonts[fontNameLower]) {
      const fontPath = systemFonts[fontNameLower];
      if (!this.isValidFontFile(fontPath)) {
        console.warn(`[ZimuShengcheng] 系统字体映射目标无效，使用兜底字体: ${fontPath}`);
        return this.getFallbackSystemFont();
      }
      console.log(`[ZimuShengcheng] 浣跨敤绯荤粺瀛椾綋鏄犲皠: ${normalizedFontName} -> ${fontPath}`);
      return fontPath;
    }

    // 鏈€鍚庡洖閫€锛氶粯璁ゅ瓧浣?
    const defaultFont = this.getFallbackSystemFont();
    console.warn(`[ZimuShengcheng] 鏈壘鍒板瓧浣?${normalizedFontName}锛屼娇鐢ㄩ粯璁ゅ瓧浣? ${defaultFont}`);
    return defaultFont;
  }

  /**
   * 瑙ｆ瀽瀛椾綋鏂囦欢璺緞锛堜粠缂撳瓨璇诲彇锛?
   * 蹇呴』鍦╬reResolveFontPaths涔嬪悗璋冪敤
   * @private
   */
  private resolveFontPath(fontName: string, fontDir: string): string {
    const normalizedFontName = this.normalizeFontNameValue(fontName);
    if (!normalizedFontName) {
      const systemRoot = process.env.SystemRoot || 'C:/Windows';
      return `${systemRoot}/Fonts/msyhbd.ttc`; // 榛樿瀛椾綋
    }

    // 浠庣紦瀛樿鍙?
    if (this.fontPathCache.has(normalizedFontName)) {
      return this.fontPathCache.get(normalizedFontName)!;
    }

    // 濡傛灉娌℃湁缂撳瓨锛屼娇鐢ㄥ悓姝ュ洖閫€鏂规
    console.warn(`[ZimuShengcheng] 瀛椾綋璺緞鏈紦瀛橈紝浣跨敤鍥為€€鏂规: ${normalizedFontName}`);
    return this.resolveFontPathSync(normalizedFontName);
  }

  private normalizeFontNameValue(fontName: unknown): string {
    if (typeof fontName === 'string') {
      return fontName.trim();
    }

    if (Array.isArray(fontName)) {
      const firstString = fontName.find((item) => typeof item === 'string' && item.trim().length > 0);
      if (typeof firstString === 'string') {
        return firstString.trim();
      }
    }

    return 'Microsoft YaHei Bold';
  }

  private normalizeColorValue(color: unknown, fallback: string): string {
    if (typeof color === 'string' && color.trim().length > 0) {
      return color.trim();
    }
    return fallback;
  }

  private normalizeOptionalColorValue(color: unknown): string | undefined {
    if (typeof color === 'string' && color.trim().length > 0) {
      return color.trim();
    }
    return undefined;
  }

  private normalizeNumericValue(value: unknown, fallback: number): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  /**
   * 灏嗗崄鍏繘鍒堕鑹茶浆鎹负drawtext鏍煎紡锛?xRRGGBB锛?
   * @private
   */
  private convertHexToDrawtext(hexColor: unknown): string {
    if (typeof hexColor !== 'string' || !hexColor.trim()) return '0xFFFFFF';

    // 绉婚櫎 # 鍓嶇紑
    const hex = hexColor.trim().replace('#', '').toUpperCase();

    // 纭繚鏄?浣嶅崄鍏繘鍒?
    if (hex.length === 8) {
      return `0x${hex.slice(0, 6)}`;
    }
    if (hex.length === 6) {
      return `0x${hex}`;
    }

    return '0xFFFFFF'; // 榛樿鐧借壊
  }

  /**
   * 鏍囧噯鍖栨椂闂村€硷細灏嗘绉掕浆鎹负绉?
   * FFmpeg 鐨?drawtext 闇€瑕佺涓哄崟浣?
   * @private
   */
  private normalizeTimeToSeconds(timeValue: number): number {
    // 绠€鍖栭€昏緫锛氬鏋滄椂闂村€煎ぇ浜?00锛岃涓烘槸姣锛岄渶瑕侀櫎浠?000
    // 鍥犱负姝ｅ父瑙嗛瀛楀箷鐨勬椂闂存埑锛堜互绉掍负鍗曚綅锛夊緢灏戜細灏忎簬100绉?
    // 浣嗗鏋滄槸姣锛屽嵆浣挎槸1绉掍篃浼氭槸1000
    if (timeValue > 100) {
      return timeValue / 1000;
    }
    // 濡傛灉鏃堕棿鍊?<= 100锛屽亣璁惧凡缁忔槸绉?
    return timeValue;
  }

  // ==================== 姝ラ6-7: FFmpeg鎵ц ====================

  /**
   * 馃啎 鏀堕泦璐寸焊绱犳潗
   * @private
   */
  private collectStickerAssets(subtitles: ArrangedSubtitle[]): { path: string, instances: any[] }[] {
    const assetsMap = new Map<string, any[]>();

    for (const sub of subtitles) {
      // 馃敡 淇锛氳创绾镐俊鎭瓨鍌ㄥ湪 animationConfig 涓?
      // 妫€鏌?animationConfig.stickerId锛堟柊浣嶇疆锛夋垨 sub.stickerId锛堝吋瀹规棫浠ｇ爜锛?
      const stickerId = (sub as any).animationConfig?.stickerId || (sub as any).stickerId;
      const stickerConfig = (sub as any).animationConfig?.stickerConfig || (sub as any).stickerConfig;

      // 馃攳 璋冭瘯锛氳褰曟墍鏈夊瓧骞曠殑璐寸焊淇℃伅鎻愬彇
      if (stickerId || (sub as any).animationConfig) {
        console.log('[ZimuShengcheng.collectStickerAssets] 瀛楀箷璐寸焊淇℃伅:', {
          text: sub.text.substring(0, 20),
          stickerId,
          hasStickerConfig: !!stickerConfig,
          hasAnimationConfig: !!(sub as any).animationConfig,
          animationConfigStickerId: (sub as any).animationConfig?.stickerId
        });
      }

      if (stickerId) {
        // 馃敡 淇锛氭櫤鑳芥瀯寤鸿创绾歌矾寰?
        // 1. 濡傛灉 stickerId 宸茬粡鏄粷瀵硅矾寰勶紙鏋佸皯鎯呭喌锛燂級锛岀洿鎺ヤ娇鐢?
        // 2. 濡傛灉 stickerId 鍖呭惈鎵╁睍鍚嶏紝鐩存帴浣跨敤
        // 3. 鍚﹀垯娣诲姞 .png

        // 鍩虹鐩綍 - 浣跨敤浼犲叆鐨?resourcesPath 鍙傛暟
        const pathModule = window.require('path');
        const stickerBaseDir = pathModule.join(resourcesPath, 'stickers');
        console.log(`[ZimuShengcheng] 璐寸焊鐩綍: ${stickerBaseDir}`);

        let stickerPath = '';
        if (stickerId === 'explosion') {
          // 鍏煎鏃х殑纭紪鐮両D
          stickerPath = `${stickerBaseDir}/explosion.png`;
        } else if (stickerId.toLowerCase().endsWith('.png') || stickerId.toLowerCase().endsWith('.jpg') || stickerId.toLowerCase().endsWith('.webp')) {
          // 宸茬粡鏄枃浠跺悕
          stickerPath = `${stickerBaseDir}/${stickerId}`;
        } else {
          // 绾疘D锛岄粯璁ゆ坊鍔爌ng
          stickerPath = `${stickerBaseDir}/${stickerId}.png`;
        }

        // 馃攳 璇婃柇鏃ュ織锛氳褰曡创绾歌矾寰勮В鏋?
        console.log(`[ZimuShengcheng] 瑙ｆ瀽璐寸焊璺緞: ID="${stickerId}" -> Path="${stickerPath}"`);

        // 馃啎 瀹夊叏妫€鏌ワ細纭繚鏂囦欢瀛樺湪
        let fileExists = true;
        try {
          if (window.require) {
            const fs = window.require('fs');
            if (fs && fs.existsSync && !fs.existsSync(stickerPath)) {
              console.warn(`[ZimuShengcheng] 鈿狅笍 璐寸焊鏂囦欢涓嶅瓨鍦紝璺宠繃: ${stickerPath}`);
              fileExists = false;
            }
          }
        } catch (e) {
          console.warn('[ZimuShengcheng] 鏃犳硶妫€鏌ユ枃浠跺瓨鍦ㄦ€?(闈濫lectron鐜?)', e);
        }

        if (fileExists) {
          if (!assetsMap.has(stickerPath)) {
            assetsMap.set(stickerPath, []);
          }

          // 馃啎 鑷€傚簲缂╂斁閫昏緫
          // 鑾峰彇瀛椾綋澶у皬锛岄粯璁や负 72
          const fontSize = (sub.style && sub.style.fontSize) ? Number(sub.style.fontSize) : 72;

          // 鍋囪璐寸焊鏍囧噯澶у皬涓?512x512 (宸茬粡鍦?collector.py 涓粺涓€)
          // 鐩爣锛氳创绾搁珮搴︾害涓哄瓧浣撶殑 2.5 鍊嶏紝浠ヨ鐩栨枃瀛?
          const BASE_SIZE = 512;
          const targetSize = fontSize * 3.0; // 3鍊嶅瓧浣撳ぇ灏?
          const autoScale = targetSize / BASE_SIZE;

          // 鐢ㄦ埛閰嶇疆鐨勭缉鏀?
          const userScale = stickerConfig?.scale ?? 1.0;
          const userOffsetX = stickerConfig?.offsetX ?? 0;
          const userOffsetY = stickerConfig?.offsetY ?? 0;

          // 鏈€缁堝弬鏁?
          const finalScale = autoScale * userScale;

          // 鏃㈢劧鎴戜滑鍦?FFmpeg 涓娇鐢?overlay锛岄€氬父 overlay 涓嶆敼鍙樺ぇ灏忋€?
          // 鎴戜滑闇€瑕佸湪 overlay 涔嬪墠缂╂斁 sticker锛屾垨鑰呬娇鐢?overlay 鐨?scale 鍙傛暟 (濡傛灉鏄緝鏂?ffmpeg)
          // DrawtextGenerator 鐩墠鍙敓鎴?overlay=x:y:enable...
          // 
          // 馃挕 绛栫暐璋冩暣锛?
          // 涓轰簡鏀寔缂╂斁锛屾垜浠渶瑕佸湪 DrawtextGenerator 涓敮鎸?w/h 鍙傛暟锛?
          // 鎴栬€呭湪 buildFFmpegCommand 涓瀯寤?filter chain 鏃跺姞鍏?scale 婊ら暅銆?
          // 
          // 绠€鍗曟柟妗堬細鍒╃敤 overlay 婊ら暅鐨?scale 閫夐」 (ffmpeg 4.x+ 鏀寔 overlay=x:y:enable:scale=...) 
          // 涔熷氨鏄?DrawtextGenerator 鐢熸垚 overlay=...:scale='...' 
          // 浣?DrawtextGenerator.ts 鐩墠鐨?generateStickerOverlay 娌℃湁鐢ㄥ埌 w/h銆?
          //
          // 鎴戜滑闇€瑕佷紶閫?scale 淇℃伅缁?buildFFmpegCommand锛屽湪閭ｈ竟鏋勫缓 input -> scale -> overlay 閾俱€?
          // 鎴栬€呬慨鏀?DrawtextGenerator.generateStickerOverlay 杩斿洖 scale 鍙傛暟銆?

          // 閲嶆柊瀹¤ DrawtextGenerator.ts:
          // 瀹冨彧杩斿洖 string銆?
          // 
          // 璁╂垜浠湪 assetsMap 涓瓨鍌?scale 淇℃伅銆?
          // sub.position 閫氬父鏄枃瀛楀乏涓嬭鎴栧乏涓婅銆?
          // 鎴戜滑甯屾湜灞呬腑銆?

          // 璁＄畻鍋忕Щ閲忥細
          // 璐寸焊缂╂斁鍚庣殑澶у皬
          const scaledWidth = BASE_SIZE * finalScale;
          const scaledHeight = BASE_SIZE * finalScale;

          // 馃啎 绮剧‘灞呬腑閫昏緫
          const textDims = this.estimateSubtitleDimensions(sub.text, fontSize, sub.style?.fontName);

          // 鏂囨湰涓績鐐?(鍋囪 sub.position 鏄乏涓婅)
          // 杩欓噷鐨?sub.position.x/y 鏄瓧骞曞湪瑙嗛涓殑宸︿笂瑙掑潗鏍?
          const textCenterX = sub.position.x + (textDims.width / 2);
          const textCenterY = sub.position.y + (textDims.height / 2);

          // 璐寸焊宸︿笂瑙?= 鏂囨湰涓績 - 璐寸焊涓€鍗?+ 鐢ㄦ埛鍋忕Щ
          // 杩欐牱璐寸焊涓績鐐逛細涓庢枃鏈腑蹇冪偣閲嶅悎锛堝姞涓婄敤鎴峰亸绉伙級
          const x = textCenterX - (scaledWidth / 2) + userOffsetX;
          const y = textCenterY - (scaledHeight / 2) + userOffsetY;

          assetsMap.get(stickerPath)?.push({
            startTime: sub.start / 1000, // 杞负绉?
            endTime: sub.end / 1000,
            x: Math.round(x),
            y: Math.round(y),
            // 馃啎 浼犻€掔缉鏀炬瘮渚嬶紝鍚庣画 buildFFmpegCommand 闇€瑕佸鐞?(鎴栬€?DrawtextGenerator)
            // 鐩墠 DrawtextGenerator 鎺ュ彛 StickerConfig 鏈?w, h銆?
            w: Math.round(scaledWidth),
            h: Math.round(scaledHeight)
          });
        }
      }
    }

    return Array.from(assetsMap.entries()).map(([path, instances]) => ({ path, instances }));
  }

  /**
   * 鏋勫缓FFmpeg鍛戒护
   * @private
   */
  private buildFFmpegCommand(
    inputVideo: string,
    outputVideo: string,
    assFiles: string[],
    drawtextCommands: string[],
    fontDir: string,
    soundInstances?: any[],
    stickerAssets?: { path: string, instances: any[] }[] // 馃啎 璐寸焊鍙傛暟
  ): FFmpegCommand {
    // 銆愭柊澧炴棩蹇椼€戞樉绀哄嵆灏嗕紶閫掔粰buildFilterComplex鐨勬墍鏈夊懡浠?
    console.log('[ZimuShengcheng.buildFFmpegCommand] ====== drawtextCommands 璇婃柇淇℃伅 ======');
    console.log('[ZimuShengcheng.buildFFmpegCommand] 鎬诲懡浠ゆ暟:', drawtextCommands.length);
    drawtextCommands.forEach((cmd, index) => {
      const textMatch = cmd.match(/text='([^']*?)'/);
      const textContent = textMatch ? textMatch[1] : '(鏈壘鍒版枃鏈?';
      console.log(`[ZimuShengcheng.buildFFmpegCommand] Command${index}: "${textContent}" (闀垮害${cmd.length})`);
    });
    console.log('[ZimuShengcheng.buildFFmpegCommand] ====== 寮€濮嬫瀯寤篺ilter_complex ======');

    // 馃啎 鏂板锛氬鏋滄湁闊虫晥瀹炰緥锛岀敓鎴愰煶棰戞贩闊抽厤缃?
    // Calculate input offset for audio (1 (video) + sticker count)
    // 娉ㄦ剰锛欱uild audio mix config 闇€瑕佺煡閬撲箣鍓嶅凡缁忔湁澶氬皯涓?input 浜?
    // 瑙嗛鏄?Input 0
    // 璐寸焊浠?Input 1 寮€濮嬶紝鏈?stickerAssets.length 涓?
    // 闊虫晥浠?Input 1 + stickerAssets.length 寮€濮?
    const stickerCount = stickerAssets ? stickerAssets.length : 0;
    const audioInputStartOffset = stickerCount; // 闊虫晥杈撳叆鐨勮捣濮嬪亸绉婚噺 (鐩稿浜?Input 1)

    let audioMixConfig: { inputFiles: string[]; mixFilter: string } | null = null;
    if (soundInstances && soundInstances.length > 0) {
      console.log('[ZimuShengcheng.buildFFmpegCommand] 馃攰 浠ヤ笅闊虫晥闇€瑕佹贩鍏ヨ棰?', soundInstances.length);
      audioMixConfig = this.buildAudioMixConfig(soundInstances, audioInputStartOffset);
    }

    // 馃啎 鏋勫缓娣峰悎婊ら暅閾?(浼樺寲鐗堬細姝ｇ‘鍒嗗眰)
    // 閫昏緫锛歏ideo -> [Stickers] -> [Drawtext] -> Output
    // 鍏堝鐞嗚创绾革紝寰楀埌涓棿娴佹爣绛撅紝鐒跺悗浼犵粰 DrawtextGenerator

    let currentStream = '[0:v]';
    let filterParts: string[] = [];
    let stickerInputOptions: string[] = [];

    // 1. 鏋勫缓璐寸焊鍙犲姞灞?
    if (stickerAssets && stickerAssets.length > 0) {
      console.log('[ZimuShengcheng] 馃洜锔?鏋勫缓璐寸焊婊ら暅閾?..');

      // 璐寸焊杈撳叆浠?Input 1 寮€濮?(0鏄棰?
      let inputIndex = 1;

      stickerAssets.forEach(asset => {
        // 鏀堕泦璐寸焊杈撳叆鍙傛暟
        stickerInputOptions.push('-i', asset.path);

        const instanceCount = asset.instances.length;

        // 1.1 Split 杈撳叆娴?(濡傛灉鏈夊涓疄渚?
        let splitOutputs: string[] = [];
        if (instanceCount > 1) {
          const splitFilter = `[${inputIndex}:v]split=${instanceCount}`;
          let splitLabels = '';
          for (let i = 0; i < instanceCount; i++) {
            const label = `[split_${inputIndex}_${i}]`;
            splitLabels += label;
            splitOutputs.push(label);
          }
          filterParts.push(`${splitFilter}${splitLabels}`);
        } else {
          splitOutputs.push(`[${inputIndex}:v]`);
        }

        // 1.2 澶勭悊姣忎釜瀹炰緥 (缂╂斁 + 鍙犲姞)
        asset.instances.forEach((instance, idx) => {
          const sourceStream = splitOutputs[idx];
          const scaledStream = `[scaled_${inputIndex}_${idx}]`;

          // 娣诲姞缂╂斁婊ら暅 (濡傛灉鏈?w/h)
          if (instance.w && instance.h) {
            filterParts.push(`${sourceStream}scale=${instance.w}:${instance.h}${scaledStream}`);
          }
          const activeStream = (instance.w && instance.h) ? scaledStream : sourceStream;

          // 鐢熸垚 overlay 鍙傛暟
          const overlayParams = `x=${instance.x}:y=${instance.y}:enable='between(t,${instance.startTime},${instance.endTime})'`;
          const nextStream = `[v_stk_out_${inputIndex}_${idx}]`;

          // [current][sticker_input]overlay=...[next]
          filterParts.push(`${currentStream}${activeStream}overlay=${overlayParams}${nextStream}`);
          currentStream = nextStream;
        });

        inputIndex++;
      });

      console.log('[ZimuShengcheng] 璐寸焊澶勭悊瀹屾瘯锛屾渶缁堟祦鏍囩:', currentStream);
    }

    // 2. 鏋勫缓瀛楀箷 Drawtext (鎺ユ敹 currentStream 浣滀负杈撳叆)
    // 鎰熻阿 DrawtextGenerator 鐨勬洿鏂帮紝鐜板湪鍙互浼犻€?inputLabel
    const drawtextFilter = DrawtextGenerator.buildFilterComplex(
      drawtextCommands,
      assFiles,
      fontDir,
      currentStream // 馃攽 鍏抽敭锛氬皢璐寸焊灞傜殑杈撳嚭浣滀负瀛楀箷灞傜殑杈撳叆
    );

    if (drawtextFilter) {
      filterParts.push(drawtextFilter);
    }

    // 缁勫悎鏈€缁堢殑 filter_complex
    let finalFilterComplex = filterParts.join(';');
    console.log('[ZimuShengcheng] 鏈€缁?filter_complex 闀垮害:', finalFilterComplex.length);


    let fullCommand = DrawtextGenerator.buildFFmpegCommand(
      inputVideo,
      outputVideo,
      finalFilterComplex // 浣跨敤鏈€缁堢殑婊ら暅閾?
    );

    // 銆愪慨澶嶃€戝鐞嗚繃闀跨殑filter_complex
    // 濡傛灉杩斿洖鐗规畩鏍囪锛岃〃绀洪渶瑕佷娇鐢ㄦ枃浠舵柟寮忎紶閫掕繃婊ゅ櫒
    if (fullCommand.startsWith('__USE_FILTER_FILE__:')) {
      console.log('[ZimuShengcheng] 妫€娴嬪埌filter_complex杩囬暱锛屽皢浣跨敤鏂囦欢鏂瑰紡浼犻€?..');
      // 鎻愬彇杩囨护鍣ㄥ唴瀹?
      const actualFilterContent = fullCommand.substring('__USE_FILTER_FILE__:'.length);
      // 銆愪慨澶嶃€戜娇鐢↗SON鏍煎紡閬垮厤璺緞涓殑鍐掑彿瀵艰嚧鍒嗗壊閿欒
      const scriptData = JSON.stringify({
        filterContent: actualFilterContent,
        inputVideo: inputVideo,
        outputVideo: outputVideo,
        audioMixConfig: audioMixConfig,  // 馃啎 鍖呭惈闊抽娣烽煶閰嶇疆
        stickerInputs: stickerInputOptions // 馃啎 鍖呭惈璐寸焊杈撳叆鍙傛暟
      });
      fullCommand = `__USE_FILTER_SCRIPT__:${scriptData}`;
    }

    return {
      fullCommand,
      filters: [finalFilterComplex],
      assFiles,
      tempFiles: assFiles, // 闇€瑕佹竻鐞嗙殑涓存椂鏂囦欢
      audioMixConfig,  // 馃啎 杩斿洖闊抽娣烽煶閰嶇疆
      stickerInputs: stickerInputOptions // 馃啎 杩斿洖璐寸焊杈撳叆
    };
  }

  /**
   * 馃啎 鏋勫缓闊抽娣烽煶閰嶇疆
   * @param inputOffset 闊抽杈撳叆鐨勮捣濮嬪亸绉婚噺 (榛樿涓?, 鍗充粠 Input 1 寮€濮?
   * @private
   */
  private buildAudioMixConfig(soundInstances: any[], inputOffset: number = 0): { inputFiles: string[]; mixFilter: string } | null {
    // 鏀堕泦鏈夋晥鐨勯煶鏁堟枃浠?
    const validInstances: { filePath: string; triggerTime: number; volume: number }[] = [];

    for (const instance of soundInstances) {
      // 閫氳繃鍚屾鏂瑰紡鑾峰彇闊虫晥鏂囦欢璺緞锛堣繖閲岄渶瑕佸湪鎵ц鍓嶅鐞嗭級
      // 绠€鍖栫増锛氱洿鎺ヤ粠 soundInstances 涓鍙栧凡瑙ｆ瀽鐨勮矾寰?
      if (instance.filePath) {
        validInstances.push({
          filePath: instance.filePath,
          triggerTime: instance.triggerTime || 0,
          volume: instance.params?.volume || 0.7
        });
      }
    }

    if (validInstances.length === 0) {
      console.log('[ZimuShengcheng.buildAudioMixConfig] 没有有效的音效文件');
      return null;
    }

    // 鐢熸垚杈撳叆鏂囦欢鍒楄〃
    const inputFiles = validInstances.map(v => v.filePath);

    // 鐢熸垚娣烽煶婊ら暅
    // 鏍煎紡: [1:a]adelay=1500|1500,volume=0.7[a1];[2:a]adelay=3000|3000,volume=0.6[a2];[0:a][a1][a2]amix=inputs=3[aout]
    const delayFilters: string[] = [];
    const labels: string[] = ['[0:a]'];  // 鍘熷瑙嗛闊宠建

    validInstances.forEach((instance, index) => {
      // Input Index = 1 (Video) + inputOffset (Stickers) + index (Current Audio)
      const inputIndex = 1 + inputOffset + index;
      const delayMs = Math.round(instance.triggerTime * 1000);
      const volume = instance.volume;
      const label = `a${index}`;

      // 鐢熸垚寤惰繜鍜岄煶閲忔护闀?
      delayFilters.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs},volume=${volume}[${label}]`);
      labels.push(`[${label}]`);
    });

    // 鐢熸垚娣烽煶婊ら暅
    // 馃敡 淇锛氭坊鍔?normalize=0 绂佺敤褰掍竴鍖栵紝淇濇寔鍘熷瑙嗛闊抽噺涓嶅彉
    // weights 鍙傛暟锛氱涓€涓槸鍘熷瑙嗛闊抽噺锛堣涓?锛夛紝鍏朵綑鏄煶鏁堥煶閲忥紙鐢卞疄渚嬫帶鍒讹級
    const weights = ['1', ...validInstances.map(() => '1')].join(' ');
    const mixFilter = `${delayFilters.join(';')};${labels.join('')}amix=inputs=${labels.length}:duration=first:normalize=0:weights=${weights}[aout]`;

    console.log('[ZimuShengcheng.buildAudioMixConfig] 闊抽娣烽煶婊ら暅:', mixFilter);
    console.log('[ZimuShengcheng.buildAudioMixConfig] 闊虫晥鏂囦欢鏁?', inputFiles.length);

    return {
      inputFiles,
      mixFilter
    };
  }

  /**
   * 鎵цFFmpeg娓叉煋
   * @private
   */
  private async executeFFmpeg(ffmpegCmd: FFmpegCommand): Promise<void> {
    let actualCommand = ffmpegCmd.fullCommand;
    let filterContent: string | null = null;
    let inputVideo: string | null = null;
    let outputVideo: string | null = null;

    // 銆愪慨澶嶃€戝鐞嗚繃闀跨殑filter_complex锛堜娇鐢╡xecFile閬垮厤鍛戒护琛岄檺鍒讹級
    // 娉ㄦ剰锛欴rawtextGenerator.buildFFmpegCommand 杩斿洖鐨勬槸 __USE_FILTER_FILE__: 鏍囪
    if (actualCommand.startsWith('__USE_FILTER_FILE__:') || actualCommand.startsWith('__USE_FILTER_SCRIPT__:')) {
      console.log('[ZimuShengcheng] 妫€娴嬪埌杩囬暱杩囨护鍣紝浣跨敤execFile鏂瑰紡...');
      try {
        // 銆愪慨澶嶃€戣В鏋怞SON鏍煎紡鐨勫弬鏁?
        const prefixLen = actualCommand.startsWith('__USE_FILTER_SCRIPT__:')
          ? '__USE_FILTER_SCRIPT__:'.length
          : '__USE_FILTER_FILE__:'.length;
        const jsonStr = actualCommand.substring(prefixLen);
        const scriptData = JSON.parse(jsonStr);
        filterContent = scriptData.filterContent;
        inputVideo = scriptData.inputVideo;
        outputVideo = scriptData.outputVideo;

        console.log('[ZimuShengcheng] 杩囨护鍣ㄤ俊鎭?', {
          filterLength: filterContent?.length || 0,
          filterEmpty: !filterContent || filterContent.trim() === '',
          inputVideo,
          outputVideo
        });

        // 馃敡 楠岃瘉filterContent涓嶄负绌?
        if (!filterContent || filterContent.trim() === '') {
          console.error('[ZimuShengcheng] filterContent 为空');
          throw new Error('FFmpeg filter 内容为空，无法生成字幕视频');
        }
      } catch (error) {
        console.error('[ZimuShengcheng] 瑙ｆ瀽filter鑴氭湰鍙傛暟澶辫触:', error);
        throw error;
      }
    }

    try {
      // 閫氳繃IPC璋冪敤FFmpeg
      if (typeof window !== 'undefined' && window.$mapi?.shell?.executeFFmpeg) {
        // 娴忚鍣ㄧ幆澧冿細浣跨敤IPC
        console.log('[ZimuShengcheng] 閫氳繃IPC璋冪敤FFmpeg...');
        if (filterContent && inputVideo && outputVideo) {
          // 馃啎 鑾峰彇闊虫晥娣烽煶閰嶇疆
          const audioMixConfig = ffmpegCmd.audioMixConfig;
          if (audioMixConfig && audioMixConfig.inputFiles.length > 0) {
            console.log('[ZimuShengcheng] 馃攰 IPC 璺緞锛氭娴嬪埌闊虫晥娣烽煶閰嶇疆:', {
              inputFilesCount: audioMixConfig.inputFiles.length,
              mixFilter: audioMixConfig.mixFilter
            });
          }

          // 濡傛灉鏄暱杩囨护鍣紝浼犻€扟SON缁橧PC澶勭悊锛堝寘鍚煶鏁堥厤缃級
          await window.$mapi.shell.executeFFmpeg(JSON.stringify({
            type: 'ffmpeg_long_filter',
            filterComplex: filterContent,
            inputVideo: inputVideo,
            outputVideo: outputVideo,
            stickerInputs: ffmpegCmd.stickerInputs, // 馃啎 浼犻€掕创绾歌緭鍏ョ粰 IPC
            // 馃啎 浼犻€掗煶鏁堟贩闊抽厤缃?
            audioMixConfig: audioMixConfig
          }));

          console.log('[ZimuShengcheng] 馃摛 IPC璋冪敤Payload:', {
            hasStickerInputs: !!ffmpegCmd.stickerInputs,
            stickerInputsLength: ffmpegCmd.stickerInputs?.length,
            stickerInputsPreview: ffmpegCmd.stickerInputs
          });
        } else {
          await window.$mapi.shell.executeFFmpeg(actualCommand);
        }
      } else {
        // Node.js鐜锛氫娇鐢╡xecFile閬垮厤鍛戒护琛岄暱搴﹂檺鍒?
        const { execFile } = await import('child_process');
        const util = await import('util');
        const execFilePromise = util.promisify(execFile);
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');

        let args: string[];
        let filterScriptFile: string | null = null;

        if (filterContent && inputVideo && outputVideo) {
          // 馃敡 淇锛氫娇鐢╢ilter鏂囦欢鑰屼笉鏄懡浠よ鍙傛暟锛岄伩鍏岴NAMETOOLONG閿欒
          // 鍒涘缓涓存椂filter鑴氭湰鏂囦欢
          const tempDir = os.default.tmpdir();
          filterScriptFile = path.default.join(tempDir, `ffmpeg_filter_${Date.now()}.txt`);

          // 鍐欏叆filter_complex鍒版枃浠?
          await fs.promises.writeFile(filterScriptFile, filterContent, 'utf-8');
          console.log('[ZimuShengcheng] 鍒涘缓filter鑴氭湰鏂囦欢:', filterScriptFile, '澶у皬:', filterContent.length, '瀛楃');

          // 銆愪慨澶嶃€戜娇鐢?-/filter_complex 鍙傛暟璇诲彇鏂囦欢锛?filter_complex_script 宸插簾寮冿級
          // 馃啎 妫€鏌ユ槸鍚︽湁闊虫晥娣烽煶閰嶇疆
          const audioMixConfig = ffmpegCmd.audioMixConfig;
          // 馃啎 鑾峰彇璐寸焊杈撳叆鍙傛暟
          const stickerInputs = ffmpegCmd.stickerInputs || [];

          let combinedFilterContent = filterContent;
          let audioArgs: string[] = [];

          if (audioMixConfig && audioMixConfig.inputFiles.length > 0) {
            console.log('[ZimuShengcheng] 馃攰 妫€娴嬪埌闊虫晥娣烽煶閰嶇疆:', {
              inputFilesCount: audioMixConfig.inputFiles.length,
              mixFilter: audioMixConfig.mixFilter
            });

            // 娣诲姞闊虫晥鏂囦欢浣滀负棰濆杈撳叆
            for (const soundFile of audioMixConfig.inputFiles) {
              audioArgs.push('-i', soundFile);
            }

            // 灏嗛煶棰戞贩闊虫护闀滄坊鍔犲埌瑙嗛婊ら暅鏈熬
            // 瑙嗛婊ら暅閫氬父浠?[out] 鎴?[v] 缁撳熬锛屾垜浠渶瑕佹坊鍔犻煶棰戞贩闊?
            combinedFilterContent = filterContent + ';' + audioMixConfig.mixFilter;
            console.log('[ZimuShengcheng] 馃攰 缁勫悎鍚庣殑婊ら暅锛堝寘鍚煶鏁堬級闀垮害:', combinedFilterContent.length);
          }

          // 鍐欏叆filter_complex鍒版枃浠?
          await fs.promises.writeFile(filterScriptFile, combinedFilterContent, 'utf-8');
          console.log('[ZimuShengcheng] 鍒涘缓filter鑴氭湰鏂囦欢:', filterScriptFile, '澶у皬:', combinedFilterContent.length, '瀛楃');

          // 鏋勫缓 args锛氳棰戣緭鍏?+ 闊虫晥杈撳叆 + 婊ら暅 + 杈撳嚭
          if (audioMixConfig && audioMixConfig.inputFiles.length > 0) {
            // 鏈夐煶鏁堟椂锛氫娇鐢?-map 鎸囧畾杈撳嚭娴?
            args = [
              '-y',  // 瑕嗙洊宸插瓨鍦ㄧ殑杈撳嚭鏂囦欢
              '-i', inputVideo,
              ...stickerInputs, // 馃啎涓€瀹氳鍔犱笂璐寸焊杈撳叆!
              ...audioArgs,  // 闊虫晥鏂囦欢杈撳叆
              `-filter_complex_script`, filterScriptFile,  // 浣跨敤婊ら暅鑴氭湰鏂囦欢
              '-map', '[out]',  // 瑙嗛杈撳嚭
              '-map', '[aout]', // 闊抽杈撳嚭
              '-c:v', 'libx264',
              '-preset', 'medium',
              '-crf', '18',
              '-c:a', 'aac',  // 闇€瑕侀噸鏂扮紪鐮侀煶棰?
              '-b:a', '192k',
              outputVideo
            ];
          } else {
            // 鏃犻煶鏁堬細榛樿鍙傛暟
            args = [
              '-y',
              '-i', inputVideo,
              ...stickerInputs, // 馃啎 鏃犻煶鏁堟椂涔熻鍔犱笂璐寸焊杈撳叆
              `-filter_complex_script`, filterScriptFile,
              '-map', '[out]',
              // '-map', '0:a?', // 灏濊瘯澶嶅埗鍘熼煶棰戯紙濡傛灉瀛樺湪锛?
              '-c:v', 'libx264',
              '-preset', 'medium',
              '-crf', '18',
              '-c:a', 'copy', // 澶嶅埗闊抽娴?
              outputVideo
            ];
          }
          console.log('[ZimuShengcheng] 浣跨敤execFile鎵цFFmpeg锛堥暱杩囨护鍣ㄦ枃浠舵ā寮忥級...');

          // 纭繚娓呯悊filter鏂囦欢
          if (!ffmpegCmd.tempFiles) {
            ffmpegCmd.tempFiles = [];
          }
          ffmpegCmd.tempFiles.push(filterScriptFile);
        } else {
          // 姝ｅ父鎯呭喌锛氱洿鎺ユ墽琛?
          console.log('[ZimuShengcheng] 浣跨敤execFile鎵цFFmpeg锛堟櫘閫氭ā寮忥級...');
          args = actualCommand.split(' ').slice(1); // 璺宠繃'ffmpeg'
          args = args.map(arg => arg.startsWith('"') && arg.endsWith('"') ? arg.slice(1, -1) : arg);
        }

        const result = await execFilePromise('ffmpeg', args);
        console.log('[ZimuShengcheng] FFmpeg杈撳嚭:', result.stdout?.substring(0, 200));

        // FFmpeg 灏嗘甯歌緭鍑猴紙鐗堟湰淇℃伅銆佺紪鐮佺粺璁＄瓑锛夎緭鍑哄埌 stderr
        // 杩欐槸鏍囧噯琛屼负锛屼笉鏄敊璇?
        if (result.stderr) {
          // 妫€鏌ユ槸鍚﹀寘鍚湡姝ｇ殑閿欒淇℃伅
          const hasRealError = /error|failed|invalid|fatal/i.test(result.stderr);
          if (hasRealError) {
            console.error('[ZimuShengcheng] FFmpeg閿欒:', result.stderr);
            throw new Error(result.stderr);
          } else {
            console.log('[ZimuShengcheng] FFmpeg淇℃伅杈撳嚭:', result.stderr.substring(0, 500) + (result.stderr.length > 500 ? '...' : ''));
          }
        }
      }
    } catch (error) {
      console.error('[ZimuShengcheng] FFmpeg鎵ц澶辫触:', error);
      throw error;
    } finally {
      // 娓呯悊涓存椂鏂囦欢
      await this.cleanupTempFiles(ffmpegCmd.tempFiles);
    }
  }

  // ==================== 杈呭姪鏂规硶 ====================

  /**
   * 鍒涘缓閲戣壊鐗规晥鏍峰紡
   * @private
   */
  private createGoldEffectStyle(config: ZimuConfig): ASSStyleConfig {
    return {
      name: 'GoldEffect',
      fontname: config.subtitleStyle.fontName || 'Microsoft YaHei Bold',
      fontsize: Math.round((config.subtitleStyle.fontSize || 48) * 1.5),
      primaryColour: '&H0000D7FF',  // 閲戣壊锛圔GR椤哄簭锛?
      secondaryColour: '&H000000FF',
      outlineColour: '&H00008CFF',
      backColour: '&H00000000',
      bold: 1,
      italic: 0,
      borderStyle: 1,
      outline: 4,
      shadow: 0,
      alignment: 2,
      marginL: 10,
      marginR: 10,
      marginV: 200,
      scaleX: 100,
      scaleY: 100
    };
  }

  /**
   * 鑾峰彇杈撳嚭鐩綍锛堢敤浜庝繚瀛楢SS鏂囦欢锛?
   * 鏀逛负浣跨敤output鐩綍鑰岄潪绯荤粺Temp鐩綍锛岄伩鍏峎indows鐭矾寰勶紙ADMINI~1锛夐棶棰?
   * @private
   */
  private async getTempDir(): Promise<string> {
    // 馃敡 淇锛氫娇鐢ㄧ郴缁熶复鏃剁洰褰曡€屼笉鏄」鐩洰褰曪紝閬垮厤涓枃璺緞闂
    // 浼樺厛浣跨敤 C:\Windows\Temp锛圵indows 绯荤粺鐩綍锛屼笉鍖呭惈涓枃锛?
    const path = await import('path');
    const fs = await import('fs');

    // Windows 绯荤粺涓存椂鐩綍锛堜笉鍖呭惈涓枃锛?
    const systemTempDir = process.platform === 'win32'
      ? 'C:/Windows/Temp/aigcpanel-fonts'
      : '/tmp/aigcpanel-fonts';

    // 纭繚鐩綍瀛樺湪
    if (typeof window !== 'undefined' && window.require) {
      const fsNode = window.require('fs');
      if (!fsNode.existsSync(systemTempDir)) {
        fsNode.mkdirSync(systemTempDir, { recursive: true });
      }
    } else {
      const fsModule = await import('fs');
      if (!fsModule.existsSync(systemTempDir)) {
        fsModule.mkdirSync(systemTempDir, { recursive: true });
      }
    }

    console.log(`[ZimuShengcheng] 浣跨敤绯荤粺涓存椂鐩綍: ${systemTempDir}`);
    return systemTempDir;
  }

  /**
   * 鐢熸垚SRT鏂囦欢锛堢敤浜庡睍绀哄拰涓嬭浇锛?
   * @private
   */
  private async generateSRTFile(segments: CorrectedSegment[], config: ZimuConfig): Promise<string> {
    // 鐢熸垚SRT鍐呭
    let srtContent = '';
    let index = 1;

    // 鏍煎紡鍖栨椂闂达紙杈撳叆涓烘绉掞紝杞崲涓篠RT鏍煎紡锛欻H:MM:SS,mmm锛?
    const formatSRTTime = (milliseconds: number): string => {
      // 杈撳叆缁熶竴涓烘绉掞紝杞崲涓虹
      const timeInSeconds = milliseconds / 1000;

      const h = Math.floor(timeInSeconds / 3600);
      const m = Math.floor((timeInSeconds % 3600) / 60);
      const s = Math.floor(timeInSeconds % 60);
      const ms = Math.floor((timeInSeconds % 1) * 1000);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };

    // 浠庝慨姝ｅ悗鐨勭墖娈电敓鎴怱RT
    for (const segment of segments) {
      const startTime = formatSRTTime(segment.start);
      const endTime = formatSRTTime(segment.end);

      srtContent += `${index}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${segment.text}\n\n`;
      index++;
    }

    // 淇濆瓨SRT鏂囦欢鍒拌緭鍑虹洰褰?
    const outputDir = await this.getTempDir();
    const path = await import('path');
    const timestamp = Date.now();
    const srtFileName = `subtitle_${timestamp}.srt`;
    const srtPath = path.join(outputDir, srtFileName).replace(/\\/g, '/');

    // 鍐欏叆鏂囦欢
    if (typeof window !== 'undefined' && window.$mapi?.file?.write) {
      await window.$mapi.file.write(srtPath, srtContent, { isDataPath: false });
    } else {
      // Node.js鐜
      const fs = await import('fs');
      const util = await import('util');
      const writeFile = util.promisify(fs.writeFile);
      await writeFile(srtPath, srtContent, { encoding: 'utf-8' });
    }

    console.log(`[ZimuShengcheng] SRT 文件已生成: ${srtPath}`);
    return srtPath;
  }

  /**
   * 娓呯悊涓存椂鏂囦欢
   * @private
   */
  private async cleanupTempFiles(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        if (typeof window !== 'undefined' && window.$mapi?.file?.deleteFile) {
          await window.$mapi.file.deleteFile(file);
        } else {
          const fs = await import('fs');
          const util = await import('util');
          const unlink = util.promisify(fs.unlink);
          await unlink(file);
        }
        console.log(`[ZimuShengcheng] 已删除临时文件: ${file}`);
      } catch (error) {
        console.warn(`[ZimuShengcheng] 鍒犻櫎涓存椂鏂囦欢澶辫触: ${file}`, error);
      }
    }
  }

  /**
   * 鐢熸垚璋冭瘯鏂囦欢锛堝寘鍚墍鏈夊瓧骞曡缁嗕俊鎭級
   * @private
   */
  private async generateDebugFile(
    subtitles: ArrangedSubtitle[],
    drawtextCommands: string[],
    config: ZimuConfig
  ): Promise<string> {
    const tempDir = await this.getTempDir();
    const debugPath = `${tempDir}/subtitle_debug_${Date.now()}.json`;

    // 鍒涘缓璋冭瘯淇℃伅瀵硅薄
    const debugInfo = {
      // 鍩虹閰嶇疆
      config: {
        videoWidth: config.videoWidth,
        videoHeight: config.videoHeight,
        subtitleStyle: config.subtitleStyle,
        keywordGroupsCount: config.keywordGroups?.length || 0
      },

      // 淇鍚庣殑娈佃惤
      segments: this.correctedSegments.map(seg => ({
        text: seg.text,
        start: seg.start,
        end: seg.end,
        duration: seg.end - seg.start
      })),

      // 鍏抽敭璇嶅尮閰嶇粨鏋?
      keywordMatches: this.keywordMatches.map(match => ({
        keyword: match.keyword,
        effectType: match.effectType,
        isAnimated: match.isAnimated,
        startTime: match.startTime,
        endTime: match.endTime,
        duration: match.endTime - match.startTime,
        effectDuration: match.effectDuration, // 姣
        groupId: match.groupId,
        groupName: match.groupName
      })),

      // 鎺掑垪鍚庣殑瀛楀箷璇︽儏
      subtitles: subtitles.map((subtitle, index) => {
        const detail: any = {
          index,
          type: subtitle.type,
          text: subtitle.text,
          start: subtitle.start,
          end: subtitle.end,
          duration: subtitle.end - subtitle.start,
          position: subtitle.position,
          style: subtitle.style,
          layer: subtitle.layer
        };

        // 濡傛灉鏈夊姩鐢婚厤缃紝娣诲姞璇︾粏淇℃伅
        if (subtitle.animationConfig) {
          detail.animationConfig = {
            type: subtitle.animationConfig.type,
            duration: subtitle.animationConfig.duration, // 姣
            delay: subtitle.animationConfig.delay,
            intensity: subtitle.animationConfig.intensity,
            parameters: subtitle.animationConfig.parameters
          };
        }

        // 璁＄畻鏂囨湰瀹藉害锛堝儚绱狅級
        const charCount = this.countDisplayChars(subtitle.text);
        detail.charCount = charCount;
        detail.estimatedWidth = charCount * subtitle.style.fontSize * 0.5; // 浼扮畻

        return detail;
      }),

      // 鏈€缁堢殑drawtext鍛戒护
      drawtextCommands: drawtextCommands.map((cmd, index) => ({
        index,
        command: cmd,
        length: cmd.length
      })),

      // SmartLayoutManager淇℃伅
      layoutManager: {
        screenWidth: config.videoWidth,
        screenHeight: config.videoHeight,
        longAnimationThreshold: 5.0, // 淇鍚庣殑鍊?
        positionStrategy: 'see SmartLayoutManager.ts'
      },

      // 缁熻淇℃伅
      statistics: {
        totalSubtitles: subtitles.length,
        normalSubtitles: subtitles.filter(s => s.type === 'normal').length,
        effectSimple: subtitles.filter(s => s.type === 'effect_simple').length,
        effectComplex: subtitles.filter(s => s.type === 'effect_complex').length,
        totalDrawtextCommands: drawtextCommands.length
      }
    };

    // 淇濆瓨鍒版枃浠?
    try {
      if (typeof window !== 'undefined' && window.$mapi?.file?.writeText) {
        await window.$mapi.file.writeText(debugPath, JSON.stringify(debugInfo, null, 2));
      } else {
        const fs = await import('fs');
        const util = await import('util');
        const writeFile = util.promisify(fs.writeFile);
        await writeFile(debugPath, JSON.stringify(debugInfo, null, 2), 'utf8');
      }

      console.log(`[ZimuShengcheng] 调试文件已生成: ${debugPath}`);
      return debugPath;

    } catch (error) {
      console.error('[ZimuShengcheng] 鐢熸垚璋冭瘯鏂囦欢澶辫触:', error);
      return '';
    }
  }

  /**
   * 璁＄畻鏄剧ず瀛楃鏁帮紙涓枃绠?锛岃嫳鏂囩畻0.5锛?
   * @private
   */
  private countDisplayChars(text: string): number {
    let count = 0;
    for (const char of text) {
      if (/[\u4e00-\u9fff]/.test(char)) {
        count += 1; // 涓枃
      } else if (/[a-zA-Z0-9\s]/.test(char)) {
        count += 0.5; // 鑻辨枃鏁板瓧
      } else {
        count += 0.3; // 鏍囩偣
      }
    }
    return count;
  }
}
