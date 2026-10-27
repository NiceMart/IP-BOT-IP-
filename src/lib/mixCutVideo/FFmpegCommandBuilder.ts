import type { MaterialReplacement, PipPosition, PipScaleMode, MixCutDisplayMode, OriginalVideoPosition, OriginalVideoShape } from './types';

/**
 * FFmpeg命令构建器
 */
export class FFmpegCommandBuilder {
  /**
   * 计算画中画的 overlay 位置坐标（返回 FFmpeg 表达式）
   * 🔧 修复：直接使用数值计算，而不是 FFmpeg 表达式
   */
  private static calculatePipPosition(
    position: PipPosition,
    mainWidth: number,
    mainHeight: number,
    pipWidth: number,
    pipHeight: number,
    padding: number = 10
  ): { x: string; y: string } {
    // 🔧 修复：直接计算数值，而不是使用 W/H/w/h 表达式
    const positions: Record<PipPosition, { x: string; y: string }> = {
      'top-left': { x: String(padding), y: String(padding) },
      'top-center': { x: String((mainWidth - pipWidth) / 2), y: String(padding) },
      'top-right': { x: String(mainWidth - pipWidth - padding), y: String(padding) },
      'center-left': { x: String(padding), y: String((mainHeight - pipHeight) / 2) },
      'center': { x: String((mainWidth - pipWidth) / 2), y: String((mainHeight - pipHeight) / 2) },
      'center-right': { x: String(mainWidth - pipWidth - padding), y: String((mainHeight - pipHeight) / 2) },
      'bottom-left': { x: String(padding), y: String(mainHeight - pipHeight - padding) },
      'bottom-center': { x: String((mainWidth - pipWidth) / 2), y: String(mainHeight - pipHeight - padding) },
      'bottom-right': { x: String(mainWidth - pipWidth - padding), y: String(mainHeight - pipHeight - padding) },
    };
    return positions[position] || positions['bottom-right'];
  }

  /**
   * 生成视频缩放 filter 字符串
   */
  private static generateScaleFilter(
    scaleMode: PipScaleMode,
    targetWidth: number,
    targetHeight: number
  ): string {
    switch (scaleMode) {
      case 'fit':
        // 保持比例 + 黑边：缩放到不超过目标尺寸
        return `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`;

      case 'fill':
        // 保持比例 + 裁剪：至少一边等于目标，然后裁剪
        return `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`;

      case 'stretch':
        // 强制拉伸：不保持比例
        return `scale=${targetWidth}:${targetHeight}`;

      default:
        return `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`;
    }
  }

  /**
   * 🆕 计算原视频最小化的位置坐标（简化版5个位置）
   */
  private static calculateOriginalVideoPosition(
    position: OriginalVideoPosition,
    videoWidth: number,
    videoHeight: number,
    miniSize: number
  ): { x: number; y: number } {
    const padding = 20; // 距离边缘的内边距

    const positions: Record<OriginalVideoPosition, { x: number; y: number }> = {
      'top-left': { x: padding, y: padding },
      'top-right': { x: videoWidth - miniSize - padding, y: padding },
      'bottom-left': { x: padding, y: videoHeight - miniSize - padding },
      'bottom-right': { x: videoWidth - miniSize - padding, y: videoHeight - miniSize - padding },
      'center': { x: (videoWidth - miniSize) / 2, y: (videoHeight - miniSize) / 2 },
    };
    return positions[position] || positions['bottom-right'];
  }

  static buildOverlayCommand(
    originalVideoPath: string,
    replacements: MaterialReplacement[],
    outputPath: string,
    videoResolution: { width: number; height: number }
  ): string[] {
    if (replacements.length === 0) throw new Error('素材替换点数组为空');

    const inputs: string[] = [originalVideoPath];
    const inputIndexMap = new Map<string, number>();
    const inputIsImage = new Map<number, boolean>(); // 🆕 记录哪些输入是图片
    inputIndexMap.set('original', 0);
    inputIsImage.set(0, false);

    // 添加所有素材文件
    for (const r of replacements) {
      if (!inputIndexMap.has(r.materialPath)) {
        inputs.push(r.materialPath);
        const index = inputs.length - 1;
        inputIndexMap.set(r.materialPath, index);
        inputIsImage.set(index, r.isImage || false); // 🆕 记录是否为图片
      }
    }

    // 🔧 修复：处理重叠替换点，当后续替换点开始时立即停止前序替换点
    // 计算每个替换点的实际结束时间（考虑后续替换点的干扰）
    const adjustedReplacements = replacements.map((r, i) => {
      let actualEndTime = r.startTime + r.duration;

      // 找到最接近的后续替换点，将当前替换点的结束时间设置为该替换点的开始时间
      // 这样可以确保没有两个素材同时播放
      for (let j = i + 1; j < replacements.length; j++) {
        const nextR = replacements[j];

        // 如果后续替换点在当前替换点的播放期间开始，立即停止当前替换点
        if (nextR.startTime < actualEndTime) {
          // 将当前替换点的结束时间设置为后续替换点的开始时间
          actualEndTime = nextR.startTime;
          // 不 break，继续检查是否有更早开始的后续替换点
        }
      }

      return { ...r, actualEndTime };
    });

    // 🔍 详细诊断：打印所有替换点信息
    console.log('='.repeat(80));
    console.log('[FFmpegCommandBuilder] 📊 替换点时间调整详情（处理重叠）:');
    adjustedReplacements.forEach((r, i) => {
      console.log(`[${i}] ${r.reason}:`);
      console.log(`    原始: startTime=${r.startTime.toFixed(3)}, duration=${r.duration.toFixed(3)}`);
      console.log(`    调整后: startTime=${r.startTime.toFixed(3)}, actualEndTime=${r.actualEndTime.toFixed(3)}`);
      console.log(`    时间范围: [${r.startTime.toFixed(3)}, ${r.actualEndTime.toFixed(3)})`);
    });
    console.log('='.repeat(80));

    // 构建filter_complex
    let filterComplex = '';
    let currentStream = '[0:v]';

    for (let i = 0; i < adjustedReplacements.length; i++) {
      const r = adjustedReplacements[i];
      const inputIndex = inputIndexMap.get(r.materialPath)!;
      const materialStream = `[${inputIndex}:v]`;
      const processedMaterialStream = `[m${i}]`;
      const actualDuration = Math.min(r.actualEndTime - r.startTime, r.materialDuration);

      // 🔧 修复：直接使用MaterialReplacement中的displayMode，默认为fullscreen
      const mode = r.displayMode || 'fullscreen';

      if (mode === 'pip') {
        // 画中画模式
        const pipSize = r.pipSizePercent || 30;
        const pipWidth = Math.round(videoResolution.width * pipSize / 100);
        const pipHeight = Math.round(videoResolution.height * pipSize / 100);
        const pipScaleMode = r.pipScaleMode || 'fit';
        const pipPos = r.pipPosition || 'bottom-right';

        // 缩放素材（根据缩放模式）
        const scaleFilter = this.generateScaleFilter(pipScaleMode, pipWidth, pipHeight);
        filterComplex += `${materialStream}${scaleFilter}${processedMaterialStream};`;

        // 计算 overlay 位置
        const { x, y } = this.calculatePipPosition(
          pipPos,
          videoResolution.width,
          videoResolution.height,
          pipWidth,
          pipHeight
        );

        // overlay 到指定位置
        const outputStream = `[v${i}]`;
        // 🔧 修复：使用半开区间 [start, end) 避免边界重叠
        // between() 是闭区间会导致两个素材在交界点同时显示
        const enableExpr = `gte(t,${r.startTime.toFixed(3)})*lt(t,${r.actualEndTime.toFixed(3)})`;
        filterComplex += `${currentStream}${processedMaterialStream}overlay=${x}:${y}:enable='${enableExpr}'${outputStream};`;

        currentStream = outputStream;
      } else {
        // 全屏替换模式
        const originalMinimized = r.originalVideoMinimized;

        if (originalMinimized?.enabled) {
          // 🆕 场景：素材全屏 + 原视频小窗口
          const { shape, position, sizePercent } = originalMinimized;
          const originalSize = Math.floor(videoResolution.width * (sizePercent / 100));

          // 1. 素材全屏铺满
          const scaleFilter = `scale=${videoResolution.width}:${videoResolution.height}:force_original_aspect_ratio=decrease`;
          filterComplex += `${materialStream}${scaleFilter},pad=${videoResolution.width}:${videoResolution.height}:(ow-iw)/2:(oh-ih)/2${processedMaterialStream};`;

          // 2. 原视频缩小处理
          const origStream = `[orig${i}]`;
          let originalScaled = `${currentStream}scale=${originalSize}:${originalSize}:force_original_aspect_ratio=decrease,pad=${originalSize}:${originalSize}:(ow-iw)/2:(oh-ih)/2:black`;

          // 3. 如果是圆形，添加圆形mask
          if (shape === 'circle') {
            const radius = originalSize / 2;
            // 使用geq滤镜创建圆形遮罩
            originalScaled += `,geq=lum='if(lt(sqrt(pow(X-${radius},2)+pow(Y-${radius},2)),${radius}),lum(X,Y),0)':a='if(lt(sqrt(pow(X-${radius},2)+pow(Y-${radius},2)),${radius}),255,0)'`;
          }
          originalScaled += origStream;
          filterComplex += originalScaled + ';';

          // 4. 计算位置坐标
          const { x, y } = this.calculateOriginalVideoPosition(position, videoResolution.width, videoResolution.height, originalSize);

          // 5. 先叠加素材，再叠加原视频小窗口
          const tmpStream = `[tmp${i}]`;
          const enableExpr = `gte(t,${r.startTime.toFixed(3)})*lt(t,${r.actualEndTime.toFixed(3)})`;
          // 第一层：原视频 + 素材全屏
          filterComplex += `${currentStream}${processedMaterialStream}overlay=0:0:enable='${enableExpr}'${tmpStream};`;
          // 第二层：+原视频小窗口
          const outputStream = `[v${i}]`;
          filterComplex += `${tmpStream}${origStream}overlay=${x}:${y}:enable='${enableExpr}'${outputStream};`;

          currentStream = outputStream;
        } else {
          // 原有的全屏替换逻辑（不显示原视频）
          const scaleFilter = `scale=${videoResolution.width}:${videoResolution.height}:force_original_aspect_ratio=decrease`;
          filterComplex += `${materialStream}${scaleFilter}${processedMaterialStream};`;

          // overlay
          const outputStream = `[v${i}]`;
          const enableExpr = `gte(t,${r.startTime.toFixed(3)})*lt(t,${r.actualEndTime.toFixed(3)})`;
          filterComplex += `${currentStream}${processedMaterialStream}overlay=0:0:enable='${enableExpr}'${outputStream};`;

          currentStream = outputStream;
        }
      }
    }

    filterComplex = filterComplex.slice(0, -1); // 去掉最后的分号

    // 🔍 诊断日志：输出完整的 filter_complex
    console.log('='.repeat(80));
    console.log('[FFmpegCommandBuilder] 生成的 filter_complex:');
    console.log(filterComplex);
    console.log('='.repeat(80));

    // 构建命令
    const ffmpegArgs: string[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      // 🆕 如果是图片，添加 -loop 1 参数使其循环播放
      if (inputIsImage.get(i)) {
        ffmpegArgs.push('-loop', '1');
        console.log(`[FFmpegCommandBuilder] 输入 [${i}] 是图片，添加 -loop 1 参数:`, input);
      }
      ffmpegArgs.push('-i', input);
    }
    ffmpegArgs.push('-filter_complex', filterComplex);
    ffmpegArgs.push('-map', `[v${replacements.length - 1}]`);
    ffmpegArgs.push('-map', '0:a?');
    ffmpegArgs.push('-c:a', 'copy');
    ffmpegArgs.push('-c:v', 'libx264');
    ffmpegArgs.push('-preset', 'medium');
    ffmpegArgs.push('-crf', '23');
    ffmpegArgs.push('-y');
    ffmpegArgs.push(outputPath);

    return ffmpegArgs;
  }
}
