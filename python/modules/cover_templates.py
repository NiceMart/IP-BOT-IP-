# -*- coding: utf-8 -*-
"""
封面模板定义文件
Cover Template Definitions
"""

from typing import Dict, Any, Tuple

# 封面模板配置
COVER_TEMPLATES: Dict[str, Dict[str, Any]] = {
    'professional': {
        'name': '专业商务风',
        'description': '金色描边 + 中度虚化 + 人物清晰',
        'blur_radius': 25,  # 背景模糊半径
        'outline_color': (255, 215, 0),  # 金色 (R, G, B)
        'outline_width': 8,  # 描边宽度
        'brightness': 0.9,  # 亮度调整 (0.0-1.0)
        'contrast': 1.0,  # 对比度
        'preview_path': '/assets/templates/professional.jpg'
    },
    'vibrant': {
        'name': '活力青春风',
        'description': '粉色描边 + 轻度虚化 + 明亮色调',
        'blur_radius': 20,
        'outline_color': (255, 105, 180),  # 粉色 (R, G, B)
        'outline_width': 6,
        'brightness': 1.1,
        'contrast': 1.05,
        'preview_path': '/assets/templates/vibrant.jpg'
    },
    'elegant': {
        'name': '优雅高级风',
        'description': '银色描边 + 重度虚化 + 柔和光效',
        'blur_radius': 30,
        'outline_color': (192, 192, 192),  # 银色 (R, G, B)
        'outline_width': 10,
        'brightness': 0.85,
        'contrast': 0.95,
        'preview_path': '/assets/templates/elegant.jpg'
    },
    'classic': {
        'name': '经典商务风',
        'description': '白色描边 + 轻度虚化 + 简洁风格',
        'blur_radius': 15,
        'outline_color': (255, 255, 255),  # 白色 (R, G, B)
        'outline_width': 5,
        'brightness': 0.95,
        'contrast': 1.0,
        'preview_path': '/assets/templates/classic.jpg'
    },
    'dramatic': {
        'name': '戏剧艺术风',
        'description': '红色描边 + 重度虚化 + 强烈对比',
        'blur_radius': 35,
        'outline_color': (220, 20, 60),  # 红色 (R, G, B)
        'outline_width': 12,
        'brightness': 0.8,
        'contrast': 1.2,
        'preview_path': '/assets/templates/dramatic.jpg'
    }
}

def get_template(template_id: str) -> Dict[str, Any]:
    """
    获取模板配置

    Args:
        template_id: 模板ID

    Returns:
        模板配置字典
    """
    return COVER_TEMPLATES.get(template_id, COVER_TEMPLATES['professional'])

def get_all_templates() -> Dict[str, Dict[str, Any]]:
    """
    获取所有模板配置

    Returns:
        所有模板配置字典
    """
    return COVER_TEMPLATES.copy()

def get_template_names() -> Dict[str, str]:
    """
    获取模板ID和名称映射

    Returns:
        {template_id: template_name}
    """
    return {k: v['name'] for k, v in COVER_TEMPLATES.items()}

def get_template_descriptions() -> Dict[str, str]:
    """
    获取模板ID和描述映射

    Returns:
        {template_id: template_description}
    """
    return {k: v['description'] for k, v in COVER_TEMPLATES.items()}

def get_template_preview_paths() -> Dict[str, str]:
    """
    获取模板ID和预览图路径映射

    Returns:
        {template_id: preview_path}
    """
    return {k: v['preview_path'] for k, v in COVER_TEMPLATES.items()}

# 模板效果参数范围定义（用于UI验证）
TEMPLATE_PARAM_RANGES = {
    'blur_radius': {'min': 0, 'max': 50, 'default': 25},
    'outline_width': {'min': 0, 'max': 20, 'default': 8},
    'brightness': {'min': 0.5, 'max': 1.5, 'default': 1.0},
    'contrast': {'min': 0.5, 'max': 1.5, 'default': 1.0}
}