"""
字体管理模块
负责查找和管理字体文件，支持预置字体、系统字体、ziti目录字体和Google Fonts
"""
import os
import sys
import platform
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import json

# 尝试导入loguru，如果不可用则使用print作为替代
try:
    from loguru import logger
except ImportError:
    # Fallback logger that uses print
    class logger:
        @staticmethod
        def info(msg, *args, **kwargs):
            print(f"[INFO] {msg}", file=sys.stderr)
        @staticmethod
        def warning(msg, *args, **kwargs):
            print(f"[WARN] {msg}", file=sys.stderr)
        @staticmethod
        def error(msg, *args, **kwargs):
            print(f"[ERROR] {msg}", file=sys.stderr)
        @staticmethod
        def debug(msg, *args, **kwargs):
            print(f"[DEBUG] {msg}", file=sys.stderr)


class FontManager:
    """字体管理器"""

    def __init__(self):
        # 计算项目根目录（从 python/modules 向上两级）
        # __file__ 应该是 .../python/modules/font_manager.py
        current_file = Path(__file__).resolve()
        python_dir = current_file.parent.parent  # python 目录
        project_root = python_dir.parent  # 项目根目录

        self.bundled_fonts_dir = Path("fonts/bundled")
        self.fonts_metadata_file = self.bundled_fonts_dir / "fonts_metadata.json"

        # 🔧 修复ziti字体路径：支持ASAR打包环境
        # 检查是否在打包环境中运行
        app_root = os.environ.get('APP_ROOT', None)
        if app_root:
            ziti_path_bundle = Path(app_root) / "resources-bundles" / "ziti"
            if ziti_path_bundle.exists():
                self.ziti_fonts_dir = ziti_path_bundle
                print(f"✅ [font_manager] 找到ziti字体目录(bundle): {ziti_path_bundle}")
            else:
                ziti_path = Path(app_root) / "extra" / "common" / "fonts" / "ziti"
                if ziti_path.exists():
                    self.ziti_fonts_dir = ziti_path
                    print(f"✅ [font_manager] 找到ziti字体目录: {ziti_path}")
                else:
                    ziti_path_fallback1 = Path(app_root) / "app.asar.unpacked" / "ziti"
                    if ziti_path_fallback1.exists():
                        self.ziti_fonts_dir = ziti_path_fallback1
                        print(f"✅ [font_manager] 找到ziti字体目录(回退1): {ziti_path_fallback1}")
                    else:
                        ziti_path_fallback2 = Path(app_root) / "ziti"
                        self.ziti_fonts_dir = ziti_path_fallback2
                        print(f"⚠️ [font_manager] 使用回退路径: {ziti_path_fallback2} (存在: {ziti_path_fallback2.exists()})")
        else:
            self.ziti_fonts_dir = project_root / "ziti"
            print(f"🔧 [font_manager] 开发环境ziti路径: {self.ziti_fonts_dir}")
        self._bundled_fonts_cache: Optional[Dict] = None
        self._system_fonts_cache: Optional[List[Dict]] = None
        self._ziti_fonts_cache: Optional[List[Dict]] = None  # 新增：ziti字体缓存

        # 诊断日志
        logger.debug(f"FontManager 初始化: current_file={current_file}, python_dir={python_dir}, project_root={project_root}")
        logger.debug(f"ziti_fonts_dir={self.ziti_fonts_dir.absolute()}, exists={self.ziti_fonts_dir.exists()}")
    
    def get_bundled_fonts(self) -> List[Dict]:
        """获取预置字体列表"""
        if self._bundled_fonts_cache is not None:
            return self._bundled_fonts_cache.get("fonts", [])
        
        if not self.fonts_metadata_file.exists():
            logger.warning(f"字体元数据文件不存在: {self.fonts_metadata_file}")
            return []
        
        try:
            with open(self.fonts_metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)
                self._bundled_fonts_cache = metadata
                return metadata.get("fonts", [])
        except Exception as e:
            logger.error(f"读取字体元数据失败: {e}")
            return []
    
    def scan_ziti_fonts(self) -> List[Dict]:
        """扫描ziti目录中的字体文件"""
        if self._ziti_fonts_cache is not None:
            return self._ziti_fonts_cache

        ziti_fonts = []

        logger.info(f"正在扫描 ziti 目录: {self.ziti_fonts_dir.absolute()}")
        logger.info(f"  当前工作目录: {os.getcwd()}")
        logger.info(f"  APP_ROOT环境变量: {os.environ.get('APP_ROOT', 'None')}")

        if not self.ziti_fonts_dir.exists():
            logger.warning(f"❌ ziti目录不存在: {self.ziti_fonts_dir.absolute()}")
            logger.warning(f"  请检查路径配置和资源文件是否正确打包")
            return []
        else:
            logger.info(f"✅ ziti目录存在，开始扫描字体文件...")
        
        try:
            # 支持的字体格式
            font_extensions = ['.ttf', '.otf', '.ttc', '.woff', '.woff2']
            
            # 扫描ziti目录中的所有字体文件
            for font_file in self.ziti_fonts_dir.iterdir():
                if font_file.is_file() and font_file.suffix.lower() in font_extensions:
                    # 从文件名提取字体信息
                    font_name = font_file.stem
                    
                    # 尝试解析字体名称和变体
                    display_name = font_name
                    family = font_name
                    weight = 400
                    
                    # 检测常见的字体变体
                    name_lower = font_name.lower()
                    if 'bold' in name_lower:
                        weight = 700
                    elif 'semibold' in name_lower:
                        weight = 600
                    elif 'medium' in name_lower:
                        weight = 500
                    elif 'light' in name_lower:
                        weight = 300
                    elif 'thin' in name_lower:
                        weight = 100
                    elif 'black' in name_lower or 'extrabold' in name_lower:
                        weight = 900
                    
                    # 清理family名称（移除变体后缀）
                    for variant in ['-Bold', '-SemiBold', '-Medium', '-Light', '-Thin', '-Black', '-ExtraBold', '-Regular']:
                        if family.endswith(variant):
                            family = family[:-len(variant)]
                            break
                    
                    ziti_fonts.append({
                        'family': family,
                        'display_name': display_name,
                        'path': str(font_file.absolute()),
                        'source': 'ziti',
                        'weight': weight,
                        'category': 'sans-serif',  # 默认分类
                        'languages': ['zh-CN', 'ja', 'en']  # 假设支持中日英
                    })
            
            logger.info(f"✅ 从ziti目录扫描到 {len(ziti_fonts)} 个字体")
            if len(ziti_fonts) > 0:
                logger.debug(f"  扫描到的字体: {', '.join([f['family'] for f in ziti_fonts[:5]])}" +
                           (f" 等({len(ziti_fonts)}个)" if len(ziti_fonts) > 5 else ""))

        except Exception as e:
            logger.error(f"❌ 扫描ziti目录字体失败: {e}")
            import traceback
            logger.error(f"  追踪: {traceback.format_exc()}")
        
        # 去重（按family和weight）
        seen = set()
        unique_fonts = []
        for font in ziti_fonts:
            key = (font['family'], font.get('weight', 400))
            if key not in seen:
                seen.add(key)
                unique_fonts.append(font)
        
        self._ziti_fonts_cache = unique_fonts
        return unique_fonts
    
    def scan_system_fonts(self) -> List[Dict]:
        """扫描系统已安装的字体"""
        if self._system_fonts_cache is not None:
            return self._system_fonts_cache
        
        system_fonts = []
        system = platform.system()
        
        try:
            if system == 'Windows':
                font_dir = Path("C:/Windows/Fonts")
                if font_dir.exists():
                    # 常见Windows字体
                    common_fonts = {
                        'simhei.ttf': {'family': 'SimHei', 'display_name': '黑体'},
                        'simsun.ttc': {'family': 'SimSun', 'display_name': '宋体'},
                        'msyh.ttc': {'family': 'Microsoft YaHei', 'display_name': '微软雅黑'},
                        'msyhbd.ttc': {'family': 'Microsoft YaHei', 'display_name': '微软雅黑 Bold', 'weight': 700},
                        'arial.ttf': {'family': 'Arial', 'display_name': 'Arial'},
                        'arialbd.ttf': {'family': 'Arial', 'display_name': 'Arial Bold', 'weight': 700},
                        'times.ttf': {'family': 'Times New Roman', 'display_name': 'Times New Roman'},
                        'timesbd.ttf': {'family': 'Times New Roman', 'display_name': 'Times New Roman Bold', 'weight': 700},
                    }
                    
                    for font_file, font_info in common_fonts.items():
                        font_path = font_dir / font_file
                        if font_path.exists():
                            system_fonts.append({
                                'family': font_info['family'],
                                'display_name': font_info['display_name'],
                                'path': str(font_path),
                                'source': 'system',
                                'weight': font_info.get('weight', 400)
                            })
            
            elif system == 'Darwin':  # macOS
                font_dirs = [
                    Path("/System/Library/Fonts"),
                    Path("/Library/Fonts"),
                    Path.home() / "Library/Fonts"
                ]
                
                common_fonts = {
                    'PingFang.ttc': {'family': 'PingFang SC', 'display_name': '苹方'},
                    'Arial.ttf': {'family': 'Arial', 'display_name': 'Arial'},
                }
                
                for font_dir in font_dirs:
                    if font_dir.exists():
                        for font_file, font_info in common_fonts.items():
                            font_path = font_dir / font_file
                            if font_path.exists():
                                system_fonts.append({
                                    'family': font_info['family'],
                                    'display_name': font_info['display_name'],
                                    'path': str(font_path),
                                    'source': 'system',
                                    'weight': 400
                                })
            
            elif system == 'Linux':
                font_dirs = [
                    Path("/usr/share/fonts/truetype"),
                    Path("/usr/share/fonts/TTF"),
                    Path.home() / ".fonts"
                ]
                
                for font_dir in font_dirs:
                    if font_dir.exists():
                        # 查找常见字体
                        for font_file in font_dir.rglob("*.ttf"):
                            font_name = font_file.stem.lower()
                            if 'dejavu' in font_name or 'liberation' in font_name:
                                system_fonts.append({
                                    'family': font_file.stem,
                                    'display_name': font_file.stem,
                                    'path': str(font_file),
                                    'source': 'system',
                                    'weight': 400
                                })
        
        except Exception as e:
            logger.error(f"扫描系统字体失败: {e}")
        
        # 去重（按family和weight）
        seen = set()
        unique_fonts = []
        for font in system_fonts:
            key = (font['family'], font.get('weight', 400))
            if key not in seen:
                seen.add(key)
                unique_fonts.append(font)
        
        self._system_fonts_cache = unique_fonts
        return unique_fonts
    
    def find_font(self, font_family: str, font_weight: int = 400) -> Optional[str]:
        """查找字体文件（按优先级：预置 > ziti > 系统 > 默认）
        
        Args:
            font_family: 字体名称
            font_weight: 字体粗细 (100-1000)
        
        Returns:
            字体文件路径，如果找不到返回None
        """
        # 1. 优先查找预置字体
        bundled_font = self._find_bundled_font(font_family, font_weight)
        if bundled_font:
            return bundled_font
        
        # 2. 查找ziti目录字体
        ziti_font = self._find_ziti_font(font_family, font_weight)
        if ziti_font:
            return ziti_font
        
        # 3. 查找系统字体
        system_font = self._find_system_font(font_family, font_weight)
        if system_font:
            return system_font
        
        # 4. 返回None（使用默认字体）
        return None
    
    def _find_bundled_font(self, font_family: str, font_weight: int) -> Optional[str]:
        """查找预置字体"""
        if not self.bundled_fonts_dir.exists():
            return None
        
        bundled_fonts = self.get_bundled_fonts()
        
        # 查找匹配的字体
        for font_info in bundled_fonts:
            if font_info.get('family') == font_family:
                font_dir = self.bundled_fonts_dir / font_info.get('path', '')
                
                # 根据font_weight选择变体
                variant = self._get_variant_for_weight(font_weight)
                
                # 查找字体文件（支持TTF和OTF格式）
                for ext in [".ttf", ".otf"]:
                    variant_file = font_dir / f"{variant}{ext}"
                    if variant_file.exists():
                        return str(variant_file)
                
                # 如果找不到指定变体，尝试查找Regular
                for ext in [".ttf", ".otf"]:
                    regular_file = font_dir / f"Regular{ext}"
                    if regular_file.exists():
                        return str(regular_file)
        
        return None
    
    def _find_ziti_font(self, font_family: str, font_weight: int) -> Optional[str]:
        """查找ziti目录字体（支持模糊匹配和名称映射）"""
        if not font_family:
            return None
            
        ziti_fonts = self.scan_ziti_fonts()
        
        if not ziti_fonts:
            logger.debug(f"ziti目录中没有字体文件，无法查找: {font_family}")
            return None
        
        # 字体名称映射表（与前端保持一致）
        # 映射：显示名称/别名 -> 文件名（不包含扩展名）
        font_name_map = {
            'Dymon手写体': 'Dymon-ShouXieTi',
            'Dymon-ShouXieTi': 'Dymon-ShouXieTi',
            '猫啃杂糅体': 'MaokenAssortedSans',
            'MaokenAssortedSans': 'MaokenAssortedSans',
            '猫啃杂糅体 Lite': 'MaokenAssortedSans-Lite',
            'MaokenAssortedSans-Lite': 'MaokenAssortedSans-Lite',
            'Murecho 黑体': 'Murecho-Black',
            'Murecho-Black': 'Murecho-Black',
            'Murecho 粗体': 'Murecho-Bold',
            'Murecho-Bold': 'Murecho-Bold',
            '墨趣古风体': '墨趣古风体',
            '平方张亚玲黑方体': '平方张亚玲黑方体',
            '胡晓波骚包体': '胡晓波骚包体2.0',
            '胡晓波骚包体2.0': '胡晓波骚包体2.0',
        }
        
        # 标准化字体名称（移除空格、统一大小写）
        def normalize_name(name: str) -> str:
            return name.replace(' ', '').replace('-', '').replace('_', '').lower()
        
        # 尝试通过映射表转换字体名称
        mapped_font_family = font_name_map.get(font_family, font_family)
        normalized_target = normalize_name(mapped_font_family)
        
        logger.debug(f"查找ziti字体: '{font_family}' -> 映射: '{mapped_font_family}' -> 标准化: '{normalized_target}', 权重: {font_weight}")
        
        # 查找匹配的字体
        best_match = None
        min_weight_diff = float('inf')
        
        for font_info in ziti_fonts:
            family = font_info.get('family', '')
            display_name = font_info.get('display_name', '')
            path = font_info.get('path', '')
            
            # 获取文件名（不含扩展名）用于匹配
            file_stem = None
            if path:
                from pathlib import Path
                file_stem = Path(path).stem
            
            # 多种匹配方式：精确匹配、模糊匹配、文件名匹配
            is_match = False
            match_type = None
            
            # 1. 精确匹配
            if family == font_family or family == mapped_font_family:
                is_match = True
                match_type = f"精确匹配(family={family})"
            elif display_name == font_family or display_name == mapped_font_family:
                is_match = True
                match_type = f"精确匹配(display_name={display_name})"
            # 2. 模糊匹配（忽略大小写和空格）
            elif normalize_name(family) == normalized_target:
                is_match = True
                match_type = f"模糊匹配(family={family})"
            elif normalize_name(display_name) == normalized_target:
                is_match = True
                match_type = f"模糊匹配(display_name={display_name})"
            # 3. 文件名匹配
            elif file_stem and normalize_name(file_stem) == normalized_target:
                is_match = True
                match_type = f"文件名匹配(file_stem={file_stem})"
            
            if is_match:
                font_weight_info = font_info.get('weight', 400)
                weight_diff = abs(font_weight_info - font_weight)
                
                logger.debug(f"找到匹配字体: {match_type}, 路径: {path}, 权重: {font_weight_info}, 权重差: {weight_diff}")
                
                # 找到权重最接近的字体
                if weight_diff < min_weight_diff:
                    min_weight_diff = weight_diff
                    best_match = path
        
        if best_match:
            logger.info(f"找到ziti字体 '{font_family}': {best_match}")
        else:
            logger.warning(f"未找到ziti字体 '{font_family}'，已扫描{len(ziti_fonts)}个字体文件")
        
        return best_match
    
    def _find_system_font(self, font_family: str, font_weight: int) -> Optional[str]:
        """查找系统字体"""
        system_fonts = self.scan_system_fonts()
        
        # 查找匹配的字体
        for font_info in system_fonts:
            if font_info.get('family') == font_family:
                font_weight_info = font_info.get('weight', 400)
                
                # 如果权重匹配（或接近），返回字体路径
                if abs(font_weight_info - font_weight) <= 100:
                    return font_info.get('path')
        
        return None
    
    def _get_variant_for_weight(self, font_weight: int) -> str:
        """根据字体权重获取变体名称"""
        if font_weight >= 700:
            return "Bold"
        elif font_weight >= 600:
            return "SemiBold"
        elif font_weight >= 500:
            return "Medium"
        else:
            return "Regular"
    
    def get_all_available_fonts(self) -> List[Dict]:
        """获取所有可用字体（合并预置、ziti和系统字体）"""
        all_fonts = []
        
        # 添加预置字体
        bundled_fonts = self.get_bundled_fonts()
        for font_info in bundled_fonts:
            all_fonts.append({
                'value': font_info.get('family'),
                'label': font_info.get('display_name', font_info.get('family')),
                'source': 'bundled',
                'category': font_info.get('category', 'sans-serif'),
                'languages': font_info.get('languages', [])
            })
        
        # 添加ziti目录字体
        ziti_fonts = self.scan_ziti_fonts()
        seen_families = {f.get('family') for f in bundled_fonts}
        
        for font_info in ziti_fonts:
            family = font_info.get('family')
            if family not in seen_families:
                all_fonts.append({
                    'value': family,
                    'label': font_info.get('display_name', family),
                    'source': 'ziti',
                    'category': font_info.get('category', 'sans-serif'),
                    'languages': font_info.get('languages', []),
                    'path': font_info.get('path')
                })
                seen_families.add(family)
        
        # 添加系统字体（去重）
        system_fonts = self.scan_system_fonts()
        
        for font_info in system_fonts:
            family = font_info.get('family')
            if family not in seen_families:
                all_fonts.append({
                    'value': family,
                    'label': font_info.get('display_name', family),
                    'source': 'system',
                    'category': 'sans-serif',
                    'languages': []
                })
                seen_families.add(family)
        
        return all_fonts


# 全局字体管理器实例
_font_manager: Optional[FontManager] = None


def get_font_manager() -> FontManager:
    """获取全局字体管理器实例"""
    global _font_manager
    if _font_manager is None:
        _font_manager = FontManager()
    return _font_manager

