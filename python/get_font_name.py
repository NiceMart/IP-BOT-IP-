"""
读取字体文件的内部Family名称（用于ASS字幕）
"""
import sys
from pathlib import Path

# 添加模块路径
sys.path.insert(0, str(Path(__file__).parent))

try:
    from fontTools.ttLib import TTFont
except ImportError:
    try:
        import fontTools
    except ImportError:
        print("", file=sys.stderr)  # 返回空字符串，表示无法读取
        sys.exit(1)

def get_font_family_name(font_path: str) -> str:
    """
    获取字体名称。
    优先使用文件名（不含扩展名），这样可以保证与ziti目录中的文件名匹配。
    例如：墨趣古风体.ttf → 返回 "墨趣古风体"
    """
    try:
        # 优先返回文件名（不含扩展名）
        # 这样可以确保与ziti目录中的文件名匹配，避免使用字体内部的元数据
        # 字体文件内部的Family Name有时是拼音（如"MoQuGuFengTi"），导致libass找不到字体
        from pathlib import Path
        filename = Path(font_path).stem  # 获取文件名，不含扩展名
        if filename:
            # 确保返回的是正确编码的字符串（对于中文字体名）
            return str(filename)

        # 如果文件名为空，尝试读取字体内部的Family名称作为备选
        font = TTFont(font_path)
        # 读取name表中的Family名称（通常在第1或第16条记录中）
        for record in font['name'].names:
            # nameID 1 = Font Family Name
            if record.nameID == 1:
                # 尝试解码，优先使用Unicode编码
                try:
                    if hasattr(record, 'string'):
                        if isinstance(record.string, bytes):
                            return record.string.decode('utf-16-be') if record.isUnicode() else record.string.decode('latin-1')
                        return str(record.string)
                except:
                    pass
        # 如果找不到nameID 1，尝试其他nameID
        for record in font['name'].names:
            if record.nameID == 16:  # Typographic Family Name
                try:
                    if hasattr(record, 'string'):
                        if isinstance(record.string, bytes):
                            return record.string.decode('utf-16-be') if record.isUnicode() else record.string.decode('latin-1')
                        return str(record.string)
                except:
                    pass
        font.close()
    except Exception as e:
        pass

    return ""

def main():
    if len(sys.argv) < 2:
        print("", file=sys.stderr)
        sys.exit(1)

    font_path = sys.argv[1]

    if not Path(font_path).exists():
        print("", file=sys.stderr)
        sys.exit(1)

    try:
        family_name = get_font_family_name(font_path)
        if family_name:
            print(family_name)
        else:
            print("")  # 返回空字符串表示无法读取
        sys.exit(0)
    except Exception as e:
        print("", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()



















