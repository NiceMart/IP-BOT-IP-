#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
实时封面预览生成器
Generate Real-time Cover Previews
"""

import os
import sys
import json
import hashlib
import tempfile
from pathlib import Path
from typing import Dict, List, Any, Optional
import subprocess
import threading
import time

# 导入封面生成器
from subtitle_cover_generator_simple import SubtitleCoverGenerator

class CoverPreviewGenerator:
    """实时封面预览生成器"""

    def __init__(self):
        self.temp_dir = os.path.join(tempfile.gettempdir(), 'cover_previews')
        os.makedirs(self.temp_dir, exist_ok=True)

        # 缓存已生成的预览，避免重复生成
        self.preview_cache = {}

        # 定义封面样式
        self.COVER_STYLES = [
            'default',
            'blur-bg',
            'outline',
            'gradient',
            'split'
        ]

    def get_video_hash(self, video_path: str) -> str:
        """获取视频文件的哈希值用于缓存"""
        hash_md5 = hashlib.md5()
        with open(video_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()[:16]

    def extract_first_frame(self, video_path: str, output_path: str) -> bool:
        """从视频中提取第一帧"""
        try:
            # 使用ffmpeg提取第一帧
            cmd = [
                'ffmpeg', '-i', video_path,
                '-vf', 'select=eq(n\\,0)',  # 选择第一帧
                '-q:v', '2',  # 高质量
                '-f', 'image2',
                '-y',  # 覆盖输出
                output_path
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return result.returncode == 0 and os.path.exists(output_path)

        except Exception as e:
            print(f"Error extracting frame: {e}", file=sys.stderr)
            return False

    def generate_preview(self, video_path: str, style: str, output_path: str) -> bool:
        """生成单个样式的封面预览"""
        try:
            # 创建临时帧文件
            frame_path = os.path.join(self.temp_dir, f"frame_{os.path.basename(video_path)}.jpg")

            # 提取第一帧
            if not self.extract_first_frame(video_path, frame_path):
                print(f"Failed to extract frame from {video_path}", file=sys.stderr)
                return False

            # 使用封面生成器创建预览
            config = {
                'videoPath': video_path,  # 保持原视频路径，用于可能的其他处理
                'scriptText': '实时预览封面效果',  # 简短预览文本
                'subtitleStyle': 'default',
                'coverStyle': style,
                'outputDir': os.path.dirname(output_path),
                'coverOnly': True,
                'useExtractedFrame': True,  # 使用已提取的帧
                'extractedFramePath': frame_path
            }

            generator = SubtitleCoverGenerator(config)
            cover_path = generator.generate_cover()

            if cover_path and os.path.exists(cover_path):
                # 移动到最终位置
                os.rename(cover_path, output_path)
                print(f"Generated preview: {output_path}", file=sys.stderr)
                return True
            else:
                print(f"Failed to generate cover for style: {style}", file=sys.stderr)
                return False

        except Exception as e:
            print(f"Error generating preview for {style}: {e}", file=sys.stderr)
            return False
        finally:
            # 清理临时文件
            if os.path.exists(frame_path):
                try:
                    os.remove(frame_path)
                except:
                    pass

    def generate_all_previews(self, video_path: str) -> Dict[str, Any]:
        """生成所有样式的预览"""
        if not os.path.exists(video_path):
            return {"error": f"Video file not found: {video_path}"}

        video_hash = self.get_video_hash(video_path)

        # 检查缓存
        if video_hash in self.preview_cache:
            print(f"Using cached previews for {video_hash}", file=sys.stderr)
            return self.preview_cache[video_hash]

        previews = []
        errors = []

        print(f"Generating {len(self.COVER_STYLES)} previews for: {video_path}", file=sys.stderr)

        # 并行生成所有预览
        threads = []
        results = {}

        def generate_single_preview(style):
            output_path = os.path.join(self.temp_dir, f"preview_{video_hash}_{style}.png")
            success = self.generate_preview(video_path, style, output_path)
            results[style] = {
                'style': style,
                'path': output_path if success else None,
                'success': success
            }

        # 启动所有预览生成线程
        for style in self.COVER_STYLES:
            thread = threading.Thread(target=generate_single_preview, args=(style,))
            thread.start()
            threads.append(thread)

        # 等待所有线程完成
        for thread in threads:
            thread.join()

        # 整理结果
        for style in self.COVER_STYLES:
            result = results.get(style, {})
            if result.get('success') and result.get('path'):
                previews.append({
                    'style': style,
                    'url': f"/temp/cover_previews/{os.path.basename(result['path'])}"
                })
            else:
                errors.append(style)

        response = {
            'previews': previews,
            'videoHash': video_hash,
            'tempDir': self.temp_dir
        }

        if errors:
            response['errors'] = errors

        # 缓存结果
        self.preview_cache[video_hash] = response

        print(f"Generated {len(previews)} previews, {len(errors)} failed", file=sys.stderr)
        return response

    def cleanup_old_previews(self, max_age_hours: int = 24):
        """清理旧的预览文件"""
        try:
            current_time = time.time()
            for filename in os.listdir(self.temp_dir):
                filepath = os.path.join(self.temp_dir, filename)
                if os.path.isfile(filepath):
                    file_age = current_time - os.path.getmtime(filepath)
                    if file_age > max_age_hours * 3600:
                        os.remove(filepath)
                        print(f"Cleaned up old preview: {filename}", file=sys.stderr)
        except Exception as e:
            print(f"Error during cleanup: {e}", file=sys.stderr)

def main():
    """命令行接口"""
    import argparse

    parser = argparse.ArgumentParser(description='Generate real-time cover previews')
    parser.add_argument('video_path', help='Path to the video file')
    parser.add_argument('--output-dir', help='Output directory for previews')

    args = parser.parse_args()

    if not os.path.exists(args.video_path):
        print(f"Error: Video file not found: {args.video_path}", file=sys.stderr)
        sys.exit(1)

    generator = CoverPreviewGenerator()

    if args.output_dir:
        generator.temp_dir = args.output_dir
        os.makedirs(generator.temp_dir, exist_ok=True)

    result = generator.generate_all_previews(args.video_path)

    # 输出JSON结果
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()