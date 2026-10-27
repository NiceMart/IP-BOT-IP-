#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字幕封面生成器 - 后端处理逻辑
"""

import os
import sys
import json
import time
import tempfile
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import logging

# ⚠️ 修复模块路径：确保 Python 能找到 modules 和其他本地模块
# 将脚本所在目录（python 目录）添加到 sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)
    print(f"[PATH] Added to sys.path: {script_dir}", file=sys.stderr)

try:
    import cv2
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    import jieba
    # import moviepy.editor  # 暂时注释掉，需要时再启用
except ImportError as e:
    print(f"缺少必要的依赖库: {e}")
    print("请安装以下库:")
    print("pip install opencv-python pillow jieba")
    sys.exit(1)

try:
    from modules.font_manager import get_font_manager
    FONT_MANAGER_AVAILABLE = True
    print("[PATH] font_manager loaded successfully", file=sys.stderr)
except ImportError as e:
    FONT_MANAGER_AVAILABLE = False
    print(f"[PATH] Warning: font_manager module not available: {e}", file=sys.stderr)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

class VideoSubtitleCoverGenerator:
    """字幕封面生成器"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)

        # 字幕样式预设
        self.subtitle_presets = {
            "classic": {
                "fontFamily": "Arial",
                "fontSize": 24,
                "fontColor": "#FFFFFF",
                "backgroundColor": "#000000",
                "backgroundColorOpacity": 0.7,
                "position": "bottom"
            },
            "modern": {
                "fontFamily": "Microsoft YaHei",
                "fontSize": 28,
                "fontColor": "#FFD700",
                "backgroundColor": "#1a1a1a",
                "backgroundColorOpacity": 0.8,
                "position": "bottom"
            },
            "minimal": {
                "fontFamily": "SimHei",
                "fontSize": 22,
                "fontColor": "#FFFFFF",
                "backgroundColor": "",
                "backgroundColorOpacity": 0,
                "position": "center"
            },
            "bold": {
                "fontFamily": "SimSun",
                "fontSize": 30,
                "fontColor": "#FF0000",
                "backgroundColor": "#FFFF00",
                "backgroundColorOpacity": 0.9,
                "position": "top"
            }
        }

        # 封面样式预设
        self.cover_presets = {
            "big-text": {
                "timePointType": "random",
                "customTimePoint": 10,
                "textOverlay": "",
                "fontSize": 72,
                "fontColor": "white",
                "position": "center",
                "backgroundColor": True,
                "backgroundOpacity": 60,
                "maxWidth": 90,
                "effectType": "blur",
                "quality": 95
            },
            "search-card": {
                "timePointType": "middle",
                "customTimePoint": 50,
                "textOverlay": "",
                "fontSize": 48,
                "fontColor": "white",
                "position": "bottom-left",
                "backgroundColor": True,
                "backgroundOpacity": 80,
                "maxWidth": 70,
                "effectType": "none",
                "quality": 95
            },
            "cut-angle": {
                "timePointType": "start",
                "customTimePoint": 5,
                "textOverlay": "",
                "fontSize": 56,
                "fontColor": "yellow",
                "position": "bottom-right",
                "backgroundColor": False,
                "backgroundOpacity": 0,
                "maxWidth": 75,
                "effectType": "gradient",
                "quality": 95
            },
            "blur-person": {
                "timePointType": "random",
                "customTimePoint": 15,
                "textOverlay": "",
                "fontSize": 64,
                "fontColor": "white",
                "position": "bottom-center",
                "backgroundColor": True,
                "backgroundOpacity": 50,
                "maxWidth": 85,
                "effectType": "blur-person",
                "quality": 95
            }
        }

    def get_subtitle_preset(self, preset_id: str) -> Dict[str, Any]:
        """获取字幕预设样式"""
        return self.subtitle_presets.get(preset_id, self.subtitle_presets["classic"])

    def get_cover_preset(self, preset_id: str) -> Dict[str, Any]:
        """获取封面预设样式"""
        return self.cover_presets.get(preset_id, self.cover_presets["big-text"])

    def extract_frame_at_time(self, video_path: str, time_seconds: float) -> Optional[np.ndarray]:
        """从视频中提取指定时间的帧"""
        try:
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                self.logger.error(f"无法打开视频文件: {video_path}")
                return None

            # 设置时间位置
            cap.set(cv2.CAP_PROP_POS_MSEC, time_seconds * 1000)

            ret, frame = cap.read()
            cap.release()

            if ret:
                return frame
            else:
                self.logger.warning(f"无法读取视频帧: {time_seconds}s")
                return None

        except Exception as e:
            self.logger.error(f"提取视频帧失败: {e}")
            return None

    def get_video_duration(self, video_path: str) -> float:
        """获取视频时长"""
        try:
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return 0

            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            duration = frame_count / fps if fps > 0 else 0

            cap.release()
            return duration

        except Exception as e:
            self.logger.error(f"获取视频时长失败: {e}")
            return 0

    def get_optimal_frame_time(self, video_path: str, time_point_type: str, custom_time: float) -> float:
        """获取最佳帧时间点"""
        duration = self.get_video_duration(video_path)

        if time_point_type == "start":
            return min(custom_time, duration * 0.1)  # 前10%
        elif time_point_type == "middle":
            return duration * (custom_time / 100)  # 百分比位置
        elif time_point_type == "end":
            return max(duration - custom_time, duration * 0.9)  # 后10%
        elif time_point_type == "random":
            import random
            # 随机选择前60%的位置，避免片尾
            return random.uniform(0, duration * 0.6)
        else:
            return min(custom_time, duration * 0.5)  # 默认中间位置

    def apply_cover_effect(self, image: Image.Image, effect_type: str) -> Image.Image:
        """应用封面特效"""
        if effect_type == "blur":
            # 高斯模糊背景
            return image.filter(ImageFilter.GaussianBlur(radius=5))
        elif effect_type == "blur-person":
            # 模拟人物虚化效果 (简单的中心区域保持清晰)
            width, height = image.size
            # 创建遮罩
            mask = Image.new('L', (width, height), 128)
            # 中心区域清晰
            center_x, center_y = width // 2, height // 2
            radius = min(width, height) // 4
            for x in range(width):
                for y in range(height):
                    dist = ((x - center_x) ** 2 + (y - center_y) ** 2) ** 0.5
                    if dist < radius:
                        mask.putpixel((x, y), 255)  # 清晰
                    else:
                        mask.putpixel((x, y), 64)   # 模糊

            blurred = image.filter(ImageFilter.GaussianBlur(radius=3))
            return Image.composite(image, blurred, mask)
        elif effect_type == "gradient":
            # 渐变效果
            width, height = image.size
            gradient = Image.new('L', (width, height), 0)
            draw = ImageDraw.Draw(gradient)

            # 创建对角线渐变
            for x in range(width):
                for y in range(height):
                    # 计算渐变值
                    factor = (x + y) / (width + height)
                    value = int(255 * (0.3 + 0.7 * factor))  # 30%-100% 不透明度
                    gradient.putpixel((x, y), value)

            # 创建半透明图层
            overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            gradient_rgba = Image.new('RGBA', (width, height), (0, 0, 0, 128))
            overlay = Image.composite(overlay, gradient_rgba, gradient)

            return Image.alpha_composite(image.convert('RGBA'), overlay).convert('RGB')
        else:
            return image

    def add_text_to_image(self, image: Image.Image, text: str, style_config: Dict[str, Any]) -> Image.Image:
        """在图片上添加文字"""
        if not text.strip():
            return image

        img = image.copy()
        draw = ImageDraw.Draw(img)
        width, height = img.size

        # 获取字体（支持自定义字体）
        font_size = style_config.get('fontSize', 48)
        font_name = style_config.get('fontName', 'Microsoft YaHei')  # 从配置获取字体名称
        font_weight = style_config.get('fontWeight', 400)
        font = self._load_font_safe(font_name, font_size, font_weight)

        # 计算文字尺寸
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # 限制最大宽度
        max_width_percent = style_config.get('maxWidth', 80) / 100
        max_width = int(width * max_width_percent)

        if text_width > max_width:
            # 如果文字太宽，需要调整字体大小
            scale_factor = max_width / text_width
            new_font_size = int(font_size * scale_factor)
            try:
                font = ImageFont.truetype(font_family, new_font_size)
            except:
                font = ImageFont.load_default()

            # 重新计算文字尺寸
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]

        # 计算位置
        position = style_config.get('position', 'center')
        font_color = style_config.get('fontColor', 'white')

        # 解析颜色
        if isinstance(font_color, str) and font_color.startswith('#'):
            r = int(font_color[1:3], 16)
            g = int(font_color[3:5], 16)
            b = int(font_color[5:7], 16)
            font_color = (r, g, b)
        elif font_color == 'white':
            font_color = (255, 255, 255)
        elif font_color == 'yellow':
            font_color = (255, 255, 0)
        else:
            font_color = (255, 255, 255)

        # 计算文字位置
        if position == 'center':
            x = (width - text_width) // 2
            y = (height - text_height) // 2
        elif position == 'bottom-left':
            x = 50
            y = height - text_height - 50
        elif position == 'bottom-right':
            x = width - text_width - 50
            y = height - text_height - 50
        elif position == 'bottom-center':
            x = (width - text_width) // 2
            y = height - text_height - 50
        elif position == 'top-left':
            x = 50
            y = 50
        elif position == 'top-right':
            x = width - text_width - 50
            y = 50
        elif position == 'top-center':
            x = (width - text_width) // 2
            y = 50
        else:  # 默认居中
            x = (width - text_width) // 2
            y = (height - text_height) // 2

        # 添加背景
        background_color = style_config.get('backgroundColor', True)
        background_opacity = style_config.get('backgroundOpacity', 70)

        if background_color and background_opacity > 0:
            # 创建半透明背景
            padding = 20
            bg_x1 = max(0, x - padding)
            bg_y1 = max(0, y - padding)
            bg_x2 = min(width, x + text_width + padding)
            bg_y2 = min(height, y + text_height + padding)

            # 创建半透明黑色背景
            background = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            bg_draw = ImageDraw.Draw(background)

            # 计算背景颜色 (黑色半透明)
            alpha = int(255 * (background_opacity / 100))
            bg_color = (0, 0, 0, alpha)

            bg_draw.rectangle([bg_x1, bg_y1, bg_x2, bg_y2], fill=bg_color)
            img = Image.alpha_composite(img.convert('RGBA'), background).convert('RGB')

            # 重新创建draw对象
            draw = ImageDraw.Draw(img)

        # 绘制文字
        draw.text((x, y), text, font=font, fill=font_color)

        return img

    def generate_cover_with_custom_template(self, video_path: str, output_path: str, template: Dict[str, Any]) -> bool:
        """使用自定义模板生成封面"""
        try:
            # 提取视频的中间帧
            duration = self.get_video_duration(video_path)
            time_point = duration * 0.5  # 使用中间帧

            frame = self.extract_frame_at_time(video_path, time_point)
            if frame is None:
                self.logger.error("无法提取视频帧")
                return False

            # 转换为PIL图像
            image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            width, height = image.size

            # 1. 应用背景模糊（如果启用）
            background_config = template.get('background', {})
            if background_config.get('blurEnabled', False):
                blur_radius = background_config.get('blurRadius', 15)
                image = image.filter(ImageFilter.GaussianBlur(radius=blur_radius))

            # 2. 处理人像描边（如果启用）
            portrait_config = template.get('portrait', {})
            if portrait_config.get('strokeEnabled', False):
                # 创建绘图对象
                draw = ImageDraw.Draw(image)

                # 获取人像位置和大小（百分比转换为像素）
                pos = portrait_config.get('position', {'x': 50, 'y': 50})
                size = portrait_config.get('size', {'width': 50, 'height': 70})

                portrait_x = int(pos['x'] / 100 * width)
                portrait_y = int(pos['y'] / 100 * height)
                portrait_width = int(size['width'] / 100 * width)
                portrait_height = int(size['height'] / 100 * height)

                # 绘制描边框
                stroke_color = portrait_config.get('strokeColor', '#FFD700')
                stroke_width = portrait_config.get('strokeWidth', 3)
                stroke_type = portrait_config.get('strokeType', 'solid')

                # 计算矩形边界
                left = portrait_x - portrait_width // 2
                top = portrait_y - portrait_height // 2
                right = portrait_x + portrait_width // 2
                bottom = portrait_y + portrait_height // 2

                if stroke_type == 'dashed':
                    # 虚线描边
                    dash_pattern = portrait_config.get('strokeDashPattern', [10, 5])
                    # 简化实现：绘制虚线矩形
                    # 这里需要手动绘制虚线，PIL不直接支持
                    pass  # 简化处理，暂时使用实线

                # 绘制实线矩形
                for i in range(stroke_width):
                    draw.rectangle(
                        [left - i, top - i, right + i, bottom + i],
                        outline=stroke_color,
                        width=1
                    )

            # 3. 添加标题文字
            titles_config = template.get('titles', {})

            # 主标题
            main_title = titles_config.get('main', {})
            main_text = main_title.get('text', '')
            if main_text:
                self._draw_text_with_stroke(
                    image,
                    main_text,
                    main_title,
                    width,
                    height
                )

            # 副标题
            sub_title = titles_config.get('sub', {})
            sub_text = sub_title.get('text', '')
            if sub_text:
                self._draw_text_with_stroke(
                    image,
                    sub_text,
                    sub_title,
                    width,
                    height
                )

            # 4. 添加蒙版（如果有）
            mask_config = template.get('mask', {})
            mask_path = mask_config.get('imagePath', '')
            if mask_path and os.path.exists(mask_path):
                try:
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
                    mask_img = mask_img.resize((mask_width, mask_height), Image.Resampling.LANCZOS)
                    if mask_opacity < 1.0:
                        alpha = mask_img.split()[3]
                        alpha = alpha.point(lambda p: int(p * mask_opacity))
                        mask_img.putalpha(alpha)

                    # 将蒙版粘贴到图像上
                    image_rgba = image.convert('RGBA')
                    image_rgba.paste(mask_img, (mask_x - mask_width // 2, mask_y - mask_height // 2), mask_img)
                    image = image_rgba.convert('RGB')
                except Exception as e:
                    self.logger.warning(f"添加蒙版失败: {e}")

            # 保存图片
            image.save(output_path, 'JPEG', quality=95)
            self.logger.info(f"自定义模板封面生成成功: {output_path}")
            return True

        except Exception as e:
            self.logger.error(f"生成自定义模板封面失败: {e}")
            return False

    def _load_font_safe(self, font_name: str = None, font_size: int = 24, font_weight: int = 400) -> ImageFont.FreeTypeFont:
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
                    self.logger.info(f"Found ziti directory: {ziti_dir}")

                    # 在 ziti 目录中查找字体文件
                    for ext in ['.ttf', '.otf', '.ttc']:
                        # 直接按字体名称查找
                        font_path = os.path.join(ziti_dir, font_name + ext)
                        if os.path.exists(font_path):
                            try:
                                return ImageFont.truetype(font_path, font_size)
                            except Exception as e:
                                self.logger.warning(f"Failed to load ziti font from {font_path}: {e}")

                    # 如果没有找到，扫描目录中所有文件进行模糊匹配
                    try:
                        for file in os.listdir(ziti_dir):
                            if not file.startswith('.') and (file.endswith('.ttf') or file.endswith('.otf') or file.endswith('.ttc')):
                                file_base = os.path.splitext(file)[0]
                                # 检查是否匹配（精确或包含）
                                if file_base == font_name or font_name in file_base:
                                    font_path = os.path.join(ziti_dir, file)
                                    try:
                                        return ImageFont.truetype(font_path, font_size)
                                    except Exception as e:
                                        self.logger.warning(f"Failed to load matched font {font_path}: {e}")
                    except Exception as e:
                        self.logger.warning(f"Error scanning ziti directory: {e}")

        # 2. 如果 ziti 目录查找失败，使用 FontManager
        if font_name and FONT_MANAGER_AVAILABLE:
            try:
                font_manager = get_font_manager()
                font_path = font_manager.find_font(font_name, font_weight)

                if font_path and os.path.exists(font_path):
                    try:
                        return ImageFont.truetype(font_path, font_size)
                    except Exception as e:
                        self.logger.warning(f"Failed to load custom font from {font_path}: {e}")
            except Exception as e:
                self.logger.warning(f"Font manager error: {e}")

        # 3. 降级：根据操作系统加载默认系统字体
        system = platform.system()
        font_paths = []

        if system == 'Windows':
            font_dir = 'C:/Windows/Fonts'
            font_paths = [
                os.path.join(font_dir, 'msyh.ttc'),      # 微软雅黑
                os.path.join(font_dir, 'msyhbd.ttc'),    # 微软雅黑 Bold
                os.path.join(font_dir, 'simhei.ttf'),    # 黑体
                os.path.join(font_dir, 'simsun.ttc'),    # 宋体
            ]
        elif system == 'Darwin':  # macOS
            font_paths = [
                '/Library/Fonts/PingFang.ttc',
                '/System/Library/Fonts/PingFang.ttc',
            ]
        else:  # Linux
            font_paths = [
                '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
            ]

        # 尝试加载每个字体
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    return ImageFont.truetype(font_path, font_size)
                except:
                    continue

        return ImageFont.load_default()

    def _draw_text_with_stroke(self, image: Image.Image, text: str, config: Dict[str, Any], img_width: int, img_height: int):
        """在图片上绘制带描边的文字"""
        if not text:
            return

        # 获取配置
        font_size = config.get('fontSize', 60)
        font_weight = config.get('fontWeight', 700)
        font_name = config.get('fontName', 'Microsoft YaHei')  # 从配置获取字体名称
        color = config.get('color', '#FFFFFF')
        stroke_color = config.get('strokeColor', '#000000')
        stroke_width = config.get('strokeWidth', 2)
        position = config.get('position', {'x': 50, 'y': 20})

        # 加载字体（使用改进的字体加载逻辑，支持自定义字体）
        font = self._load_font_safe(font_name, font_size, font_weight)

        # 计算文字位置
        text_x = int(position['x'] / 100 * img_width)
        text_y = int(position['y'] / 100 * img_height)

        # 创建绘图对象
        draw = ImageDraw.Draw(image)

        # 绘制描边（多次绘制以模拟描边效果）
        if stroke_width > 0:
            for adj_x in range(-stroke_width, stroke_width + 1):
                for adj_y in range(-stroke_width, stroke_width + 1):
                    if adj_x != 0 or adj_y != 0:
                        draw.text(
                            (text_x + adj_x, text_y + adj_y),
                            text,
                            font=font,
                            fill=stroke_color,
                            anchor='mm'
                        )

        # 绘制主文字
        draw.text(
            (text_x, text_y),
            text,
            font=font,
            fill=color,
            anchor='mm'
        )

    def generate_cover(self, video_path: str, output_path: str, cover_config: Dict[str, Any]) -> bool:
        """生成封面图片"""
        try:
            # 获取最佳帧时间点
            time_point = self.get_optimal_frame_time(
                video_path,
                cover_config.get('timePointType', 'random'),
                cover_config.get('customTimePoint', 10)
            )

            # 提取帧
            frame = self.extract_frame_at_time(video_path, time_point)
            if frame is None:
                self.logger.error("无法提取视频帧")
                return False

            # 转换为PIL图像
            image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

            # 应用特效
            effect_type = cover_config.get('effectType', 'none')
            if effect_type != 'none':
                image = self.apply_cover_effect(image, effect_type)

            # 添加文字
            text_overlay = cover_config.get('textOverlay', '').strip()
            if text_overlay:
                image = self.add_text_to_image(image, text_overlay, cover_config)

            # 保存图片
            quality = cover_config.get('quality', 95)
            image.save(output_path, 'JPEG', quality=quality)

            self.logger.info(f"封面生成成功: {output_path}")
            return True

        except Exception as e:
            self.logger.error(f"生成封面失败: {e}")
            return False

    def generate_subtitle_srt(self, text: str, video_duration: float) -> str:
        """生成字幕SRT文件内容"""
        try:
            # 使用jieba分词
            words = list(jieba.cut(text.strip()))

            # 计算字幕时长分布
            total_chars = len(text)
            if total_chars == 0:
                return ""

            # 平均每个字幕显示2-3秒
            avg_duration = min(3.0, max(2.0, video_duration / max(1, total_chars / 10)))

            srt_lines = []
            current_time = 1.0  # 从1秒开始

            for i, word in enumerate(words):
                if not word.strip():
                    continue

                start_time = current_time
                end_time = min(current_time + avg_duration, video_duration - 0.5)

                # 格式化时间 (HH:MM:SS,mmm)
                def format_time(seconds):
                    hours = int(seconds // 3600)
                    minutes = int((seconds % 3600) // 60)
                    secs = int(seconds % 60)
                    ms = int((seconds % 1) * 1000)
                    return "02d"

                start_str = format_time(start_time)
                end_str = format_time(end_time)

                srt_lines.append(f"{i+1}")
                srt_lines.append(f"{start_str} --> {end_str}")
                srt_lines.append(word)
                srt_lines.append("")  # 空行

                current_time = end_time

            return "\n".join(srt_lines)

        except Exception as e:
            self.logger.error(f"生成字幕SRT失败: {e}")
            return ""

    def add_subtitle_to_video(self, video_path: str, srt_path: str, output_path: str, subtitle_config: Dict[str, Any]) -> bool:
        """为视频添加字幕 - 简化的实现"""
        try:
            # 目前先复制原视频作为输出（字幕功能可以后续完善）
            # 实际项目中可以使用 ffmpeg 或其他视频处理库
            import shutil
            shutil.copy2(video_path, output_path)

            self.logger.info(f"视频复制成功 (字幕功能待完善): {output_path}")
            return True

        except Exception as e:
            self.logger.error(f"复制视频失败: {e}")
            return False

    def parse_srt_time(self, time_str: str) -> float:
        """解析SRT时间格式"""
        try:
            # 格式: 00:00:01,000
            parts = time_str.replace(',', ':').split(':')
            if len(parts) >= 3:
                hours = int(parts[0])
                minutes = int(parts[1])
                seconds = float(parts[2])
                return hours * 3600 + minutes * 60 + seconds
        except:
            pass
        return 0.0

    def process(self, progress_callback=None) -> Dict[str, Any]:
        """主处理流程"""
        try:
            # 检查是否使用自定义模板
            if self.config.get('customTemplate', False):
                return self._process_with_custom_template(progress_callback)

            model_config = self.config.get('modelConfig', {})
            video_path = model_config.get('video', '')

            if not video_path or not os.path.exists(video_path):
                return {
                    'code': -1,
                    'msg': f'视频文件不存在: {video_path}'
                }

            # 创建输出目录
            output_dir = os.path.dirname(video_path)
            base_name = os.path.splitext(os.path.basename(video_path))[0]

            # 更新进度: 初始化
            if progress_callback:
                progress_callback(0.1, "初始化处理...")

            # 获取字幕和封面配置
            subtitle_template = model_config.get('subtitleTemplate', 'classic')
            cover_template = model_config.get('coverTemplate', 'big-text')

            subtitle_style = self.get_subtitle_preset(subtitle_template)
            cover_style = self.get_cover_preset(cover_template)

            # 如果配置中有自定义样式，覆盖预设
            if 'subtitleStyle' in model_config:
                subtitle_style.update(model_config['subtitleStyle'])
            if 'coverStyle' in model_config:
                cover_style.update(model_config['coverStyle'])

            # 更新进度: 生成字幕
            if progress_callback:
                progress_callback(0.2, "生成字幕文件...")

            # 生成字幕SRT
            video_duration = self.get_video_duration(video_path)
            reference_text = model_config.get('referenceText', '')

            srt_content = self.generate_subtitle_srt(reference_text, video_duration)

            # 保存SRT文件
            srt_path = os.path.join(output_dir, f"{base_name}_subtitles.srt")
            with open(srt_path, 'w', encoding='utf-8') as f:
                f.write(srt_content)

            # 更新进度: 生成封面
            if progress_callback:
                progress_callback(0.5, "生成视频封面...")

            # 生成封面
            cover_path = os.path.join(output_dir, f"{base_name}_cover.jpg")
            cover_success = self.generate_cover(video_path, cover_path, cover_style)

            # 更新进度: 添加字幕到视频
            if progress_callback:
                progress_callback(0.7, "为视频添加字幕...")

            # 生成带字幕的视频
            video_with_subtitle_path = os.path.join(output_dir, f"{base_name}_with_subtitles.mp4")
            subtitle_success = self.add_subtitle_to_video(video_path, srt_path, video_with_subtitle_path, subtitle_style)

            # 更新进度: 完成
            if progress_callback:
                progress_callback(1.0, "处理完成")

            result = {
                'code': 0,
                'msg': '处理成功',
                'video': video_with_subtitle_path if subtitle_success else video_path,
                'cover': cover_path if cover_success else None,
                'srtPath': srt_path
            }

            return result

        except Exception as e:
            self.logger.error(f"处理失败: {e}")
            return {
                'code': -1,
                'msg': f'处理失败: {str(e)}'
            }

    def _process_with_custom_template(self, progress_callback=None) -> Dict[str, Any]:
        """使用自定义模板处理"""
        try:
            video_path = self.config.get('videoPath', '')
            template = self.config.get('template', {})

            if not video_path or not os.path.exists(video_path):
                return {
                    'code': -1,
                    'msg': f'视频文件不存在: {video_path}'
                }

            if not template:
                return {
                    'code': -1,
                    'msg': '缺少自定义模板配置'
                }

            # 创建输出目录
            output_dir = self.config.get('outputDir', os.path.dirname(video_path))
            if not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)

            base_name = os.path.splitext(os.path.basename(video_path))[0]

            # 更新进度: 初始化
            if progress_callback:
                progress_callback(0.1, "初始化自定义模板处理...")

            # 更新进度: 生成封面
            if progress_callback:
                progress_callback(0.5, "使用自定义模板生成封面...")

            # 生成封面
            cover_path = os.path.join(output_dir, f"{base_name}_custom_cover.jpg")
            cover_success = self.generate_cover_with_custom_template(video_path, cover_path, template)

            # 更新进度: 完成
            if progress_callback:
                progress_callback(1.0, "处理完成")

            result = {
                'success': cover_success,
                'coverPath': cover_path if cover_success else None,
                'message': '自定义模板处理成功' if cover_success else '自定义模板处理失败'
            }

            return result

        except Exception as e:
            self.logger.error(f"自定义模板处理失败: {e}")
            return {
                'success': False,
                'error': str(e),
                'message': f'自定义模板处理失败: {str(e)}'
            }


def main():
    """命令行入口"""
    if len(sys.argv) < 2:
        print("用法: python video_subtitle_cover_generator.py <config.json>")
        sys.exit(1)

    config_path = sys.argv[1]

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)

        generator = VideoSubtitleCoverGenerator(config)
        result = generator.process()

        # 输出JSON结果（单行，以便Node.js解析）
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'message': f'执行失败: {str(e)}'
        }, ensure_ascii=False))


if __name__ == "__main__":
    main()