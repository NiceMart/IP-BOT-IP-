"""
封面生成模块
根据模板生成封面图，包括背景虚化、人物描边和文本排版
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List, Union
import os
import sys
import time
import shutil

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

from .utils import ensure_dir, save_image, apply_blur, apply_gradient_overlay, blend_images

# 检查cv2是否可用
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("opencv-python不可用，某些功能可能受限")


class CoverGenerator:
    """封面生成器"""

    def __init__(self, template_config: Optional[Dict[str, Any]] = None):
        self.template_config = template_config or self._get_default_config()
        self.templates = self._load_templates()

    def _get_default_config(self) -> Dict[str, Any]:
        """获取默认配置"""
        return {
            'canvas_size': (1080, 1920),  # 9:16 比例
            'background_color': (255, 255, 255),
            'font_family': 'simhei.ttf',  # 默认字体
            'font_size_title': 120,
            'font_size_subtitle': 60,
            'text_color': (255, 255, 255),
            'text_shadow': True,
            'text_shadow_color': (0, 0, 0),
            'text_shadow_offset': (3, 3),
        }

    def _load_templates(self) -> Dict[str, Dict[str, Any]]:
        """加载封面模板"""
        return {
            'big_text': {
                'name': '大字封面',
                'description': '大标题文字，适合宣传类内容',
                'background_effect': 'blur',
                'text_position': 'center',
                'text_size': 'large',
                'person_position': 'bottom',
                'person_size': 0.8,
            },
            'search_card': {
                'name': '搜索卡片封面',
                'description': '卡片式布局，适合教程类内容',
                'background_effect': 'gradient',
                'text_position': 'top-left',
                'text_size': 'medium',
                'person_position': 'right',
                'person_size': 0.6,
            },
            'cut_angle': {
                'name': '斜切色块封面',
                'description': '斜切设计，现代感强',
                'background_effect': 'solid',
                'text_position': 'top-right',
                'text_size': 'medium',
                'person_position': 'left',
                'person_size': 0.7,
            },
            'blur_person': {
                'name': '背景虚化人物封面',
                'description': '人物突出，背景虚化',
                'background_effect': 'blur-person',
                'blur_intensity': 15,  # 增强背景模糊（从8增加到15）
                'text_position': 'bottom',
                'text_size': 'large',
                'person_position': 'center',
                'person_size': 0.9,
                'person_border_color': '#FFFFFF',
                'person_border_width': 6,
                'person_border_style': 'solid',  # solid 或 dashed
            },
            'red_banner': {
                'name': '红色横幅封面',
                'description': '红色横幅，白色文字，简洁醒目',
                'background_effect': 'none',
                'text_position': 'bottom-center',
                'text_size': 'large',
                'text_background_color': '#DC143C',  # 深红色
                'text_background_opacity': 255,
                'person_position': 'center',
                'person_size': 0.7,
            },
            'blue_banner': {
                'name': '蓝色横幅封面',
                'description': '蓝色横幅，不规则边缘，现代感',
                'background_effect': 'none',
                'text_position': 'bottom-center',
                'text_size': 'large',
                'text_background_color': '#1E90FF',  # 蓝色
                'text_background_opacity': 255,
                'text_background_shape': 'irregular',  # 不规则边缘
                'person_position': 'center',
                'person_size': 0.8,
            },
            'yellow_outline': {
                'name': '黄色描边文字封面',
                'description': '黄色文字，白色描边，无背景框',
                'background_effect': 'blur',
                'text_position': 'center',
                'text_size': 'large',
                'text_color': '#FFD700',  # 黄色
                'text_outline': True,
                'text_outline_color': '#FFFFFF',
                'text_outline_width': 3,
                'person_position': 'center',
                'person_size': 0.8,
            },
            'dual_color': {
                'name': '双色文字封面',
                'description': '黄色和橙色文字，无背景框',
                'background_effect': 'none',
                'text_position': 'center',
                'text_size': 'large',
                'text_color': '#FFD700',  # 主文字黄色
                'secondary_text_color': '#FF8C00',  # 副文字橙色
                'person_position': 'center',
                'person_size': 0.8,
            },
            'multi_text': {
                'name': '多位置文字封面',
                'description': '左上和右侧都有文字，适合信息展示',
                'background_effect': 'blur-person',
                'blur_intensity': 8,
                'text_position': 'top-left',
                'secondary_text_position': 'right',
                'text_size': 'medium',
                'person_position': 'center',
                'person_size': 0.9,
                'person_border_color': '#FFFFFF',
                'person_border_width': 3,
            },
        }

    def generate_cover(self, background_path: str, person_path: Optional[str] = None,
                      text_info: Dict[str, Any] = None, template_id: str = "big_text",
                      output_path: Optional[str] = None, person_mask: Optional[np.ndarray] = None,
                      cover_style: Optional[Dict[str, Any]] = None, save_steps: bool = False,
                      step_callback: Optional[callable] = None) -> Union[str, Dict[str, Any]]:
        """生成封面

        Args:
            background_path: 背景图路径
            person_path: 人物图路径（可选）
            text_info: 文本信息
            template_id: 模板ID
            output_path: 输出路径
            person_mask: 人物mask（用于描边和背景模糊）
            cover_style: 封面样式配置
            save_steps: 是否保存中间步骤（用于预览）
            step_callback: 步骤回调函数，每完成一个步骤时调用，参数为(step_num, step_name, step_path)

        Returns:
            如果save_steps=False，返回生成的封面路径（str）
            如果save_steps=True，返回包含最终路径和中间步骤路径的字典
        """
        try:
            # 检测自定义模板（格式：custom:${templateId}）
            is_custom_template = template_id.startswith('custom:')
            if is_custom_template:
                # 自定义模板：使用 cover_style 中的所有参数
                # 创建一个基础模板配置
                template = self.templates.get('big_text', {}).copy()
                # 标记为自定义模板
                template['is_custom'] = True
                # 设置 normalized ID（用于日志）
                template_id_normalized = template_id
                logger.info(f"检测到自定义模板: {template_id}")
            else:
                # 处理模板ID映射（前端可能使用连字符，后端使用下划线）
                template_id_normalized = template_id.replace('-', '_')
                # 获取模板配置
                template = self.templates.get(template_id_normalized, self.templates['big_text']).copy()
            
            # 合并cover_style到template，以便统一处理
            if cover_style:
                # 保存原始的background_effect（模板定义的背景效果不应该被cover_style覆盖）
                original_background_effect = template.get('background_effect')
                
                # 保存cover_style到template中，供描边函数使用
                template['cover_style'] = cover_style
                
                # 合并cover_style（但不覆盖background_effect）
                for key, value in cover_style.items():
                    # 跳过effectType，因为它不应该覆盖模板的background_effect
                    if key != 'effectType':
                        # 将前端命名转换为后端命名
                        if key == 'personBorderEnabled':
                            template['person_border_enabled'] = value
                        elif key == 'personBorderWidth':
                            template['person_border_width'] = value
                        elif key == 'personBorderColor':
                            template['person_border_color'] = value
                        elif key == 'personBorderStyle':
                            template['person_border_style'] = value
                        elif key == 'personBorderDashLength':
                            template['person_border_dash_length'] = value
                        elif key == 'personBorderGapLength':
                            template['person_border_gap_length'] = value
                        elif key == 'backgroundBlurEnabled':
                            template['background_blur_enabled'] = value
                        elif key == 'backgroundBlurIntensity':
                            template['background_blur_intensity'] = value
                        elif key == 'blurIntensity':
                            # 背景模糊度（用于blur-person模板，兼容旧字段）
                            template['blur_intensity'] = value
                        elif key == 'personSize':
                            # 人像大小（百分比，转换为0-1的小数）
                            template['person_size'] = value / 100.0 if value else 0.9
                        elif key == 'personPosition':
                            # 人像位置（百分比坐标）
                            template['person_position_custom'] = value
                        elif key == 'backgroundSize':
                            # 背景大小（百分比）
                            template['background_size'] = value / 100.0 if value else 1.0
                        elif key == 'backgroundPosition':
                            # 背景位置（百分比坐标）
                            template['background_position_custom'] = value
                        elif key == 'titlePosition':
                            # 主标题位置（百分比坐标）
                            template['title_position_custom'] = value
                        elif key == 'subtitlePosition':
                            # 副标题位置（百分比坐标）
                            template['subtitle_position_custom'] = value
                        elif key == 'maskEnabled':
                            # 蒙版启用
                            template['mask_enabled'] = value
                        elif key == 'maskImagePath':
                            # 蒙版图片路径
                            template['mask_image_path'] = value
                        elif key == 'maskSize':
                            # 蒙版大小（百分比）
                            template['mask_size'] = value / 100.0 if value else 1.0
                        elif key == 'maskPosition':
                            # 蒙版位置（百分比坐标）
                            template['mask_position_custom'] = value
                        elif key == 'maskColor':
                            # 蒙版颜色
                            template['mask_color'] = value
                        elif key == 'maskOpacity':
                            # 蒙版透明度（0-100转换为0-1）
                            template['mask_opacity'] = value / 100.0 if value else 1.0
                        elif key == 'maskShape':
                            # 蒙版形状
                            template['mask_shape'] = value
                        else:
                            template[key] = value
                
                # 确保background_effect不被覆盖
                template['background_effect'] = original_background_effect
                
                logger.info(f"合并cover_style后 - background_effect: {template.get('background_effect')}")
                logger.info(f"描边配置 - width: {template.get('person_border_width')}, color: {template.get('person_border_color')}, style: {template.get('person_border_style')}")
            
            # 调试日志
            logger.info(f"生成封面 - template_id: {template_id}, normalized: {template_id_normalized}")
            logger.info(f"生成封面 - template配置: {template}")
            logger.info(f"生成封面 - background_effect: {template.get('background_effect')}")
            if text_info:
                logger.info(f"生成封面 - text_info.title: {text_info.get('title')}")
                logger.info(f"生成封面 - text_info.cover_style: {text_info.get('cover_style')}")
            logger.info(f"生成封面 - person_path: {person_path}")

            # 确定输出目录（用于保存中间步骤）
            if output_path is None:
                output_dir = ensure_dir("output")
                # 对于自定义模板，使用简化的文件名（移除 custom: 前缀和特殊字符）
                safe_template_id = template_id.replace('custom:', '').replace(':', '-').replace('/', '-')
                output_path = str(output_dir / f"cover_{safe_template_id}.png")
            else:
                output_dir = os.path.dirname(output_path)
                if output_dir:
                    ensure_dir(output_dir)
                else:
                    output_dir = "output"
                    ensure_dir(output_dir)

            # 中间步骤路径列表
            step_paths = []
            
            # 生成安全的模板ID（用于文件名）
            safe_template_id = template_id.replace('custom:', '').replace(':', '-').replace('/', '-')

            # 创建画布
            canvas = self._create_canvas(template)
            
            # 步骤0: 空白画布
            if save_steps:
                step_path_0 = os.path.join(output_dir, f"step_0_canvas_{safe_template_id}.png")
                # 替换所有使用 template_id 作为文件名的地方
                # 复制画布以确保保存当前状态
                canvas_copy_0 = canvas.copy()
                canvas_bgr_0 = cv2.cvtColor(np.array(canvas_copy_0), cv2.COLOR_RGB2BGR)
                save_image(canvas_bgr_0, step_path_0)
                # 确保路径是绝对路径
                step_path_0 = os.path.abspath(step_path_0)
                step_paths.append({"step": 0, "name": "创建画布", "path": step_path_0})
                logger.info(f"步骤0已保存: {step_path_0}")
                print(f"步骤0 (创建画布) 图片路径: {step_path_0}", file=sys.stderr, flush=True)
                # 调用步骤回调
                if step_callback:
                    step_callback(0, "创建画布", step_path_0)
                # 等待3秒
                time.sleep(3)
                logger.info("步骤0等待完成，继续下一步")

            # 步骤0.5: 显示人像分割结果（透明背景人像图）
            if save_steps and person_path and os.path.exists(person_path):
                # 直接使用人像分割的结果（已经是透明背景的PNG）
                step_path_person_seg = os.path.join(output_dir, f"step_0.5_person_seg_{safe_template_id}.png")
                # 复制人像分割结果到步骤目录
                shutil.copy2(person_path, step_path_person_seg)
                # 确保路径是绝对路径
                step_path_person_seg = os.path.abspath(step_path_person_seg)
                step_paths.append({"step": 0.5, "name": "人像分割（透明背景）", "path": step_path_person_seg})
                logger.info(f"步骤0.5已保存（人像分割结果）: {step_path_person_seg}")
                print(f"步骤0.5 (人像分割（透明背景）) 图片路径: {step_path_person_seg}", file=sys.stderr, flush=True)
                # 调用步骤回调
                if step_callback:
                    step_callback(0.5, "人像分割（透明背景）", step_path_person_seg)
                # 等待3秒
                time.sleep(3)
                logger.info("步骤0.5等待完成，继续下一步")

            # 处理背景（如果是blur-person模板或自定义模板启用了描边，需要先添加人物再模糊背景）
            background_effect = template.get('background_effect')
            is_custom_template = template.get('is_custom', False)
            cover_style = template.get('cover_style', {})
            person_border_enabled = cover_style.get('personBorderEnabled') or template.get('person_border_enabled', False)
            
            # 判断是否需要走blur-person流程（先添加背景，再添加人物和描边）
            # 对于自定义模板，如果启用了描边或背景模糊，都需要走这个流程
            background_blur_enabled = cover_style.get('backgroundBlurEnabled') or template.get('background_blur_enabled', False)
            needs_blur_person_flow = (
                (background_effect == 'blur-person' or background_effect == 'blur_person') or
                (is_custom_template and (person_border_enabled or background_blur_enabled))
            )
            
            logger.info(f"模板背景效果: {background_effect}, is_custom: {is_custom_template}, personBorderEnabled: {person_border_enabled}, needs_blur_person_flow: {needs_blur_person_flow}")
            logger.info(f"person_path: {person_path}, person_mask: {person_mask is not None}")
            
            if needs_blur_person_flow and person_path:
                logger.info("blur-person模板：开始处理背景和人物")
                
                # 步骤1: 对抠图进行描边（在透明画布上）
                logger.info("步骤1开始：对抠图进行描边")
                person_with_border = None
                person_position_info = None
                
                if person_border_enabled:
                    # 创建带描边的人物图（在透明画布上）
                    person_with_border, person_position_info = self._create_person_with_border(
                        person_path, template, person_mask
                    )
                    logger.info("步骤1完成：人物描边已添加")
                    
                    # 保存步骤1（描边后的人物图）
                    if save_steps and person_with_border:
                        step_path_1 = os.path.join(output_dir, f"step_1_person_border_{safe_template_id}.png")
                        # 保存带描边的人物图（RGBA格式）
                        person_with_border_bgr = cv2.cvtColor(np.array(person_with_border.convert('RGB')), cv2.COLOR_RGB2BGR)
                        save_image(person_with_border_bgr, step_path_1)
                        # 确保路径是绝对路径
                        step_path_1 = os.path.abspath(step_path_1)
                        step_paths.append({"step": 1, "name": "人物描边", "path": step_path_1})
                        logger.info(f"步骤1已保存: {step_path_1}")
                        print(f"步骤1 (人物描边) 图片路径: {step_path_1}", file=sys.stderr, flush=True)
                        # 调用步骤回调
                        if step_callback:
                            step_callback(1, "人物描边", step_path_1)
                        # 等待3秒
                        time.sleep(3)
                        logger.info("步骤1等待完成，继续下一步")
                else:
                    # 如果没有描边，直接读取人物图并计算位置信息
                    person_img = Image.open(person_path).convert('RGBA')
                    canvas_width, canvas_height = canvas.size
                    person_position_custom = template.get('person_position_custom')
                    person_size_custom = template.get('person_size')
                    
                    if person_position_custom and person_size_custom is not None:
                        person_size_ratio = person_size_custom
                        person_width = int(canvas_width * person_size_ratio)
                        person_height = int(person_width * person_img.height / person_img.width)
                        if person_height > canvas_height * 0.95:
                            person_height = int(canvas_height * 0.95)
                            person_width = int(person_height * person_img.width / person_img.height)
                        x = int((person_position_custom.get('x', 50) / 100.0) * canvas_width) - person_width // 2
                        y = int((person_position_custom.get('y', 50) / 100.0) * canvas_height) - person_height // 2
                        x = max(0, min(x, canvas_width - person_width))
                        y = max(0, min(y, canvas_height - person_height))
                        person_with_border = person_img.resize((person_width, person_height), Image.LANCZOS)
                    else:
                        person_size_ratio = template.get('person_size', 0.8)
                        person_width = int(canvas_width * person_size_ratio)
                        person_height = int(person_width * person_img.height / person_img.width)
                        if person_height > canvas_height * 0.9:
                            person_height = int(canvas_height * 0.9)
                            person_width = int(person_height * person_img.width / person_img.height)
                        person_position = template.get('person_position', 'center')
                        x, y = self._calculate_position(person_position, (person_width, person_height), (canvas_width, canvas_height))
                        person_with_border = person_img.resize((person_width, person_height), Image.LANCZOS)
                    
                    person_position_info = {'x': x, 'y': y, 'width': person_width, 'height': person_height}
                    logger.info("步骤1跳过：描边已禁用")
                
                # 步骤2: 模糊背景（在单独的背景图上）
                logger.info("步骤2开始：模糊背景")
                # 检查是否启用背景模糊
                background_blur_enabled = cover_style.get('backgroundBlurEnabled')
                if background_blur_enabled is None:
                    background_blur_enabled = template.get('background_blur_enabled')
                    if background_blur_enabled is None:
                        background_blur_enabled = (background_effect == 'blur-person' or background_effect == 'blur_person')
                
                logger.info(f"背景模糊启用状态 - backgroundBlurEnabled: {background_blur_enabled}")
                
                # 读取背景图
                background = Image.open(background_path).convert('RGB')
                canvas_width, canvas_height = canvas.size
                background = self._resize_image(background, (canvas_width, canvas_height))
                
                if background_blur_enabled:
                    # 对背景进行模糊
                    cover_style = template.get('cover_style', {})
                    blur_radius = cover_style.get('backgroundBlurIntensity')
                    if blur_radius is None:
                        blur_radius = template.get('background_blur_intensity')
                    if blur_radius is None:
                        blur_radius = template.get('blur_intensity', 8)
                    background = background.filter(ImageFilter.GaussianBlur(radius=blur_radius))
                    logger.info(f"步骤2完成：背景模糊已应用（模糊度: {blur_radius}）")
                else:
                    logger.info("步骤2完成：背景未模糊")
                
                # 保存步骤2（模糊后的背景图）
                if save_steps:
                    step_path_2 = os.path.join(output_dir, f"step_2_background_blur_{safe_template_id}.png")
                    background_bgr = cv2.cvtColor(np.array(background), cv2.COLOR_RGB2BGR)
                    save_image(background_bgr, step_path_2)
                    step_path_2 = os.path.abspath(step_path_2)
                    step_paths.append({"step": 2, "name": "模糊背景", "path": step_path_2})
                    logger.info(f"步骤2已保存: {step_path_2}")
                    print(f"步骤2 (模糊背景) 图片路径: {step_path_2}", file=sys.stderr, flush=True)
                    if step_callback:
                        step_callback(2, "模糊背景", step_path_2)
                    time.sleep(3)
                    logger.info("步骤2等待完成，继续下一步")
                
                # 步骤3: 合成（将描边的人物图合成到模糊的背景上）
                logger.info("步骤3开始：合成描边人物和模糊背景")
                # 将模糊的背景粘贴到画布
                canvas.paste(background, (0, 0))
                # 将带描边的人物图合成到画布上
                if person_with_border and person_position_info:
                    x = person_position_info['x']
                    y = person_position_info['y']
                    if person_with_border.mode == 'RGBA':
                        canvas.paste(person_with_border, (x, y), mask=person_with_border.split()[-1])
                    else:
                        canvas.paste(person_with_border, (x, y))
                    logger.info(f"步骤3完成：已合成到位置 ({x}, {y})")
                
                # 保存步骤3（合成后的最终结果）
                if save_steps:
                    step_path_3 = os.path.join(output_dir, f"step_3_composite_{safe_template_id}.png")
                    canvas_copy_3 = canvas.copy()
                    canvas_bgr_3 = cv2.cvtColor(np.array(canvas_copy_3), cv2.COLOR_RGB2BGR)
                    save_image(canvas_bgr_3, step_path_3)
                    step_path_3 = os.path.abspath(step_path_3)
                    step_paths.append({"step": 3, "name": "合成", "path": step_path_3})
                    logger.info(f"步骤3已保存: {step_path_3}")
                    print(f"步骤3 (合成) 图片路径: {step_path_3}", file=sys.stderr, flush=True)
                    if step_callback:
                        step_callback(3, "合成", step_path_3)
                    time.sleep(3)
                    logger.info("步骤3等待完成，继续下一步")
            else:
                # 普通背景处理
                logger.info("普通模板：处理背景效果")
                canvas = self._apply_background_effect(canvas, background_path, template)
                logger.info("背景效果已应用")
                
                # 保存背景步骤
                if save_steps:
                    step_path_bg = os.path.join(output_dir, f"step_1_background_{safe_template_id}.png")
                    # 复制画布以确保保存当前状态
                    canvas_copy_bg = canvas.copy()
                    canvas_bgr_bg = cv2.cvtColor(np.array(canvas_copy_bg), cv2.COLOR_RGB2BGR)
                    save_image(canvas_bgr_bg, step_path_bg)
                    # 确保路径是绝对路径
                    step_path_bg = os.path.abspath(step_path_bg)
                    step_paths.append({"step": 1, "name": "背景效果", "path": step_path_bg})
                    logger.info(f"背景步骤已保存: {step_path_bg}")
                    # 调用步骤回调
                    if step_callback:
                        step_callback(1, "背景效果", step_path_bg)
                    # 等待3秒
                    time.sleep(3)
                    logger.info("背景步骤等待完成，继续下一步")
                
                # 添加人物
                if person_path:
                    logger.info("添加人物")
                    canvas = self._add_person(canvas, person_path, template, person_mask)
                    logger.info("人物已添加")
                    
                    # 保存人物步骤
                    if save_steps:
                        step_path_person = os.path.join(output_dir, f"step_2_person_{safe_template_id}.png")
                        # 复制画布以确保保存当前状态
                        canvas_copy_person = canvas.copy()
                        canvas_bgr_person = cv2.cvtColor(np.array(canvas_copy_person), cv2.COLOR_RGB2BGR)
                        save_image(canvas_bgr_person, step_path_person)
                        # 确保路径是绝对路径
                        step_path_person = os.path.abspath(step_path_person)
                        step_paths.append({"step": 2, "name": "添加人物", "path": step_path_person})
                        logger.info(f"人物步骤已保存: {step_path_person}")
                        print(f"步骤2 (添加人物) 图片路径: {step_path_person}", file=sys.stderr, flush=True)
                        # 调用步骤回调
                        if step_callback:
                            step_callback(2, "添加人物", step_path_person)
                        # 等待3秒
                        time.sleep(3)
                        logger.info("人物步骤等待完成，继续下一步")

            # 添加文字
            if text_info:
                logger.info(f"准备添加文字 - text_info: {text_info}")
                print(f"准备添加文字 - title: '{text_info.get('title', '')}'", file=sys.stderr, flush=True)
                # _add_text 直接修改画布，但也会返回画布
                canvas = self._add_text(canvas, text_info, template)
                logger.info(f"文字添加完成，画布状态已更新")
                print(f"文字添加完成", file=sys.stderr, flush=True)
                
                # 保存文字步骤（在添加文字后立即保存）
                if save_steps:
                    step_path_text = os.path.join(output_dir, f"step_4_text_{safe_template_id}.png")
                    # 复制画布以确保保存当前状态（添加文字后的状态）
                    canvas_copy_text = canvas.copy()
                    canvas_bgr_text = cv2.cvtColor(np.array(canvas_copy_text), cv2.COLOR_RGB2BGR)
                    save_image(canvas_bgr_text, step_path_text)
                    # 确保路径是绝对路径
                    step_path_text = os.path.abspath(step_path_text)
                    step_paths.append({"step": 4, "name": "添加文字", "path": step_path_text})
                    logger.info(f"文字步骤已保存: {step_path_text}")
                    print(f"步骤4 (添加文字) 图片路径: {step_path_text}", file=sys.stderr, flush=True)
                    # 调用步骤回调
                    if step_callback:
                        step_callback(4, "添加文字", step_path_text)
                    # 等待3秒
                    time.sleep(3)
                    logger.info("文字步骤等待完成，继续下一步")

            # 添加蒙版（如果启用）
            if template.get('mask_enabled') and template.get('mask_image_path'):
                logger.info("添加蒙版")
                canvas = self._add_mask(canvas, template)
                logger.info("蒙版已添加")
                
                # 保存蒙版步骤
                if save_steps:
                    step_path_mask = os.path.join(output_dir, f"step_5_mask_{safe_template_id}.png")
                    canvas_copy_mask = canvas.copy()
                    canvas_bgr_mask = cv2.cvtColor(np.array(canvas_copy_mask), cv2.COLOR_RGB2BGR)
                    save_image(canvas_bgr_mask, step_path_mask)
                    step_path_mask = os.path.abspath(step_path_mask)
                    step_paths.append({"step": 5, "name": "添加蒙版", "path": step_path_mask})
                    logger.info(f"蒙版步骤已保存: {step_path_mask}")
                    if step_callback:
                        step_callback(5, "添加蒙版", step_path_mask)
                    time.sleep(3)
            
            # 应用最终效果
            canvas = self._apply_final_effects(canvas, template)
            
            # 保存最终效果步骤（如果有特殊效果）
            if save_steps and template.get('final_effects'):
                step_path_final = os.path.join(output_dir, f"step_5_final_{safe_template_id}.png")
                # 复制画布以确保保存当前状态
                canvas_copy_final = canvas.copy()
                canvas_bgr_final = cv2.cvtColor(np.array(canvas_copy_final), cv2.COLOR_RGB2BGR)
                save_image(canvas_bgr_final, step_path_final)
                # 确保路径是绝对路径
                step_path_final = os.path.abspath(step_path_final)
                step_paths.append({"step": 5, "name": "最终效果", "path": step_path_final})
                logger.info(f"最终效果步骤已保存: {step_path_final}")
                print(f"步骤5 (最终效果) 图片路径: {step_path_final}", file=sys.stderr, flush=True)
                # 调用步骤回调
                if step_callback:
                    step_callback(5, "最终效果", step_path_final)
                # 等待3秒
                time.sleep(3)
                logger.info("最终效果步骤等待完成")

            # 转换为OpenCV格式并保存最终结果
            canvas_bgr = cv2.cvtColor(np.array(canvas), cv2.COLOR_RGB2BGR)
            save_image(canvas_bgr, output_path)

            logger.info(f"封面生成成功: {output_path}")
            
            # 如果保存了中间步骤，返回包含步骤信息的字典
            if save_steps:
                return {
                    "cover_path": output_path,
                    "steps": step_paths
                }
            else:
                return output_path

        except Exception as e:
            logger.error(f"封面生成失败: {e}")
            raise

    def _apply_person_background_blur(self, canvas: Image.Image, person_path: Optional[str],
                                     person_mask: Optional[np.ndarray], template: Dict[str, Any]) -> Image.Image:
        """对背景区域应用模糊，保持人物清晰
        
        Args:
            canvas: 画布（已经添加了人物）
            person_path: 人物图路径
            person_mask: 人物mask
            template: 模板配置
            
        Returns:
            处理后的画布
        """
        try:
            if not CV2_AVAILABLE:
                # 如果cv2不可用，使用PIL的模糊（会模糊整张图，包括人物）
                cover_style = template.get('cover_style', {})
                blur_radius = cover_style.get('backgroundBlurIntensity')
                if blur_radius is None:
                    blur_radius = template.get('background_blur_intensity')
                if blur_radius is None:
                    blur_radius = template.get('blur_intensity', 8)  # 兼容旧字段
                logger.warning("OpenCV不可用，将模糊整张图（包括人物）")
                return canvas.filter(ImageFilter.GaussianBlur(radius=blur_radius))
            
            if not person_path:
                logger.warning("人物路径为空，跳过背景模糊")
                return canvas

            # 转换为numpy数组
            canvas_array = np.array(canvas)
            canvas_h, canvas_w = canvas_array.shape[:2]
            
            # 获取模糊半径（优先使用cover_style中的配置）
            cover_style = template.get('cover_style', {})
            blur_radius = cover_style.get('backgroundBlurIntensity')
            if blur_radius is None:
                blur_radius = template.get('background_blur_intensity')
            if blur_radius is None:
                blur_radius = template.get('blur_intensity', 8)  # 兼容旧字段
            
            logger.info(f"背景模糊半径: {blur_radius} (来源: cover_style={cover_style.get('backgroundBlurIntensity')}, template={template.get('background_blur_intensity')})")
            
            # 读取人物图以获取mask和位置信息
            try:
                # 确保使用绝对路径
                if not os.path.isabs(person_path):
                    # 如果是相对路径，尝试从当前工作目录解析
                    person_path_abs = os.path.abspath(person_path)
                else:
                    person_path_abs = person_path
                
                logger.info(f"尝试读取人物图像: {person_path_abs}")
                if not os.path.exists(person_path_abs):
                    logger.warning(f"人物图像文件不存在: {person_path_abs}")
                    # 如果文件不存在，尝试使用person_mask
                    if person_mask is not None:
                        logger.info("使用提供的person_mask进行背景模糊")
                    else:
                        return canvas
                
                person_img = Image.open(person_path_abs)
                # 强制加载图像数据
                person_img.load()
                logger.info(f"人物图像读取成功: {person_img.size}, mode: {person_img.mode}")
            except Exception as e:
                logger.warning(f"读取人物图像失败: {e}，尝试使用person_mask")
                person_img = None
            
            person_position = template.get('person_position', 'center')
            
            # 创建人物区域的mask
            if person_mask is not None:
                # 优先使用提供的person_mask
                mask_h, mask_w = person_mask.shape[:2]
                person_width = int(canvas_w * template.get('person_size', 0.9))
                person_height = int(person_width * mask_h / mask_w)
                if person_height > canvas_h * 0.9:
                    person_height = int(canvas_h * 0.9)
                    person_width = int(person_height * mask_w / mask_h)
                
                x, y = self._calculate_position(person_position, (person_width, person_height), (canvas_w, canvas_h))
                alpha_resized = cv2.resize(person_mask, (person_width, person_height))
                logger.info(f"使用person_mask，尺寸: {alpha_resized.shape}, 位置: ({x}, {y})")
            elif person_img is not None:
                # 从人物图获取尺寸和位置
                person_width = int(canvas_w * template.get('person_size', 0.9))
                person_height = int(person_width * person_img.height / person_img.width)
                if person_height > canvas_h * 0.9:
                    person_height = int(canvas_h * 0.9)
                    person_width = int(person_height * person_img.width / person_img.height)
                
                x, y = self._calculate_position(person_position, (person_width, person_height), (canvas_w, canvas_h))
                
                if person_img.mode == 'RGBA':
                    # 从人物图提取alpha通道作为mask
                    try:
                        alpha = np.array(person_img.split()[-1])
                        # 调整mask大小
                        alpha_resized = cv2.resize(alpha, (person_width, person_height))
                        logger.info(f"从RGBA图像提取alpha通道，尺寸: {alpha_resized.shape}, 位置: ({x}, {y})")
                    except Exception as e:
                        logger.warning(f"提取alpha通道失败: {e}，创建矩形mask")
                        alpha_resized = np.ones((person_height, person_width), dtype=np.uint8) * 255
                else:
                    # 创建简单的矩形mask（基于人物位置和大小）
                    alpha_resized = np.ones((person_height, person_width), dtype=np.uint8) * 255
                    logger.info(f"创建矩形mask，尺寸: {alpha_resized.shape}, 位置: ({x}, {y})")
            else:
                logger.warning("无法获取人物图像或mask，跳过背景模糊")
                return canvas
            
            # 创建画布大小的mask
            canvas_mask = np.zeros((canvas_h, canvas_w), dtype=np.uint8)
            
            # 将人物mask放置到正确位置
            start_y = max(0, y)
            end_y = min(canvas_h, y + person_height)
            start_x = max(0, x)
            end_x = min(canvas_w, x + person_width)
            
            mask_start_y = max(0, -y)
            mask_end_y = mask_start_y + (end_y - start_y)
            mask_start_x = max(0, -x)
            mask_end_x = mask_start_x + (end_x - start_x)
            
            if mask_end_y > mask_start_y and mask_end_x > mask_start_x:
                canvas_mask[start_y:end_y, start_x:end_x] = alpha_resized[mask_start_y:mask_end_y, mask_start_x:mask_end_x]
            
            # 对整张图应用模糊
            blurred = cv2.GaussianBlur(canvas_array, (blur_radius * 2 + 1, blur_radius * 2 + 1), blur_radius)
            
            # 归一化mask（人物区域=1保持清晰，背景区域=0使用模糊）
            mask_normalized = canvas_mask.astype(float) / 255.0
            
            # 使用mask混合：人物区域保持清晰，背景区域模糊
            mask_3d = np.stack([mask_normalized] * 3, axis=2)
            result = (canvas_array * mask_3d + blurred * (1 - mask_3d)).astype(np.uint8)
            
            return Image.fromarray(result)

        except Exception as e:
            logger.warning(f"应用人物背景模糊失败: {e}")
            import traceback
            logger.warning(traceback.format_exc())
            return canvas

    def _create_canvas(self, template: Dict[str, Any]) -> Image.Image:
        """创建画布"""
        width, height = self.template_config['canvas_size']

        # 创建背景
        if template.get('background_color'):
            canvas = Image.new('RGB', (width, height), template['background_color'])
        else:
            canvas = Image.new('RGB', (width, height), self.template_config['background_color'])

        return canvas

    def _apply_background_effect(self, canvas: Image.Image, background_path: str,
                               template: Dict[str, Any]) -> Image.Image:
        """应用背景效果"""
        try:
            # 读取背景图
            background = Image.open(background_path).convert('RGB')

            # 调整背景图大小
            canvas_width, canvas_height = canvas.size
            background = self._resize_image(background, (canvas_width, canvas_height))

            effect_type = template.get('background_effect', 'blur')

            if effect_type == 'blur':
                # 高斯模糊
                background = background.filter(ImageFilter.GaussianBlur(radius=10))

            elif effect_type == 'gradient':
                # 渐变覆盖（从下到上，从透明到半透明黑色）
                overlay = Image.new('RGBA', background.size, (0, 0, 0, 0))
                for y in range(background.height):
                    alpha = int(180 * (1 - y / background.height))  # 从下到上逐渐变透明
                    for x in range(background.width):
                        overlay.putpixel((x, y), (0, 0, 0, alpha))
                background = Image.alpha_composite(background.convert('RGBA'), overlay).convert('RGB')

            elif effect_type == 'solid':
                # 斜切色块背景（cut_angle模板使用）
                logger.info("应用斜切色块效果（solid）")
                # 先添加半透明的深色覆盖层
                overlay = Image.new('RGBA', background.size, (20, 20, 30, 200))
                background = Image.alpha_composite(background.convert('RGBA'), overlay).convert('RGB')
                
                # 添加斜切色块效果
                if CV2_AVAILABLE:
                    logger.info("使用OpenCV绘制斜切多边形")
                    # 使用OpenCV绘制斜切多边形
                    bg_array = np.array(background)
                    h, w = bg_array.shape[:2]
                    
                    # 创建一个斜切的多边形（从左上角到右下角的斜切）
                    # 定义多边形的顶点（斜切形状）
                    points = np.array([
                        [0, 0],                    # 左上
                        [int(w * 0.3), 0],         # 右上（斜切点1）
                        [int(w * 0.7), h],         # 右下（斜切点2）
                        [0, h]                     # 左下
                    ], np.int32)
                    
                    # 创建mask
                    mask = np.zeros((h, w), dtype=np.uint8)
                    cv2.fillPoly(mask, [points], 255)
                    
                    # 创建色块（使用亮色，如黄色或橙色）
                    color_block = np.zeros_like(bg_array)
                    color_block[:] = (255, 200, 50)  # 金黄色
                    
                    # 将色块应用到背景（使用mask，60%透明度）
                    mask_3d = np.stack([mask] * 3, axis=2) / 255.0
                    bg_array = (bg_array * (1 - mask_3d * 0.6) + color_block * (mask_3d * 0.6)).astype(np.uint8)
                    
                    background = Image.fromarray(bg_array)
                    logger.info("斜切色块效果已应用（OpenCV）")
                else:
                    # 如果没有OpenCV，使用PIL绘制简单的斜切矩形
                    draw = ImageDraw.Draw(background, 'RGBA')
                    w, h = background.size
                    # 绘制一个斜切的矩形（使用多边形）
                    points = [
                        (0, 0),
                        (int(w * 0.3), 0),
                        (int(w * 0.7), h),
                        (0, h)
                    ]
                    draw.polygon(points, fill=(255, 200, 50, 150))
                    logger.info("斜切色块效果已应用（PIL）")

            elif effect_type == 'blur-person':
                # 人物突出背景虚化（需要在添加人物后处理）
                blur_radius = template.get('blur_intensity', 8)
                background = background.filter(ImageFilter.GaussianBlur(radius=blur_radius))

            # 将背景合成到画布
            canvas.paste(background, (0, 0))

            return canvas

        except Exception as e:
            logger.warning(f"应用背景效果失败: {e}")
            return canvas

    def _add_person(self, canvas: Image.Image, person_path: str,
                   template: Dict[str, Any], person_mask: Optional[np.ndarray] = None) -> Image.Image:
        """添加人物（支持描边效果）
        
        Args:
            canvas: 画布
            person_path: 人物图路径
            template: 模板配置
            person_mask: 人物mask（用于描边）
        """
        try:
            if not person_path:
                logger.warning("人物路径为空，跳过添加人物")
                return canvas
            
            # 确保使用绝对路径
            if not os.path.isabs(person_path):
                person_path_abs = os.path.abspath(person_path)
            else:
                person_path_abs = person_path
            
            logger.info(f"添加人物 - 读取图像: {person_path_abs}")
            if not os.path.exists(person_path_abs):
                logger.warning(f"人物图像文件不存在: {person_path_abs}")
                return canvas
            
            # 读取人物图（应该是带透明背景的PNG）
            person = Image.open(person_path_abs)
            logger.info(f"人物图像读取成功: {person.size}, mode: {person.mode}")
            original_person = person.copy()

            # 保存alpha通道（如果有）
            alpha_channel = None
            if person.mode == 'RGBA':
                # 保留alpha通道用于透明合成
                alpha_channel = person.split()[-1]
                # 保持RGBA格式，不要转换为RGB
                person_rgba = person
            elif person.mode == 'RGB':
                # 没有alpha通道，创建不透明的人物图
                person_rgba = person
                alpha_channel = None
            else:
                person_rgba = person.convert('RGBA')
                alpha_channel = person_rgba.split()[-1] if person_rgba.mode == 'RGBA' else None

            # 计算人物大小和位置
            canvas_width, canvas_height = canvas.size
            
            # 检查是否有自定义位置和大小
            person_position_custom = template.get('person_position_custom')
            person_size_custom = template.get('person_size')
            
            if person_position_custom and person_size_custom is not None:
                # 使用自定义位置和大小（百分比坐标）
                person_size_ratio = person_size_custom  # 已经是0-1的小数
                person_width = int(canvas_width * person_size_ratio)
                person_height = int(person_width * person_rgba.height / person_rgba.width)
                
                # 确保不超过画布高度
                if person_height > canvas_height * 0.95:
                    person_height = int(canvas_height * 0.95)
                    person_width = int(person_height * person_rgba.width / person_rgba.height)
                
                # 计算位置（百分比坐标转换为像素）
                x = int((person_position_custom.get('x', 50) / 100.0) * canvas_width)
                y = int((person_position_custom.get('y', 50) / 100.0) * canvas_height)
                # 调整为中心对齐（因为位置是中心点）
                x = x - person_width // 2
                y = y - person_height // 2
                # 确保在画布范围内
                x = max(0, min(x, canvas_width - person_width))
                y = max(0, min(y, canvas_height - person_height))
                logger.info(f"使用自定义位置和大小 - 大小: {person_size_ratio}, 位置: ({x}, {y})")
            else:
                # 使用预设位置和大小
                person_size_ratio = template.get('person_size', 0.8)
                person_width = int(canvas_width * person_size_ratio)
                person_height = int(person_width * person_rgba.height / person_rgba.width)

                # 确保不超过画布高度
                if person_height > canvas_height * 0.9:
                    person_height = int(canvas_height * 0.9)
                    person_width = int(person_height * person_rgba.width / person_rgba.height)

                # 计算位置
                person_position = template.get('person_position', 'center')
                x, y = self._calculate_position(person_position, (person_width, person_height), canvas.size)

            person_resized = person_rgba.resize((person_width, person_height), Image.LANCZOS)
            
            # 提取alpha通道
            if person_resized.mode == 'RGBA':
                alpha_resized = person_resized.split()[-1]
            else:
                alpha_resized = None

            # 检查是否启用描边（对于blur-person模板或自定义模板）
            background_effect = template.get('background_effect')
            is_custom_template = template.get('is_custom', False)
            cover_style = template.get('cover_style', {})
            person_border_enabled = cover_style.get('personBorderEnabled')
            if person_border_enabled is None:
                # 如果没有设置，从template中读取
                person_border_enabled = template.get('person_border_enabled')
                if person_border_enabled is None:
                    # 如果还是没有设置，对于blur-person模板默认启用，其他模板默认禁用
                    person_border_enabled = (background_effect == 'blur-person' or background_effect == 'blur_person')
            
            logger.info(f"添加人物 - background_effect: {background_effect}, is_custom: {is_custom_template}, personBorderEnabled: {person_border_enabled}")
            logger.info(f"描边启用状态 - personBorderEnabled: {person_border_enabled}, 来源: cover_style={cover_style.get('personBorderEnabled')}, template={template.get('person_border_enabled')}")
            
            # 如果是blur-person模板或启用了描边，需要先合成人物，然后添加描边
            needs_border = (background_effect == 'blur-person' or background_effect == 'blur_person' or person_border_enabled)
            
            if needs_border:
                logger.info("需要添加描边：合成人物并添加描边")
                # 先合成人物（使用透明背景）
                if alpha_resized is not None:
                    # 将alpha_resized转换为PIL Image mask
                    if isinstance(alpha_resized, np.ndarray):
                        alpha_mask = Image.fromarray(alpha_resized)
                    else:
                        alpha_mask = alpha_resized
                    canvas.paste(person_resized, (x, y), mask=alpha_mask)
                    logger.info(f"人物已合成到位置 ({x}, {y})，使用alpha通道")
                else:
                    canvas.paste(person_resized, (x, y))
                    logger.info(f"人物已合成到位置 ({x}, {y})，无alpha通道")
                
                if person_border_enabled:
                    # 然后添加描边（描边是直接绘制在画布上的）
                    logger.info("开始添加人物描边")
                    try:
                        # 如果有person_mask（numpy array），优先使用它，否则使用alpha_resized
                        border_mask = None
                        if person_mask is not None and isinstance(person_mask, np.ndarray):
                            # 调整person_mask大小以匹配person_resized
                            mask_h, mask_w = person_mask.shape[:2]
                            if mask_h != person_height or mask_w != person_width:
                                border_mask = cv2.resize(person_mask, (person_width, person_height))
                                logger.info(f"使用person_mask进行描边，已调整大小: {border_mask.shape}")
                            else:
                                border_mask = person_mask
                                logger.info(f"使用person_mask进行描边，原始大小: {border_mask.shape}")
                        elif alpha_resized is not None:
                            # 使用alpha_resized作为mask
                            if isinstance(alpha_resized, np.ndarray):
                                border_mask = alpha_resized
                            else:
                                border_mask = np.array(alpha_resized)
                            logger.info(f"使用alpha_resized进行描边: {border_mask.shape}")
                        
                        if border_mask is not None:
                            canvas = self._add_person_border_to_canvas(canvas, person_resized, border_mask, (x, y), template)
                            logger.info("人物描边添加完成")
                        else:
                            logger.warning("无法获取mask，跳过描边")
                    except Exception as e:
                        logger.warning(f"添加人物描边失败: {e}")
                        import traceback
                        logger.warning(traceback.format_exc())
                else:
                    logger.info("描边已禁用，跳过描边处理")
            else:
                # 普通模板，直接合成人物（使用透明背景）
                logger.info(f"普通模板：合成人物到位置 ({x}, {y})")
                if alpha_resized is not None:
                    if isinstance(alpha_resized, np.ndarray):
                        alpha_mask = Image.fromarray(alpha_resized)
                    else:
                        alpha_mask = alpha_resized
                    canvas.paste(person_resized, (x, y), mask=alpha_mask)
                else:
                    canvas.paste(person_resized, (x, y))

            return canvas

        except Exception as e:
            logger.warning(f"添加人物失败: {e}")
            return canvas

    def _create_person_with_border(self, person_path: str, template: Dict[str, Any], 
                                   person_mask: Optional[np.ndarray] = None) -> Tuple[Image.Image, Dict[str, int]]:
        """在透明画布上创建带描边的人物图
        
        Args:
            person_path: 人物图路径
            template: 模板配置
            person_mask: 人物mask（用于描边）
            
        Returns:
            (带描边的人物图, 位置信息字典 {'x': int, 'y': int, 'width': int, 'height': int})
        """
        try:
            # 读取人物图
            if not os.path.isabs(person_path):
                person_path_abs = os.path.abspath(person_path)
            else:
                person_path_abs = person_path
            
            person_img = Image.open(person_path_abs)
            if person_img.mode != 'RGBA':
                person_img = person_img.convert('RGBA')
            
            # 计算人物大小和位置（基于画布尺寸）
            canvas_width, canvas_height = 1080, 1920  # 标准画布尺寸
            person_position_custom = template.get('person_position_custom')
            person_size_custom = template.get('person_size')
            
            if person_position_custom and person_size_custom is not None:
                person_size_ratio = person_size_custom
                person_width = int(canvas_width * person_size_ratio)
                person_height = int(person_width * person_img.height / person_img.width)
                if person_height > canvas_height * 0.95:
                    person_height = int(canvas_height * 0.95)
                    person_width = int(person_height * person_img.width / person_img.height)
                x = int((person_position_custom.get('x', 50) / 100.0) * canvas_width) - person_width // 2
                y = int((person_position_custom.get('y', 50) / 100.0) * canvas_height) - person_height // 2
                x = max(0, min(x, canvas_width - person_width))
                y = max(0, min(y, canvas_height - person_height))
            else:
                person_size_ratio = template.get('person_size', 0.8)
                person_width = int(canvas_width * person_size_ratio)
                person_height = int(person_width * person_img.height / person_img.width)
                if person_height > canvas_height * 0.9:
                    person_height = int(canvas_height * 0.9)
                    person_width = int(person_height * person_img.width / person_img.height)
                person_position = template.get('person_position', 'center')
                x, y = self._calculate_position(person_position, (person_width, person_height), (canvas_width, canvas_height))
            
            # 调整人物图大小
            person_resized = person_img.resize((person_width, person_height), Image.LANCZOS)
            
            # 提取alpha通道
            if person_resized.mode == 'RGBA':
                alpha_resized = person_resized.split()[-1]
                # 转换为numpy array用于描边
                if isinstance(alpha_resized, Image.Image):
                    alpha_array = np.array(alpha_resized)
                else:
                    alpha_array = alpha_resized
            else:
                alpha_array = None
            
            # 如果有person_mask，调整大小
            border_mask = None
            if person_mask is not None and isinstance(person_mask, np.ndarray):
                mask_h, mask_w = person_mask.shape[:2]
                if mask_h != person_height or mask_w != person_width:
                    border_mask = cv2.resize(person_mask, (person_width, person_height))
                else:
                    border_mask = person_mask
            elif alpha_array is not None:
                border_mask = alpha_array
            
            # 创建带描边的人物图（在透明画布上）
            # 这个方法会返回扩展后的图像（包含padding）
            person_with_border = self._add_person_border_to_canvas(None, person_resized,
                                                                   border_mask if border_mask is not None else alpha_array,
                                                                   (0, 0), template)
            
            # 获取描边宽度以计算padding
            cover_style = template.get('cover_style', {})
            border_width = cover_style.get('personBorderWidth')
            if border_width is None:
                border_width = template.get('person_border_width', 6)
            padding = border_width * 2
            
            # 调整位置信息以考虑padding（图像扩大了，所以位置需要向左上偏移）
            adjusted_x = x - padding
            adjusted_y = y - padding
            adjusted_width = person_width + padding * 2
            adjusted_height = person_height + padding * 2
            
            position_info = {
                'x': adjusted_x,
                'y': adjusted_y,
                'width': adjusted_width,
                'height': adjusted_height
            }
            logger.info(f"位置信息已调整 - 原始: ({x}, {y}, {person_width}x{person_height}), 调整后: ({adjusted_x}, {adjusted_y}, {adjusted_width}x{adjusted_height}), padding: {padding}")
            return person_with_border, position_info
            
        except Exception as e:
            logger.warning(f"创建带描边的人物图失败: {e}")
            import traceback
            logger.warning(traceback.format_exc())
            # 返回原始人物图和默认位置
            person_img = Image.open(person_path).convert('RGBA')
            canvas_width, canvas_height = 1080, 1920
            person_width = int(canvas_width * 0.8)
            person_height = int(person_width * person_img.height / person_img.width)
            person_resized = person_img.resize((person_width, person_height), Image.LANCZOS)
            x, y = self._calculate_position('center', (person_width, person_height), (canvas_width, canvas_height))
            return person_resized, {'x': x, 'y': y, 'width': person_width, 'height': person_height}

    def _add_person_border_to_canvas(self, canvas: Optional[Image.Image], person_img: Image.Image, 
                                    mask: Optional[Union[Image.Image, np.ndarray]], position: Tuple[int, int],
                                    template: Dict[str, Any]) -> Image.Image:
        """在画布上为人物添加描边效果（如果canvas为None，则在透明画布上创建带描边的人物图）
        
        Args:
            canvas: 画布（如果为None，则创建新的透明画布）
            person_img: 人物图像
            mask: 人物mask（alpha通道）
            position: 人物在画布上的位置 (x, y)（如果canvas为None，则忽略）
            template: 模板配置
            
        Returns:
            如果canvas不为None，返回添加描边后的画布；如果canvas为None，返回带描边的人物图
        """
        try:
            if not CV2_AVAILABLE:
                logger.warning("opencv不可用，跳过描边效果")
                return canvas if canvas is not None else person_img
            
            x, y = position
            
            # 获取mask
            logger.info(f"描边 - person_img.mode: {person_img.mode}, mask类型: {type(mask)}")
            if mask is None:
                # 从人物图像提取alpha通道作为mask
                if person_img.mode == 'RGBA':
                    # 直接从RGBA图像提取alpha通道
                    try:
                        mask_array = np.array(person_img.split()[-1])
                        logger.info(f"从RGBA图像提取alpha通道成功，尺寸: {mask_array.shape}, 值范围: {mask_array.min()}-{mask_array.max()}")
                    except Exception as e:
                        logger.warning(f"提取alpha通道失败: {e}，尝试从图像创建mask")
                        person_array = np.array(person_img.convert('RGB'))
                        gray = cv2.cvtColor(person_array, cv2.COLOR_RGB2GRAY)
                        _, mask_array = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
                else:
                    # 如果没有alpha通道，尝试从图像创建mask
                    person_array = np.array(person_img.convert('RGB'))
                    # 转换为灰度图
                    gray = cv2.cvtColor(person_array, cv2.COLOR_RGB2GRAY)
                    # 使用阈值创建mask（假设背景较亮）
                    _, mask_array = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
                    logger.info(f"从RGB图像创建mask，尺寸: {mask_array.shape}")
            else:
                # 使用提供的mask
                if isinstance(mask, Image.Image):
                    mask_array = np.array(mask)
                else:
                    mask_array = mask
                if len(mask_array.shape) == 3:
                    mask_array = cv2.cvtColor(mask_array, cv2.COLOR_RGB2GRAY)
                elif len(mask_array.shape) == 2:
                    pass  # 已经是单通道
                else:
                    logger.warning("mask格式不正确")
                    return canvas

            # 使用适中的阈值来二值化mask
            _, mask_array = cv2.threshold(mask_array, 127, 255, cv2.THRESH_BINARY)
            logger.info(f"mask二值化完成 - 非零像素: {np.count_nonzero(mask_array)}, 总像素: {mask_array.size}")
            
            # 中等强度的边缘平滑：平衡均匀性和自然曲线
            smooth_kernel_size = max(7, border_width)
            if smooth_kernel_size % 2 == 0:
                smooth_kernel_size += 1
            smooth_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (smooth_kernel_size, smooth_kernel_size))
            
            # 闭运算：填充小孔和平滑凹陷
            mask_array = cv2.morphologyEx(mask_array, cv2.MORPH_CLOSE, smooth_kernel)
            # 开运算：去除小突起和平滑凸出
            mask_array = cv2.morphologyEx(mask_array, cv2.MORPH_OPEN, smooth_kernel)
            
            logger.info(f"mask边缘中等平滑完成 - smooth_kernel_size: {smooth_kernel_size}")

            # 描边参数（优先使用cover_style中的配置）
            cover_style = template.get('cover_style', {})
            logger.info(f"描边函数 - cover_style内容: {cover_style}")
            logger.info(f"描边函数 - template中的person_border_color: {template.get('person_border_color')}")
            logger.info(f"描边函数 - template中的person_border_width: {template.get('person_border_width')}")
            
            # 优先使用cover_style中的配置，然后使用template中的配置，最后使用默认值
            border_width = cover_style.get('personBorderWidth')
            if border_width is None:
                border_width = template.get('person_border_width', 6)
            
            border_color = cover_style.get('personBorderColor')
            if border_color is None:
                border_color = template.get('person_border_color', '#FFFFFF')
            
            border_style = cover_style.get('personBorderStyle')
            if border_style is None:
                border_style = template.get('person_border_style', 'solid')
            
            logger.info(f"描边参数 - width: {border_width}, color: {border_color}, style: {border_style}")
            logger.info(f"描边参数来源 - cover_style.personBorderWidth: {cover_style.get('personBorderWidth')}, template.person_border_width: {template.get('person_border_width')}")
            logger.info(f"描边参数来源 - cover_style.personBorderColor: {cover_style.get('personBorderColor')}, template.person_border_color: {template.get('person_border_color')}")
            logger.info(f"描边参数来源 - cover_style.personBorderStyle: {cover_style.get('personBorderStyle')}, template.person_border_style: {template.get('person_border_style')}")
            if border_style == 'dashed' or str(border_style).lower() == 'dashed':
                logger.info(f"虚线参数来源 - cover_style.personBorderDashLength: {cover_style.get('personBorderDashLength')}, template.person_border_dash_length: {template.get('person_border_dash_length')}")
                logger.info(f"虚线参数来源 - cover_style.personBorderGapLength: {cover_style.get('personBorderGapLength')}, template.person_border_gap_length: {template.get('person_border_gap_length')}")
            
            # 转换颜色
            if isinstance(border_color, str):
                if border_color.startswith('#'):
                    try:
                        # 确保颜色字符串格式正确（6位十六进制）
                        color_hex = border_color[1:] if border_color.startswith('#') else border_color
                        if len(color_hex) == 6:
                            border_rgb = tuple(int(color_hex[i:i+2], 16) for i in (0, 2, 4))
                        elif len(color_hex) == 3:
                            # 支持3位十六进制（如 #FFF）
                            border_rgb = tuple(int(c*2, 16) for c in color_hex)
                        else:
                            border_rgb = self._parse_color(border_color)
                    except (ValueError, IndexError) as e:
                        logger.warning(f"颜色解析失败: {border_color}, 错误: {e}，使用默认白色")
                        border_rgb = (255, 255, 255)
                else:
                    # 使用颜色名称（如 'white', 'red' 等）
                    border_rgb = self._parse_color(border_color)
            else:
                border_rgb = (255, 255, 255)  # 默认白色
            
            logger.info(f"描边颜色RGB: {border_rgb} (来源: {border_color})")

            # 使用多次小幅度膨胀生成完全均匀的描边
            # 这种方法比一次大膨胀更均匀
            
            # 使用小的椭圆kernel进行多次膨胀
            small_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            
            # 计算需要膨胀的次数（基于border_width）
            iterations = max(1, border_width)
            
            # 执行膨胀
            dilated_mask = mask_array.copy()
            for i in range(iterations):
                dilated_mask = cv2.dilate(dilated_mask, small_kernel, iterations=1)
            
            # 边缘 = 膨胀后的mask - 原始mask
            border_mask = cv2.subtract(dilated_mask, mask_array)
            
            logger.info(f"使用多次膨胀生成描边 - iterations: {iterations}, border_mask非零像素: {np.count_nonzero(border_mask)}")
            
            # 如果是虚线样式，需要进一步处理
            if border_style == 'dashed':
                # 虚线处理会在后面的_create_dashed_border中进行
                pass
            else:
                # 如果轮廓检测失败，回退到形态学方法
                logger.warning("轮廓检测失败，使用形态学方法生成描边")
                kernel_size = border_width * 2 + 1
                kernel = np.ones((kernel_size, kernel_size), np.uint8)
                iterations = max(1, border_width // 2)
                dilated_mask = cv2.dilate(mask_array, kernel, iterations=iterations)
                # 确保只得到边缘：膨胀后的mask减去原始mask
                border_mask = cv2.subtract(dilated_mask, mask_array)
                logger.info(f"使用形态学方法生成描边 - border_width: {border_width}, iterations: {iterations}, border_mask非零像素: {np.count_nonzero(border_mask)}")
            
            # 如果是虚线样式，需要处理border_mask（必须在应用描边之前处理）
            logger.info(f"检查描边样式 - border_style: {border_style}, type: {type(border_style)}")
            if border_style == 'dashed' or str(border_style).lower() == 'dashed':
                # 获取虚线参数（优先使用cover_style中的配置）
                # 注意：前端可能传递 null/None，需要正确处理
                dash_length_raw = cover_style.get('personBorderDashLength')
                logger.info(f"虚线长度读取 - cover_style.personBorderDashLength: {dash_length_raw}, type: {type(dash_length_raw)}")
                if dash_length_raw is None or dash_length_raw == 0 or dash_length_raw == '':
                    dash_length_raw = template.get('person_border_dash_length')
                    logger.info(f"虚线长度读取 - template.person_border_dash_length: {dash_length_raw}, type: {type(dash_length_raw)}")
                
                # 转换为整数（如果有效），否则为None
                if dash_length_raw is not None and dash_length_raw != 0 and dash_length_raw != '':
                    try:
                        dash_length = int(float(dash_length_raw))  # 支持字符串数字
                        logger.info(f"虚线长度已转换: {dash_length}")
                    except (ValueError, TypeError):
                        dash_length = None
                        logger.warning(f"虚线长度转换失败: {dash_length_raw}")
                else:
                    dash_length = None
                    logger.info(f"虚线长度未设置，将使用默认值")
                
                gap_length_raw = cover_style.get('personBorderGapLength')
                logger.info(f"虚线间隔读取 - cover_style.personBorderGapLength: {gap_length_raw}, type: {type(gap_length_raw)}")
                if gap_length_raw is None or gap_length_raw == 0 or gap_length_raw == '':
                    gap_length_raw = template.get('person_border_gap_length')
                    logger.info(f"虚线间隔读取 - template.person_border_gap_length: {gap_length_raw}, type: {type(gap_length_raw)}")
                
                # 转换为整数（如果有效），否则为None
                if gap_length_raw is not None and gap_length_raw != 0 and gap_length_raw != '':
                    try:
                        gap_length = int(float(gap_length_raw))  # 支持字符串数字
                        logger.info(f"虚线间隔已转换: {gap_length}")
                    except (ValueError, TypeError):
                        gap_length = None
                        logger.warning(f"虚线间隔转换失败: {gap_length_raw}")
                else:
                    gap_length = None
                    logger.info(f"虚线间隔未设置，将使用默认值")
                
                logger.info(f"虚线参数最终值 - border_width: {border_width}, dash_length: {dash_length}, gap_length: {gap_length}")
                logger.info(f"虚线参数来源 - cover_style.personBorderDashLength: {cover_style.get('personBorderDashLength')}, template.person_border_dash_length: {template.get('person_border_dash_length')}")
                logger.info(f"虚线参数来源 - cover_style.personBorderGapLength: {cover_style.get('personBorderGapLength')}, template.person_border_gap_length: {template.get('person_border_gap_length')}")
                border_mask = self._create_dashed_border(border_mask, border_width, dash_length, gap_length)
                logger.info(f"虚线描边已应用 - border_width: {border_width}, dash_length: {dash_length}, gap_length: {gap_length}")

            # 新的逻辑：扩大画布以容纳描边，避免描边被裁剪
            # 1. 计算需要扩展的边距（描边宽度的3倍，确保足够空间）
            padding = border_width * 3
            person_width, person_height = person_img.size
            expanded_width = person_width + padding * 2
            expanded_height = person_height + padding * 2
            
            # 2. 创建扩展后的透明画布
            person_with_border = Image.new('RGBA', (expanded_width, expanded_height), (0, 0, 0, 0))
            
            # 3. 将人物图像粘贴到扩展画布的中心
            if person_img.mode == 'RGBA':
                person_with_border.paste(person_img, (padding, padding))
            else:
                person_with_border.paste(person_img.convert('RGBA'), (padding, padding))
            
            logger.info(f"创建扩展画布用于描边: {expanded_width}x{expanded_height} (原始: {person_width}x{person_height}, padding: {padding})")
            
            # 4. 将已经生成好的均匀描边mask放到扩展画布上
            # 不要重新生成，直接使用之前通过多次膨胀生成的均匀border_mask
            expanded_mask = np.zeros((expanded_height, expanded_width), dtype=np.uint8)
            expanded_mask[padding:padding+person_height, padding:padding+person_width] = border_mask
            
            logger.info(f"将均匀描边mask放到扩展画布 - 非零像素: {np.count_nonzero(expanded_mask)}")
            
            # 5. 在扩展画布上绘制描边
            person_array = np.array(person_with_border)
            border_mask_3d = np.stack([expanded_mask] * 3, axis=2) / 255.0  # 归一化到0-1
            
            # 应用描边颜色
            border_rgb_array = np.array(border_rgb, dtype=np.float32)
            h, w = person_array.shape[:2]
            border_rgb_3d = np.tile(border_rgb_array.reshape(1, 1, 3), (h, w, 1))
            
            # 分离RGB和Alpha通道
            person_rgb = person_array[:, :, :3].astype(np.float32)
            person_alpha = person_array[:, :, 3:4].astype(np.float32) / 255.0
            
            # 对RGB通道应用描边
            person_rgb = (person_rgb * (1 - border_mask_3d) +
                         border_rgb_3d * border_mask_3d).astype(np.uint8)
            
            # 对Alpha通道：描边区域不透明
            border_alpha_mask = expanded_mask[:, :, np.newaxis] / 255.0
            person_alpha_new = np.maximum(person_alpha, border_alpha_mask) * 255.0
            person_alpha_new = person_alpha_new.astype(np.uint8)
            
            # 合并RGB和Alpha通道
            person_array = np.concatenate([person_rgb, person_alpha_new], axis=2)
            
            person_with_border = Image.fromarray(person_array, 'RGBA')
            logger.info(f"描边已应用到扩展画布，颜色RGB: {border_rgb}")
            
            # 6. 返回带描边的人物图像（包含padding）
            logger.info(f"带描边的人物图已创建，尺寸: {expanded_width}x{expanded_height}")
            return person_with_border

        except Exception as e:
            logger.warning(f"创建带描边的人物图失败: {e}")
            import traceback
            logger.warning(traceback.format_exc())
            return person_img  # 返回原始人物图

    def _add_person_border(self, person_img: Image.Image, mask: Optional[Image.Image],
                          template: Dict[str, Any]) -> Image.Image:
        """为人物添加描边效果
        
        Args:
            person_img: 人物图像
            mask: 人物mask（alpha通道）
            template: 模板配置
            
        Returns:
            带描边的人物图像
        """
        try:
            if not CV2_AVAILABLE:
                logger.warning("opencv不可用，跳过描边效果")
                return person_img
            
            # 如果没有mask，从图像创建
            if mask is None:
                # 转换为numpy数组处理
                person_array = np.array(person_img)
                # 创建简单的mask（基于非白色区域）
                gray = cv2.cvtColor(person_array, cv2.COLOR_RGB2GRAY) if len(person_array.shape) == 3 else person_array
                _, mask_array = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
                mask = Image.fromarray(mask_array)
            else:
                mask_array = np.array(mask)

            # 描边参数
            border_width = template.get('person_border_width', 3)
            border_color = template.get('person_border_color', '#FFFFFF')
            
            # 转换颜色
            if isinstance(border_color, str) and border_color.startswith('#'):
                border_rgb = tuple(int(border_color[i:i+2], 16) for i in (1, 3, 5))
            else:
                border_rgb = (255, 255, 255)  # 默认白色

            # 使用形态学操作生成描边
            kernel_size = border_width * 2 + 1
            kernel = np.ones((kernel_size, kernel_size), np.uint8)
            dilated_mask = cv2.dilate(mask_array, kernel, iterations=1)
            border_mask = dilated_mask - mask_array

            # 创建描边图像
            person_array = np.array(person_img)
            if len(person_array.shape) == 2:
                person_array = cv2.cvtColor(person_array, cv2.COLOR_GRAY2RGB)
            
            # 应用描边
            border_mask_3d = np.stack([border_mask] * 3, axis=2) / 255.0
            person_with_border = person_array.copy()
            person_with_border = (person_with_border * (1 - border_mask_3d) + 
                                 np.array(border_rgb) * border_mask_3d).astype(np.uint8)

            return Image.fromarray(person_with_border)

        except Exception as e:
            logger.warning(f"添加人物描边失败: {e}")
            return person_img

    def _add_text(self, canvas: Image.Image, text_info: Dict[str, Any],
                 template: Dict[str, Any]) -> Image.Image:
        """添加文字"""
        try:
            draw = ImageDraw.Draw(canvas)

            # 获取封面样式配置（如果提供）
            cover_style = text_info.get('cover_style', {})
            
            # 调试日志
            logger.info(f"添加文字 - cover_style: {cover_style}")
            logger.info(f"添加文字 - template: {template}")
            
            # 获取字体
            font_family = self.template_config.get('font_family')
            font_path = self._find_font(font_family)

            # 标题
            title = text_info.get('title', '') or cover_style.get('title', '') or cover_style.get('titleText', '')
            logger.info(f"添加文字 - title: '{title}', title长度: {len(title) if title else 0}")
            if title:
                # 获取字体族（优先使用自定义）
                title_font_family = cover_style.get('titleFontFamily') or template.get('title_font_family') or font_family
                logger.info(f"查找标题字体 - titleFontFamily: '{title_font_family}', 原始值: {cover_style.get('titleFontFamily')}, 模板值: {template.get('title_font_family')}, 默认值: {font_family}")
                
                # 获取字重（如果支持）
                font_weight = cover_style.get('titleFontWeight', 700) if cover_style else 700
                
                # 查找字体路径
                title_font_path = self._find_font(title_font_family, font_weight)
                if not title_font_path:
                    logger.warning(f"未找到字体 '{title_font_family}'，使用默认字体路径")
                    title_font_path = font_path
                else:
                    logger.info(f"找到标题字体路径: {title_font_path}")
                
                # 使用cover_style中的字体大小，否则使用模板默认大小
                if cover_style and cover_style.get('titleFontSize'):
                    font_size = int(cover_style.get('titleFontSize'))
                    logger.info(f"使用cover_style标题字体大小: {font_size}")
                elif cover_style and cover_style.get('fontSize'):
                    font_size = int(cover_style.get('fontSize'))
                    logger.info(f"使用cover_style字体大小: {font_size}")
                else:
                    font_size = self._get_font_size(template, 'title')
                    logger.info(f"使用模板默认字体大小: {font_size}")
                
                font = self._load_font(title_font_path, font_size, font_weight)
                
                # 使用cover_style中的字体颜色，否则使用默认颜色
                if cover_style and cover_style.get('titleColor'):
                    text_color_str = cover_style.get('titleColor', 'white')
                    # 转换颜色字符串为RGB元组
                    text_color = self._parse_color(text_color_str)
                    logger.info(f"使用cover_style标题颜色: {text_color_str} -> {text_color}")
                elif cover_style and cover_style.get('fontColor'):
                    text_color_str = cover_style.get('fontColor', 'white')
                    text_color = self._parse_color(text_color_str)
                    logger.info(f"使用cover_style字体颜色: {text_color_str} -> {text_color}")
                else:
                    text_color = text_info.get('color', self.template_config['text_color'])
                    logger.info(f"使用默认字体颜色: {text_color}")

                # 获取描边设置
                title_stroke_color = cover_style.get('titleStrokeColor', '#000000') if cover_style else '#000000'
                title_stroke_width = cover_style.get('titleStrokeWidth', 0) if cover_style else 0
                
                bbox = draw.textbbox((0, 0), title, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]

                # 计算位置 - 优先使用自定义位置（百分比坐标）
                title_position_custom = template.get('title_position_custom')
                if title_position_custom:
                    # 使用自定义位置（百分比坐标）
                    canvas_width, canvas_height = canvas.size
                    x = int((title_position_custom.get('x', 50) / 100.0) * canvas_width)
                    y = int((title_position_custom.get('y', 50) / 100.0) * canvas_height)
                    # 调整为中心对齐（因为位置是中心点）
                    x = x - text_width // 2
                    y = y - text_height // 2
                    # 确保在画布范围内
                    x = max(0, min(x, canvas_width - text_width))
                    y = max(0, min(y, canvas_height - text_height))
                    logger.info(f"使用自定义标题位置: ({x}, {y})")
                elif cover_style and cover_style.get('position'):
                    text_position = cover_style.get('position', 'center')
                    logger.info(f"使用cover_style位置: {text_position}")
                    x, y = self._calculate_text_position(text_position, (text_width, text_height), canvas.size)
                else:
                    text_position = template.get('text_position', 'center')
                    logger.info(f"使用模板位置: {text_position}")
                    x, y = self._calculate_text_position(text_position, (text_width, text_height), canvas.size)

                # 检查是否需要文字背景框（新的独立文字背景功能）
                # 优先使用新的 titleBackgroundEnabled 配置
                title_bg_enabled = cover_style.get('titleBackgroundEnabled') if cover_style else False
                
                # 兼容旧配置
                if not title_bg_enabled:
                    template_bg_color = template.get('text_background_color')
                    has_background = cover_style.get('backgroundColor', False) if cover_style else False
                    if template_bg_color:
                        has_background = True
                else:
                    has_background = True
                
                # 如果有背景框，先绘制背景
                if has_background:
                    if title_bg_enabled:
                        # 使用新的独立文字背景配置
                        title_bg_color = cover_style.get('titleBackgroundColor', '#000000')
                        title_bg_opacity = cover_style.get('titleBackgroundOpacity', 70)
                        title_bg_shape = cover_style.get('titleBackgroundShape', 'rectangle')
                        title_bg_size = cover_style.get('titleBackgroundSize', {'width': 100, 'height': 50})
                        title_bg_position = cover_style.get('titleBackgroundPosition', {'x': 0, 'y': 0})
                        title_bg_radius = cover_style.get('titleBackgroundRadius', 10)
                        title_bg_points = cover_style.get('titleBackgroundPoints', [])
                        
                        logger.info(f"绘制主标题背景 - 颜色: {title_bg_color}, 透明度: {title_bg_opacity}%, 形状: {title_bg_shape}")
                        
                        # 绘制主标题背景（保持RGBA模式以支持透明度）
                        canvas_rgba = canvas.convert('RGBA')
                        canvas_rgba = self._draw_text_background(
                            canvas_rgba, x, y, text_width, text_height,
                            title_bg_color, title_bg_opacity, title_bg_shape,
                            title_bg_size, title_bg_position, title_bg_radius, title_bg_points
                        )
                        # 保持RGBA模式用于绘制文字（确保透明度正确）
                        canvas = canvas_rgba
                        logger.info(f"主标题背景绘制完成，画布模式: {canvas.mode}")
                        draw = ImageDraw.Draw(canvas)  # 重新创建draw对象
                    else:
                        # 兼容旧配置
                        logger.info("绘制文字背景框")
                        # 计算背景框的宽度（基于maxWidth百分比）
                        max_width_percent = cover_style.get('maxWidth', 80) if cover_style else 80
                        canvas_width = canvas.width
                        max_text_width = int(canvas_width * max_width_percent / 100)
                        
                        # 如果文字宽度超过最大宽度，需要换行（简化处理：缩小字体或截断）
                        actual_text_width = min(text_width, max_text_width)
                        
                        # 背景框的padding
                        padding_x = 20
                        padding_y = 15
                        
                        # 计算背景框位置和大小
                        bg_x = max(0, x - padding_x)
                        bg_y = max(0, y - padding_y)
                        bg_width = min(actual_text_width + padding_x * 2, canvas_width - bg_x)
                        bg_height = text_height + padding_y * 2
                        
                        # 确定背景颜色
                        background_opacity = cover_style.get('backgroundOpacity', 70) if cover_style else 70
                        if template_bg_color:
                            bg_rgb = self._parse_color(template_bg_color)
                            bg_color = (*bg_rgb, background_opacity)
                        else:
                            bg_color = (0, 0, 0, int(255 * background_opacity / 100))
                        
                        bg_overlay = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
                        bg_draw = ImageDraw.Draw(bg_overlay)
                        template_bg_shape = template.get('text_background_shape', 'rectangle')
                        
                        # 根据形状绘制背景
                        if template_bg_shape == 'irregular' and CV2_AVAILABLE:
                            # 不规则边缘（使用波浪边缘）
                            try:
                                mask = np.zeros((bg_height, bg_width), dtype=np.uint8)
                                
                                # 创建波浪边缘效果
                                points = []
                                wave_amplitude = 8
                                wave_frequency = 0.1
                                
                                # 上边缘（波浪）
                                for i in range(bg_width):
                                    wave_y = int(wave_amplitude * np.sin(i * wave_frequency))
                                    points.append((i, max(0, wave_y)))
                                
                                # 右边缘
                                for i in range(bg_height):
                                    points.append((bg_width - 1, i))
                                
                                # 下边缘（波浪）
                                for i in range(bg_width - 1, -1, -1):
                                    wave_y = bg_height - 1 - int(wave_amplitude * np.sin(i * wave_frequency))
                                    points.append((i, min(bg_height - 1, wave_y)))
                                
                                # 左边缘
                                for i in range(bg_height - 1, -1, -1):
                                    points.append((0, i))
                                
                                # 填充多边形
                                points_array = np.array(points, np.int32)
                                cv2.fillPoly(mask, [points_array], 255)
                                
                                # 转换为PIL Image并应用颜色
                                mask_img = Image.fromarray(mask, mode='L')
                                bg_img = Image.new('RGBA', (bg_width, bg_height), bg_color)
                                bg_img.putalpha(mask_img)
                                
                                # 粘贴到overlay
                                bg_overlay.paste(bg_img, (bg_x, bg_y), mask_img)
                                logger.info("不规则背景已绘制")
                            except Exception as e:
                                logger.warning(f"绘制不规则背景失败: {e}，使用矩形背景")
                                bg_draw.rectangle(
                                    [(bg_x, bg_y), (bg_x + bg_width, bg_y + bg_height)],
                                    fill=bg_color
                                )
                        else:
                            # 矩形背景
                            bg_draw.rectangle(
                                [(bg_x, bg_y), (bg_x + bg_width, bg_y + bg_height)],
                                fill=bg_color
                            )
                        
                        canvas = Image.alpha_composite(canvas.convert('RGBA'), bg_overlay).convert('RGB')
                        draw = ImageDraw.Draw(canvas)  # 重新创建draw对象

                # 检查是否需要文字描边（优先使用自定义描边设置）
                if title_stroke_width > 0:
                    # 绘制文字描边（使用多次偏移绘制实现描边效果）
                    logger.info(f"绘制标题描边 - 颜色: {title_stroke_color}, 宽度: {title_stroke_width}")
                    outline_color = self._parse_color(title_stroke_color)
                    # 在多个方向绘制描边
                    for dx in range(-title_stroke_width, title_stroke_width + 1):
                        for dy in range(-title_stroke_width, title_stroke_width + 1):
                            if dx*dx + dy*dy <= title_stroke_width*title_stroke_width:
                                draw.text((x + dx, y + dy), title, fill=outline_color, font=font)
                else:
                    # 检查模板定义的描边
                    text_outline = template.get('text_outline', False)
                    text_outline_color = template.get('text_outline_color', '#FFFFFF')
                    text_outline_width = template.get('text_outline_width', 3)
                    
                    # 添加文字阴影或描边
                    effect_type = cover_style.get('effectType', 'none') if cover_style else 'none'
                    
                    if text_outline:
                        # 绘制文字描边（使用多次偏移绘制实现描边效果）
                        logger.info(f"绘制文字描边 - 颜色: {text_outline_color}, 宽度: {text_outline_width}")
                        outline_color = self._parse_color(text_outline_color)
                        # 在多个方向绘制描边
                        for dx in range(-text_outline_width, text_outline_width + 1):
                            for dy in range(-text_outline_width, text_outline_width + 1):
                                if dx*dx + dy*dy <= text_outline_width*text_outline_width:
                                    draw.text((x + dx, y + dy), title, fill=outline_color, font=font)
                    elif effect_type == 'shadow' or (effect_type == 'none' and self.template_config.get('text_shadow', True)):
                        shadow_color = self.template_config.get('text_shadow_color', (0, 0, 0))
                        shadow_offset = self.template_config.get('text_shadow_offset', (2, 2))
                        draw.text((x + shadow_offset[0], y + shadow_offset[1]), title,
                                fill=shadow_color, font=font)

                # 绘制主要文字（如果fontWeight >= 800，使用粗体效果）
                # 如果canvas是RGBA模式，确保颜色包含alpha通道
                if canvas.mode == 'RGBA':
                    if isinstance(text_color, tuple) and len(text_color) == 3:
                        text_color_rgba = (*text_color, 255)  # 添加完全不透明的alpha
                    else:
                        text_color_rgba = text_color
                    if font_weight >= 800:
                        self._apply_bold_effect(draw, title, (x, y), font, text_color_rgba, font_weight)
                    else:
                        draw.text((x, y), title, fill=text_color_rgba, font=font)
                else:
                    if font_weight >= 800:
                        self._apply_bold_effect(draw, title, (x, y), font, text_color, font_weight)
                    else:
                        draw.text((x, y), title, fill=text_color, font=font)
                logger.info(f"文字已绘制到位置 ({x}, {y})，颜色: {text_color}, 字体大小: {font_size}, 字重: {font_weight}")
                print(f"文字已绘制: '{title}' 到位置 ({x}, {y})", file=sys.stderr, flush=True)

            # 副标题
            subtitle = text_info.get('subtitle', '') or cover_style.get('subtitle', '') or cover_style.get('subtitleText', '')
            if subtitle:
                # 获取字体族（优先使用自定义）
                subtitle_font_family = cover_style.get('subtitleFontFamily') or template.get('subtitle_font_family') or font_family
                subtitle_font_path = self._find_font(subtitle_font_family) or font_path
                
                # 使用cover_style中的字体大小
                if cover_style and cover_style.get('subtitleFontSize'):
                    font_size = int(cover_style.get('subtitleFontSize'))
                    logger.info(f"使用cover_style副标题字体大小: {font_size}")
                else:
                    font_size = self._get_font_size(template, 'subtitle')
                    logger.info(f"使用模板默认副标题字体大小: {font_size}")
                
                # 获取字重
                subtitle_font_weight = cover_style.get('subtitleFontWeight', 400) if cover_style else 400
                # 尝试查找粗体字体
                if subtitle_font_weight >= 700:
                    bold_font_path = self._find_font(subtitle_font_family, subtitle_font_weight)
                    if bold_font_path:
                        subtitle_font_path = bold_font_path
                font = self._load_font(subtitle_font_path, font_size, subtitle_font_weight)
                
                # 获取副标题颜色
                if cover_style and cover_style.get('subtitleColor'):
                    subtitle_color_str = cover_style.get('subtitleColor', 'white')
                    subtitle_color = self._parse_color(subtitle_color_str)
                    logger.info(f"使用cover_style副标题颜色: {subtitle_color_str} -> {subtitle_color}")
                else:
                    subtitle_color = text_info.get('color', self.template_config['text_color'])
                    logger.info(f"使用默认副标题颜色: {subtitle_color}")
                
                # 获取副标题描边设置
                subtitle_stroke_color = cover_style.get('subtitleStrokeColor', '#000000') if cover_style else '#000000'
                subtitle_stroke_width = cover_style.get('subtitleStrokeWidth', 0) if cover_style else 0

                bbox = draw.textbbox((0, 0), subtitle, font=font)
                text_width = bbox[2] - bbox[0]
                text_height_sub = bbox[3] - bbox[1]
                
                # 检查是否需要副标题背景
                subtitle_bg_enabled = cover_style.get('subtitleBackgroundEnabled') if cover_style else False
                
                # 计算副标题位置 - 优先使用自定义位置（百分比坐标）
                subtitle_position_custom = template.get('subtitle_position_custom')
                if subtitle_position_custom:
                    # 使用自定义位置（百分比坐标）
                    canvas_width, canvas_height = canvas.size
                    x_sub = int((subtitle_position_custom.get('x', 50) / 100.0) * canvas_width)
                    y_sub = int((subtitle_position_custom.get('y', 50) / 100.0) * canvas_height)
                    # 调整为中心对齐
                    x_sub = x_sub - text_width // 2
                    y_sub = y_sub - text_height_sub // 2
                    # 确保在画布范围内
                    x_sub = max(0, min(x_sub, canvas_width - text_width))
                    y_sub = max(0, min(y_sub, canvas_height - text_height_sub))
                    logger.info(f"使用自定义副标题位置: ({x_sub}, {y_sub})")
                elif title:
                    # 副标题位置在标题下方
                    x_sub = x
                    y_sub = y + text_height + 20
                else:
                    # 使用模板位置
                    x_sub, y_sub = self._calculate_text_position(template.get('text_position', 'center'), 
                                                                 (text_width, text_height_sub), canvas.size)

                # 如果有副标题背景，先绘制背景
                if subtitle_bg_enabled:
                    subtitle_bg_color = cover_style.get('subtitleBackgroundColor', '#000000')
                    subtitle_bg_opacity = cover_style.get('subtitleBackgroundOpacity', 70)
                    subtitle_bg_shape = cover_style.get('subtitleBackgroundShape', 'rectangle')
                    subtitle_bg_size = cover_style.get('subtitleBackgroundSize', {'width': 100, 'height': 50})
                    subtitle_bg_position = cover_style.get('subtitleBackgroundPosition', {'x': 0, 'y': 0})
                    subtitle_bg_radius = cover_style.get('subtitleBackgroundRadius', 10)
                    subtitle_bg_points = cover_style.get('subtitleBackgroundPoints', [])
                    
                    # 绘制副标题背景（保持RGBA模式以支持透明度）
                    canvas_rgba = canvas.convert('RGBA')
                    canvas_rgba = self._draw_text_background(
                        canvas_rgba, x_sub, y_sub, text_width, text_height_sub,
                        subtitle_bg_color, subtitle_bg_opacity, subtitle_bg_shape,
                        subtitle_bg_size, subtitle_bg_position, subtitle_bg_radius, subtitle_bg_points
                    )
                    # 保持RGBA模式用于绘制文字（确保透明度正确）
                    canvas = canvas_rgba
                    draw = ImageDraw.Draw(canvas)  # 重新创建draw对象

                # 绘制副标题描边
                if subtitle_stroke_width > 0:
                    logger.info(f"绘制副标题描边 - 颜色: {subtitle_stroke_color}, 宽度: {subtitle_stroke_width}")
                    outline_color = self._parse_color(subtitle_stroke_color)
                    # 在多个方向绘制描边
                    for dx in range(-subtitle_stroke_width, subtitle_stroke_width + 1):
                        for dy in range(-subtitle_stroke_width, subtitle_stroke_width + 1):
                            if dx*dx + dy*dy <= subtitle_stroke_width*subtitle_stroke_width:
                                draw.text((x_sub + dx, y_sub + dy), subtitle, fill=outline_color, font=font)

                # 绘制副标题（如果fontWeight >= 800，使用粗体效果）
                # 如果canvas是RGBA模式，确保颜色包含alpha通道
                if canvas.mode == 'RGBA':
                    if isinstance(subtitle_color, tuple) and len(subtitle_color) == 3:
                        subtitle_color_rgba = (*subtitle_color, 255)  # 添加完全不透明的alpha
                    else:
                        subtitle_color_rgba = subtitle_color
                    if subtitle_font_weight >= 800:
                        self._apply_bold_effect(draw, subtitle, (x_sub, y_sub), font, subtitle_color_rgba, subtitle_font_weight)
                    else:
                        draw.text((x_sub, y_sub), subtitle, fill=subtitle_color_rgba, font=font)
                else:
                    if subtitle_font_weight >= 800:
                        self._apply_bold_effect(draw, subtitle, (x_sub, y_sub), font, subtitle_color, subtitle_font_weight)
                    else:
                        draw.text((x_sub, y_sub), subtitle, fill=subtitle_color, font=font)
                logger.info(f"副标题已绘制到位置 ({x_sub}, {y_sub})，颜色: {subtitle_color}, 字体大小: {font_size}, 字重: {subtitle_font_weight}")

            # 如果画布是RGBA模式，转换为RGB（最终输出需要RGB）
            if canvas.mode == 'RGBA':
                canvas = canvas.convert('RGB')
            logger.info(f"添加文字完成，画布模式: {canvas.mode}, 尺寸: {canvas.size}")
            print(f"添加文字完成，画布尺寸: {canvas.size}", file=sys.stderr, flush=True)
            return canvas

        except Exception as e:
            logger.error(f"添加文字失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            print(f"添加文字失败: {e}", file=sys.stderr, flush=True)
            return canvas

    def _draw_text_background(self, canvas: Image.Image, text_x: int, text_y: int,
                             text_width: int, text_height: int,
                             bg_color: str, bg_opacity: int, bg_shape: str,
                             bg_size: Dict[str, int], bg_position: Dict[str, int],
                             bg_radius: int = 10, bg_points: List[Dict[str, Any]] = None) -> Image.Image:
        """绘制文字背景（独立图层，不依赖文字位置和大小）
        
        Args:
            canvas: 画布
            text_x: 文字X坐标（左上角）- 仅用于兼容，实际不使用
            text_y: 文字Y坐标（左上角）- 仅用于兼容，实际不使用
            text_width: 文字宽度 - 仅用于兼容，实际不使用
            text_height: 文字高度 - 仅用于兼容，实际不使用
            bg_color: 背景颜色
            bg_opacity: 背景透明度 (0-100)
            bg_shape: 背景形状 ('rectangle', 'rounded', 'polygon', 'bezier')
            bg_size: 背景大小 {'width': int, 'height': int} (百分比，相对于画布)
            bg_position: 背景位置 {'x': int, 'y': int} (百分比，相对于画布中心)
            bg_radius: 圆角半径（仅用于rounded）
            bg_points: 控制点列表（用于polygon和bezier，相对于背景中心）
            
        Returns:
            绘制背景后的画布
        """
        try:
            canvas_width = canvas.width
            canvas_height = canvas.height
            
            # 计算背景大小（百分比转换为像素，相对于画布）
            bg_width = int((bg_size.get('width', 30) / 100.0) * canvas_width)
            bg_height = int((bg_size.get('height', 10) / 100.0) * canvas_height)
            
            # 计算背景中心位置（百分比转换为像素，相对于画布）
            bg_center_x = int((bg_position.get('x', 50) / 100.0) * canvas_width)
            bg_center_y = int((bg_position.get('y', 50) / 100.0) * canvas_height)
            
            # 计算背景左上角位置
            bg_x = bg_center_x - bg_width // 2
            bg_y = bg_center_y - bg_height // 2
            
            # 解析背景颜色
            bg_rgb = self._parse_color(bg_color)
            bg_alpha = int(255 * bg_opacity / 100)
            bg_rgba = (*bg_rgb, bg_alpha)
            
            logger.info(f"_draw_text_background - 颜色: {bg_color} -> RGB: {bg_rgb}, 透明度: {bg_opacity}% -> Alpha: {bg_alpha}, RGBA: {bg_rgba}")
            
            # 创建背景overlay
            bg_overlay = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
            bg_draw = ImageDraw.Draw(bg_overlay)
            
            # 根据形状绘制背景
            if bg_shape == 'rectangle':
                bg_draw.rectangle(
                    [(bg_x, bg_y), (bg_x + bg_width, bg_y + bg_height)],
                    fill=bg_rgba
                )
            elif bg_shape == 'rounded':
                # 圆角矩形
                if bg_radius > 0:
                    # 使用圆角矩形绘制
                    bg_draw.rounded_rectangle(
                        [(bg_x, bg_y), (bg_x + bg_width, bg_y + bg_height)],
                        radius=bg_radius,
                        fill=bg_rgba
                    )
                else:
                    bg_draw.rectangle(
                        [(bg_x, bg_y), (bg_x + bg_width, bg_y + bg_height)],
                        fill=bg_rgba
                    )
            elif bg_shape == 'polygon' and bg_points:
                # 多边形
                if len(bg_points) >= 3:
                    # 将控制点转换为绝对坐标（控制点相对于背景中心）
                    points = []
                    for pt in bg_points:
                        # pt.x 和 pt.y 是相对于背景中心的百分比
                        px = bg_center_x + int((pt.get('x', 0) / 100.0) * bg_width)
                        py = bg_center_y + int((pt.get('y', 0) / 100.0) * bg_height)
                        points.append((px, py))
                    
                    if len(points) >= 3:
                        bg_draw.polygon(points, fill=bg_rgba)
            elif bg_shape == 'bezier' and bg_points and CV2_AVAILABLE:
                # 贝塞尔曲线
                try:
                    # 将控制点转换为绝对坐标（控制点相对于背景中心）
                    control_points = []
                    for pt in bg_points:
                        # pt.x 和 pt.y 是相对于背景中心的百分比
                        px = bg_center_x + int((pt.get('x', 0) / 100.0) * bg_width)
                        py = bg_center_y + int((pt.get('y', 0) / 100.0) * bg_height)
                        control_points.append((px, py))
                    
                    if len(control_points) >= 2:
                        # 使用cv2绘制贝塞尔曲线路径
                        mask = np.zeros((canvas.height, canvas.width), dtype=np.uint8)
                        
                        # 将控制点转换为numpy数组
                        points_array = np.array(control_points, dtype=np.int32)
                        
                        # 使用cv2.fillPoly填充（简化处理，实际应该使用贝塞尔曲线）
                        if len(control_points) >= 3:
                            cv2.fillPoly(mask, [points_array], 255)
                        else:
                            # 如果只有2个点，绘制直线
                            cv2.line(mask, tuple(control_points[0]), tuple(control_points[1]), 255, 2)
                        
                        # 转换为PIL Image并应用颜色和透明度
                        mask_img = Image.fromarray(mask, mode='L')
                        # 将mask与透明度相乘，确保透明度正确应用
                        mask_array = np.array(mask, dtype=np.float32)
                        mask_alpha = (mask_array * (bg_alpha / 255.0)).astype(np.uint8)
                        # 创建带透明度的背景图像
                        bg_img = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
                        bg_rgba_array = np.array(bg_img)
                        # 在mask区域内填充颜色，alpha通道使用计算后的透明度
                        mask_bool = mask > 0
                        bg_rgba_array[:, :, 0][mask_bool] = bg_rgb[0]
                        bg_rgba_array[:, :, 1][mask_bool] = bg_rgb[1]
                        bg_rgba_array[:, :, 2][mask_bool] = bg_rgb[2]
                        bg_rgba_array[:, :, 3] = mask_alpha
                        bg_img = Image.fromarray(bg_rgba_array, mode='RGBA')
                        bg_overlay = Image.alpha_composite(bg_overlay, bg_img)
                except Exception as e:
                    logger.warning(f"绘制贝塞尔曲线背景失败: {e}，使用矩形背景")
                    bg_draw.rectangle(
                        [(bg_x, bg_y), (bg_x + bg_width, bg_y + bg_height)],
                        fill=bg_rgba
                    )
            else:
                # 默认矩形
                bg_draw.rectangle(
                    [(bg_x, bg_y), (bg_x + bg_width, bg_y + bg_height)],
                    fill=bg_rgba
                )
            
            # 合成背景到画布（保持RGBA模式以支持透明度）
            canvas_rgba = canvas.convert('RGBA')
            logger.info(f"_draw_text_background - 合成前画布模式: {canvas.mode}, overlay模式: {bg_overlay.mode}")
            canvas_rgba = Image.alpha_composite(canvas_rgba, bg_overlay)
            logger.info(f"_draw_text_background - 合成后画布模式: {canvas_rgba.mode}")
            # 检查合成后的alpha通道（采样检查）
            if canvas_rgba.mode == 'RGBA':
                sample_alpha = canvas_rgba.getpixel((bg_center_x, bg_center_y))[3] if 0 <= bg_center_x < canvas_rgba.width and 0 <= bg_center_y < canvas_rgba.height else None
                logger.info(f"_draw_text_background - 合成后中心点alpha值: {sample_alpha}")
            return canvas_rgba
            
        except Exception as e:
            logger.warning(f"绘制文字背景失败: {e}")
            import traceback
            logger.warning(traceback.format_exc())
            return canvas

    def _resample_contour(self, contour: np.ndarray, spacing: float = 1.0) -> List[Tuple[int, int]]:
        """重采样轮廓，使点均匀分布
        
        Args:
            contour: 原始轮廓点
            spacing: 采样间隔（像素）
            
        Returns:
            重采样后的轮廓点列表
        """
        if len(contour) < 2:
            return [tuple(pt[0]) for pt in contour]
        
        # 将轮廓点转换为列表
        points = [tuple(pt[0]) for pt in contour]
        
        # 计算累积距离
        cumulative_dist = [0.0]
        for i in range(len(points) - 1):
            pt1 = points[i]
            pt2 = points[i + 1]
            dist = np.sqrt((pt2[0] - pt1[0])**2 + (pt2[1] - pt1[1])**2)
            cumulative_dist.append(cumulative_dist[-1] + dist)
        
        total_length = cumulative_dist[-1]
        if total_length < spacing:
            return points
        
        # 重采样
        resampled_points = []
        target_dist = 0.0
        
        while target_dist <= total_length:
            # 找到目标距离所在的线段
            for i in range(len(cumulative_dist) - 1):
                if cumulative_dist[i] <= target_dist <= cumulative_dist[i + 1]:
                    # 在这个线段上插值
                    segment_start_dist = cumulative_dist[i]
                    segment_end_dist = cumulative_dist[i + 1]
                    segment_length = segment_end_dist - segment_start_dist
                    
                    if segment_length > 0:
                        t = (target_dist - segment_start_dist) / segment_length
                        pt1 = points[i]
                        pt2 = points[i + 1]
                        x = int(pt1[0] + (pt2[0] - pt1[0]) * t)
                        y = int(pt1[1] + (pt2[1] - pt1[1]) * t)
                        resampled_points.append((x, y))
                    break
            
            target_dist += spacing
        
        return resampled_points

    def _get_point_at_distance(self, points: List[Tuple[int, int]],
                               cumulative_dist: List[float],
                               target_dist: float) -> Optional[Tuple[int, int]]:
        """在轮廓上找到指定距离处的点
        
        Args:
            points: 轮廓点列表
            cumulative_dist: 累积距离列表
            target_dist: 目标距离
            
        Returns:
            目标距离处的点坐标，如果找不到则返回None
        """
        if target_dist < 0 or target_dist > cumulative_dist[-1]:
            return None
        
        # 找到目标距离所在的线段
        for i in range(len(cumulative_dist) - 1):
            if cumulative_dist[i] <= target_dist <= cumulative_dist[i + 1]:
                # 在这个线段上插值
                segment_start_dist = cumulative_dist[i]
                segment_end_dist = cumulative_dist[i + 1]
                segment_length = segment_end_dist - segment_start_dist
                
                if segment_length > 0:
                    t = (target_dist - segment_start_dist) / segment_length
                    pt1 = points[i]
                    pt2 = points[i + 1]
                    x = int(pt1[0] + (pt2[0] - pt1[0]) * t)
                    y = int(pt1[1] + (pt2[1] - pt1[1]) * t)
                    return (x, y)
                else:
                    return points[i]
        
        return None

    def _create_dashed_border(self, border_mask: np.ndarray, border_width: int,
                             dash_length: Optional[int] = None, gap_length: Optional[int] = None) -> np.ndarray:
        """创建虚线描边效果
        
        Args:
            border_mask: 原始描边mask
            border_width: 描边宽度
            dash_length: 每段虚线长度（像素），如果为None则自动计算
            gap_length: 每段间隔长度（像素），如果为None则自动计算
            
        Returns:
            虚线描边mask
        """
        try:
            if not CV2_AVAILABLE:
                return border_mask
            
            # 虚线参数（如果未提供或为0，使用默认值）
            if dash_length is None or dash_length == 0:
                dash_length = border_width * 3  # 每段虚线长度
                logger.info(f"虚线长度未提供，使用默认值: {dash_length} (border_width * 3)")
            if gap_length is None or gap_length == 0:
                gap_length = border_width * 2   # 每段间隔长度
                logger.info(f"虚线间隔未提供，使用默认值: {gap_length} (border_width * 2)")
            
            logger.info(f"_create_dashed_border 接收参数 - border_width: {border_width}, dash_length: {dash_length}, gap_length: {gap_length}")
            
            # 创建虚线mask
            dashed_mask = np.zeros_like(border_mask)
            
            # 找到所有描边像素的位置
            if np.count_nonzero(border_mask) == 0:
                return border_mask
            
            # 使用轮廓来生成虚线
            contours, _ = cv2.findContours(border_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            
            if len(contours) == 0:
                return border_mask
            
            # 新方法：基于已有的均匀实线border_mask创建虚线
            # 不重新绘制，而是对实线mask进行选择性保留
            # 这样可以保持与实线相同的均匀性
            
            # 对border_mask中的每个像素，计算它到轮廓起点的距离
            # 然后根据距离决定是否保留（虚线模式）
            
            for contour in contours:
                if len(contour) < 2:
                    continue
                
                # 将轮廓点展平为列表
                points = [tuple(pt[0]) for pt in contour]
                
                # 计算累积距离
                cumulative_dist = [0.0]
                for i in range(len(points) - 1):
                    pt1 = points[i]
                    pt2 = points[i + 1]
                    dist = np.sqrt((pt2[0] - pt1[0])**2 + (pt2[1] - pt1[1])**2)
                    cumulative_dist.append(cumulative_dist[-1] + dist)
                
                total_length = cumulative_dist[-1]
                if total_length < 1:
                    continue
                
                logger.info(f"轮廓总长度: {total_length}, 点数: {len(points)}")
                
                # 为轮廓上的每个点分配距离值
                point_distances = {}
                for i, pt in enumerate(points):
                    point_distances[pt] = cumulative_dist[i]
                
                # 遍历border_mask中的所有描边像素
                # 找到每个像素最近的轮廓点，获取其距离值
                # 根据距离值决定是否保留（虚线模式）
                y_coords, x_coords = np.where(border_mask > 0)
                
                cycle_length = dash_length + gap_length
                
                for y, x in zip(y_coords, x_coords):
                    # 找到最近的轮廓点
                    min_dist = float('inf')
                    nearest_contour_dist = 0
                    
                    for pt, contour_dist in point_distances.items():
                        dist = np.sqrt((x - pt[0])**2 + (y - pt[1])**2)
                        if dist < min_dist:
                            min_dist = dist
                            nearest_contour_dist = contour_dist
                    
                    # 根据轮廓距离决定是否保留这个像素
                    position_in_cycle = nearest_contour_dist % cycle_length
                    if position_in_cycle < dash_length:
                        dashed_mask[y, x] = 255
                
                logger.info(f"虚线生成完成，共保留了 {np.count_nonzero(dashed_mask)} 个像素")
            
            return dashed_mask
            
        except Exception as e:
            logger.warning(f"创建虚线描边失败: {e}，使用实线描边")
            import traceback
            logger.warning(traceback.format_exc())
            return border_mask

    def _apply_final_effects(self, canvas: Image.Image, template: Dict[str, Any]) -> Image.Image:
        """应用最终效果"""
        try:
            # 可以在这里添加边框、水印等效果
            return canvas
        except Exception as e:
            logger.warning(f"应用最终效果失败: {e}")
            return canvas

    def _resize_image(self, image: Image.Image, target_size: Tuple[int, int]) -> Image.Image:
        """调整图像大小，保持比例"""
        target_width, target_height = target_size
        img_width, img_height = image.size

        # 计算缩放比例
        scale = min(target_width / img_width, target_height / img_height)
        new_width = int(img_width * scale)
        new_height = int(img_height * scale)

        return image.resize((new_width, new_height), Image.LANCZOS)

    def _calculate_position(self, position: str, element_size: Tuple[int, int],
                          canvas_size: Tuple[int, int]) -> Tuple[int, int]:
        """计算元素位置"""
        element_width, element_height = element_size
        canvas_width, canvas_height = canvas_size

        if position == 'center':
            x = (canvas_width - element_width) // 2
            y = (canvas_height - element_height) // 2
        elif position == 'top':
            x = (canvas_width - element_width) // 2
            y = canvas_height // 10
        elif position == 'bottom':
            x = (canvas_width - element_width) // 2
            y = canvas_height - element_height - canvas_height // 10
        elif position == 'left':
            x = canvas_width // 10
            y = (canvas_height - element_height) // 2
        elif position == 'right':
            x = canvas_width - element_width - canvas_width // 10
            y = (canvas_height - element_height) // 2
        elif position == 'top-left':
            x = canvas_width // 10
            y = canvas_height // 10
        elif position == 'top-right':
            x = canvas_width - element_width - canvas_width // 10
            y = canvas_height // 10
        elif position == 'bottom-left':
            x = canvas_width // 10
            y = canvas_height - element_height - canvas_height // 10
        elif position == 'bottom-right':
            x = canvas_width - element_width - canvas_width // 10
            y = canvas_height - element_height - canvas_height // 10
        elif position == 'bottom-center':
            x = (canvas_width - element_width) // 2
            y = canvas_height - element_height - canvas_height // 10
        else:
            # 默认居中
            x = (canvas_width - element_width) // 2
            y = (canvas_height - element_height) // 2

        return x, y

    def _calculate_text_position(self, position: str, text_size: Tuple[int, int],
                               canvas_size: Tuple[int, int]) -> Tuple[int, int]:
        """计算文字位置"""
        return self._calculate_position(position, text_size, canvas_size)

    def _add_mask(self, canvas: Image.Image, template: Dict[str, Any]) -> Image.Image:
        """添加蒙版
        
        Args:
            canvas: 画布
            template: 模板配置
            
        Returns:
            添加蒙版后的画布
        """
        try:
            mask_image_path = template.get('mask_image_path')
            if not mask_image_path or not os.path.exists(mask_image_path):
                logger.warning(f"蒙版图片不存在: {mask_image_path}")
                return canvas
            
            # 读取蒙版图片
            mask_img = Image.open(mask_image_path).convert('RGBA')
            canvas_width, canvas_height = canvas.size
            
            # 获取蒙版大小和位置
            mask_size = template.get('mask_size', 1.0)  # 0-1的小数
            mask_position_custom = template.get('mask_position_custom', {'x': 50, 'y': 50})
            mask_opacity = template.get('mask_opacity', 1.0)  # 0-1
            mask_color = template.get('mask_color')
            mask_shape = template.get('mask_shape', 'rectangle')
            
            # 调整蒙版大小
            mask_width = int(canvas_width * mask_size)
            mask_height = int(mask_width * mask_img.height / mask_img.width)
            if mask_height > canvas_height * 0.95:
                mask_height = int(canvas_height * 0.95)
                mask_width = int(mask_height * mask_img.width / mask_img.height)
            
            mask_resized = mask_img.resize((mask_width, mask_height), Image.LANCZOS)
            
            # 应用颜色（如果指定）
            if mask_color:
                mask_rgb = self._parse_color(mask_color)
                # 创建颜色层
                color_layer = Image.new('RGB', mask_resized.size, mask_rgb)
                # 使用alpha通道合成
                mask_resized = Image.composite(
                    color_layer.convert('RGBA'),
                    mask_resized,
                    mask_resized.split()[-1]  # 使用原图的alpha通道
                )
            
            # 应用透明度
            if mask_opacity < 1.0:
                alpha = mask_resized.split()[-1]
                alpha = alpha.point(lambda p: int(p * mask_opacity))
                mask_resized.putalpha(alpha)
            
            # 应用形状（如果需要）
            if mask_shape == 'circle':
                # 创建圆形蒙版
                mask_alpha = Image.new('L', mask_resized.size, 0)
                draw = ImageDraw.Draw(mask_alpha)
                radius = min(mask_width, mask_height) // 2
                center = (mask_width // 2, mask_height // 2)
                draw.ellipse([center[0] - radius, center[1] - radius,
                             center[0] + radius, center[1] + radius], fill=255)
                mask_resized.putalpha(mask_alpha)
            elif mask_shape == 'rounded':
                # 创建圆角矩形蒙版
                mask_alpha = Image.new('L', mask_resized.size, 0)
                draw = ImageDraw.Draw(mask_alpha)
                corner_radius = min(mask_width, mask_height) // 10
                draw.rounded_rectangle([0, 0, mask_width, mask_height], 
                                      radius=corner_radius, fill=255)
                mask_resized.putalpha(mask_alpha)
            
            # 计算位置（百分比坐标转换为像素）
            x = int((mask_position_custom.get('x', 50) / 100.0) * canvas_width)
            y = int((mask_position_custom.get('y', 50) / 100.0) * canvas_height)
            # 调整为中心对齐
            x = x - mask_width // 2
            y = y - mask_height // 2
            # 确保在画布范围内
            x = max(0, min(x, canvas_width - mask_width))
            y = max(0, min(y, canvas_height - mask_height))
            
            # 合成蒙版到画布
            canvas = canvas.convert('RGBA')
            canvas.paste(mask_resized, (x, y), mask_resized.split()[-1])
            canvas = canvas.convert('RGB')
            
            logger.info(f"蒙版已添加到位置 ({x}, {y})，大小: {mask_width}x{mask_height}")
            return canvas
            
        except Exception as e:
            logger.warning(f"添加蒙版失败: {e}")
            return canvas

    def _find_font(self, font_family: str, font_weight: int = 400) -> Optional[str]:
        """查找字体文件，支持预置字体、系统字体和粗体字体查找"""
        try:
            # 尝试使用字体管理器（优先查找预置字体）
            from .font_manager import get_font_manager
            font_manager = get_font_manager()
            font_path = font_manager.find_font(font_family, font_weight)
            if font_path:
                return font_path
        except Exception as e:
            logger.warning(f"使用字体管理器查找字体失败: {e}，回退到系统字体查找")
        
        # 回退到原有的系统字体查找逻辑
        import platform
        
        # 粗体字体名称映射
        bold_font_map = {
            'SimHei': 'simhei.ttf',  # 黑体
            'Microsoft YaHei': 'msyhbd.ttf',  # 微软雅黑粗体
            'SimSun': 'simsun.ttc',  # 宋体（不支持粗体，使用描边模拟）
            'Arial': 'arialbd.ttf',  # Arial Bold
            'Times New Roman': 'timesbd.ttf',  # Times New Roman Bold
        }
        
        system = platform.system()
        font_paths = []
        
        if system == 'Windows':
            windows_font_dir = Path("C:/Windows/Fonts")
            # 如果指定了粗体且font_weight >= 700，尝试查找粗体字体
            if font_weight >= 700 and font_family in bold_font_map:
                bold_font_name = bold_font_map[font_family]
                bold_path = windows_font_dir / bold_font_name
                if bold_path.exists():
                    font_paths.append(str(bold_path))
            
            # 普通字体查找
            font_name_map = {
                'SimHei': 'simhei.ttf',
                'Microsoft YaHei': 'msyh.ttc',
                'SimSun': 'simsun.ttc',
                'Arial': 'arial.ttf',
                'Times New Roman': 'times.ttf',
            }
            if font_family in font_name_map:
                font_path = windows_font_dir / font_name_map[font_family]
                if font_path.exists():
                    font_paths.append(str(font_path))
            
            # 通用字体路径
            font_paths.extend([
                str(windows_font_dir / "simhei.ttf"),
                str(windows_font_dir / "msyh.ttc"),
                str(windows_font_dir / "simsun.ttc"),
            ])
        elif system == 'Darwin':  # macOS
            font_paths = [
                "/System/Library/Fonts/PingFang.ttc",
                "/Library/Fonts/Arial.ttf",
            ]
        else:  # Linux
            font_paths = [
                "/usr/share/fonts/truetype/droid/DroidSansFallback.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            ]

        # 检查字体文件是否存在
        for path in font_paths:
            if Path(path).exists():
                return path

        # 如果找不到，使用PIL默认字体
        return None

    def _load_font(self, font_path: Optional[str], size: int, font_weight: int = 400) -> ImageFont.FreeTypeFont:
        """加载字体，支持fontWeight参数"""
        try:
            if font_path:
                # 验证字体文件是否存在
                from pathlib import Path
                if not Path(font_path).exists():
                    logger.warning(f"❌ 字体文件不存在: {font_path}")
                    logger.warning(f"  使用默认字体作为回退")
                    return ImageFont.load_default()

                logger.debug(f"✅ 加载字体: {font_path} (大小: {size})")
                font = ImageFont.truetype(font_path, size)
                # 注意：PIL的ImageFont.truetype不支持直接设置fontWeight
                # 如果需要更粗的字体，需要在_find_font中查找粗体字体文件
                return font
            else:
                logger.debug(f"⚠️ 未提供字体路径，使用默认字体")
                return ImageFont.load_default()
        except Exception as e:
            logger.warning(f"❌ 加载字体失败: {e}")
            logger.warning(f"  字体路径: {font_path}")
            logger.warning(f"  使用默认字体作为回退")
            import traceback
            logger.debug(f"  错误追踪: {traceback.format_exc()}")
            return ImageFont.load_default()
    
    def _apply_bold_effect(self, draw: ImageDraw.Draw, text: str, position: Tuple[int, int], 
                          font: ImageFont.FreeTypeFont, color: Tuple[int, int, int],
                          font_weight: int) -> None:
        """应用粗体效果（当字体本身不够粗时，使用描边模拟）"""
        if font_weight >= 800:
            # 对于非常粗的字体（800+），使用多次偏移绘制来增加视觉粗细
            offsets = [
                (-1, -1), (-1, 0), (-1, 1),
                (0, -1), (0, 0), (0, 1),
                (1, -1), (1, 0), (1, 1),
            ]
            for dx, dy in offsets:
                draw.text((position[0] + dx, position[1] + dy), text, fill=color, font=font)
        elif font_weight >= 700:
            # 对于粗体（700-799），使用轻微偏移
            offsets = [
                (-0.5, -0.5), (-0.5, 0.5),
                (0.5, -0.5), (0.5, 0.5),
            ]
            for dx, dy in offsets:
                draw.text((int(position[0] + dx), int(position[1] + dy)), text, fill=color, font=font)
            # 最后绘制主文字
            draw.text(position, text, fill=color, font=font)

    def _get_font_size(self, template: Dict[str, Any], text_type: str) -> int:
        """获取字体大小"""
        if text_type == 'title':
            base_size = self.template_config.get('font_size_title', 120)
        else:
            base_size = self.template_config.get('font_size_subtitle', 60)

        # 根据模板调整大小
        text_size = template.get('text_size', 'medium')
        if text_size == 'small':
            base_size = int(base_size * 0.8)
        elif text_size == 'large':
            base_size = int(base_size * 1.2)

        return base_size

    def _parse_color(self, color_str: str) -> Tuple[int, int, int]:
        """解析颜色字符串为RGB元组
        
        Args:
            color_str: 颜色字符串，支持 'white', 'black', 'red', 'yellow', '#RRGGBB' 等格式
            
        Returns:
            RGB元组 (r, g, b)
        """
        color_str = color_str.lower().strip()
        
        # 预定义颜色
        color_map = {
            'white': (255, 255, 255),
            'black': (0, 0, 0),
            'red': (255, 0, 0),
            'green': (0, 255, 0),
            'blue': (0, 0, 255),
            'yellow': (255, 255, 0),
            'orange': (255, 165, 0),
            'purple': (128, 0, 128),
            'pink': (255, 192, 203),
        }
        
        if color_str in color_map:
            return color_map[color_str]
        
        # 十六进制颜色 #RRGGBB
        if color_str.startswith('#'):
            try:
                hex_color = color_str[1:]
                if len(hex_color) == 6:
                    r = int(hex_color[0:2], 16)
                    g = int(hex_color[2:4], 16)
                    b = int(hex_color[4:6], 16)
                    return (r, g, b)
            except ValueError:
                pass
        
        # 默认返回白色
        return (255, 255, 255)


def generate_cover(background_path: str, people_path: Optional[str] = None,
                  text: Dict[str, Any] = None, template_id: str = "big_text",
                  output_path: Optional[str] = None) -> str:
    """便捷的封面生成函数

    Args:
        background_path: 背景图路径
        people_path: 人物图路径
        text: 文本信息
        template_id: 模板ID
        output_path: 输出路径

    Returns:
        生成的封面路径
    """
    generator = CoverGenerator()
    return generator.generate_cover(background_path, people_path, text, template_id, output_path)

    """
    generator = CoverGenerator()
    return generator.generate_cover(background_path, people_path, text, template_id, output_path)
