#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Simple Python dependency test script
Can be run with full path, e.g.:
C:\Python312\python.exe python/test_dependencies_simple.py
"""

import sys
import os

def test_python_version():
    """Test Python version"""
    version = sys.version_info
    print(f"Python version: {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 7):
        print("X Python version too low, need 3.7 or higher")
        return False
    else:
        print("[OK] Python version meets requirements")
        return True

def test_pillow():
    """Test Pillow library"""
    try:
        from PIL import Image
        import PIL
        print(f"[OK] Pillow installed: {PIL.__version__}")
        return True
    except ImportError:
        print("X Pillow not installed")
        print("   Install command: pip install Pillow")
        return False

def test_numpy():
    """Test NumPy library"""
    try:
        import numpy as np
        print(f"[OK] NumPy installed: {np.__version__}")
        return True
    except ImportError:
        print("X NumPy not installed")
        print("   Install command: pip install numpy")
        return False

def main():
    print("=" * 50)
    print("Python Dependency Test")
    print("=" * 50)
    print()
    
    print(f"Python executable: {sys.executable}")
    print()
    
    results = []
    
    # Test Python version
    results.append(test_python_version())
    print()
    
    # Test Pillow
    results.append(test_pillow())
    print()
    
    # Test NumPy
    results.append(test_numpy())
    print()
    
    # Summary
    print("=" * 50)
    if all(results):
        print("[OK] All dependencies ready!")
        print()
        print("Next steps:")
        print("1. Add Python to system PATH, or")
        print("2. Use full path in code:")
        print(f"   {sys.executable}")
        return 0
    else:
        print("X Missing dependencies")
        print()
        print("Install all dependencies:")
        print("  pip install Pillow numpy")
        return 1

if __name__ == "__main__":
    sys.exit(main())