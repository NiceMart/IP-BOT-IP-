"""
查找指定字体文件路径
"""
import sys
from pathlib import Path

# 添加模块路径
sys.path.insert(0, str(Path(__file__).parent))

from modules.font_manager import get_font_manager

def main():
    if len(sys.argv) < 2:
        print("Usage: python find_font.py <font_family> [font_weight]", file=sys.stderr)
        sys.exit(1)
    
    font_family = sys.argv[1]
    font_weight = int(sys.argv[2]) if len(sys.argv) > 2 else 400
    
    try:
        font_manager = get_font_manager()
        font_path = font_manager.find_font(font_family, font_weight)
        
        if font_path:
            print(font_path)
        else:
            print("")  # 返回空字符串表示未找到
        
        sys.exit(0)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()