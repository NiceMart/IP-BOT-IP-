#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字幕封面生成器 - 简化版本（不依赖spacy和rembg）
Subtitle & Cover Generator - Simplified Version
"""

import os
import sys
import json
import argparse
import subprocess
from typing import Dict, List, Any, Optional
from pathlib import Path

# ⚠️ 修复模块路径：确保 Python 能找到 modules 和其他本地模块
# 将脚本所在目录（python 目录）添加到 sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)
    print(f"[PATH] Added to sys.path: {script_dir}", file=sys.stderr)

try:
    from modules.font_manager import get_font_manager
    FONT_MANAGER_AVAILABLE = True
    print("[PATH] font_manager loaded successfully", file=sys.stderr)
except ImportError as e:
    FONT_MANAGER_AVAILABLE = False
    print(f"[PATH] Warning: font_manager module not available: {e}", file=sys.stderr)

# 导入封面模板
try:
    from modules.cover_templates import get_template, get_all_templates
    COVER_TEMPLATES_AVAILABLE = True
except ImportError:
    COVER_TEMPLATES_AVAILABLE = False
    print("Warning: cover_templates module not available", file=sys.stderr)

# 导入基础库
try:
    import cv2
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageFont, ImageOps
except ImportError as e:
    print(f"Error: Missing required library - {e}", file=sys.stderr)
    sys.exit(1)

# 尝试导入 RMBG（人像抠图）
try:
    from rembg import remove as rembg_remove
    REMBG_AVAILABLE = True
    print("RMBG library loaded successfully", file=sys.stderr)
except ImportError:
    REMBG_AVAILABLE = False
    print("Warning: RMBG library not available, portrait extraction will be disabled", file=sys.stderr)

# 尝试导入 Jieba（中文NLP - 轻量级）
try:
    import jieba
    import jieba.analyse
    NLP_AVAILABLE = True
    print("Jieba NLP library loaded successfully", file=sys.stderr)
except ImportError:
    NLP_AVAILABLE = False
    print("Warning: Jieba library not available, NLP features will be disabled", file=sys.stderr)

# 尝试导入 Transformers（深度学习情感分析）
try:
    from transformers import pipeline
    import torch
    TRANSFORMERS_AVAILABLE = True
    print("Transformers library loaded successfully", file=sys.stderr)
    # 检查是否支持FP16
    FP16_AVAILABLE = torch.cuda.is_available()
    if FP16_AVAILABLE:
        print("CUDA available, FP16 optimization enabled", file=sys.stderr)
    else:
        print("CUDA not available, using CPU mode", file=sys.stderr)
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    FP16_AVAILABLE = False
    print("Warning: Transformers library not available, advanced sentiment analysis will be disabled", file=sys.stderr)

# 尝试导入 FUNASR（语音识别）
try:
    from funasr import AutoModel
    FUNASR_AVAILABLE = True
    print("FUNASR library loaded successfully", file=sys.stderr)
except ImportError:
    FUNASR_AVAILABLE = False
    print("Warning: FUNASR library not available, speech recognition will be disabled", file=sys.stderr)


class SubtitleCoverGenerator:
    """字幕封面生成器主类（简化版）"""

    def __init__(self, config: Dict[str, Any]):
        """
        初始化生成器

        Args:
            config: 配置字典，包含视频路径、文案、样式等
        """
        self.config = config
        self.video_path = config.get('videoPath')
        self.script_text = config.get('scriptText', '')
        self.subtitle_style = config.get('subtitleStyle', 'default')
        self.cover_style = config.get('coverStyle', 'default')
        self.output_dir = config.get('outputDir', './output')

        # 新增：关键词分组和效果配置
        self.keyword_groups = config.get('keywordGroups', [])  # 关键词分组列表
        self.keyword_markers = config.get('keywordMarkers', [])  # 关键词标记
        print(f"[SubtitleGenerator] Loaded {len(self.keyword_groups)} keyword groups and {len(self.keyword_markers)} keyword markers", file=sys.stderr)

        # ✅ 详细日志：显示关键词分组信息
        if self.keyword_groups:
            print(f"[SubtitleGenerator] === Keyword Groups Details ===", file=sys.stderr)
            for idx, group in enumerate(self.keyword_groups):
                style_override = group.get('styleOverride', {})
                print(f"[SubtitleGenerator] Group {idx}: id={group.get('id')}", file=sys.stderr)
                print(f"  name={group.get('name')}", file=sys.stderr)
                print(f"  effectId={group.get('effectId')}", file=sys.stderr)
                print(f"  styleOverride={style_override}", file=sys.stderr)
                print(f"  fontColor={style_override.get('fontColor')}", file=sys.stderr)
                print(f"  outlineColor={style_override.get('outlineColor')}", file=sys.stderr)
                print(f"  fontSize={style_override.get('fontSize')}", file=sys.stderr)
        else:
            print("[SubtitleGenerator] WARNING: No keyword groups received!", file=sys.stderr)

        # ✅ 详细日志：显示关键词标记信息
        if self.keyword_markers:
            for marker in self.keyword_markers:
                print(f"[SubtitleGenerator] Keyword Marker: text={marker.get('text')}, groupId={marker.get('groupId')}", file=sys.stderr)

        # 新增：字体配置（从subtitleStyle中提取）
        subtitle_style = config.get('subtitleStyle', {})
        self.subtitle_font_name = subtitle_style.get('fontName', 'Microsoft YaHei')  # 字体名称
        self.subtitle_font_size = subtitle_style.get('fontSize', 24)  # 字体大小
        self.subtitle_font_color = subtitle_style.get('fontColor', '#FFFFFF')  # 字体颜色
        print(f"Subtitle font config: {self.subtitle_font_name}, {self.subtitle_font_size}px, {self.subtitle_font_color}", file=sys.stderr)

        # 获取用户配置的文件存储路径，如果没有则使用默认输出目录
        self.hub_root = config.get('hubRoot', None)
        if self.hub_root:
            # 确保hub_root路径存在
            os.makedirs(self.hub_root, exist_ok=True)
            # 使用hub_root作为输出目录
            self.output_dir = self.hub_root
        else:
            # 没有hub_root配置，使用提供的outputDir或默认值
            self.output_dir = config.get('outputDir', './output')
        
        # 确保输出目录存在
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 初始化 ziti 字体目录路径（用于 FFmpeg fontconfig）
        self.ziti_dir = self._find_ziti_directory()
        print(f"[SubtitleGenerator] Ziti font directory: {self.ziti_dir}", file=sys.stderr)

        self.use_funasr = config.get('useFunasr', False)  # 是否使用FUNASR
        self.funasr_result = config.get('funasrResult', None)  # FUNASR识别结果（可选）
        self.cover_only = config.get('coverOnly', False)  # 是否仅生成封面
        self.use_extracted_frame = config.get('useExtractedFrame', False)  # 是否使用提取的帧
        self.extracted_frame_path = config.get('extractedFramePath', None)  # 提取的帧路径

        # 封面参数配置
        self.cover_text = config.get('coverText', '')  # 封面文字
        self.cover_text_position = config.get('coverTextPosition', 'bottom')  # 文字位置
        self.cover_text_color = config.get('coverTextColor', '#FFFFFF')  # 文字颜色
        self.cover_text_size = config.get('coverTextSize', 50)  # 文字大小
        self.outline_color = config.get('outlineColor', '#FFD700')  # 描边颜色
        self.outline_width = config.get('outlineWidth', 3)  # 描边宽度
        self.blur_radius = config.get('blurRadius', 15)  # 背景模糊度
        self.zoom_level = config.get('zoomLevel', 1.0)  # 封面放大倍数

        # 自定义模板配置
        self.custom_template = config.get('customTemplate', False)  # 是否使用自定义模板
        self.template = config.get('template', None)  # 自定义模板对象

        # 初始化情感分析模型（延迟加载）
        self.sentiment_analyzer = None
        if TRANSFORMERS_AVAILABLE:
            try:
                print("Loading sentiment analysis model...", file=sys.stderr)
                # 使用中文情感分析模型，支持FP16优化
                device = 0 if FP16_AVAILABLE else -1  # 0 = GPU, -1 = CPU
                torch_dtype = torch.float16 if FP16_AVAILABLE else torch.float32
                self.sentiment_analyzer = pipeline(
                    'sentiment-analysis',
                    model='uer/roberta-base-finetuned-jd-binary-chinese',  # 中文情感分析模型
                    device=device,
                    torch_dtype=torch_dtype
                )
                print(f"Sentiment analysis model loaded (device={device}, dtype={torch_dtype})", file=sys.stderr)
            except Exception as e:
                print(f"Failed to load sentiment analyzer: {e}", file=sys.stderr)
                self.sentiment_analyzer = None

        # 初始化FUNASR模型（延迟加载）
        self.funasr_model = None
        if FUNASR_AVAILABLE and self.use_funasr:
            try:
                print("Loading FUNASR model...", file=sys.stderr)
                self.funasr_model = AutoModel(
                    model="paraformer-zh",  # 中文语音识别模型
                    model_revision="v2.0.4",
                    vad_model="fsmn-vad",
                    vad_model_revision="v2.0.4",
                    punc_model="ct-punc-c",
                    punc_model_revision="v2.0.4",
                )
                print("FUNASR model loaded successfully", file=sys.stderr)
            except Exception as e:
                print(f"Failed to load FUNASR model: {e}", file=sys.stderr)
                self.funasr_model = None

    def _find_ziti_directory(self) -> Optional[str]:
        """
        查找 ziti 字体目录的绝对路径（支持开发环境和打包环境）
        
        Returns:
            ziti 目录路径，如果未找到返回 None
        """
        # 可能的 ziti 目录路径（按优先级排列）
        possible_paths = []
        
        # 1. 从 APP_ROOT 环境变量查找（打包环境）
        app_root = os.environ.get('APP_ROOT', None)
        if app_root:
            # 打包后的结构: resources/app.asar.unpacked/ziti
            possible_paths.append(os.path.join(app_root, 'app.asar.unpacked', 'ziti'))
            # 备选结构: resources/extra/common/fonts/ziti
            possible_paths.append(os.path.join(app_root, 'extra', 'common', 'fonts', 'ziti'))
            # 直接在 app_root 下
            possible_paths.append(os.path.join(app_root, 'ziti'))
        
        # 2. 相对于脚本位置查找（开发环境）
        script_dir = os.path.dirname(os.path.abspath(__file__))
        possible_paths.append(os.path.join(script_dir, '..', 'ziti'))  # python/../ziti
        possible_paths.append(os.path.join(script_dir, '..', '..', 'ziti'))  # python/../../ziti
        
        # 3. 当前工作目录
        possible_paths.append(os.path.join(os.getcwd(), 'ziti'))
        
        # 4. 用户主目录
        possible_paths.append(os.path.expanduser('~/ziti'))
        
        # 遍历查找存在的目录
        for path in possible_paths:
            normalized_path = os.path.normpath(os.path.abspath(path))
            if os.path.isdir(normalized_path):
                # 检查目录中是否有字体文件
                try:
                    fonts = [f for f in os.listdir(normalized_path) 
                             if f.endswith(('.ttf', '.otf', '.ttc'))]
                    if fonts:
                        print(f"[_find_ziti_directory] ✅ Found ziti directory with {len(fonts)} fonts: {normalized_path}", file=sys.stderr)
                        return normalized_path
                except Exception as e:
                    print(f"[_find_ziti_directory] ⚠ Error scanning {normalized_path}: {e}", file=sys.stderr)
        
        print(f"[_find_ziti_directory] ❌ ziti directory not found, searched: {possible_paths[:3]}...", file=sys.stderr)
        return None
    
    def _get_ffmpeg_fontconfig(self) -> str:
        """
        生成 FFmpeg fontconfig 参数字符串
        
        Returns:
            FFmpeg fontconfig 参数，如 ":fontconfig='fontdir=/path/to/ziti:'"
        """
        if self.ziti_dir and os.path.isdir(self.ziti_dir):
            # 将 Windows 路径转换为正斜杠格式（FFmpeg 需要）
            ziti_path = self.ziti_dir.replace('\\', '/')
            fontconfig = f":fontconfig='fontdir={ziti_path}:'"
            print(f"[_get_ffmpeg_fontconfig] Using ziti path: {ziti_path}", file=sys.stderr)
            return fontconfig
        else:
            # 降级：使用当前工作目录
            print(f"[_get_ffmpeg_fontconfig] ⚠ Ziti directory not available, using fallback '.'", file=sys.stderr)
            return ":fontconfig='fontdir=.'"

    def extract_audio_for_asr(self) -> str:
        """
        从视频中提取音频为WAV格式,用于语音识别

        Returns:
            音频文件路径
        """
        try:
            audio_path = os.path.join(self.output_dir, 'extracted_audio.wav')

            # 使用FFmpeg提取音频
            cmd = [
                'ffmpeg', '-y',
                '-i', self.video_path,
                '-vn',  # 不要视频
                '-acodec', 'pcm_s16le',  # WAV格式
                '-ar', '16000',  # 采样率16kHz (FUNASR推荐)
                '-ac', '1',  # 单声道
                audio_path
            ]

            print(f"Extracting audio from video: {' '.join(cmd)}", file=sys.stderr)
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore', timeout=300)

            if result.returncode == 0 and os.path.exists(audio_path):
                print(f"Audio extracted successfully: {audio_path}", file=sys.stderr)
                return audio_path
            else:
                raise Exception(f"FFmpeg failed: {result.stderr}")

        except subprocess.TimeoutExpired:
            raise Exception("Audio extraction timeout (exceeded 5 minutes)")
        except Exception as e:
            raise Exception(f"Error extracting audio: {str(e)}")

    def transcribe_audio_with_funasr(self, audio_path: str) -> Dict:
        """
        使用FUNASR进行语音识别

        Args:
            audio_path: 音频文件路径

        Returns:
            识别结果字典，包含segments列表
        """
        if not FUNASR_AVAILABLE or self.funasr_model is None:
            raise Exception("FUNASR not available or model not loaded")

        try:
            print(f"Transcribing audio with FUNASR: {audio_path}", file=sys.stderr)

            # 调用FUNASR模型进行识别
            result = self.funasr_model.generate(
                input=audio_path,
                batch_size_s=300,  # 批处理大小
                hotword='',  # 热词
            )

            print(f"FUNASR transcription completed", file=sys.stderr)

            # 解析FUNASR结果
            segments = []
            if result and len(result) > 0:
                for i, item in enumerate(result):
                    # FUNASR返回格式: {'text': '...', 'timestamp': [[start_ms, end_ms], ...]}
                    text = item.get('text', '')
                    timestamp = item.get('timestamp', [])

                    # 如果有时间戳，使用时间戳
                    if timestamp and len(timestamp) > 0:
                        for j, (start_ms, end_ms) in enumerate(timestamp):
                            # 提取对应的文本片段
                            words = text.split()
                            if j < len(words):
                                segment_text = words[j]
                            else:
                                segment_text = text

                            segments.append({
                                'text': segment_text,
                                'start': start_ms / 1000.0,  # 转换为秒
                                'end': end_ms / 1000.0
                            })
                    else:
                        # 没有时间戳，按句子分割，平均分配时间
                        sentences = text.split('。')
                        for k, sentence in enumerate(sentences):
                            if sentence.strip():
                                segments.append({
                                    'text': sentence.strip() + '。',
                                    'start': k * 3.0,
                                    'end': (k + 1) * 3.0
                                })

            print(f"Generated {len(segments)} segments from FUNASR", file=sys.stderr)

            return {
                'success': True,
                'segments': segments
            }

        except Exception as e:
            print(f"FUNASR transcription failed: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'segments': []
            }

    def extract_frame(self, timestamp: float = 1.0) -> tuple[np.ndarray, tuple[int, int]]:
        """
        从视频中提取关键帧

        Args:
            timestamp: 提取帧的时间戳（秒）

        Returns:
            提取的帧（numpy数组）和视频尺寸（宽度, 高度）
        """
        try:
            cap = cv2.VideoCapture(self.video_path)

            # 获取视频尺寸
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            video_size = (width, height)

            # 设置到指定时间戳
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_number = int(timestamp * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)

            ret, frame = cap.read()
            cap.release()

            if not ret:
                raise Exception("Failed to extract frame from video")

            return frame, video_size
        except Exception as e:
            raise Exception(f"Error extracting frame: {str(e)}")

    def generate_cover(self) -> str:
        """
        生成视频封面

        Returns:
            生成的封面图片路径
        """
        try:
            # 如果使用提取的帧，直接使用已提取的帧
            if self.use_extracted_frame and self.extracted_frame_path and os.path.exists(self.extracted_frame_path):
                print(f"Using extracted frame: {self.extracted_frame_path}", file=sys.stderr)
                frame = cv2.imread(self.extracted_frame_path)
                self.video_width, self.video_height = frame.shape[1], frame.shape[0]
            else:
                # 提取关键帧和视频尺寸
                frame, video_size = self.extract_frame(1.0)
                self.video_width, self.video_height = video_size

            # 检查是否使用自定义模板
            if self.custom_template and self.template:
                print("Using custom template for cover generation", file=sys.stderr)
                cover_path = self._generate_custom_template_cover(frame)
                return cover_path

            if self.cover_style == 'default':
                # 默认封面：直接使用提取的帧，保持原始尺寸
                cover_path = os.path.join(self.output_dir, 'cover.png')
                cv2.imwrite(cover_path, frame)

                # 应用缩放和文字叠加
                image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                image = self._apply_zoom(image)
                image = self._add_text_overlay(image)
                image.save(cover_path, quality=95)

            elif self.cover_style == 'blur-bg':
                # 背景虚化效果（简化版）
                cover_path = self._generate_blur_cover(frame)

            elif self.cover_style == 'outline':
                # 人物描边效果（简化版）
                cover_path = self._generate_outline_cover(frame)

            elif self.cover_style == 'gradient':
                # 渐变背景效果
                cover_path = self._generate_gradient_cover(frame)

            elif self.cover_style == 'split':
                # 斜切设计效果
                cover_path = self._generate_split_cover(frame)
            else:
                cover_path = os.path.join(self.output_dir, 'cover.png')
                cv2.imwrite(cover_path, frame)

            return cover_path
        except Exception as e:
            raise Exception(f"Error generating cover: {str(e)}")

    def _generate_blur_cover(self, frame: np.ndarray) -> str:
        """生成背景虚化封面（人物突出，背景虚化）"""
        try:
            print("Starting blur cover generation...", file=sys.stderr)
            # 转换为PIL
            image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            width, height = image.size

            # 确保图像格式正确
            print(f"Image size: {width}x{height}, mode: {image.mode}", file=sys.stderr)

            # 使用视频的原始尺寸
            video_width = getattr(self, 'video_width', width)
            video_height = getattr(self, 'video_height', height)

            if REMBG_AVAILABLE:
                try:
                    print("Creating background blur effect with portrait segmentation...", file=sys.stderr)
                    # 使用RMBG提取人像
                    portrait = rmbg_remove(image)

                    print(f"Portrait extracted, mode: {portrait.mode if hasattr(portrait, 'mode') else 'unknown'}", file=sys.stderr)

                    # 创建强力背景虚化
                    print("Creating blurred background...", file=sys.stderr)
                    blurred_bg = image.filter(ImageFilter.GaussianBlur(radius=self.blur_radius))

                    # 创建结果：虚化背景 + 清晰人物
                    print(f"Creating result image with size: {video_width}x{video_height}", file=sys.stderr)
                    result = Image.new('RGB', (video_width, video_height))
                    result.paste(blurred_bg, (0, 0))

                    # 将清晰的人物合成到虚化背景上
                    if portrait.mode == 'RGBA':
                        # 计算居中位置
                        x_offset = (video_width - width) // 2
                        y_offset = (video_height - height) // 2
                        print(f"Pasting portrait at offset: ({x_offset}, {y_offset})", file=sys.stderr)
                        result.paste(portrait, (x_offset, y_offset), portrait)
                        print("Portrait background blur effect successful", file=sys.stderr)
                    else:
                        # 如果抠图失败，使用降低透明度的原始图像
                        print(f"Warning: Portrait mode is {portrait.mode}, expected RGBA", file=sys.stderr)
                        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                        overlay.paste(image, (0, 0))
                        result.paste(overlay, (0, 0), overlay)

                    # 应用缩放和文字叠加
                    print("Applying zoom and text overlay...", file=sys.stderr)
                    result = self._apply_zoom(result)
                    result = self._add_text_overlay(result)
                except Exception as e:
                    print(f"RMBG failed with error: {str(e)}", file=sys.stderr)
                    import traceback
                    traceback.print_exc(file=sys.stderr)
                    print("Falling back to software blur method", file=sys.stderr)
                    # 软件方法：创建人物区域mask
                    # 这里简化实现：假设人物在中心区域
                    result = image.copy()
                    # 降低背景亮度并模糊
                    bg_overlay = Image.new('RGB', (video_width, video_height), (0, 0, 0))
                    blurred = image.filter(ImageFilter.GaussianBlur(radius=self.blur_radius))
                    bg_overlay.paste(blurred, (0, 0))
                    # 中心人物区域保持清晰
                    center_mask = Image.new('L', (width, height), 0)
                    draw = ImageDraw.Draw(center_mask)
                    draw.ellipse([width//4, height//4, 3*width//4, 3*height//4], fill=255)
                    result = Image.composite(image, bg_overlay, center_mask)

                    # 应用缩放和文字叠加
                    result = self._apply_zoom(result)
                    result = self._add_text_overlay(result)
            else:
                print("RMBG not available, using simple blur effect", file=sys.stderr)
                # 简单方法：整体轻微模糊 + 中心清晰区域
                blurred = image.filter(ImageFilter.GaussianBlur(radius=self.blur_radius))
                center_region = image.crop((width//4, height//4, 3*width//4, 3*width//4))
                blurred.paste(center_region, (width//4, height//4))
                result = blurred.resize((video_width, video_height))

                # 应用缩放和文字叠加
                result = self._apply_zoom(result)
                result = self._add_text_overlay(result)

            # 保存
            print("Saving cover image...", file=sys.stderr)
            cover_path = os.path.join(self.output_dir, 'cover_blur.png')
            result.save(cover_path, quality=95)
            print(f"Cover saved successfully: {cover_path}", file=sys.stderr)
            return cover_path
        except Exception as e:
            print(f"Error in _generate_blur_cover: {str(e)}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            raise

    def _generate_outline_cover(self, frame: np.ndarray) -> str:
        """生成人物描边封面（使用RMBG人像抠图 + 描边效果）"""
        # 转换为PIL
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        width, height = image.size

        if REMBG_AVAILABLE:
            try:
                # 使用更精确的人像分割模型
                print("Extracting portrait using RMBG for outline effect...", file=sys.stderr)

                # 尝试使用专门的人像分割模型
                try:
                    from rembg import new_session
                    session = new_session("u2net_human_seg")
                    portrait = rmbg_remove(image, session=session, post_process_mask=True)
                    print("Used specialized human segmentation model", file=sys.stderr)
                except:
                    # 降级到默认模型
                    portrait = rmbg_remove(image)
                    print("Used default rembg model", file=sys.stderr)

                # 获取alpha通道作为mask
                if portrait.mode == 'RGBA':
                    alpha = portrait.split()[3]
                    alpha_np = np.array(alpha)

                    # 改进的描边方法：使用固定迭代次数和可变 kernel 大小
                    # 这样描边宽度可控，但紧贴轮廓
                    kernel_size = max(3, self.outline_width * 2 + 1)  # 确保是奇数
                    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))

                    # 只膨胀1次，避免离轮廓太远
                    alpha_dilated = cv2.dilate(alpha_np, kernel, iterations=1)

                    # 描边 = 膨胀后的轮廓 - 原始轮廓（这样得到紧贴的描边）
                    outline_mask = cv2.subtract(alpha_dilated, alpha_np)

                    # 转换描边颜色
                    outline_rgb = self._hex_to_rgb(self.outline_color)
                    outline_layer = Image.new('RGBA', (width, height), (*outline_rgb, 0))

                    # 应用描边
                    outline_pil = Image.fromarray(outline_mask)
                    outline_colored = Image.new('RGBA', (width, height), (*outline_rgb, 255))
                    outline_colored.putalpha(outline_pil)
                    outline_layer = Image.alpha_composite(outline_layer, outline_colored)

                    # 创建结果：背景 + 描边 + 人像
                    result = Image.new('RGB', (width, height), (0, 0, 0))

                    # 先放原图作为背景
                    result.paste(image, (0, 0))

                    # 应用缩放到人像和描边
                    if self.zoom_level != 1.0:
                        # 只缩放人像和描边，保持背景不变
                        portrait_zoomed = self._apply_zoom(portrait)
                        outline_zoomed = self._apply_zoom(outline_layer)

                        # 计算居中位置
                        p_width, p_height = portrait_zoomed.size
                        if portrait_zoomed.mode == 'RGBA':
                            result.paste(portrait_zoomed,
                                       ((width - p_width) // 2, (height - p_height) // 2),
                                       portrait_zoomed)

                        result.paste(outline_zoomed,
                                   ((width - p_width) // 2, (height - p_height) // 2),
                                   outline_zoomed)
                    else:
                        result.paste(outline_layer, (0, 0), outline_layer)
                        result.paste(portrait, (0, 0), portrait)

                    print("Enhanced portrait outline extraction successful", file=sys.stderr)
                else:
                    raise Exception("Portrait extraction did not return RGBA image")

            except Exception as e:
                print(f"Enhanced RMBG portrait outline failed: {e}, using fallback method", file=sys.stderr)
                # 降级方案：简单的边缘检测
                image_np = np.array(image.convert('L'))
                edges = cv2.Canny(image_np, 50, 150)
                outline_rgb = self._hex_to_rgb(self.outline_color)
                edges_colored = np.zeros((*edges.shape, 3), dtype=np.uint8)
                edges_colored[edges > 0] = outline_rgb
                edges_pil = Image.fromarray(edges_colored)

                result = Image.blend(image, edges_pil, 0.3)
                result = self._apply_zoom(result)
        else:
            # 降级方案：简单的边缘检测
            image_np = np.array(image.convert('L'))
            edges = cv2.Canny(image_np, 50, 150)
            outline_rgb = self._hex_to_rgb(self.outline_color)
            edges_colored = np.zeros((*edges.shape, 3), dtype=np.uint8)
            edges_colored[edges > 0] = outline_rgb
            edges_pil = Image.fromarray(edges_colored)

            result = Image.blend(image, edges_pil, 0.3)
            result = self._apply_zoom(result)

        # 应用文字叠加
        result = self._add_text_overlay(result)

        # 保存
        cover_path = os.path.join(self.output_dir, 'cover_outline.png')
        result.save(cover_path, quality=95)

        return cover_path

    def _generate_gradient_cover(self, frame: np.ndarray) -> str:
        """生成渐变背景封面"""
        # 转换为PIL
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        width, height = image.size

        # 创建渐变背景
        gradient = Image.new('RGB', (width, height), color=(0, 0, 0))
        draw = ImageDraw.Draw(gradient)

        # 绘制渐变
        for y in range(height):
            r = int(103 + (118 - 103) * y / height)
            g = int(126 + (74 - 126) * y / height)
            b = int(234 + (162 - 234) * y / height)
            draw.line([(0, y), (width, y)], fill=(r, g, b))

        # 应用半透明图片
        image_enhanced = ImageEnhance.Brightness(image).enhance(0.8)
        gradient.paste(image_enhanced, (0, 0))

        # 应用缩放和文字叠加
        gradient = self._apply_zoom(gradient)
        gradient = self._add_text_overlay(gradient)

        # 保存
        cover_path = os.path.join(self.output_dir, 'cover_gradient.png')
        gradient.save(cover_path, quality=95)

        return cover_path

    def _generate_split_cover(self, frame: np.ndarray) -> str:
        """生成斜切设计封面"""
        # 转换为PIL
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        width, height = image.size

        # 创建斜切背景
        background = Image.new('RGB', (width, height), color=(255, 255, 255))
        draw = ImageDraw.Draw(background)

        # 绘制斜切色块
        draw.polygon([(0, 0), (width * 0.6, 0), (width * 0.4, height), (0, height)],
                     fill=(103, 126, 234))
        draw.polygon([(width * 0.6, 0), (width, 0), (width, height), (width * 0.4, height)],
                     fill=(118, 74, 162))

        # 应用半透明图片
        image_enhanced = ImageEnhance.Brightness(image).enhance(0.8)
        background.paste(image_enhanced, (0, 0))

        # 应用缩放和文字叠加
        background = self._apply_zoom(background)
        background = self._add_text_overlay(background)

        # 保存
        cover_path = os.path.join(self.output_dir, 'cover_split.png')
        background.save(cover_path, quality=95)

        return cover_path

    def _apply_zoom(self, image: Image.Image, zoom_level: float = None) -> Image.Image:
        """
        对图像应用缩放效果

        Args:
            image: 输入图像
            zoom_level: 缩放倍数，如果为None则使用self.zoom_level

        Returns:
            缩放后的图像
        """
        if zoom_level is None:
            zoom_level = self.zoom_level

        if zoom_level == 1.0:
            return image

        width, height = image.size
        new_width = int(width * zoom_level)
        new_height = int(height * zoom_level)

        print(f"Applying zoom level {zoom_level}x: {width}x{height} -> {new_width}x{new_height}", file=sys.stderr)

        # 使用高质量重采样
        zoomed = image.resize((new_width, new_height), Image.LANCZOS)

        # 如果放大，需要裁剪中心区域
        if zoom_level > 1.0:
            left = (new_width - width) // 2
            top = (new_height - height) // 2
            zoomed = zoomed.crop((left, top, left + width, top + height))
            print(f"Cropped zoomed image to center: {width}x{height}", file=sys.stderr)
        # 如果缩小，需要填充边缘
        elif zoom_level < 1.0:
            result = Image.new('RGB', (width, height), (0, 0, 0))
            left = (width - new_width) // 2
            top = (height - new_height) // 2
            result.paste(zoomed, (left, top))
            print(f"Padded zoomed image to original size: {width}x{height}", file=sys.stderr)
            return result

        return zoomed

    def _hex_to_rgb(self, hex_color: str) -> tuple:
        """
        将十六进制颜色转换为RGB元组

        Args:
            hex_color: 十六进制颜色字符串，如 '#FFFFFF' 或 'FFFFFF'

        Returns:
            RGB元组，如 (255, 255, 255)
        """
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

    def _draw_char_with_effects(self, image: Image.Image, char: str, x: int, y: int, font,
                                 color: tuple, title_config: dict) -> Image.Image:
        """
        绘制带阴影和描边效果的单个字符

        Args:
            image: PIL图像（RGBA模式）
            char: 要绘制的字符
            x, y: 字符位置
            font: 字体对象
            color: 文字颜色（RGB元组）
            title_config: 标题配置（包含阴影和描边参数）

        Returns:
            绘制后的图像
        """
        # 获取阴影参数
        shadow_color = self._hex_to_rgb(title_config.get('shadowColor', '#000000'))
        shadow_offset_x = title_config.get('shadowOffsetX', 0)
        shadow_offset_y = title_config.get('shadowOffsetY', 0)
        shadow_blur = title_config.get('shadowBlur', 0)

        # 获取描边参数
        stroke_width = title_config.get('strokeWidth', 0)
        stroke_color = self._hex_to_rgb(title_config.get('strokeColor', '#000000'))

        # 1. 绘制阴影（如果有偏移）
        if shadow_offset_x != 0 or shadow_offset_y != 0:
            shadow_x = x + shadow_offset_x
            shadow_y = y + shadow_offset_y

            # 调试：打印阴影位置计算
            print(f"[DEBUG] Shadow for char '{char}': text_pos=({x}, {y}), offset=({shadow_offset_x}, {shadow_offset_y}), shadow_pos=({shadow_x}, {shadow_y})", file=sys.stderr)

            if shadow_blur > 0:
                # 创建阴影图层并模糊
                shadow_layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
                shadow_draw = ImageDraw.Draw(shadow_layer)
                shadow_draw.text((shadow_x, shadow_y), char, font=font, fill=(*shadow_color, 180))
                shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=shadow_blur))
                image = Image.alpha_composite(image, shadow_layer)
            else:
                draw = ImageDraw.Draw(image)
                draw.text((shadow_x, shadow_y), char, font=font, fill=(*shadow_color, 180))

        # 2. 绘制描边
        if stroke_width > 0:
            draw = ImageDraw.Draw(image)
            for offset_x in range(-stroke_width, stroke_width + 1):
                for offset_y in range(-stroke_width, stroke_width + 1):
                    if offset_x == 0 and offset_y == 0:
                        continue
                    draw.text((x + offset_x, y + offset_y), char, font=font, fill=(*stroke_color, 255))

        # 3. 绘制主体文字
        draw = ImageDraw.Draw(image)
        draw.text((x, y), char, font=font, fill=(*color, 255))

        return image

    def _load_font(self, font_name: str = None, font_size: int = 24, font_weight: int = 400) -> ImageFont.FreeTypeFont:
        """
        加载字体，支持自定义字体、ziti目录、系统字体
        优先顺序：ziti目录 -> FontManager -> 系统字体 -> 默认字体

        Args:
            font_name: 字体名称（如 "微软雅黑"、"墨趣古风体" 等）
            font_size: 字体大小
            font_weight: 字体粗细 (100-1000)

        Returns:
            字体对象
        """
        import platform

        # 1. 首先直接尝试在 ziti 目录查找字体文件
        if font_name:
            # 多个可能的 ziti 目录路径（相对和绝对）
            possible_ziti_paths = [
                os.path.join(os.getcwd(), 'ziti'),  # 当前工作目录
                os.path.join(os.path.dirname(__file__), '..', 'ziti'),  # 相对于脚本
                os.path.join(os.path.dirname(__file__), '..', '..', 'ziti'),  # 项目根目录
                'ziti',  # 相对路径
                os.path.expanduser('~/ziti'),  # 用户主目录
            ]

            # 尝试找到 ziti 目录
            for ziti_dir in possible_ziti_paths:
                if os.path.isdir(ziti_dir):
                    print(f"Found ziti directory: {ziti_dir}", file=sys.stderr)

                    # 在 ziti 目录中查找字体文件
                    for ext in ['.ttf', '.otf', '.ttc']:
                        # 直接按字体名称查找
                        font_path = os.path.join(ziti_dir, font_name + ext)
                        if os.path.exists(font_path):
                            try:
                                font = ImageFont.truetype(font_path, font_size)
                                print(f"✓ Successfully loaded ziti font '{font_name}': {font_path}", file=sys.stderr)
                                return font
                            except Exception as e:
                                print(f"✗ Failed to load ziti font from {font_path}: {e}", file=sys.stderr)

                    # 如果没有找到，扫描目录中所有文件进行模糊匹配
                    try:
                        for file in os.listdir(ziti_dir):
                            if not file.startswith('.') and (file.endswith('.ttf') or file.endswith('.otf') or file.endswith('.ttc')):
                                file_base = os.path.splitext(file)[0]
                                # 检查是否匹配（精确或包含）
                                if file_base == font_name or font_name in file_base:
                                    font_path = os.path.join(ziti_dir, file)
                                    try:
                                        font = ImageFont.truetype(font_path, font_size)
                                        print(f"✓ Successfully loaded ziti font '{font_name}' (matched as {file}): {font_path}", file=sys.stderr)
                                        return font
                                    except Exception as e:
                                        print(f"✗ Failed to load matched font {font_path}: {e}", file=sys.stderr)
                    except Exception as e:
                        print(f"✗ Error scanning ziti directory: {e}", file=sys.stderr)

        # 2. 如果 ziti 目录查找失败，使用 FontManager
        if font_name and FONT_MANAGER_AVAILABLE:
            try:
                font_manager = get_font_manager()
                font_path = font_manager.find_font(font_name, font_weight)

                if font_path and os.path.exists(font_path):
                    try:
                        font = ImageFont.truetype(font_path, font_size)
                        print(f"✓ Successfully loaded font via FontManager '{font_name}': {font_path}", file=sys.stderr)
                        return font
                    except Exception as e:
                        print(f"✗ Failed to load font from {font_path}: {e}", file=sys.stderr)
            except Exception as e:
                print(f"✗ FontManager error: {e}", file=sys.stderr)

        # 3. 降级：根据操作系统加载默认系统字体
        print(f"⚠ Font '{font_name}' not found, trying system fonts...", file=sys.stderr)
        system = platform.system()
        font_paths = []

        if system == 'Windows':
            font_dir = 'C:/Windows/Fonts'
            font_paths = [
                os.path.join(font_dir, 'msyh.ttc'),      # 微软雅黑
                os.path.join(font_dir, 'msyhbd.ttc'),    # 微软雅黑 Bold
                os.path.join(font_dir, 'simhei.ttf'),    # 黑体
                os.path.join(font_dir, 'simsun.ttc'),    # 宋体
                os.path.join(font_dir, 'arial.ttf'),     # Arial
            ]
        elif system == 'Darwin':  # macOS
            font_paths = [
                '/Library/Fonts/PingFang.ttc',
                '/System/Library/Fonts/PingFang.ttc',
                '/Library/Fonts/Arial.ttf',
            ]
        else:  # Linux
            font_paths = [
                '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            ]

        # 尝试加载每个系统字体
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    font = ImageFont.truetype(font_path, font_size)
                    print(f"✓ Successfully loaded system font: {font_path}", file=sys.stderr)
                    return font
                except Exception as e:
                    print(f"✗ Failed to load system font {font_path}: {e}", file=sys.stderr)
                    continue

        # 4. 最后的降级方案：使用 PIL 默认字体
        print("⚠ All font loading attempts failed, using PIL default font (text may not render correctly for CJK)", file=sys.stderr)
        return ImageFont.load_default()

    def _add_text_overlay(self, image: Image.Image) -> Image.Image:
        """
        在封面上添加文字叠加

        Args:
            image: 输入图像

        Returns:
            添加了文字的图像
        """
        if not self.cover_text or not self.cover_text.strip():
            return image

        print(f"Adding text overlay: '{self.cover_text}'", file=sys.stderr)

        # 创建绘图对象
        draw = ImageDraw.Draw(image)

        # 获取字体名称（从配置中优先获取，否则使用微软雅黑作为默认）
        font_name = self.config.get('coverTextFont', 'Microsoft YaHei')

        # 加载字体 - 改进的字体加载逻辑，支持自定义字体
        font = self._load_font(font_name, self.cover_text_size)

        # 计算文字边界框
        text_bbox = draw.textbbox((0, 0), self.cover_text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]

        # 根据位置参数定位文字
        x = (image.width - text_width) // 2
        if self.cover_text_position == 'top':
            y = 50
        elif self.cover_text_position == 'center':
            y = (image.height - text_height) // 2
        else:  # bottom
            y = image.height - text_height - 50

        print(f"Text position: ({x}, {y}), size: {text_width}x{text_height}", file=sys.stderr)

        # 转换颜色
        text_color = self._hex_to_rgb(self.cover_text_color)
        outline_rgb = self._hex_to_rgb(self.outline_color)

        # 绘制文字描边
        if self.outline_width > 0:
            for offset_x in range(-self.outline_width, self.outline_width + 1):
                for offset_y in range(-self.outline_width, self.outline_width + 1):
                    if offset_x == 0 and offset_y == 0:
                        continue
                    draw.text((x + offset_x, y + offset_y), self.cover_text,
                             font=font, fill=outline_rgb)

        # 绘制文字主体
        draw.text((x, y), self.cover_text, font=font, fill=text_color)

        print("Text overlay added successfully", file=sys.stderr)
        return image

    def _generate_custom_template_cover(self, frame: np.ndarray) -> str:
        """
        使用自定义模板生成封面

        Args:
            frame: 视频帧

        Returns:
            生成的封面路径
        """
        try:
            print("Generating custom template cover...", file=sys.stderr)
            template = self.template

            # 转换为PIL图像
            image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            width, height = image.size

            # 1. 应用背景模糊
            # 支持两种格式：旧格式 template['background']['blurEnabled'] 和新格式 template['backgroundBlurEnabled']
            blur_enabled = template.get('backgroundBlurEnabled', template.get('background', {}).get('blurEnabled', False))
            if blur_enabled:
                blur_radius = template.get('backgroundBlurIntensity', template.get('background', {}).get('blurRadius', 15))
                print(f"Applying background blur: {blur_radius}", file=sys.stderr)
                image = image.filter(ImageFilter.GaussianBlur(radius=blur_radius))

            # 2. 处理人像描边（如果启用RMBG）
            # 支持两种格式：旧格式 template['portrait']['strokeEnabled'] 和新格式 template['personBorderEnabled']
            stroke_enabled = template.get('personBorderEnabled', template.get('portrait', {}).get('strokeEnabled', False))
            if stroke_enabled and REMBG_AVAILABLE:
                try:
                    print("Extracting portrait for stroke effect...", file=sys.stderr)
                    portrait = rmbg_remove(image)

                    # 创建描边效果
                    # 支持两种格式
                    stroke_color = template.get('personBorderColor', template.get('portrait', {}).get('strokeColor', '#FFD700'))
                    stroke_width = template.get('personBorderWidth', template.get('portrait', {}).get('strokeWidth', 3))
                    stroke_type = template.get('personBorderStyle', template.get('portrait', {}).get('strokeType', 'solid'))

                    print(f"Stroke: color={stroke_color}, width={stroke_width}, type={stroke_type}", file=sys.stderr)

                    # 合成带描边的人像
                    if portrait.mode == 'RGBA':
                        # 获取alpha通道作为mask
                        alpha = portrait.split()[3]
                        alpha_np = np.array(alpha)

                        # 改进的描边方法：使用固定迭代次数和可变 kernel 大小
                        # 这样描边宽度可控，但紧贴轮廓
                        kernel_size = max(3, stroke_width * 2 + 1)  # 确保是奇数
                        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))

                        # 只膨胀1次，避免离轮廓太远
                        alpha_dilated = cv2.dilate(alpha_np, kernel, iterations=1)

                        # 描边 = 膨胀后的轮廓 - 原始轮廓（这样得到紧贴的描边）
                        outline_mask = cv2.subtract(alpha_dilated, alpha_np)

                        # 转换描边颜色
                        stroke_rgb = self._hex_to_rgb(stroke_color)
                        outline_layer = Image.new('RGBA', (width, height), (*stroke_rgb, 0))

                        # 应用描边
                        outline_pil = Image.fromarray(outline_mask)
                        outline_colored = Image.new('RGBA', (width, height), (*stroke_rgb, 255))
                        outline_colored.putalpha(outline_pil)
                        outline_layer = Image.alpha_composite(outline_layer, outline_colored)

                        # 创建结果：背景 + 描边 + 人像
                        result = Image.new('RGB', (width, height))
                        result.paste(image, (0, 0))

                        # 将描边和人像合成到背景上
                        result_rgba = result.convert('RGBA')
                        result_rgba = Image.alpha_composite(result_rgba, outline_layer)
                        result_rgba = Image.alpha_composite(result_rgba, portrait)
                        image = result_rgba.convert('RGB')

                        print("Portrait stroke effect applied successfully", file=sys.stderr)
                except Exception as e:
                    print(f"Portrait stroke failed: {e}", file=sys.stderr)
                    import traceback
                    traceback.print_exc(file=sys.stderr)


            # 3. 添加蒙版（如果有）
            mask_config = template.get('mask', {})
            mask_path = mask_config.get('imagePath', '')
            if mask_path and os.path.exists(mask_path):
                try:
                    print(f"Adding mask from: {mask_path}", file=sys.stderr)
                    mask_img = Image.open(mask_path).convert('RGBA')

                    # 获取蒙版位置和大小
                    mask_pos = mask_config.get('position', {'x': 10, 'y': 10})
                    mask_size = mask_config.get('size', {'width': 30, 'height': 20})
                    mask_opacity = mask_config.get('opacity', 0.8)

                    mask_width = int(mask_size['width'] / 100 * width)
                    mask_height = int(mask_size['height'] / 100 * height)
                    mask_x = int(mask_pos['x'] / 100 * width)
                    mask_y = int(mask_pos['y'] / 100 * height)

                    # 调整蒙版大小和透明度
                    mask_img = mask_img.resize((mask_width, mask_height), Image.LANCZOS)
                    if mask_opacity < 1.0:
                        alpha = mask_img.split()[3]
                        alpha = alpha.point(lambda p: int(p * mask_opacity))
                        mask_img.putalpha(alpha)

                    # 将蒙版粘贴到图像上
                    image_rgba = image.convert('RGBA')
                    image_rgba.paste(mask_img, (mask_x - mask_width // 2, mask_y - mask_height // 2), mask_img)
                    image = image_rgba.convert('RGB')

                    print("Mask applied successfully", file=sys.stderr)
                except Exception as e:
                    print(f"Failed to add mask: {e}", file=sys.stderr)
                    import traceback
                    traceback.print_exc(file=sys.stderr)

            # 4. 添加标题
            # 转换为RGBA以支持透明图层
            if image.mode != 'RGBA':
                image = image.convert('RGBA')

            # 加载字体 - 使用模板中的字体设置
            main_font_family = template['titles']['main'].get('fontFamily', 'Microsoft YaHei')
            main_font_size = template['titles']['main'].get('fontSize', 60)
            main_font_weight = template['titles']['main'].get('fontWeight', 400)

            sub_font_family = template['titles']['sub'].get('fontFamily', 'Microsoft YaHei')
            sub_font_size = template['titles']['sub'].get('fontSize', 40)
            sub_font_weight = template['titles']['sub'].get('fontWeight', 400)

            print(f"Loading main font: {main_font_family}, size={main_font_size}, weight={main_font_weight}", file=sys.stderr)
            print(f"Loading sub font: {sub_font_family}, size={sub_font_size}, weight={sub_font_weight}", file=sys.stderr)

            font_main = self._load_font(main_font_family, main_font_size, main_font_weight)
            font_sub = self._load_font(sub_font_family, sub_font_size, sub_font_weight)

            draw = ImageDraw.Draw(image)

            # 绘制主标题（支持自动换行）
            main_title = template['titles']['main']
            if main_title.get('text'):
                main_text = main_title['text']
                main_color = self._hex_to_rgb(main_title.get('color', '#FFFFFF'))
                main_pos_x = int(width * main_title['position']['x'] / 100)
                main_pos_y = int(height * main_title['position']['y'] / 100)

                # 调试：打印接收到的位置参数
                print(f"[DEBUG] Main title position - Received from frontend: x={main_title['position']['x']}%, y={main_title['position']['y']}%", file=sys.stderr)
                print(f"[DEBUG] Main title position - Calculated pixels: x={main_pos_x}px, y={main_pos_y}px", file=sys.stderr)
                print(f"[DEBUG] Canvas size: {width}x{height}", file=sys.stderr)

                max_chars_per_line = main_title.get('maxLength', 4)  # 每行最多字符数

                # 获取文字方向和间距参数
                direction = main_title.get('direction', 'horizontal')
                font_size = main_title.get('fontSize', 60)
                char_spacing = main_title.get('charSpacing', int(font_size * 0.2))  # 字符间距
                line_spacing = main_title.get('lineSpacing', int(font_size * 1.2))  # 行间距

                # 调试日志
                print(f"[DEBUG] Main title config:", file=sys.stderr)
                print(f"  Text: '{main_text}' (length: {len(main_text)})", file=sys.stderr)
                print(f"  maxLength: {max_chars_per_line}", file=sys.stderr)
                print(f"  Direction: {direction}", file=sys.stderr)
                print(f"  Char spacing: {char_spacing}px, Line spacing: {line_spacing}px", file=sys.stderr)
                print(f"  Position: ({main_pos_x}, {main_pos_y})", file=sys.stderr)

                # 将文字分行
                lines = []
                for i in range(0, len(main_text), max_chars_per_line):
                    lines.append(main_text[i:i + max_chars_per_line])

                print(f"  Split into {len(lines)} lines: {lines}", file=sys.stderr)

                if direction == 'vertical':
                    # 竖排：从右到左排列，每列从上到下
                    # 计算总宽度和高度
                    total_width = (len(lines) - 1) * line_spacing + font_size

                    # 找出最长的列
                    max_col_chars = max(len(line) for line in lines) if lines else 1
                    total_height = (max_col_chars - 1) * (font_size + char_spacing) + font_size

                    # 计算起始位置（整体居中）
                    start_x = main_pos_x + total_width // 2 - font_size // 2
                    start_y = main_pos_y - total_height // 2

                    # 逐列绘制（从右到左）
                    for col_idx, line in enumerate(lines):
                        col_x = start_x - col_idx * line_spacing

                        # 逐字符绘制（从上到下）
                        for char_idx, char in enumerate(line):
                            char_y = start_y + char_idx * (font_size + char_spacing)

                            # 计算字符实际宽度以水平居中
                            try:
                                bbox = draw.textbbox((0, 0), char, font=font_main)
                                char_w = bbox[2] - bbox[0]
                                char_x = col_x - char_w // 2 + font_size // 2
                            except:
                                char_x = col_x

                            # 使用带阴影和描边效果的绘制函数
                            image = self._draw_char_with_effects(
                                image, char, char_x, char_y, font_main, main_color, main_title
                            )
                            draw = ImageDraw.Draw(image)

                            print(f"    Char '{char}' at ({char_x}, {char_y})", file=sys.stderr)
                else:
                    # 横排：从左到右，从上到下（默认）
                    # 计算总高度
                    total_height = (len(lines) - 1) * line_spacing + font_size
                    start_y = main_pos_y - total_height // 2

                    # 逐行绘制
                    for row_idx, line in enumerate(lines):
                        line_y = start_y + row_idx * line_spacing

                        # 计算该行的总宽度
                        line_width = (len(line) - 1) * (font_size + char_spacing) + font_size
                        start_x = main_pos_x - line_width // 2

                        # 逐字符绘制（从左到右）
                        for char_idx, char in enumerate(line):
                            char_x = start_x + char_idx * (font_size + char_spacing)

                            # 使用带阴影和描边效果的绘制函数
                            image = self._draw_char_with_effects(
                                image, char, char_x, line_y, font_main, main_color, main_title
                            )
                            draw = ImageDraw.Draw(image)

                            print(f"    Char '{char}' at ({char_x}, {line_y})", file=sys.stderr)

                print(f"Drew main title: '{main_text}' ({len(lines)} lines) at ({main_pos_x}, {main_pos_y})", file=sys.stderr)

            # 绘制副标题（支持自动换行）
            sub_title = template['titles']['sub']
            if sub_title.get('text'):
                sub_text = sub_title['text']
                sub_color = self._hex_to_rgb(sub_title.get('color', '#FFFFFF'))
                sub_pos_x = int(width * sub_title['position']['x'] / 100)
                sub_pos_y = int(height * sub_title['position']['y'] / 100)

                # 调试：打印接收到的位置参数
                print(f"[DEBUG] Subtitle position - Received from frontend: x={sub_title['position']['x']}%, y={sub_title['position']['y']}%", file=sys.stderr)
                print(f"[DEBUG] Subtitle position - Calculated pixels: x={sub_pos_x}px, y={sub_pos_y}px", file=sys.stderr)

                max_chars_per_line = sub_title.get('maxLength', 3)  # 每行最多字符数

                # 获取文字方向和间距参数
                direction = sub_title.get('direction', 'horizontal')
                font_size = sub_title.get('fontSize', 40)
                char_spacing = sub_title.get('charSpacing', int(font_size * 0.2))  # 字符间距
                line_spacing = sub_title.get('lineSpacing', int(font_size * 1.2))  # 行间距

                # 调试日志
                print(f"[DEBUG] Sub title config:", file=sys.stderr)
                print(f"  Text: '{sub_text}' (length: {len(sub_text)})", file=sys.stderr)
                print(f"  maxLength: {max_chars_per_line}", file=sys.stderr)
                print(f"  Direction: '{direction}' (type: {type(direction).__name__}, equals 'vertical': {direction == 'vertical'})", file=sys.stderr)
                print(f"  Char spacing: {char_spacing}px, Line spacing: {line_spacing}px", file=sys.stderr)
                print(f"  Position: ({sub_pos_x}, {sub_pos_y})", file=sys.stderr)
                print(f"[DEBUG] sub_title dict keys: {list(sub_title.keys())}", file=sys.stderr)

                # 将文字分行
                lines = []
                for i in range(0, len(sub_text), max_chars_per_line):
                    lines.append(sub_text[i:i + max_chars_per_line])

                print(f"  Split into {len(lines)} lines: {lines}", file=sys.stderr)

                if direction == 'vertical':
                    # 竖排：从右到左排列，每列从上到下
                    # 计算总宽度和高度
                    total_width = (len(lines) - 1) * line_spacing + font_size

                    # 找出最长的列
                    max_col_chars = max(len(line) for line in lines) if lines else 1
                    total_height = (max_col_chars - 1) * (font_size + char_spacing) + font_size

                    # 计算起始位置（整体居中）
                    start_x = sub_pos_x + total_width // 2 - font_size // 2
                    start_y = sub_pos_y - total_height // 2

                    # 逐列绘制（从右到左）
                    for col_idx, line in enumerate(lines):
                        col_x = start_x - col_idx * line_spacing

                        # 逐字符绘制（从上到下）
                        for char_idx, char in enumerate(line):
                            char_y = start_y + char_idx * (font_size + char_spacing)

                            # 计算字符实际宽度以水平居中
                            try:
                                bbox = draw.textbbox((0, 0), char, font=font_sub)
                                char_w = bbox[2] - bbox[0]
                                char_x = col_x - char_w // 2 + font_size // 2
                            except:
                                char_x = col_x

                            # 使用带阴影和描边效果的绘制函数
                            image = self._draw_char_with_effects(
                                image, char, char_x, char_y, font_sub, sub_color, sub_title
                            )
                            draw = ImageDraw.Draw(image)

                            print(f"    Char '{char}' at ({char_x}, {char_y})", file=sys.stderr)
                else:
                    # 横排：从左到右，从上到下（默认）
                    # 计算总高度
                    total_height = (len(lines) - 1) * line_spacing + font_size
                    start_y = sub_pos_y - total_height // 2

                    # 逐行绘制
                    for row_idx, line in enumerate(lines):
                        line_y = start_y + row_idx * line_spacing

                        # 计算该行的总宽度
                        line_width = (len(line) - 1) * (font_size + char_spacing) + font_size
                        start_x = sub_pos_x - line_width // 2

                        # 逐字符绘制（从左到右）
                        for char_idx, char in enumerate(line):
                            char_x = start_x + char_idx * (font_size + char_spacing)
                            char_y = line_y  # ✅ 添加char_y变量以保持一致性

                            # 使用带阴影和描边效果的绘制函数
                            image = self._draw_char_with_effects(
                                image, char, char_x, char_y, font_sub, sub_color, sub_title
                            )
                            draw = ImageDraw.Draw(image)

                            print(f"    Char '{char}' at ({char_x}, {line_y})", file=sys.stderr)

                print(f"Drew sub title: '{sub_text}' ({len(lines)} lines) at ({sub_pos_x}, {sub_pos_y})", file=sys.stderr)

            # 转换回RGB并保存封面
            if image.mode == 'RGBA':
                image = image.convert('RGB')
            cover_path = os.path.join(self.output_dir, 'cover_custom_template.png')
            image.save(cover_path, quality=95)

            print(f"Custom template cover generated: {cover_path}", file=sys.stderr)
            return cover_path

        except Exception as e:
            print(f"Error generating custom template cover: {e}", file=sys.stderr)
            raise Exception(f"Custom template cover generation failed: {str(e)}")

    def generate_subtitles(self) -> List[Dict[str, Any]]:
        """
        生成字幕列表
        支持两种模式：
        1. FUNASR模式：使用语音识别结果的时间戳
        2. 文本模式：根据文案按行分割，平均分配时间

        现在支持：逐句情感分析 + 动态字幕样式

        Returns:
            字幕列表，每个字幕包含文本、开始时间、结束时间、情感、样式等
        """
        try:
            subtitles = []

            # 模式1: 使用FUNASR识别结果
            if self.use_funasr and self.funasr_result:
                print("Generating subtitles from FUNASR result with sentiment analysis...", file=sys.stderr)
                segments = self.funasr_result.get('segments', [])

                for i, segment in enumerate(segments):
                    text = segment.get('text', '')

                    # 对每句话进行情感分析
                    sentiment_analysis = self.analyze_sentence_sentiment(text)
                    sentiment = sentiment_analysis['sentiment']
                    score = sentiment_analysis['score']

                    # 根据情感选择样式
                    dynamic_style = self.get_style_by_sentiment(sentiment, score)

                    subtitle = {
                        'index': i + 1,
                        'text': text,
                        'start_time': segment.get('start', i * 3.0),
                        'end_time': segment.get('end', (i + 1) * 3.0),
                        'style': dynamic_style,  # 动态样式
                        'sentiment': sentiment,  # 情感类型
                        'sentiment_score': score,  # 情感分数
                        'fontName': self.subtitle_font_name,  # 加入字体名称
                        'fontSize': self.subtitle_font_size,  # 加入字体大小
                    }
                    subtitles.append(subtitle)

                print(f"Generated {len(subtitles)} subtitles from FUNASR with sentiment-based styles", file=sys.stderr)

            # 模式2: 基于文本的简单分割（支持情感分析）
            else:
                print("Generating subtitles from script text with sentiment analysis...", file=sys.stderr)
                # 先按行分割
                lines = [line.strip() for line in self.script_text.split('\n') if line.strip()]

                # 如果只有一行,则按句子分割（使用句号、问号、感叹号等标点）
                if len(lines) == 1:
                    import re
                    # 使用正则表达式按中英文标点分割句子
                    sentences = re.split(r'[。！？\.\!\?]+', lines[0])
                    lines = [s.strip() for s in sentences if s.strip()]
                    print(f"Single line detected, split into {len(lines)} sentences", file=sys.stderr)

                # 生成字幕列表（简单示例，每句3秒）
                for i, line in enumerate(lines):
                    # 对每句话进行情感分析
                    sentiment_analysis = self.analyze_sentence_sentiment(line)
                    sentiment = sentiment_analysis['sentiment']
                    score = sentiment_analysis['score']

                    # 根据情感选择样式
                    dynamic_style = self.get_style_by_sentiment(sentiment, score)

                    subtitle = {
                        'index': i + 1,
                        'text': line,
                        'start_time': i * 3.0,
                        'end_time': (i + 1) * 3.0,
                        'style': dynamic_style,  # 动态样式
                        'sentiment': sentiment,  # 情感类型
                        'sentiment_score': score,  # 情感分数
                        'fontName': self.subtitle_font_name,  # 加入字体名称
                        'fontSize': self.subtitle_font_size,  # 加入字体大小
                    }
                    subtitles.append(subtitle)

                print(f"Generated {len(subtitles)} subtitles from text with sentiment-based styles", file=sys.stderr)

            return self.normalize_subtitles(subtitles)
        except Exception as e:
            raise Exception(f"Error generating subtitles: {str(e)}")

    def normalize_subtitles(self, subtitles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        min_duration = 0.18
        overlap_gap = 0.03
        duplicate_time_threshold = 0.2
        normalized: List[Dict[str, Any]] = []

        for original in subtitles:
            text = str(original.get('text', '')).replace('\r', ' ').replace('\n', ' ').strip()
            if not text:
                continue

            try:
                start_time = float(original.get('start_time', 0.0) or 0.0)
            except (TypeError, ValueError):
                start_time = 0.0

            try:
                end_time = float(original.get('end_time', start_time + min_duration) or (start_time + min_duration))
            except (TypeError, ValueError):
                end_time = start_time + min_duration

            start_time = max(0.0, start_time)
            end_time = max(start_time + min_duration, end_time)

            subtitle = dict(original)
            subtitle['text'] = text
            subtitle['start_time'] = start_time
            subtitle['end_time'] = end_time
            normalized.append(subtitle)

        normalized.sort(key=lambda item: (item['start_time'], item['end_time'], item.get('index', 0)))

        cleaned: List[Dict[str, Any]] = []
        adjusted_count = 0

        for subtitle in normalized:
            if cleaned:
                previous = cleaned[-1]

                is_duplicate = (
                    subtitle['text'] == previous['text']
                    and abs(subtitle['start_time'] - previous['start_time']) <= duplicate_time_threshold
                )
                if is_duplicate:
                    previous['end_time'] = max(previous['end_time'], subtitle['end_time'])
                    adjusted_count += 1
                    continue

                if subtitle['start_time'] < previous['end_time']:
                    preferred_previous_end = max(
                        previous['start_time'] + min_duration,
                        subtitle['start_time'] - overlap_gap
                    )

                    if preferred_previous_end < previous['end_time']:
                        previous['end_time'] = preferred_previous_end
                        adjusted_count += 1

                    if subtitle['start_time'] < previous['end_time']:
                        subtitle['start_time'] = previous['end_time'] + overlap_gap
                        subtitle['end_time'] = max(subtitle['start_time'] + min_duration, subtitle['end_time'])
                        adjusted_count += 1

            cleaned.append(subtitle)

        for index, subtitle in enumerate(cleaned, start=1):
            subtitle['index'] = index

        if adjusted_count > 0:
            print(
                f"Normalized subtitles: {len(subtitles)} -> {len(cleaned)}, adjusted {adjusted_count} entries",
                file=sys.stderr
            )

        return cleaned

    def save_srt(self, subtitles: List[Dict[str, Any]]) -> str:
        """
        保存SRT字幕文件

        Args:
            subtitles: 字幕列表

        Returns:
            SRT文件路径
        """
        try:
            srt_path = os.path.join(self.output_dir, 'subtitles.srt')

            with open(srt_path, 'w', encoding='utf-8') as f:
                for sub in subtitles:
                    # SRT格式
                    f.write(f"{sub['index']}\n")
                    f.write(f"{self._format_time(sub['start_time'])} --> {self._format_time(sub['end_time'])}\n")
                    f.write(f"{sub['text']}\n\n")

            return srt_path
        except Exception as e:
            raise Exception(f"Error saving SRT file: {str(e)}")

    def _format_time(self, seconds: float) -> str:
        """格式化时间为SRT格式"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)

        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def _apply_keyword_effects_to_subtitle(self, subtitle: Dict[str, Any]) -> Dict[str, Any]:
        """
        对字幕应用关键词分组效果

        Args:
            subtitle: 字幕对象

        Returns:
            应用了效果的字幕对象
        """
        # 查找该字幕中的关键词标记
        text = subtitle.get('text', '')

        # ✅ 修复：正确处理关键词标记的结构
        # 前端发送的关键词标记结构：{ text: '关键词', groupId: 'xxx-xxx-xxx', positions: [...], count: 1 }
        if not self.keyword_markers:
            print(f"[_apply_keyword_effects_to_subtitle] No keyword markers found", file=sys.stderr)
            return subtitle

        # 检查是否有相关的关键词标记
        for marker in self.keyword_markers:
            # ✅ 尝试多种方式获取标记文本
            marker_text = marker.get('text') or marker.get('keyword') or ''

            if not marker_text:
                continue

            # 检查字幕中是否包含此关键词
            if marker_text in text:
                group_id = marker.get('groupId')

                # 查找对应的分组
                if group_id:
                    matched_group = None
                    for group in self.keyword_groups:
                        if group.get('id') == group_id:
                            matched_group = group
                            break

                    if matched_group:
                        # 应用分组的样式覆盖
                        style_override = matched_group.get('styleOverride', {})

                        # ✅ 即使没有 styleOverride，也要应用 effectId
                        effect_id = matched_group.get('effectId', 'none')

                        # 更新字幕的样式信息
                        subtitle['keywordEffect'] = {
                            'groupId': group_id,
                            'groupName': matched_group.get('name', ''),
                            'fontColor': style_override.get('fontColor', '#FFFFFF'),
                            'outlineColor': style_override.get('outlineColor', '#000000'),
                            'fontSize': style_override.get('fontSize', 24),
                            'outlineWidth': style_override.get('outlineWidth', 2),
                            'effectId': effect_id,
                            'effectDuration': style_override.get('effectDuration', 2.0),
                        }
                        print(f"[_apply_keyword_effects] Matched keyword '{marker_text}' -> group '{matched_group.get('name')}': effect={effect_id}, color={style_override.get('fontColor')}", file=sys.stderr)
                        # ✅ 找到匹配后，只返回，不继续搜索（一个字幕一个特效）
                        return subtitle
                else:
                    print(f"[_apply_keyword_effects] Keyword '{marker_text}' found but no groupId", file=sys.stderr)

        return subtitle

    def save_ass(self, subtitles: List[Dict[str, Any]]) -> str:
        """
        保存ASS字幕文件（Advanced Substation Alpha）
        支持每个字幕不同的样式、字体和关键词分组效果

        Args:
            subtitles: 字幕列表

        Returns:
            ASS文件路径
        """
        try:
            ass_path = os.path.join(self.output_dir, 'subtitles.ass')

            with open(ass_path, 'w', encoding='utf-8-sig') as f:
                # ASS头部信息
                f.write("""[Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1920
PlayResY: 1080
Timer: 100.0000
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
""")

                # 收集所有唯一的字体名称和关键词分组样式（从字幕中提取）
                unique_fonts = set()
                keyword_group_styles = {}  # 存储关键词分组的样式信息

                for sub in subtitles:
                    font_name = sub.get('fontName', 'Microsoft YaHei')
                    unique_fonts.add(font_name)

                    # 如果有关键词效果，记录其样式信息
                    if sub.get('keywordEffect'):
                        keyword_effect = sub.get('keywordEffect')
                        group_id = keyword_effect.get('groupId')
                        group_name = keyword_effect.get('groupName', '')

                        # 为关键词分组创建唯一的样式
                        style_key = f"group_{group_id}" if group_id else None
                        if style_key and style_key not in keyword_group_styles:
                            # 转换颜色格式：#RRGGBB → &H00BBGGRR&
                            font_color = keyword_effect.get('fontColor', '#FFFFFF')
                            outline_color = keyword_effect.get('outlineColor', '#000000')
                            outline_width = keyword_effect.get('outlineWidth', 2)
                            font_size = keyword_effect.get('fontSize', 72)

                            # 转换十六进制颜色
                            if font_color.startswith('#'):
                                hex_c = font_color.lstrip('#')
                                primary_color = f"&H00{hex_c[4:6]}{hex_c[2:4]}{hex_c[0:2]}&"
                            else:
                                primary_color = "&H00FFFFFF&"

                            if outline_color.startswith('#'):
                                hex_c = outline_color.lstrip('#')
                                outline_color_ass = f"&H00{hex_c[4:6]}{hex_c[2:4]}{hex_c[0:2]}&"
                            else:
                                outline_color_ass = "&H00000000&"

                            keyword_group_styles[style_key] = {
                                'font_size': font_size,
                                'primary_color': primary_color,
                                'outline_color': outline_color_ass,
                                'outline_width': outline_width,
                                'style_def': f'Style: {style_key},{font_name.replace(" ", "_")},{font_size},{primary_color},&H000000FF,{outline_color_ass},&H80000000,-1,0,0,0,100,100,0,0,1,{int(outline_width)},1,2,10,10,20,1'
                            }

                print(f"Found {len(unique_fonts)} unique fonts in subtitles: {unique_fonts}", file=sys.stderr)
                print(f"Found {len(keyword_group_styles)} keyword group styles", file=sys.stderr)

                # 为每个唯一字体创建样式
                styles = {}
                default_font = 'Microsoft YaHei'

                # 先添加默认样式（使用默认字体）
                default_font_to_use = list(unique_fonts)[0] if unique_fonts else default_font
                styles['default'] = f'Style: default,{default_font_to_use},24,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,20,1'

                # 为其他唯一字体创建额外样式
                for idx, font_name in enumerate(unique_fonts, 1):
                    # 清理字体名称用作样式名（只允许字母和数字）
                    style_name = f'font_{idx}' if font_name == default_font_to_use or font_name not in ['Microsoft YaHei', 'SimHei', 'SimSun'] else font_name.replace(' ', '_')
                    styles[style_name] = f'Style: {style_name},{font_name},24,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,20,1'

                # 添加关键词分组的样式
                for style_key, style_info in keyword_group_styles.items():
                    styles[style_key] = style_info['style_def']

                # 输出所有样式定义
                for style_def in styles.values():
                    f.write(f"{style_def}\n")

                f.write("""
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""")

                # 添加字幕事件
                for sub in subtitles:
                    # 应用关键词分组效果
                    sub = self._apply_keyword_effects_to_subtitle(sub)

                    start_time = self._format_ass_time(sub['start_time'])
                    end_time = self._format_ass_time(sub['end_time'])
                    style = sub.get('style', 'default')
                    text = sub['text']
                    font_name = sub.get('fontName')  # 从字幕对象获取字体名称

                    # ✅ 如果有关键词效果，优先使用关键词分组的样式
                    keyword_effect = sub.get('keywordEffect', None)
                    if keyword_effect:
                        group_id = keyword_effect.get('groupId')
                        style_key = f"group_{group_id}" if group_id else None
                        if style_key and style_key in styles:
                            style = style_key
                            print(f"Subtitle '{text[:20]}...' using keyword group style: {style}", file=sys.stderr)
                        else:
                            print(f"Subtitle '{text[:20]}...' keyword group style '{style_key}' not found, using default", file=sys.stderr)
                    # 否则，根据字体名称选择对应的样式
                    elif font_name:
                        # 尝试使用字体名称作为样式名
                        style_for_font = font_name.replace(' ', '_')
                        # 如果样式不存在，使用default
                        if style_for_font not in styles:
                            style = 'default'
                        else:
                            style = style_for_font
                        print(f"Subtitle '{text[:20]}...' using font: {font_name}, style: {style}", file=sys.stderr)
                    else:
                        print(f"Subtitle '{text[:20]}...' using default font and style", file=sys.stderr)

                    # 如果有关键词效果，添加ASS特效标签和颜色
                    if keyword_effect:
                        effect_id = keyword_effect.get('effectId', 'none')
                        effect_duration = keyword_effect.get('effectDuration', 2.0)
                        font_color = keyword_effect.get('fontColor', '#FFFFFF')

                        # 转换十六进制颜色为ASS格式（&HAABBGGRR）
                        if font_color.startswith('#'):
                            hex_color = font_color.lstrip('#')
                            # 反转RGB为BGR
                            ass_color = f"&H00{hex_color[4:6]}{hex_color[2:4]}{hex_color[0:2]}&"
                        else:
                            ass_color = "&H00FFFFFF&"

                        # ✅ 根据前端支持的所有特效类型添加ASS标签
                        # 前端支持的特效ID: zoom-in, pulse, bounce, glow, shake, slide-up, fade, spin, wave, flip
                        if effect_id in ['bounce', 'pulse', 'pulse_scale']:
                            # 弹跳/脉冲：使用缩放变换
                            text = f"{{\\t(0,{int(effect_duration*1000)},\\t(0,{int(effect_duration*500)},\\fscx110)\\t({int(effect_duration*500)},{int(effect_duration*1000)},\\fscx100))}}{text}"
                        elif effect_id in ['zoom-in']:
                            # 缩放弹出
                            text = f"{{\\t(0,{int(effect_duration*1000)},\\fscx130\\fscy130)}}{text}"
                        elif effect_id in ['glow', 'glow_effect']:
                            # 发光效果
                            text = f"{{\\c{ass_color}\\blur2\\bord2}}{text}"
                        elif effect_id in ['shake']:
                            # 抖动效果（使用多个 pos 标签模拟）
                            text = f"{{\\fad(100,{int(effect_duration*500)})}}{text}"
                        elif effect_id in ['slide-up', 'slide_in_up']:
                            # 从下向上滑入
                            text = f"{{\\move(0,{int(1080 * 0.3)},0,{int(1080 * 0.2)},0,{int(effect_duration*1000)})}}{text}"
                        elif effect_id in ['fade']:
                            # 渐变高亮
                            text = f"{{\\t(0,{int(effect_duration*500)},\\c{ass_color})\\t({int(effect_duration*500)},{int(effect_duration*1000)},\\c&H00FFFFFF&)}}{text}"
                        elif effect_id in ['spin']:
                            # 旋转效果
                            text = f"{{\\t(0,{int(effect_duration*1000)},\\frz360)}}{text}"
                        elif effect_id in ['wave']:
                            # 彩虹波浪（使用多个颜色变换）
                            text = f"{{\\t(0,{int(effect_duration*1000)},\\c&H0000FF&)\\t({int(effect_duration*250)},{int(effect_duration*500)},\\c&H00FF00&)\\t({int(effect_duration*500)},{int(effect_duration*750)},\\c&HFF0000&)}}{text}"
                        elif effect_id in ['flip']:
                            # 3D翻转效果
                            text = f"{{\\t(0,{int(effect_duration*1000)},\\frx360)}}{text}"
                        # 其他特效或 'none' 不添加标签

                    f.write(f"Dialogue: 0,{start_time},{end_time},{style},,0,0,0,,{text}\n")

            print(f"ASS subtitle file saved: {ass_path}", file=sys.stderr)
            return ass_path
        except Exception as e:
            raise Exception(f"Error saving ASS file: {str(e)}")

    def _format_ass_time(self, seconds: float) -> str:
        """格式化时间为ASS格式 (H:MM:SS.cc)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        centisecs = int((seconds % 1) * 100)

        return f"{hours}:{minutes:02d}:{secs:02d}.{centisecs:02d}"

    def analyze_script(self) -> Dict[str, Any]:
        """
        使用轻量级NLP分析文案
        提取标题、关键词、列表项、情感等信息

        Returns:
            分析结果字典
        """
        if not NLP_AVAILABLE:
            print("NLP not available, returning basic analysis", file=sys.stderr)
            return {
                'title': None,
                'keywords': [],
                'list_items': [],
                'sentiment': 'neutral'
            }

        try:
            result = {}

            # 分割文本为行
            lines = [line.strip() for line in self.script_text.split('\n') if line.strip()]

            # 1. 提取标题（取第一行，如果长度适中）
            if lines and len(lines[0]) <= 30:
                result['title'] = lines[0]
            else:
                result['title'] = None

            # 2. 提取列表项（包含"第一"、"第二"、"首先"、"其次"等序号词的行）
            list_markers = ['第一', '第二', '第三', '第四', '第五', '首先', '其次', '再次', '最后', '1.', '2.', '3.', '4.', '5.']
            list_items = []
            for line in lines:
                if any(marker in line for marker in list_markers):
                    list_items.append(line)
            result['list_items'] = list_items

            # 3. 提取关键词（使用TF-IDF）
            full_text = ' '.join(lines)
            try:
                # 使用 jieba 提取关键词（基于 TF-IDF）
                keywords = jieba.analyse.extract_tags(full_text, topK=10, withWeight=False)
                result['keywords'] = keywords
                print(f"Extracted keywords: {keywords}", file=sys.stderr)
            except Exception as e:
                print(f"Keyword extraction failed: {e}", file=sys.stderr)
                result['keywords'] = []

            # 4. 情感分析（优先使用Transformer，降级到关键词匹配）
            if self.sentiment_analyzer is not None:
                try:
                    # 使用Transformer模型进行深度情感分析
                    print("Using Transformer for sentiment analysis...", file=sys.stderr)
                    # 截取前512个字符（模型限制）
                    text_for_analysis = full_text[:512] if len(full_text) > 512 else full_text
                    sentiment_result = self.sentiment_analyzer(text_for_analysis)[0]

                    # 转换标签为统一格式
                    label = sentiment_result['label'].lower()
                    score = sentiment_result['score']

                    if 'pos' in label or 'positive' in label:
                        result['sentiment'] = 'positive'
                    elif 'neg' in label or 'negative' in label:
                        result['sentiment'] = 'negative'
                    else:
                        result['sentiment'] = 'neutral'

                    result['sentiment_score'] = score
                    print(f"Transformer sentiment: {result['sentiment']} (score: {score:.4f})", file=sys.stderr)
                except Exception as e:
                    print(f"Transformer sentiment analysis failed: {e}, using fallback", file=sys.stderr)
                    # 降级到关键词匹配
                    result['sentiment'] = self._fallback_sentiment_analysis(full_text)
                    result['sentiment_score'] = 0.5
            else:
                # 降级到关键词匹配
                result['sentiment'] = self._fallback_sentiment_analysis(full_text)
                result['sentiment_score'] = 0.5

            print(f"Script analysis result: {result}", file=sys.stderr)
            return result

        except Exception as e:
            print(f"Error analyzing script: {e}", file=sys.stderr)
            return {
                'title': None,
                'keywords': [],
                'list_items': [],
                'sentiment': 'neutral',
                'sentiment_score': 0.5
            }

    def _fallback_sentiment_analysis(self, text: str) -> str:
        """基于关键词的简单情感分析（降级方案）"""
        positive_words = ['好', '棒', '优秀', '成功', '喜欢', '开心', '快乐', '美好', '精彩', '完美']
        negative_words = ['差', '糟', '失败', '讨厌', '难过', '痛苦', '糟糕', '失望', '困难']

        positive_count = sum(1 for word in positive_words if word in text)
        negative_count = sum(1 for word in negative_words if word in text)

        if positive_count > negative_count:
            return 'positive'
        elif negative_count > positive_count:
            return 'negative'
        else:
            return 'neutral'

    def analyze_sentence_sentiment(self, text: str) -> Dict[str, Any]:
        """
        分析单句话的情感

        Args:
            text: 待分析的句子

        Returns:
            包含情感和分数的字典
        """
        # 如果句子太短（少于3个字），返回中性
        if len(text.strip()) < 3:
            return {
                'sentiment': 'neutral',
                'score': 0.5
            }

        # 优先使用Transformer模型
        if self.sentiment_analyzer is not None:
            try:
                # 截取前512个字符（模型限制）
                text_for_analysis = text[:512] if len(text) > 512 else text
                sentiment_result = self.sentiment_analyzer(text_for_analysis)[0]

                # 转换标签为统一格式
                label = sentiment_result['label'].lower()
                score = sentiment_result['score']

                if 'pos' in label or 'positive' in label:
                    sentiment = 'positive'
                elif 'neg' in label or 'negative' in label:
                    sentiment = 'negative'
                else:
                    sentiment = 'neutral'

                return {
                    'sentiment': sentiment,
                    'score': score
                }
            except Exception as e:
                print(f"Transformer sentiment analysis failed for sentence: {e}", file=sys.stderr)
                # 降级到关键词匹配
                sentiment = self._fallback_sentiment_analysis(text)
                return {
                    'sentiment': sentiment,
                    'score': 0.5
                }
        else:
            # 降级到关键词匹配
            sentiment = self._fallback_sentiment_analysis(text)
            return {
                'sentiment': sentiment,
                'score': 0.5
            }

    def get_style_by_sentiment(self, sentiment: str, score: float) -> str:
        """
        根据情感选择字幕样式

        Args:
            sentiment: 情感类型 (positive/negative/neutral)
            score: 情感分数 (0-1)

        Returns:
            字幕样式名称
        """
        # 如果用户强制指定了样式，优先使用用户指定的
        if hasattr(self, 'force_style') and self.force_style:
            return self.subtitle_style

        # 处理emotion-mixed样式：使用情感分析自动选择
        if self.subtitle_style == 'emotion-mixed':
            # 根据情感自动选择样式
            if sentiment == 'positive':
                if score > 0.8:  # 强烈积极
                    return 'neon'  # 霓虹样式 - 明亮彩色
                else:
                    return 'highlight'  # 高亮样式 - 黄色背景
            elif sentiment == 'negative':
                if score > 0.8:  # 强烈消极
                    return 'minimal'  # 极简样式 - 低调
                else:
                    return 'card'  # 卡片样式 - 半透明背景
            else:
                return 'default'  # 中性 - 默认样式

        # 普通样式映射
        if sentiment == 'positive':
            if score > 0.8:  # 强烈积极
                return 'neon'  # 霓虹样式 - 明亮彩色
            else:
                return 'highlight'  # 高亮样式 - 黄色背景
        elif sentiment == 'negative':
            if score > 0.8:  # 强烈消极
                return 'minimal'  # 极简样式 - 低调
            else:
                return 'card'  # 卡片样式 - 半透明背景
        else:
            return 'default'  # 中性 - 默认样式

    def burn_subtitles_to_video(self, subtitles: List[Dict[str, Any]]) -> str:
        """
        使用 FFmpeg 将字幕烧录到视频
        现在支持每个字幕不同的样式（使用ASS格式）

        Args:
            subtitles: 字幕列表（包含样式信息）

        Returns:
            输出视频路径
        """
        try:
            output_video = os.path.join(self.output_dir, 'video_with_subtitles.mp4')

            # 保存ASS字幕文件（支持多样式）
            ass_path = self.save_ass(subtitles)

            # Windows上FFmpeg无法正确解析绝对路径中的ASS文件
            # 使用相对路径执行FFmpeg
            ass_filename = os.path.basename(ass_path)
            working_dir = os.path.dirname(ass_path)

            # 构建 FFmpeg 命令
            # 🔧 修复：使用 ziti 目录的绝对路径，而不是相对路径 '.'
            fontconfig = self._get_ffmpeg_fontconfig()
            print(f"Adding fontconfig to FFmpeg: {fontconfig}", file=sys.stderr)

            # 构建字幕过滤器参数
            subtitle_filter = f"subtitles={ass_filename}{fontconfig}"

            cmd = [
                'ffmpeg', '-y',
                '-i', self.video_path,
                '-vf', subtitle_filter,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                '-c:a', 'copy',
                output_video
            ]

            print(f"Running FFmpeg command with ASS subtitles: {' '.join(cmd)}", file=sys.stderr)
            print(f"Working directory: {working_dir}", file=sys.stderr)

            # 执行 FFmpeg 命令 (使用UTF-8编码避免GBK解码错误，从工作目录执行)
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore', timeout=300, cwd=working_dir)

            if result.returncode == 0 and os.path.exists(output_video):
                print(f"Video with dynamic sentiment-based subtitles generated successfully: {output_video}", file=sys.stderr)
                return output_video
            else:
                print(f"FFmpeg error: {result.stderr}", file=sys.stderr)
                # 尝试使用subtitles过滤器作为fallback
                print("Trying fallback with subtitles filter...", file=sys.stderr)
                return self._burn_with_subtitles_filter(ass_path, output_video)

        except subprocess.TimeoutExpired:
            print("FFmpeg timeout, trying fallback method...", file=sys.stderr)
            return self._burn_with_srt_fallback(subtitles, output_video)
        except Exception as e:
            print(f"FFmpeg failed: {e}, trying fallback method...", file=sys.stderr)
            return self._burn_with_srt_fallback(subtitles, output_video)

    def _burn_with_subtitles_filter(self, ass_path: str, output_video: str) -> str:
        """使用subtitles过滤器的fallback方法"""
        try:
            # 使用相对路径执行FFmpeg
            ass_filename = os.path.basename(ass_path)
            working_dir = os.path.dirname(ass_path)

            # 构建 FFmpeg 命令（添加字体路径支持）
            # 🔧 修复：使用 ziti 目录的绝对路径，而不是相对路径 '.'
            fontconfig = self._get_ffmpeg_fontconfig()
            print(f"Fallback: Adding fontconfig to FFmpeg: {fontconfig}", file=sys.stderr)

            # 使用subtitles过滤器而不是ass过滤器
            subtitle_filter = f"subtitles={ass_filename}{fontconfig}"

            cmd = [
                'ffmpeg', '-y',
                '-i', self.video_path,
                '-vf', subtitle_filter,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                '-c:a', 'copy',
                output_video
            ]

            print(f"Running fallback FFmpeg command: {' '.join(cmd)}", file=sys.stderr)
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore', timeout=300, cwd=working_dir)

            if result.returncode == 0 and os.path.exists(output_video):
                print(f"Fallback method successful: {output_video}", file=sys.stderr)
                return output_video
            else:
                print(f"Fallback method failed: {result.stderr}", file=sys.stderr)
                raise Exception(f"Both FFmpeg methods failed")
        except Exception as e:
            raise Exception(f"FFmpeg fallback also failed: {str(e)}")

    def _burn_with_srt_fallback(self, subtitles: List[Dict[str, Any]], output_video: str) -> str:
        """最终fallback：使用SRT格式"""
        try:
            # 保存SRT文件（所有字幕用default样式）
            srt_path = self.save_srt(subtitles)

            # 使用相对路径执行FFmpeg
            srt_filename = os.path.basename(srt_path)
            working_dir = os.path.dirname(srt_path)

            # 构建 FFmpeg 命令（添加字体路径支持）
            # 🔧 修复：使用 ziti 目录的绝对路径，而不是相对路径 '.'
            fontconfig = self._get_ffmpeg_fontconfig()
            print(f"SRT Fallback: Adding fontconfig to FFmpeg: {fontconfig}", file=sys.stderr)

            # 使用subtitles过滤器
            subtitle_filter = f"subtitles={srt_filename}{fontconfig}"

            cmd = [
                'ffmpeg', '-y',
                '-i', self.video_path,
                '-vf', subtitle_filter,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                '-c:a', 'copy',
                output_video
            ]

            print(f"Running SRT fallback command: {' '.join(cmd)}", file=sys.stderr)
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore', timeout=300, cwd=working_dir)

            if result.returncode == 0 and os.path.exists(output_video):
                print(f"SRT fallback successful: {output_video}", file=sys.stderr)
                return output_video
            else:
                raise Exception(f"All methods failed: {result.stderr}")
        except Exception as e:
            raise Exception(f"SRT fallback failed: {str(e)}")

    def _get_subtitle_filter(self, srt_path: str) -> str:
        """
        根据样式生成 FFmpeg 字幕过滤器

        Args:
            srt_path: SRT文件路径

        Returns:
            FFmpeg 过滤器字符串
        """
        # 使用双引号包围 Windows 路径
        safe_path = f'"{srt_path}"'

        if self.subtitle_style == 'highlight':
            # 高亮样式：黄色背景
            return f"subtitles={safe_path}:force_style='FontName=Microsoft YaHei,FontSize=24,PrimaryColour=&H000000&,BackColour=&H00FFFF&,Bold=1,Outline=0,Shadow=0,MarginV=20'"

        elif self.subtitle_style == 'card':
            # 卡片样式：带背景框
            return f"subtitles={safe_path}:force_style='FontName=Microsoft YaHei,FontSize=24,PrimaryColour=&HFFFFFF&,BackColour=&H80000000&,Bold=1,Outline=2,Shadow=1,MarginV=20'"

        elif self.subtitle_style == 'neon':
            # 霓虹样式：彩色描边
            return f"subtitles={safe_path}:force_style='FontName=Microsoft YaHei,FontSize=26,PrimaryColour=&H00FFFF&,OutlineColour=&HFF00FF&,Bold=1,Outline=3,Shadow=0,MarginV=20'"

        elif self.subtitle_style == 'minimal':
            # 极简样式：细描边
            return f"subtitles={safe_path}:force_style='FontName=Microsoft YaHei,FontSize=22,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Bold=0,Outline=1,Shadow=0,MarginV=20'"

        else:
            # 默认样式：白色文字，黑色描边
            return f"subtitles={safe_path}:force_style='FontName=Microsoft YaHei,FontSize=24,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Bold=1,Outline=2,Shadow=1,MarginV=20'"

    def generate_all(self) -> Dict[str, Any]:
        """
        一键生成所有内容

        Returns:
            包含生成结果的字典
        """
        try:
            # 如果仅生成封面模式
            if self.cover_only:
                print("Cover-only mode: Generating cover only...", file=sys.stderr)

                # 生成封面
                print("Generating cover...", file=sys.stderr)
                cover_path = self.generate_cover()

                result = {
                    'success': True,
                    'coverPath': cover_path,
                    'message': 'Cover generated successfully'
                }

                return result

            # 完整生成模式
            # 分析文案（NLP）
            print("Analyzing script with NLP...", file=sys.stderr)
            nlp_analysis = self.analyze_script()

            # 生成封面
            print("Generating cover...", file=sys.stderr)
            cover_path = self.generate_cover()

            # 生成字幕
            print("Generating subtitles...", file=sys.stderr)
            subtitles = self.generate_subtitles()

            # 烧录字幕到视频（传递字幕列表而不是SRT路径）
            print("Burning subtitles to video...", file=sys.stderr)
            video_path = self.burn_subtitles_to_video(subtitles)

            result = {
                'success': True,
                'coverPath': cover_path,
                'videoPath': video_path,
                'subtitles': subtitles,
                'nlpAnalysis': nlp_analysis,  # 添加NLP分析结果
                'message': 'Generated successfully with sentiment-based subtitles'
            }

            return result
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': f'Generation failed: {str(e)}'
            }


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='Subtitle & Cover Generator (Simplified)')
    parser.add_argument('config_file', help='Configuration JSON file path')
    args = parser.parse_args()

    try:
        # 读取配置文件
        with open(args.config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)

        # 创建生成器
        generator = SubtitleCoverGenerator(config)

        # 执行生成
        result = generator.generate_all()

        # 输出结果
        print(json.dumps(result, ensure_ascii=False))

        sys.exit(0 if result['success'] else 1)

    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'message': f'Error: {str(e)}'
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
