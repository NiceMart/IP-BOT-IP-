#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字幕封面生成器 - 一键生成视频字幕和封面
Subtitle & Cover Generator for AIGC Panel
"""

import os
import sys
import json
import argparse
from typing import Dict, List, Any, Tuple
from pathlib import Path

# 导入必要的库
try:
    import cv2
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps
    from rembg import remove
except ImportError as e:
    print(f"Error: Missing required library - {e}", file=sys.stderr)
    sys.exit(1)


class SubtitleCoverGenerator:
    """字幕封面生成器主类"""

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

        # 新增配置参数
        self.is_portrait = config.get('isPortrait', False)  # 是否为竖屏视频
        self.cover_text = config.get('coverText', '')  # 封面文字
        self.cover_text_position = config.get('coverTextPosition', 'bottom')  # 文字位置: top, center, bottom
        self.cover_text_color = config.get('coverTextColor', '#FFFFFF')  # 文字颜色
        self.cover_text_size = config.get('coverTextSize', 50)  # 文字大小
        self.outline_color = config.get('outlineColor', '#FFD700')  # 描边颜色
        self.outline_width = config.get('outlineWidth', 3)  # 描边宽度
        self.blur_radius = config.get('blurRadius', 15)  # 背景模糊度
        self.zoom_level = config.get('zoomLevel', 1.0)  # 封面放大倍数

        # 确保输出目录存在
        os.makedirs(self.output_dir, exist_ok=True)

    def get_video_info(self) -> Dict[str, Any]:
        """
        获取视频信息

        Returns:
            包含视频宽度、高度、时长等信息的字典
        """
        try:
            cap = cv2.VideoCapture(self.video_path)
            if not cap.isOpened():
                raise Exception("Could not open video file")

            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = frame_count / fps if fps > 0 else 0

            cap.release()

            # 检测是否为竖屏视频
            is_portrait = height > width

            return {
                'width': width,
                'height': height,
                'fps': fps,
                'duration': duration,
                'is_portrait': is_portrait
            }
        except Exception as e:
            raise Exception(f"Error getting video info: {str(e)}")

    def extract_frame(self, timestamp: float = 1.0) -> np.ndarray:
        """
        从视频中提取关键帧

        Args:
            timestamp: 提取帧的时间戳（秒）

        Returns:
            提取的帧（numpy数组）
        """
        try:
            cap = cv2.VideoCapture(self.video_path)

            # 设置到指定时间戳
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_number = int(timestamp * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)

            ret, frame = cap.read()
            cap.release()

            if not ret:
                raise Exception("Failed to extract frame from video")

            return frame
        except Exception as e:
            raise Exception(f"Error extracting frame: {str(e)}")

    def remove_background(self, image: np.ndarray) -> Image.Image:
        """
        使用rembg进行人物抠图

        Args:
            image: 输入图像（numpy数组）

        Returns:
            抠图后的PIL Image对象（带透明通道）
        """
        try:
            # 转换为PIL Image
            pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

            # 使用rembg移除背景
            output = remove(pil_image)

            return output
        except Exception as e:
            raise Exception(f"Error removing background: {str(e)}")

    def generate_cover(self) -> str:
        """
        生成视频封面

        Returns:
            生成的封面图片路径
        """
        try:
            # 获取视频信息
            video_info = self.get_video_info()
            self.is_portrait = video_info['is_portrait']

            # 提取关键帧
            frame = self.extract_frame(1.0)

            if self.cover_style == 'default':
                # 默认封面：直接使用提取的帧
                cover_path = os.path.join(self.output_dir, 'cover.png')
                cv2.imwrite(cover_path, frame)

            elif self.cover_style == 'blur-bg':
                # 背景虚化效果
                cover_path = self._generate_blur_cover(frame)

            elif self.cover_style == 'outline':
                # 人物描边效果
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

            # 如果需要放大封面
            if self.zoom_level != 1.0:
                cover_path = self._zoom_cover(cover_path)

            # 如果有文字需要添加
            if self.cover_text.strip():
                cover_path = self._add_text_to_cover(cover_path)

            return cover_path
        except Exception as e:
            raise Exception(f"Error generating cover: {str(e)}")

    def _zoom_cover(self, cover_path: str) -> str:
        """放大封面"""
        try:
            image = Image.open(cover_path)

            # 计算新的尺寸
            new_width = int(image.width * self.zoom_level)
            new_height = int(image.height * self.zoom_level)

            # 放大图像
            zoomed = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # 如果是竖屏视频，需要裁剪中心区域
            if self.is_portrait:
                # 裁剪为原始尺寸的正方形区域
                left = (zoomed.width - image.width) // 2
                top = (zoomed.height - image.height) // 2
                right = left + image.width
                bottom = top + image.height
                zoomed = zoomed.crop((left, top, right, bottom))
            else:
                # 横屏视频裁剪中心区域
                left = (zoomed.width - image.width) // 2
                top = (zoomed.height - image.height) // 2
                right = left + image.width
                bottom = top + image.height
                zoomed = zoomed.crop((left, top, right, bottom))

            # 保存放大后的封面
            zoom_path = os.path.join(self.output_dir, 'cover_zoomed.png')
            zoomed.save(zoom_path, quality=95)

            return zoom_path
        except Exception as e:
            print(f"Warning: Could not zoom cover: {e}", file=sys.stderr)
            return cover_path

    def _add_text_to_cover(self, cover_path: str) -> str:
        """添加文字到封面"""
        try:
            image = Image.open(cover_path)
            draw = ImageDraw.Draw(image)

            # 尝试加载字体，如果失败则使用默认字体
            try:
                font = ImageFont.truetype("arial.ttf", self.cover_text_size)
            except:
                try:
                    font = ImageFont.truetype("DejaVuSans-Bold.ttf", self.cover_text_size)
                except:
                    font = ImageFont.load_default()

            # 计算文字位置
            bbox = draw.textbbox((0, 0), self.cover_text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]

            if self.cover_text_position == 'top':
                x = (image.width - text_width) // 2
                y = 50
            elif self.cover_text_position == 'center':
                x = (image.width - text_width) // 2
                y = (image.height - text_height) // 2
            else:  # bottom
                x = (image.width - text_width) // 2
                y = image.height - text_height - 50

            # 添加描边效果
            if self.outline_width > 0:
                # 创建描边
                outline_color = self._hex_to_rgb(self.outline_color)
                for offset_x in range(-self.outline_width, self.outline_width + 1):
                    for offset_y in range(-self.outline_width, self.outline_width + 1):
                        if offset_x == 0 and offset_y == 0:
                            continue
                        draw.text((x + offset_x, y + offset_y), self.cover_text, fill=outline_color, font=font)

            # 添加文字
            text_color = self._hex_to_rgb(self.cover_text_color)
            draw.text((x, y), self.cover_text, fill=text_color, font=font)

            # 保存带文字的封面
            text_path = os.path.join(self.output_dir, 'cover_with_text.png')
            image.save(text_path, quality=95)

            return text_path
        except Exception as e:
            print(f"Warning: Could not add text to cover: {e}", file=sys.stderr)
            return cover_path

    def _hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int]:
        """将十六进制颜色转换为RGB元组"""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

    def _generate_blur_cover(self, frame: np.ndarray) -> str:
        """生成背景虚化封面"""
        # 转换为PIL
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        # 抠出人物
        person = self.remove_background(frame)

        # 背景虚化（使用配置的模糊度）
        background = image.filter(ImageFilter.GaussianBlur(radius=self.blur_radius))

        # 合成
        background.paste(person, (0, 0), person)

        # 保存
        cover_path = os.path.join(self.output_dir, 'cover_blur.png')
        background.save(cover_path, quality=95)

        return cover_path

    def _generate_outline_cover(self, frame: np.ndarray) -> str:
        """生成人物描边封面"""
        # 转换为PIL
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        # 抠出人物
        person = self.remove_background(frame)

        # 创建描边效果
        # 将person转为numpy进行描边处理
        person_np = np.array(person)
        alpha = person_np[:, :, 3]

        # 使用形态学操作创建描边
        kernel = np.ones((self.outline_width * 2 + 1, self.outline_width * 2 + 1), np.uint8)
        dilated = cv2.dilate(alpha, kernel, iterations=1)
        outline = dilated - alpha

        # 创建描边图层
        outline_layer = Image.new('RGBA', person.size, (0, 0, 0, 0))
        outline_draw = ImageDraw.Draw(outline_layer)

        # 获取描边颜色
        outline_color = self._hex_to_rgb(self.outline_color)

        # 应用描边
        for y in range(outline.shape[0]):
            for x in range(outline.shape[1]):
                if outline[y, x] > 0:
                    outline_layer.putpixel((x, y), outline_color + (255,))

        # 合成
        result = Image.new('RGBA', image.size)
        result.paste(image, (0, 0))
        result.paste(outline_layer, (0, 0), outline_layer)
        result.paste(person, (0, 0), person)

        # 保存
        cover_path = os.path.join(self.output_dir, 'cover_outline.png')
        result.save(cover_path, quality=95)

        return cover_path

    def _generate_gradient_cover(self, frame: np.ndarray) -> str:
        """生成渐变背景封面"""
        # 转换为PIL
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        # 抠出人物
        person = self.remove_background(frame)

        # 创建渐变背景
        width, height = image.size
        gradient = Image.new('RGB', (width, height), color=(0, 0, 0))
        draw = ImageDraw.Draw(gradient)

        # 绘制渐变
        for y in range(height):
            r = int(103 + (118 - 103) * y / height)
            g = int(126 + (74 - 126) * y / height)
            b = int(234 + (162 - 234) * y / height)
            draw.line([(0, y), (width, y)], fill=(r, g, b))

        # 合成
        gradient.paste(person, (0, 0), person)

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

        # 保存
        cover_path = os.path.join(self.output_dir, 'cover_split.png')
        background.save(cover_path, quality=95)

        return cover_path

    def generate_subtitles(self) -> List[Dict[str, Any]]:
        """
        生成字幕列表

        Returns:
            字幕列表，每个字幕包含文本、开始时间、结束时间
        """
        try:
            # 将文案按行分割
            lines = [line.strip() for line in self.script_text.split('\n') if line.strip()]

            # 生成字幕列表（简单示例，每句3秒）
            subtitles = []
            for i, line in enumerate(lines):
                subtitle = {
                    'index': i + 1,
                    'text': line,
                    'start_time': i * 3.0,
                    'end_time': (i + 1) * 3.0,
                    'style': self.subtitle_style
                }
                subtitles.append(subtitle)

            return subtitles
        except Exception as e:
            raise Exception(f"Error generating subtitles: {str(e)}")

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

    def generate_all(self) -> Dict[str, Any]:
        """
        一键生成所有内容

        Returns:
            包含生成结果的字典
        """
        try:
            # 生成封面
            print("Generating cover...", file=sys.stderr)
            cover_path = self.generate_cover()

            # 生成字幕
            print("Generating subtitles...", file=sys.stderr)
            subtitles = self.generate_subtitles()
            srt_path = self.save_srt(subtitles)

            result = {
                'success': True,
                'coverPath': cover_path,
                'srtPath': srt_path,
                'subtitles': subtitles,
                'message': 'Generated successfully'
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
    parser = argparse.ArgumentParser(description='Subtitle & Cover Generator')
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
