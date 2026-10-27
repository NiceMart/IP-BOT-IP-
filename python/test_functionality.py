#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试字幕封面生成器的核心功能
Test core functionality of subtitle and cover generator
"""

import os
import sys
import json
import tempfile
from pathlib import Path

def test_video_frame_extraction():
    """测试视频帧提取功能"""
    try:
        import cv2
        print("✓ OpenCV loaded successfully")

        # 创建一个假的视频文件路径来测试
        # (实际上不会提取帧，只是测试cv2.VideoCapture是否能初始化)
        cap = cv2.VideoCapture()
        print("✓ VideoCapture initialized successfully")
        cap.release()

        return True
    except Exception as e:
        print(f"✗ Video frame extraction failed: {e}")
        return False

def test_image_processing():
    """测试图像处理功能"""
    try:
        import numpy as np
        from PIL import Image, ImageDraw
        print("✓ PIL and NumPy loaded successfully")

        # 创建一个测试图像
        img = Image.new('RGB', (100, 100), color='red')
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), "Test", fill='white')

        # 转换为numpy数组
        img_np = np.array(img)
        print(f"✓ Image processing works: shape {img_np.shape}")

        return True
    except Exception as e:
        print(f"✗ Image processing failed: {e}")
        return False

def test_nlp_processing():
    """测试NLP处理功能"""
    try:
        import jieba
        print("✓ Jieba loaded successfully")

        # 测试关键词提取
        text = "这是一个测试句子，用于验证中文分词功能"
        words = jieba.cut(text)
        keywords = jieba.analyse.extract_tags(text, topK=5)
        print(f"✓ NLP processing works: keywords {keywords}")

        return True
    except Exception as e:
        print(f"✗ NLP processing failed: {e}")
        return False

def test_background_removal():
    """测试背景移除功能"""
    try:
        from rembg import remove
        print("✓ RMBG loaded successfully")

        # 创建一个简单的测试图像
        from PIL import Image
        test_img = Image.new('RGB', (50, 50), color='blue')
        # 测试是否能调用remove函数（不实际处理）
        print("✓ Background removal library available")

        return True
    except Exception as e:
        print(f"✗ Background removal failed: {e}")
        return False

def test_transformers():
    """测试Transformers功能"""
    try:
        from transformers import pipeline
        import torch
        print("✓ Transformers loaded successfully")
        print(f"✓ PyTorch available: CUDA={torch.cuda.is_available()}")

        # 不实际加载模型，只测试导入
        return True
    except Exception as e:
        print(f"✗ Transformers failed: {e}")
        return False

def test_funasr():
    """测试FUNASR功能"""
    try:
        from funasr import AutoModel
        print("✓ FUNASR loaded successfully")

        # 测试是否能导入AutoModel
        return True
    except Exception as e:
        print(f"✗ FUNASR failed: {e}")
        return False

def test_ffmpeg():
    """测试FFmpeg功能"""
    try:
        import subprocess
        result = subprocess.run(['ffmpeg', '-version'],
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            print(f"✓ FFmpeg available: {version_line}")
            return True
        else:
            print("✗ FFmpeg not working properly")
            return False
    except Exception as e:
        print(f"✗ FFmpeg test failed: {e}")
        return False

def main():
    """主测试函数"""
    print("=" * 60)
    print("字幕封面生成器功能测试")
    print("Subtitle & Cover Generator Feature Test")
    print("=" * 60)

    tests = [
        ("视频帧提取", test_video_frame_extraction),
        ("图像处理", test_image_processing),
        ("NLP处理", test_nlp_processing),
        ("背景移除", test_background_removal),
        ("Transformers", test_transformers),
        ("FUNASR语音识别", test_funasr),
        ("FFmpeg", test_ffmpeg),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n测试: {test_name}")
        print("-" * 30)
        if test_func():
            passed += 1
        print()

    print("=" * 60)
    print(f"测试结果: {passed}/{total} 通过")
    print(f"Test Results: {passed}/{total} passed")

    if passed == total:
        print("🎉 所有功能正常！可以开始使用字幕封面生成功能了")
        print("All features working! Ready to use subtitle and cover generation.")
        return 0
    else:
        print("⚠️  某些功能不可用，请检查依赖库安装")
        print("Some features not available, please check dependencies.")
        return 1

if __name__ == '__main__':
    sys.exit(main())