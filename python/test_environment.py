#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试Python环境和依赖库
Test Python Environment and Dependencies
"""

import sys


def check_library(lib_name, import_name=None):
    """检查库是否可用"""
    if import_name is None:
        import_name = lib_name

    try:
        __import__(import_name)
        print(f"[OK] {lib_name} is installed")
        return True
    except ImportError:
        print(f"[ERROR] {lib_name} is NOT installed")
        return False


def main():
    """主函数"""
    print("=" * 50)
    print("Python Environment Check")
    print("=" * 50)
    print(f"Python version: {sys.version}")
    print()

    # 检查必要的库
    libraries = [
        ("OpenCV", "cv2"),
        ("NumPy", "numpy"),
        ("Pillow", "PIL"),
        ("rembg", "rembg"),
        ("ffmpeg-python", "ffmpeg"),
        ("spacy", "spacy"),
        ("transformers", "transformers"),
    ]

    print("Checking required libraries:")
    print("-" * 50)

    all_installed = True
    for lib_name, import_name in libraries:
        if not check_library(lib_name, import_name):
            all_installed = False

    print()
    print("=" * 50)
    if all_installed:
        print("[SUCCESS] All dependencies are installed!")
        print("Environment is ready for subtitle and cover generation.")
    else:
        print("[FAILED] Some dependencies are missing.")
        print("Please install missing libraries using:")
        print("pip install opencv-python numpy Pillow rembg ffmpeg-python spacy transformers")

    print("=" * 50)

    return 0 if all_installed else 1


if __name__ == '__main__':
    sys.exit(main())
