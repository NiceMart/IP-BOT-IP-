#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
为图片生成5种字幕封面风格
"""
from PIL import Image, ImageDraw, ImageFont
import os

def add_text_with_style(img, title, style_name, font_path):
    """在图像上添加指定风格的标题文字"""
    pil_img = img.copy()
    draw = ImageDraw.Draw(pil_img)

    width, height = pil_img.size

    # 设置字体大小
    font_size = int(height * 0.12)
    try:
        font = ImageFont.truetype(font_path, font_size)
    except:
        font = ImageFont.load_default()

    # 计算标题位置（顶部居中）
    bbox = draw.textbbox((0, 0), title, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) // 2
    y = int(height * 0.08)  # 距离顶部8%的位置

    if style_name == "default":
        # 默认风格：黑色背景条 + 白色文字
        padding = 30
        draw.rectangle(
            [x - padding, y - padding, x + text_width + padding, y + text_height + padding],
            fill=(0, 0, 0, 200)
        )
        draw.text((x, y), title, font=font, fill=(255, 255, 255))

    elif style_name == "blur_bg":
        # 模糊背景风格
        bg_region = pil_img.crop((x - 50, y - 50, x + text_width + 50, y + text_height + 50))
        bg_region = bg_region.filter(Image.BLUR)
        pil_img.paste(bg_region, (x - 50, y - 50))
        draw = ImageDraw.Draw(pil_img)

        # 添加半透明黑色遮罩
        overlay = Image.new('RGBA', pil_img.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        overlay_draw.rectangle([x - 50, y - 50, x + text_width + 50, y + text_height + 50], fill=(0, 0, 0, 150))
        pil_img = Image.alpha_composite(pil_img.convert('RGBA'), overlay).convert('RGB')
        draw = ImageDraw.Draw(pil_img)

        draw.text((x, y), title, font=font, fill=(255, 255, 255))

    elif style_name == "outline":
        # 描边风格：白色文字 + 黑色描边
        outline_width = 4
        for adj_x in range(-outline_width, outline_width + 1):
            for adj_y in range(-outline_width, outline_width + 1):
                draw.text((x + adj_x, y + adj_y), title, font=font, fill=(0, 0, 0))
        draw.text((x, y), title, font=font, fill=(255, 255, 255))

    elif style_name == "gradient":
        # 渐变背景风格
        gradient_height = text_height + 100
        gradient = Image.new('RGBA', (width, gradient_height), (0, 0, 0, 0))
        gradient_draw = ImageDraw.Draw(gradient)
        for i in range(gradient_height):
            alpha = int(250 * (i / gradient_height))
            gradient_draw.rectangle([0, i, width, i + 1], fill=(0, 0, 0, alpha))

        pil_img_rgba = pil_img.convert('RGBA')
        pil_img_rgba.paste(gradient, (0, y - 50), gradient)
        pil_img = pil_img_rgba.convert('RGB')
        draw = ImageDraw.Draw(pil_img)

        draw.text((x, y), title, font=font, fill=(255, 255, 255))

    elif style_name == "split":
        # 分栏风格：左侧标题 + 右侧装饰
        padding = 40

        # 左侧标题
        left_x = padding
        draw.rectangle(
            [left_x - 20, y - 20, left_x + text_width + 20, y + text_height + 20],
            fill=(0, 0, 0, 180)
        )
        draw.text((left_x, y), title, font=font, fill=(255, 255, 255))

        # 右侧装饰元素
        right_text = "✨ 精彩"
        right_bbox = draw.textbbox((0, 0), right_text, font=font)
        right_width = right_bbox[2] - right_bbox[0]
        right_x = width - right_width - padding
        draw.rectangle(
            [right_x - 25, y - 25, right_x + right_width + 25, y + text_height + 25],
            fill=(255, 193, 7, 200)  # 金黄色背景
        )
        draw.text((right_x, y), right_text, font=font, fill=(0, 0, 0))

    return pil_img

def main():
    # 输入图片路径
    image_path = r"C:\aigcpanel-main\微信图片_20251125215233_633_235.jpg"
    title = "我是个美女啊啊啊"

    # 输出目录
    output_dir = r"C:\aigcpanel-main\public\cover-previews"
    os.makedirs(output_dir, exist_ok=True)

    # 字体路径
    font_path = r"C:\Windows\Fonts\msyh.ttc"  # 微软雅黑

    # 读取图片
    print("正在读取图片...")
    try:
        img = Image.open(image_path)
        print(f"图片尺寸：{img.size}")
    except Exception as e:
        print(f"❌ 无法读取图片: {e}")
        return

    # 调整图片大小以便预览
    width, height = img.size
    if width > 1280:
        scale = 1280 / width
        new_width = 1280
        new_height = int(height * scale)
        img = img.resize((new_width, new_height))
        print(f"调整图片尺寸为：{img.size}")

    # 定义5种风格
    styles = [
        ("default", "默认风格：黑色半透明背景条"),
        ("blur_bg", "模糊背景风格：背景模糊效果"),
        ("outline", "描边风格：文字带黑色描边"),
        ("gradient", "渐变背景风格：渐变半透明遮罩"),
        ("split", "分栏风格：标题+装饰元素")
    ]

    # 生成每种风格的封面
    for style_name, description in styles:
        print(f"生成 {style_name} 风格封面：{description}")

        # 复制原始图片
        styled_img = img.copy()

        # 应用风格
        styled_img = add_text_with_style(styled_img, title, style_name, font_path)

        # 保存封面
        output_path = os.path.join(output_dir, f"cover-title-{style_name}.png")
        styled_img.save(output_path)
        print(f"✅ 已保存：{output_path}")

    print("\n" + "="*60)
    print("🎉 所有封面生成完成！")
    print(f"📁 保存位置：{output_dir}")
    print("="*60)
    print(f"\n标题：{title}")
    print("\n封面列表：")
    for style_name, description in styles:
        print(f"  • cover-title-{style_name}.png - {description}")

if __name__ == "__main__":
    main()