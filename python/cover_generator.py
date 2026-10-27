#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
视频封面生成器
支持从视频提取帧并添加标题文字
"""

import argparse
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import cv2

# ⚠️ 修复模块路径：确保 Python 能找到 modules 和其他本地模块
# 将脚本所在目录（python 目录）添加到 sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)
    print(f"[PATH] Added to sys.path: {script_dir}", file=sys.stderr)

def extract_frame_from_video(video_path, timestamp=0):
    """从视频中提取指定时间的帧"""
    try:
        cap = cv2.VideoCapture(video_path)
        
        # 设置到指定时间（秒）
        cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
        
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            return None
            
        # 转换BGR到RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return Image.fromarray(frame_rgb)
        
    except Exception as e:
        print(f"Error extracting frame: {e}", file=sys.stderr)
        return None

def hex_to_rgb(hex_color):
    """将十六进制颜色转换为RGB元组"""
    if isinstance(hex_color, str):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    return tuple(hex_color)

def add_text_to_image(img, title, config):
    """在图像上添加标题文字"""
    pil_img = img.copy().convert('RGBA')

    width, height = pil_img.size

    # 获取配置参数 - 支持新格式（来自前端的配置）
    # 新格式：titleFontSize, titleColor, titleFontFamily, titlePosition, titleStrokeWidth, titleStrokeColor
    # 旧格式：fontSize, fontColor, fontPath, position, style

    font_size = config.get('titleFontSize', config.get('fontSize', int(height * 0.08)))

    # 处理颜色格式：新格式是十六进制字符串（如 "#eb1414"），旧格式是RGB元组
    title_color = config.get('titleColor', config.get('fontColor', '#FFFFFF'))
    font_color = hex_to_rgb(title_color)

    # 阴影参数
    shadow_color = hex_to_rgb(config.get('titleShadowColor', '#000000'))
    shadow_offset_x = config.get('titleShadowOffsetX', 0)
    shadow_offset_y = config.get('titleShadowOffsetY', 0)
    shadow_blur_raw = config.get('titleShadowBlur', 0)
    # 修复：PIL的GaussianBlur效果比CSS重，需要缩小系数以匹配前端预览
    # 经验值：CSS box-shadow blur 与 PIL GaussianBlur 的比例约为 2.5:1
    shadow_blur = int(shadow_blur_raw * 0.4) if shadow_blur_raw > 0 else 0

    # 描边参数
    stroke_width = config.get('titleStrokeWidth', 0)
    stroke_color = hex_to_rgb(config.get('titleStrokeColor', '#000000'))

    print(f"[DEBUG] Text rendering params: stroke_width={stroke_width}, stroke_color={stroke_color}", file=sys.stderr)

    font_family = config.get('titleFontFamily', config.get('fontPath', 'SimHei'))

    # 使用 font_manager 查找字体（支持系统字体和ziti目录字体）
    font_path = None
    try:
        from modules.font_manager import get_font_manager
        font_manager = get_font_manager()
        font_path = font_manager.find_font(font_family, 400)
        if font_path:
            print(f"[DEBUG] Font found via font_manager: {font_family} -> {font_path}", file=sys.stderr)
        else:
            print(f"[DEBUG] Font not found via font_manager: {font_family}, using fallback", file=sys.stderr)
    except Exception as e:
        print(f"[DEBUG] font_manager not available: {e}, using hardcoded fonts", file=sys.stderr)

    # 回退到硬编码字体路径
    if not font_path:
        if font_family == 'SimHei':
            font_path = 'C:\\Windows\\Fonts\\simhei.ttf'
        elif font_family == 'SimSun':
            font_path = 'C:\\Windows\\Fonts\\simsun.ttc'
        elif font_family == 'Microsoft YaHei':
            font_path = 'C:\\Windows\\Fonts\\msyh.ttc'
        else:
            font_path = config.get('fontPath', 'C:\\Windows\\Fonts\\msyh.ttc')
        print(f"[DEBUG] Using hardcoded font path: {font_path}", file=sys.stderr)

    # 位置：新格式是百分比坐标 {x, y}，旧格式是 'top', 'center', 'bottom'
    title_position = config.get('titlePosition', {})
    if isinstance(title_position, dict):
        position = 'custom'
    else:
        position = config.get('position', 'top')  # top, center, bottom

    style = config.get('style', 'default')  # default, outline, blur_bg, gradient, split
    
    # 加载字体
    try:
        font = ImageFont.truetype(font_path, font_size)
    except:
        font = ImageFont.load_default()
    
    # 创建绘图对象
    draw = ImageDraw.Draw(pil_img)
    
    # 计算文字尺寸
    bbox = draw.textbbox((0, 0), title, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # 计算文字位置
    if position == 'custom' and isinstance(title_position, dict):
        # 使用自定义位置（百分比）
        x = int(width * title_position.get('x', 50) / 100) - text_width // 2
        y = int(height * title_position.get('y', 80) / 100) - text_height // 2
    else:
        x = (width - text_width) // 2
        if position == 'top':
            y = int(height * 0.08)
        elif position == 'center':
            y = (height - text_height) // 2
        elif position == 'bottom':
            y = int(height * 0.85) - text_height
        else:
            y = int(height * 0.08)
    
    # 辅助函数：绘制带阴影和描边的文字
    def draw_text_with_effects(draw_obj, pos_x, pos_y, text, font, color, stroke_w, stroke_c, shadow_ox, shadow_oy, shadow_b, shadow_c):
        """绘制带阴影和描边的文字"""
        # 1. 先绘制阴影（如果有偏移）
        if shadow_ox != 0 or shadow_oy != 0:
            if shadow_b > 0:
                # 创建阴影图层并模糊
                shadow_layer = Image.new('RGBA', pil_img.size, (0, 0, 0, 0))
                shadow_draw = ImageDraw.Draw(shadow_layer)
                shadow_draw.text((pos_x + shadow_ox, pos_y + shadow_oy), text, font=font, fill=shadow_c + (180,))
                shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=shadow_b))
                return shadow_layer
            else:
                draw_obj.text((pos_x + shadow_ox, pos_y + shadow_oy), text, font=font, fill=shadow_c + (180,))

        # 2. 绘制描边
        if stroke_w > 0:
            for adj_x in range(-stroke_w, stroke_w + 1):
                for adj_y in range(-stroke_w, stroke_w + 1):
                    if adj_x != 0 or adj_y != 0:
                        draw_obj.text((pos_x + adj_x, pos_y + adj_y), text, font=font, fill=stroke_c + (255,))

        # 3. 绘制主文字
        draw_obj.text((pos_x, pos_y), text, font=font, fill=color + (255,))
        return None

    # 应用样式
    if style == 'default':
        # 默认风格：黑色半透明背景条
        padding = 30
        overlay = Image.new('RGBA', pil_img.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        overlay_draw.rectangle(
            [x - padding, y - padding, x + text_width + padding, y + text_height + padding],
            fill=(0, 0, 0, 180)
        )
        pil_img = Image.alpha_composite(pil_img, overlay)
        draw = ImageDraw.Draw(pil_img)

        # 绘制阴影
        if shadow_offset_x != 0 or shadow_offset_y != 0:
            if shadow_blur > 0:
                shadow_layer = Image.new('RGBA', pil_img.size, (0, 0, 0, 0))
                shadow_draw = ImageDraw.Draw(shadow_layer)
                shadow_draw.text((x + shadow_offset_x, y + shadow_offset_y), title, font=font, fill=shadow_color + (180,))
                shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=shadow_blur))
                pil_img = Image.alpha_composite(pil_img, shadow_layer)
                draw = ImageDraw.Draw(pil_img)
            else:
                draw.text((x + shadow_offset_x, y + shadow_offset_y), title, font=font, fill=shadow_color + (180,))

        # 绘制描边
        if stroke_width > 0:
            print(f"[DEBUG] Drawing text stroke: width={stroke_width}, color={stroke_color}", file=sys.stderr)
            for adj_x in range(-stroke_width, stroke_width + 1):
                for adj_y in range(-stroke_width, stroke_width + 1):
                    if adj_x != 0 or adj_y != 0:
                        draw.text((x + adj_x, y + adj_y), title, font=font, fill=stroke_color + (255,))
        else:
            print(f"[DEBUG] Stroke disabled: stroke_width={stroke_width}", file=sys.stderr)

        draw.text((x, y), title, font=font, fill=font_color + (255,))

    elif style == 'outline':
        # 描边风格
        # 绘制阴影
        if shadow_offset_x != 0 or shadow_offset_y != 0:
            if shadow_blur > 0:
                shadow_layer = Image.new('RGBA', pil_img.size, (0, 0, 0, 0))
                shadow_draw = ImageDraw.Draw(shadow_layer)
                shadow_draw.text((x + shadow_offset_x, y + shadow_offset_y), title, font=font, fill=shadow_color + (180,))
                shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=shadow_blur))
                pil_img = Image.alpha_composite(pil_img, shadow_layer)
                draw = ImageDraw.Draw(pil_img)
            else:
                draw.text((x + shadow_offset_x, y + shadow_offset_y), title, font=font, fill=shadow_color + (180,))

        outline_width = stroke_width if stroke_width > 0 else 3
        outline_color = stroke_color
        for adj_x in range(-outline_width, outline_width + 1):
            for adj_y in range(-outline_width, outline_width + 1):
                draw.text((x + adj_x, y + adj_y), title, font=font, fill=outline_color + (255,))
        draw.text((x, y), title, font=font, fill=font_color + (255,))
        
    elif style == 'blur_bg':
        # 模糊背景风格
        padding = 50
        bg_region = pil_img.crop((
            max(0, x - padding),
            max(0, y - padding),
            min(width, x + text_width + padding),
            min(height, y + text_height + padding)
        ))
        bg_region = bg_region.filter(ImageFilter.GaussianBlur(radius=15))
        pil_img.paste(bg_region, (max(0, x - padding), max(0, y - padding)))
        
        # 添加半透明遮罩
        overlay = Image.new('RGBA', pil_img.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        overlay_draw.rectangle(
            [x - padding, y - padding, x + text_width + padding, y + text_height + padding],
            fill=(0, 0, 0, 120)
        )
        pil_img = Image.alpha_composite(pil_img, overlay)
        draw = ImageDraw.Draw(pil_img)
        draw.text((x, y), title, font=font, fill=font_color + (255,))
        
    elif style == 'gradient':
        # 渐变背景风格
        gradient_height = text_height + 100
        gradient = Image.new('RGBA', (width, gradient_height), (0, 0, 0, 0))
        gradient_draw = ImageDraw.Draw(gradient)
        for i in range(gradient_height):
            alpha = int(200 * (i / gradient_height))
            gradient_draw.rectangle([0, i, width, i + 1], fill=(0, 0, 0, alpha))
        
        pil_img.paste(gradient, (0, max(0, y - 50)), gradient)
        draw = ImageDraw.Draw(pil_img)
        draw.text((x, y), title, font=font, fill=font_color + (255,))
        
    elif style == 'split':
        # 分栏风格
        padding = 40
        left_x = padding
        
        # 左侧标题背景
        overlay = Image.new('RGBA', pil_img.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        overlay_draw.rectangle(
            [left_x - 20, y - 20, left_x + text_width + 20, y + text_height + 20],
            fill=(0, 0, 0, 180)
        )
        pil_img = Image.alpha_composite(pil_img, overlay)
        draw = ImageDraw.Draw(pil_img)
        draw.text((left_x, y), title, font=font, fill=font_color + (255,))
        
        # 右侧装饰
        accent_text = config.get('accentText', '✨')
        accent_bbox = draw.textbbox((0, 0), accent_text, font=font)
        accent_width = accent_bbox[2] - accent_bbox[0]
        right_x = width - accent_width - padding
        
        overlay = Image.new('RGBA', pil_img.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        overlay_draw.rectangle(
            [right_x - 25, y - 25, right_x + accent_width + 25, y + text_height + 25],
            fill=(255, 193, 7, 200)
        )
        pil_img = Image.alpha_composite(pil_img, overlay)
        draw = ImageDraw.Draw(pil_img)
        draw.text((right_x, y), accent_text, font=font, fill=(0, 0, 0, 255))
    
    return pil_img.convert('RGB')

def main():
    parser = argparse.ArgumentParser(description='Generate video cover with title')
    parser.add_argument('--video', required=True, help='Path to video file')
    parser.add_argument('--title', required=True, help='Title text')
    parser.add_argument('--output', required=True, help='Output image path')
    parser.add_argument('--config', default='{}', help='JSON configuration')
    parser.add_argument('--preview', action='store_true', help='Preview mode')
    parser.add_argument('--timestamp', type=float, default=0, help='Frame timestamp in seconds')
    
    args = parser.parse_args()
    
    try:
        # 解析配置
        config = json.loads(args.config)

        # 诊断日志：输出接收到的配置参数
        print(f"[DEBUG] Received config: {json.dumps(config, indent=2, ensure_ascii=False)}", file=sys.stderr)
        print(f"[DEBUG] titleStrokeWidth: {config.get('titleStrokeWidth', 'NOT SET')}", file=sys.stderr)
        print(f"[DEBUG] titleStrokeColor: {config.get('titleStrokeColor', 'NOT SET')}", file=sys.stderr)
        print(f"[DEBUG] titleFontFamily: {config.get('titleFontFamily', 'NOT SET')}", file=sys.stderr)

        # 检查输入是图像还是视频
        video_path = args.video
        if video_path.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.webp')):
            # 直接加载图像
            print(f"Loading image: {video_path}")
            try:
                frame = Image.open(video_path)
            except Exception as e:
                print(f"Error: Failed to load image: {e}", file=sys.stderr)
                sys.exit(1)
        else:
            # 提取视频帧
            print(f"Extracting frame from video: {video_path}")
            frame = extract_frame_from_video(video_path, args.timestamp)

            if frame is None:
                print("Error: Failed to extract frame from video", file=sys.stderr)
                sys.exit(1)
        
        # 调整图片大小
        width, height = frame.size
        max_width = config.get('maxWidth', 1920)
        if width > max_width:
            scale = max_width / width
            new_width = max_width
            new_height = int(height * scale)
            frame = frame.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # 添加标题
        print(f"Adding title: {args.title}")
        result = add_text_to_image(frame, args.title, config)
        
        # 保存结果
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        result.save(args.output, quality=95)
        print(f"Cover saved to: {args.output}")
        
        sys.exit(0)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()