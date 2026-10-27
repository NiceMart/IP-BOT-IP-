"""
获取所有可用字体列表
"""
import json
import sys
from pathlib import Path

# 添加模块路径
sys.path.insert(0, str(Path(__file__).parent))

from modules.font_manager import get_font_manager

def main():
    try:
        font_manager = get_font_manager()
        fonts = font_manager.get_all_available_fonts()
        
        # 输出JSON格式
        print(json.dumps(fonts, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()