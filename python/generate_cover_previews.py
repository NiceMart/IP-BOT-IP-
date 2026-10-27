#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成封面模板预览图
Generate Cover Template Previews
"""

import os
import sys
from subtitle_cover_generator_simple import SubtitleCoverGenerator

# 定义封面样式
COVER_STYLES = [
    'default',
    'blur-bg',
    'outline',
    'gradient',
    'split'
]

def generate_all_cover_previews():
    """生成所有封面模板的预览图"""

    # 使用项目中的demo视频
    video_path = r"C:\aigcpanel-main\demo\demo-1.mp4"

    if not os.path.exists(video_path):
        print(f"Error: Video file not found: {video_path}", file=sys.stderr)
        return False

    # 创建预览图存储目录
    preview_dir = r"C:\aigcpanel-main\public\cover-previews"
    os.makedirs(preview_dir, exist_ok=True)

    print(f"Generating cover previews from: {video_path}", file=sys.stderr)
    print(f"Output directory: {preview_dir}", file=sys.stderr)

    # 为每个样式生成封面预览
    for style in COVER_STYLES:
        try:
            print(f"\nGenerating preview for style: {style}", file=sys.stderr)

            # 创建配置
            config = {
                'videoPath': video_path,
                'scriptText': '欢迎来到我们的精彩世界！这里有无限的可能性和创意。让我们一起探索未知的领域，发现更多的美好事物。',  # 使用更长的演示文本
                'subtitleStyle': 'default',
                'coverStyle': style,
                'outputDir': preview_dir,
                'coverOnly': True  # 仅生成封面
            }

            # 创建生成器并生成封面
            generator = SubtitleCoverGenerator(config)
            cover_path = generator.generate_cover()

            # 重命名为样式名称
            style_preview_path = os.path.join(preview_dir, f'cover-preview-{style}.png')
            if os.path.exists(cover_path):
                # 如果目标文件已存在，先删除
                if os.path.exists(style_preview_path):
                    os.remove(style_preview_path)
                os.rename(cover_path, style_preview_path)
                print(f"✓ Generated: {style_preview_path}", file=sys.stderr)
            else:
                print(f"✗ Failed to generate: {style}", file=sys.stderr)

        except Exception as e:
            print(f"✗ Error generating {style}: {e}", file=sys.stderr)
            continue

    print("\n" + "=" * 60, file=sys.stderr)
    print("Cover preview generation completed!", file=sys.stderr)
    print(f"Preview images saved to: {preview_dir}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    return True

if __name__ == '__main__':
    success = generate_all_cover_previews()
    sys.exit(0 if success else 1)
