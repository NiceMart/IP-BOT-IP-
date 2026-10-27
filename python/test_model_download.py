#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试脚本：触发 rembg 模型下载
"""

import sys
import os
from pathlib import Path

# 设置控制台编码为 UTF-8
if sys.platform == 'win32':
    os.system('chcp 65001 >nul')

print("=" * 60)
print("测试 rembg 模型加载")
print("=" * 60)
print()

try:
    print("[1/3] 导入 rembg...")
    from rembg import new_session
    print("[OK] rembg 导入成功")
    print()
    
    print("[2/3] 初始化 u2net 模型...")
    print("注意：首次运行会自动下载模型（约 176MB）")
    print("模型将缓存到：", Path.home() / ".u2net")
    print()
    
    session = new_session('u2net')
    print("[OK] u2net 模型加载成功！")
    print()
    
    print("[3/3] 验证模型...")
    print(f"Session 类型: {type(session)}")
    print(f"Session 信息: {session}")
    print()
    
    print("=" * 60)
    print("[OK] 所有测试通过！")
    print("=" * 60)
    print()
    print("模型已准备就绪，可以开始使用人像抠图功能。")
    print()
    
except Exception as e:
    print()
    print("=" * 60)
    print("[ERROR] 测试失败")
    print("=" * 60)
    print()
    print(f"错误信息: {e}")
    print()
    import traceback
    traceback.print_exc()
    sys.exit(1)