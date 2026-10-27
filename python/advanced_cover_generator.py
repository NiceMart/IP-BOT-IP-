#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
高级封面生成器 - 支持完整的模板功能
Advanced Cover Generator - Full Template Support

功能：
- 背景模糊
- 人物抠图
- 人物描边
- 蒙版叠加
- 自定义字体和文字样式
- 步骤化生成，每步生成预览图
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, Optional, Tuple
from pathlib import Path

# ⚠️ 修复模块路径：确保 Python 能找到 modules 和其他本地模块
# 将脚本所在目录（python 目录）添加到 sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))

# 🔧 关键修复：在打包环境中，modules可能在当前目录或上级目录
# 添加多个可能的路径
possible_paths = [
    script_dir,                          # 脚本所在目录
    os.path.join(script_dir, '..'),     # 上一级目录（如果python-scripts是子目录）
    os.getcwd(),                         # 当前工作目录
]

for path in possible_paths:
    abs_path = os.path.abspath(path)
    if abs_path not in sys.path:
        sys.path.insert(0, abs_path)
        print(f"[PATH] Added to sys.path: {abs_path}", file=sys.stderr, flush=True)

print(f"[PATH] Current sys.path (first 3): {sys.path[:3]}", file=sys.stderr, flush=True)  # 显示前3个路径用于诊断

# ⚠️ 强制输出：验证Python脚本确实在运行
print("=" * 60, file=sys.stderr, flush=True)
print("ADVANCED_COVER_GENERATOR.PY STARTED", file=sys.stderr, flush=True)
print("=" * 60, file=sys.stderr, flush=True)
sys.stderr.flush()

# 导入基础库
try:
    import cv2
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
    print("✅ Basic libraries loaded (cv2, numpy, PIL)", file=sys.stderr, flush=True)
except ImportError as e:
    print(f"❌ Error: Missing required library - {e}", file=sys.stderr, flush=True)
    sys.exit(1)

# 导入人像分割模块（支持MODNet和rembg）
try:
    from modules.segment import PersonSegmenter
    SEGMENT_AVAILABLE = True
    diag_segment = "✅ PersonSegmenter loaded successfully (supports MODNet + rembg)"
    print(diag_segment, file=sys.stderr)
    sys.stderr.flush()
except ImportError as e:
    SEGMENT_AVAILABLE = False
    PersonSegmenter = None
    diag_segment = f"❌ PersonSegmenter failed to load: {e}"
    print(diag_segment, file=sys.stderr)
    print(f"[DIAGNOSTIC] Attempted module paths:", file=sys.stderr)
    for p in sys.path[:5]:
        modules_path = os.path.join(p, 'modules', 'segment.py')
        exists = "EXISTS" if os.path.exists(modules_path) else "NOT FOUND"
        print(f"  {modules_path} - {exists}", file=sys.stderr)
    sys.stderr.flush()

    # 尝试其他可能的导入方式
    try:
        import modules.segment as seg_module
        PersonSegmenter = seg_module.PersonSegmenter
        SEGMENT_AVAILABLE = True
        print("✅ PersonSegmenter loaded via alternative import path", file=sys.stderr)
    except Exception as e2:
        print(f"❌ Alternative import also failed: {e2}", file=sys.stderr)
    sys.stderr.flush()


class AdvancedCoverGenerator:
    """高级封面生成器"""

    def __init__(self, config: Dict[str, Any]):
        """
        初始化生成器

        Args:
            config: 配置字典
        """
        self.config = config
        self.template = config
        self.output_dir = os.path.dirname(config.get('output', './output/cover.png'))
        self.output_path = config.get('output', './output/cover.png')

        # 创建输出目录
        os.makedirs(self.output_dir, exist_ok=True)

        # 步骤预览图列表
        self.preview_images = []
        
        # 初始化人像分割器（支持MODNet优先级，与参考项目一致）
        self.segmenter = None
        self.current_model = "none"
        if SEGMENT_AVAILABLE:
            self._init_segmenter()

    def _init_segmenter(self):
        """
        初始化人像分割器，按优先级尝试加载模型
        
        模型优先级（修复：优先使用rembg模型，避免依赖MODNet本地模型）：
        1. u2net - 通用高质量模型（rembg默认，会自动下载）
        2. u2net_human_seg - 人像专用模型
        3. u2netp - 轻量版模型
        4. silueta - 通用抠图模型
        5. modnet - MODNet专业人像抠图（仅作为备选）
        6. simple - 简化方法（后备）
        """
        model_priority = [
            "u2net",            # 通用高质量（rembg默认，优先使用）
            "u2net_human_seg",  # 人像专用
            "u2netp",           # 轻量版
            "silueta",          # 备用
            "modnet",           # MODNet专业人像（仅作为备选，避免本地模型依赖）
            "simple"            # 简化方法
        ]
        
        for model_name in model_priority:
            try:
                print(f"[COVER_GENERATOR] Trying to load segmentation model: {model_name}", file=sys.stderr)
                self.segmenter = PersonSegmenter(model_name=model_name)
                print(f"[COVER_GENERATOR] Successfully loaded segmentation model: {model_name}", file=sys.stderr)
                self.current_model = model_name
                return
            except Exception as e:
                print(f"[COVER_GENERATOR] Failed to load model {model_name}: {e}", file=sys.stderr)
                import traceback
                traceback.print_exc(file=sys.stderr)
                continue
        
        # 如果所有模型都失败
        print("[COVER_GENERATOR] Warning: All segmentation models failed", file=sys.stderr)
        self.segmenter = None
        self.current_model = "none"

    def _segment_person_with_modnet(self, pil_image: Image.Image) -> Image.Image:
        """
        使用PersonSegmenter进行人像分割（支持MODNet优先级）

        Args:
            pil_image: PIL Image对象（RGB或RGBA）

        Returns:
            分割后的PIL Image（RGBA格式，背景完全透明）
        """
        if self.segmenter is None:
            raise RuntimeError("PersonSegmenter not initialized")

        # 转换PIL Image到numpy数组（BGR格式，PersonSegmenter需要）
        img_np = np.array(pil_image)
        if img_np.shape[2] == 4:  # RGBA
            img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
        elif img_np.shape[2] == 3:  # RGB
            img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

        # 使用PersonSegmenter进行分割（获取mask，而不是预处理后的图像）
        print(f"Using segmentation model: {self.current_model}", file=sys.stderr)

        # 关键修复：使用 return_mask=True 获取分割mask，而不是预处理后的图像
        # 这样可以确保背景被正确处理为透明
        _, mask = self.segmenter.segment_person(img_np, return_mask=True)

        # 确保mask是uint8格式
        if mask.dtype != np.uint8:
            if mask.max() <= 1.0:
                mask = (mask * 255).astype(np.uint8)
            else:
                mask = mask.astype(np.uint8)

        print(f"Segmentation mask: shape={mask.shape}, dtype={mask.dtype}, min={mask.min()}, max={mask.max()}", file=sys.stderr)

        # 将mask应用到原始图像，创建带透明背景的图像
        # 原始图像是RGB，需要转换为RGBA
        img_rgb = cv2.cvtColor(img_np, cv2.COLOR_BGR2RGB)

        # 创建RGBA图像：RGB来自原始图像，A来自mask
        segmented_rgba = np.dstack([img_rgb, mask])

        print(f"Result image: shape={segmented_rgba.shape}, dtype={segmented_rgba.dtype}", file=sys.stderr)

        return Image.fromarray(segmented_rgba)

    def refine_mask(self, mask: np.ndarray) -> np.ndarray:
        """
        优化mask，提高人像分割精度，严格过滤背景物体
        
        改进策略：
        1. 高斯模糊平滑
        2. OTSU 自适应阈值
        3. 形态学操作（开运算去噪点，闭运算填充小洞）
        4. 智能轮廓过滤（基于位置、形状、面积多重条件）
        5. 边缘平滑
        
        Args:
            mask: 输入的 mask（numpy 数组）
            
        Returns:
            优化后的 mask
        """
        try:
            # 确保mask是uint8格式
            if mask.dtype != np.uint8:
                if mask.max() <= 1.0:
                    mask = (mask * 255).astype(np.uint8)
                else:
                    mask = mask.astype(np.uint8)
            
            h, w = mask.shape[:2]
            print(f"Refining mask: shape={mask.shape}, dtype={mask.dtype}", file=sys.stderr)
            
            # 1. 第一次高斯模糊（sigma=0.3）
            mask_blurred = cv2.GaussianBlur(mask, (3, 3), 0.3)
            
            # 2. 使用 OTSU 自适应阈值
            _, mask_binary = cv2.threshold(mask_blurred, 0, 255,
                                           cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # 3. 形态学操作
            # 开运算（去除噪点）- 使用小kernel保持细节
            kernel_small = np.ones((3, 3), np.uint8)
            mask_cleaned = cv2.morphologyEx(mask_binary, cv2.MORPH_OPEN,
                                           kernel_small, iterations=1)
            
            # 闭运算（填充小洞）- 使用中等kernel
            kernel_medium = np.ones((5, 5), np.uint8)
            mask_filled = cv2.morphologyEx(mask_cleaned, cv2.MORPH_CLOSE,
                                          kernel_medium, iterations=1)
            
            # 4. 智能轮廓过滤（严格过滤背景物体）
            contours, _ = cv2.findContours(mask_filled, cv2.RETR_EXTERNAL,
                                           cv2.CHAIN_APPROX_SIMPLE)
            
            if len(contours) > 0:
                # 找到最大轮廓（通常是人物主体）
                largest_contour = max(contours, key=cv2.contourArea)
                largest_area = cv2.contourArea(largest_contour)
                
                # 计算最大轮廓的中心点和边界框
                M = cv2.moments(largest_contour)
                if M["m00"] != 0:
                    largest_cx = int(M["m10"] / M["m00"])
                    largest_cy = int(M["m01"] / M["m00"])
                else:
                    largest_cx, largest_cy = w // 2, h // 2
                
                largest_x, largest_y, largest_w, largest_h = cv2.boundingRect(largest_contour)
                
                print(f"Largest contour: area={largest_area}, center=({largest_cx},{largest_cy}), bbox=({largest_x},{largest_y},{largest_w},{largest_h})", file=sys.stderr)
                
                # 创建新的mask，只保留符合条件的轮廓
                mask_refined = np.zeros_like(mask_filled)
                cv2.fillPoly(mask_refined, [largest_contour], 255)
                
                # 过滤其他轮廓（更严格的条件）
                kept_contours = 1
                for contour in contours:
                    if contour is largest_contour:
                        continue
                    
                    area = cv2.contourArea(contour)
                    
                    # 条件1: 面积必须大于最大轮廓的5%（提高阈值从1.5%到5%）
                    if area < largest_area * 0.05:
                        continue
                    
                    # 计算轮廓的中心点和边界框
                    M = cv2.moments(contour)
                    if M["m00"] != 0:
                        cx = int(M["m10"] / M["m00"])
                        cy = int(M["m01"] / M["m00"])
                    else:
                        continue
                    
                    x, y, cw, ch = cv2.boundingRect(contour)
                    
                    # 条件2: 必须与最大轮廓在垂直方向上有重叠（人物的手臂、腿等）
                    vertical_overlap = not (y + ch < largest_y or y > largest_y + largest_h)
                    if not vertical_overlap:
                        print(f"Filtered contour: no vertical overlap, area={area}, pos=({x},{y})", file=sys.stderr)
                        continue
                    
                    # 条件3: 水平距离不能太远（必须在最大轮廓宽度的1.5倍范围内）
                    horizontal_distance = min(abs(x - largest_x), abs((x + cw) - (largest_x + largest_w)))
                    max_horizontal_distance = largest_w * 1.5
                    if horizontal_distance > max_horizontal_distance:
                        print(f"Filtered contour: too far horizontally, distance={horizontal_distance}, area={area}", file=sys.stderr)
                        continue
                    
                    # 条件4: 长宽比检查（避免保留细长的背景物体）
                    aspect_ratio = cw / ch if ch > 0 else 0
                    # 人体部位的长宽比通常在0.2到5之间
                    if aspect_ratio < 0.2 or aspect_ratio > 5:
                        print(f"Filtered contour: abnormal aspect ratio={aspect_ratio:.2f}, area={area}", file=sys.stderr)
                        continue
                    
                    # 条件5: 位置检查（避免保留图像边缘的物体）
                    # 如果轮廓紧贴图像边缘且不是最大轮廓，很可能是背景物体
                    edge_margin = 10  # 边缘容差
                    is_at_edge = (x < edge_margin or y < edge_margin or
                                 x + cw > w - edge_margin or y + ch > h - edge_margin)
                    if is_at_edge and area < largest_area * 0.3:
                        print(f"Filtered contour: at edge with small area={area}, pos=({x},{y})", file=sys.stderr)
                        continue
                    
                    # 通过所有条件，保留此轮廓
                    cv2.fillPoly(mask_refined, [contour], 255)
                    kept_contours += 1
                    print(f"Kept contour: area={area}, center=({cx},{cy}), aspect_ratio={aspect_ratio:.2f}", file=sys.stderr)
                
                print(f"Contour filtering: kept {kept_contours}/{len(contours)} contours", file=sys.stderr)
                mask_filled = mask_refined
            
            # 5. 第二次高斯模糊使边缘自然（sigma=0.2）
            mask_smooth = cv2.GaussianBlur(mask_filled, (3, 3), 0.2)

            # 最终二值化（使用OTSU自动计算阈值，而不是固定值100）
            # 这样可以避免背景被误认为是人物
            _, mask_final = cv2.threshold(mask_smooth, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            print(f"Mask refinement completed. Final mask: non-zero pixels={np.count_nonzero(mask_final)}", file=sys.stderr)
            return mask_final
            
        except Exception as e:
            print(f"Mask refinement failed: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return mask

    def hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int]:
        """
        将十六进制颜色转换为RGB元组

        Args:
            hex_color: 十六进制颜色字符串（如 "#FFFFFF"）

        Returns:
            RGB元组
        """
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

    def load_image(self, image_path: str) -> Image.Image:
        """
        加载图像

        Args:
            image_path: 图像路径

        Returns:
            PIL图像对象
        """
        print(f"Loading image: {image_path}", file=sys.stderr)

        if image_path.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.webp')):
            # 直接加载图像
            return Image.open(image_path).convert('RGB')
        else:
            # 从视频提取帧
            cap = cv2.VideoCapture(image_path)
            ret, frame = cap.read()
            cap.release()

            if not ret:
                raise Exception("Failed to extract frame from video")

            # 转换BGR到RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            return Image.fromarray(frame_rgb)

    def save_preview(self, image: Image.Image, step_name: str) -> str:
        """
        保存步骤预览图

        Args:
            image: PIL图像对象
            step_name: 步骤名称

        Returns:
            预览图路径
        """
        preview_path = os.path.join(
            self.output_dir,
            f"preview_{len(self.preview_images) + 1}_{step_name}.png"
        )
        image.save(preview_path, quality=95)
        self.preview_images.append({
            'step': len(self.preview_images) + 1,
            'name': step_name,
            'path': preview_path
        })
        print(f"Preview saved: {step_name} -> {preview_path}", file=sys.stderr)
        return preview_path

    def apply_background_blur(self, image: Image.Image) -> Image.Image:
        """
        步骤1: 应用背景模糊

        Args:
            image: 输入图像

        Returns:
            模糊后的图像
        """
        blur_enabled = self.template.get('backgroundBlurEnabled', False)

        if not blur_enabled:
            print("Step 1: Background blur disabled, skipping", file=sys.stderr)
            return image

        blur_intensity = self.template.get('backgroundBlurIntensity', 10)
        print(f"Step 1: Applying background blur (intensity: {blur_intensity})", file=sys.stderr)

        # 应用高斯模糊
        blurred = image.filter(ImageFilter.GaussianBlur(radius=blur_intensity))

        # 保存预览
        self.save_preview(blurred, "background_blur")

        return blurred

    def extract_and_composite_person(self, background: Image.Image) -> Image.Image:
        """
        步骤2: 人物抠图和合成

        Args:
            background: 背景图像

        Returns:
            合成后的图像
        """
        person_border_enabled = self.template.get('personBorderEnabled', False)

        if not person_border_enabled or not SEGMENT_AVAILABLE:
            print("Step 2: Person extraction disabled or PersonSegmenter not available, skipping", file=sys.stderr)
            return background

        print("Step 2: Extracting person from original image", file=sys.stderr)

        # 从原始图像抠图（不是从模糊的背景）
        original_image = self.load_image(self.config.get('video', ''))

        # 调整大小以匹配背景
        if original_image.size != background.size:
            original_image = original_image.resize(background.size, Image.Resampling.LANCZOS)

        # 使用PersonSegmenter进行抠图（支持MODNet优先级）
        try:
            person_rgba = self._segment_person_with_modnet(original_image)
            print("Person extraction completed with PersonSegmenter", file=sys.stderr)
        except Exception as e:
            print(f"PersonSegmenter extraction failed: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return background

        # 确保是 RGBA 模式
        if person_rgba.mode != 'RGBA':
            person_rgba = person_rgba.convert('RGBA')
        
        # 提取 alpha 通道并优化
        alpha_channel = np.array(person_rgba.split()[3])
        refined_alpha = self.refine_mask(alpha_channel)
        
        # 将优化后的 alpha 通道应用回图像
        person_rgba.putalpha(Image.fromarray(refined_alpha))
        
        print("Mask refinement applied to extracted person", file=sys.stderr)

        # 保存抠图预览（带透明背景）
        self.save_preview(person_rgba, "person_extracted")

        # 调整人物大小
        person_size = self.template.get('personSize', 100)
        person_rotation = self.template.get('personRotation', 0)
        if person_size != 100:
            print(f"Step 2: Resizing person to {person_size}%", file=sys.stderr)
            new_width = int(person_rgba.width * person_size / 100)
            new_height = int(person_rgba.height * person_size / 100)
            person_rgba = person_rgba.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # 调整人物位置
        person_position = self.template.get('personPosition', {'x': 50, 'y': 50})

        # ✅ 新增：人像旋转
        if person_rotation != 0:
            print(f"Rotating person by {person_rotation}°", file=sys.stderr)
            # 旋转人像（使用expand=True以保留完整旋转结果）
            person_rgba = person_rgba.rotate(-person_rotation, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
            print(f"Person rotated, new size: {person_rgba.size}", file=sys.stderr)

        person_x = int(background.width * person_position['x'] / 100) - person_rgba.width // 2
        person_y = int(background.height * person_position['y'] / 100) - person_rgba.height // 2

        # 合成到背景（保持 RGBA 模式以保留透明度）
        result = background.convert('RGBA')
        result.paste(person_rgba, (person_x, person_y), person_rgba)
        
        # 保存预览（保持RGBA模式）
        self.save_preview(result, "person_composited")

        return result

    def apply_person_outline(self, image: Image.Image) -> Image.Image:
        """
        步骤3: 应用人物描边
        
        注意：此方法已废弃，描边逻辑已移至 _apply_outline_to_person
        保留此方法仅为兼容性

        Args:
            image: 输入图像

        Returns:
            添加描边后的图像
        """
        person_border_enabled = self.template.get('personBorderEnabled', False)

        if not person_border_enabled or not SEGMENT_AVAILABLE:
            print("Step 3: Person outline disabled or PersonSegmenter not available, skipping", file=sys.stderr)
            return image

        print("Step 3: Applying person outline (legacy method)", file=sys.stderr)
        print("Warning: This method is deprecated, use the new generate() flow instead", file=sys.stderr)

        # 从原始图像抠图（使用PersonSegmenter）
        original_image = self.load_image(self.config.get('video', ''))
        if original_image.size != image.size:
            original_image = original_image.resize(image.size, Image.Resampling.LANCZOS)

        # 使用PersonSegmenter进行抠图
        try:
            person_rgba = self._segment_person_with_modnet(original_image)
        except Exception as e:
            print(f"PersonSegmenter extraction failed: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return image
        
        # 确保是 RGBA 模式
        if person_rgba.mode != 'RGBA':
            person_rgba = person_rgba.convert('RGBA')
        
        # 提取 alpha 通道并优化
        alpha_channel = np.array(person_rgba.split()[3])
        refined_alpha = self.refine_mask(alpha_channel)
        person_rgba.putalpha(Image.fromarray(refined_alpha))

        # 应用描边
        person_rgba = self._apply_outline_to_person(person_rgba)

        # 调整人物大小
        person_size = self.template.get('personSize', 100)
        person_rotation = self.template.get('personRotation', 0)
        if person_size != 100:
            new_width = int(person_rgba.width * person_size / 100)
            new_height = int(person_rgba.height * person_size / 100)
            person_rgba = person_rgba.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # 调整大小和位置
        person_position = self.template.get('personPosition', {'x': 50, 'y': 50})
        person_x = int(image.width * person_position['x'] / 100) - person_rgba.width // 2
        person_y = int(image.height * person_position['y'] / 100) - person_rgba.height // 2

        # 合成
        result = image.convert('RGBA')
        result.paste(person_rgba, (person_x, person_y), person_rgba)
        
        # 保存预览（保持RGBA模式）
        self.save_preview(result, "person_outlined")

        return result

    def apply_mask(self, image: Image.Image) -> Image.Image:
        """
        步骤4: 应用蒙版

        Args:
            image: 输入图像

        Returns:
            添加蒙版后的图像
        """
        mask_enabled = self.template.get('maskEnabled', False)

        if not mask_enabled:
            print("Step 4: Mask disabled, skipping", file=sys.stderr)
            return image

        mask_path = self.template.get('maskImagePath', '')
        if not mask_path or not os.path.exists(mask_path):
            print(f"Step 4: Mask image not found: {mask_path}, skipping", file=sys.stderr)
            return image

        print(f"Step 4: Applying mask from {mask_path}", file=sys.stderr)

        # 加载蒙版
        mask_img = Image.open(mask_path).convert('RGBA')

        # 获取蒙版参数
        mask_size = self.template.get('maskSize', 100)
        mask_position = self.template.get('maskPosition', {'x': 50, 'y': 50})
        mask_opacity = self.template.get('maskOpacity', 100)

        # 调整蒙版大小
        mask_width = int(image.width * mask_size / 100)
        mask_height = int(image.height * mask_size / 100)
        mask_img = mask_img.resize((mask_width, mask_height), Image.Resampling.LANCZOS)

        # 调整透明度
        if mask_opacity < 100:
            alpha = mask_img.split()[3]
            alpha = ImageEnhance.Brightness(alpha).enhance(mask_opacity / 100)
            mask_img.putalpha(alpha)

        # 计算位置
        mask_x = int(image.width * mask_position['x'] / 100) - mask_width // 2
        mask_y = int(image.height * mask_position['y'] / 100) - mask_height // 2

        # 合成
        result = image.convert('RGBA')
        result.paste(mask_img, (mask_x, mask_y), mask_img)
        
        # 保存预览（保持RGBA模式）
        self.save_preview(result, "mask_applied")

        return result

    def add_text(self, image: Image.Image) -> Image.Image:
        """
        步骤5: 添加文字（主标题和副标题）

        Args:
            image: 输入图像

        Returns:
            添加文字后的图像
        """
        title_text = self.config.get('title', self.template.get('titleText', ''))
        subtitle_text = self.template.get('subtitleText', '')

        if not title_text and not subtitle_text:
            print("Step 5: No title or subtitle text, skipping", file=sys.stderr)
            return image

        print(f"Step 5: Adding text - Title: {title_text}, Subtitle: {subtitle_text}", file=sys.stderr)

        # 转换为RGBA以支持透明度
        result = image.convert('RGBA')
        draw = ImageDraw.Draw(result)

        width, height = result.size
        print(f"[add_text] Image size: {width}x{height}", file=sys.stderr)

        # 获取文字参数
        font_family = self.template.get('titleFontFamily', 'SimHei')
        font_size = self.template.get('titleFontSize', 120)
        font_weight = self.template.get('titleFontWeight', 700)
        text_color = self.hex_to_rgb(self.template.get('titleColor', '#FFFFFF'))
        stroke_color = self.hex_to_rgb(self.template.get('titleStrokeColor', '#000000'))
        stroke_width = self.template.get('titleStrokeWidth', 2)

        # 修复：处理文本位置参数，确保是字典类型
        text_position = self.template.get('titlePosition', {'x': 50, 'y': 80})
        print(f"[add_text] Title position (percentage): x={text_position['x']}%, y={text_position['y']}%", file=sys.stderr)
        
        # 如果是字符串（旧格式），转换为字典
        if isinstance(text_position, str):
            position_map = {
                'top': {'x': 50, 'y': 20},
                'center': {'x': 50, 'y': 50},
                'bottom': {'x': 50, 'y': 80}
            }
            text_position = position_map.get(text_position, {'x': 50, 'y': 80})
            print(f"Converted text position from string to dict: {text_position}", file=sys.stderr)

        # 加载字体
        font_path = self._get_font_path(font_family)
        try:
            font = ImageFont.truetype(font_path, font_size)
        except:
            print(f"Warning: Failed to load font {font_path}, using default", file=sys.stderr)
            font = ImageFont.load_default()

        # ✅ 关键修复：支持多行文字，使用anchor='mm'实现中心对齐
        # 计算文字中心点位置（百分比转像素）
        # 主标题不需要坐标反转
        text_x_from_config = text_position['x']
        text_y_from_config = text_position['y']
        text_x = int(width * text_x_from_config / 100)
        text_y = int(height * text_y_from_config / 100)
        print(f"[add_text] Title initial position (pixels): x={text_x}px, y={text_y}px (from {text_x_from_config}%, {text_y_from_config}%)", file=sys.stderr)
        
        if '\n' in title_text:
            lines = title_text.split('\n')
            print(f"Rendering multiline text: {len(lines)} lines, center=({text_x},{text_y}), text='{title_text}'", file=sys.stderr)
        else:
            print(f"Rendering single line text, center=({text_x},{text_y}), text='{title_text}'", file=sys.stderr)

        # 绘制装饰图层1（原文字背景，现为独立装饰层）
        if self.template.get('titleBackgroundEnabled', False):
            bg_color = self.hex_to_rgb(self.template.get('titleBackgroundColor', '#000000'))
            bg_opacity = self.template.get('titleBackgroundOpacity', 70)
            bg_shape = self.template.get('titleBackgroundShape', 'rectangle')
            bg_size = self.template.get('titleBackgroundSize', {'width': 30, 'height': 10})
            bg_position = self.template.get('titleBackgroundPosition', {'x': 50, 'y': 30})
            bg_radius = self.template.get('titleBackgroundRadius', 10)
            bg_points = self.template.get('titleBackgroundPoints', [])
            title_background_rotation = self.template.get('titleBackgroundRotation', 0)

            bg_alpha = int(255 * bg_opacity / 100)

            print(f"Title background: color={bg_color}, opacity={bg_opacity}%, alpha={bg_alpha}, shape={bg_shape}", file=sys.stderr)
            # 🔧 调试：输出多边形点数据
            print(f"[DEBUG] titleBackgroundPoints: {bg_points}, type: {type(bg_points)}, len: {len(bg_points) if isinstance(bg_points, (list, tuple)) else 'N/A'}", file=sys.stderr)

            # 创建单独的图层来绘制背景（确保透明度正确）
            bg_layer = Image.new('RGBA', result.size, (0, 0, 0, 0))
            bg_draw = ImageDraw.Draw(bg_layer)

            # 使用独立的位置和大小参数（百分比转像素）
            bg_width = int(width * bg_size['width'] / 100)
            bg_height = int(height * bg_size['height'] / 100)
            bg_center_x = int(width * bg_position['x'] / 100)
            bg_center_y = int(height * bg_position['y'] / 100)
            
            bg_left = bg_center_x - bg_width // 2
            bg_top = bg_center_y - bg_height // 2
            bg_right = bg_center_x + bg_width // 2
            bg_bottom = bg_center_y + bg_height // 2

            # 🔧 调试：记录每个条件的结果
            print(f"[DEBUG] Shape check: bg_shape='{bg_shape}' (type: {type(bg_shape).__name__})", file=sys.stderr)
            print(f"[DEBUG] Points check: bg_points={bg_points}, type={type(bg_points).__name__}, len={len(bg_points) if isinstance(bg_points, list) else 'N/A'}, bool(bg_points)={bool(bg_points)}", file=sys.stderr)

            # 🔧 详细输出：模板中的所有背景相关字段
            print(f"[DEBUG] Template background fields:", file=sys.stderr)
            print(f"  titleBackgroundEnabled: {self.template.get('titleBackgroundEnabled')}", file=sys.stderr)
            print(f"  titleBackgroundShape: {self.template.get('titleBackgroundShape')}", file=sys.stderr)
            print(f"  titleBackgroundPoints raw: {self.template.get('titleBackgroundPoints')}", file=sys.stderr)
            print(f"[DEBUG] Polygon condition: bg_shape=='polygon'={bg_shape == 'polygon'}, bg_points truthy={bool(bg_points)}", file=sys.stderr)

            if bg_shape == 'rectangle':
                # 矩形背景
                print(f"[DEBUG] Drawing RECTANGLE background", file=sys.stderr)
                bg_draw.rectangle(
                    [bg_left, bg_top, bg_right, bg_bottom],
                    fill=(*bg_color, bg_alpha)
                )
            elif bg_shape == 'rounded':
                # 圆角矩形背景
                print(f"[DEBUG] Drawing ROUNDED RECTANGLE background", file=sys.stderr)
                bg_draw.rounded_rectangle(
                    [bg_left, bg_top, bg_right, bg_bottom],
                    radius=bg_radius,
                    fill=(*bg_color, bg_alpha)
                )
            elif bg_shape == 'polygon' and bg_points:
                # 自定义多边形背景
                print(f"[DEBUG] Drawing POLYGON background with {len(bg_points)} points", file=sys.stderr)
                polygon_points = []
                for i, point in enumerate(bg_points):
                    try:
                        px = bg_center_x + int(point['x'] * bg_width / 100)
                        py = bg_center_y + int(point['y'] * bg_height / 100)
                        polygon_points.append((px, py))
                        print(f"[DEBUG] Point {i}: {point} -> ({px}, {py})", file=sys.stderr)
                    except Exception as e:
                        print(f"[DEBUG] Error processing point {i}: {point}, error: {e}", file=sys.stderr)

                if len(polygon_points) >= 3:
                    print(f"[DEBUG] Drawing polygon with {len(polygon_points)} points: {polygon_points}", file=sys.stderr)
                    bg_draw.polygon(polygon_points, fill=(*bg_color, bg_alpha))
                else:
                    print(f"[DEBUG] Not enough points for polygon (need >= 3, got {len(polygon_points)}). Falling back to rectangle.", file=sys.stderr)
                    bg_draw.rectangle(
                        [bg_left, bg_top, bg_right, bg_bottom],
                        fill=(*bg_color, bg_alpha)
                    )
            else:
                # 默认使用矩形
                print(f"[DEBUG] Drawing DEFAULT RECTANGLE (didn't match any shape type)", file=sys.stderr)
                bg_draw.rectangle(
                    [bg_left, bg_top, bg_right, bg_bottom],
                    fill=(*bg_color, bg_alpha)
                )

            # ✅ 如果需要旋转，旋转背景图层
            if title_background_rotation != 0:
                print(f"Rotating title background by {title_background_rotation}°", file=sys.stderr)
                bg_layer = bg_layer.rotate(-title_background_rotation, resample=Image.BICUBIC, expand=False, fillcolor=(0, 0, 0, 0))

            # 使用alpha_composite合成背景层
            result = Image.alpha_composite(result, bg_layer)
            draw = ImageDraw.Draw(result)  # 重新创建draw对象

        # 绘制装饰图层2（副标题背景，现为独立装饰层）
        if self.template.get('subtitleBackgroundEnabled', False):
            bg_color = self.hex_to_rgb(self.template.get('subtitleBackgroundColor', '#000000'))
            bg_opacity = self.template.get('subtitleBackgroundOpacity', 70)
            bg_shape = self.template.get('subtitleBackgroundShape', 'rectangle')
            bg_size = self.template.get('subtitleBackgroundSize', {'width': 30, 'height': 10})
            bg_position = self.template.get('subtitleBackgroundPosition', {'x': 50, 'y': 60})
            bg_radius = self.template.get('subtitleBackgroundRadius', 10)
            bg_points = self.template.get('subtitleBackgroundPoints', [])
            subtitle_background_rotation = self.template.get('subtitleBackgroundRotation', 0)

            bg_alpha = int(255 * bg_opacity / 100)

            print(f"Subtitle background: color={bg_color}, opacity={bg_opacity}%, alpha={bg_alpha}, shape={bg_shape}", file=sys.stderr)
            # 🔧 调试：输出副标题多边形点数据
            print(f"[DEBUG] subtitleBackgroundPoints: {bg_points}, type: {type(bg_points)}, len: {len(bg_points) if isinstance(bg_points, (list, tuple)) else 'N/A'}", file=sys.stderr)

            # 创建单独的图层来绘制背景（确保透明度正确）
            bg_layer = Image.new('RGBA', result.size, (0, 0, 0, 0))
            bg_draw = ImageDraw.Draw(bg_layer)

            # 使用独立的位置和大小参数（百分比转像素）
            bg_width = int(width * bg_size['width'] / 100)
            bg_height = int(height * bg_size['height'] / 100)
            bg_center_x = int(width * bg_position['x'] / 100)
            bg_center_y = int(height * bg_position['y'] / 100)

            bg_left = bg_center_x - bg_width // 2
            bg_top = bg_center_y - bg_height // 2
            bg_right = bg_center_x + bg_width // 2
            bg_bottom = bg_center_y + bg_height // 2

            # 🔧 调试：记录每个条件的结果
            print(f"[DEBUG-SUB] Shape check: bg_shape='{bg_shape}' (type: {type(bg_shape).__name__})", file=sys.stderr)
            print(f"[DEBUG-SUB] Points check: bg_points={bg_points}, bool(bg_points)={bool(bg_points)}", file=sys.stderr)
            print(f"[DEBUG-SUB] Polygon condition: bg_shape=='polygon'={bg_shape == 'polygon'}, bg_points truthy={bool(bg_points)}", file=sys.stderr)

            if bg_shape == 'rectangle':
                # 矩形背景
                print(f"[DEBUG-SUB] Drawing RECTANGLE background", file=sys.stderr)
                bg_draw.rectangle(
                    [bg_left, bg_top, bg_right, bg_bottom],
                    fill=(*bg_color, bg_alpha)
                )
            elif bg_shape == 'rounded':
                # 圆角矩形背景
                print(f"[DEBUG-SUB] Drawing ROUNDED RECTANGLE background", file=sys.stderr)
                bg_draw.rounded_rectangle(
                    [bg_left, bg_top, bg_right, bg_bottom],
                    radius=bg_radius,
                    fill=(*bg_color, bg_alpha)
                )
            elif bg_shape == 'polygon' and bg_points:
                # 自定义多边形背景
                print(f"[DEBUG-SUB] Drawing POLYGON background with {len(bg_points)} points", file=sys.stderr)
                polygon_points = []
                for i, point in enumerate(bg_points):
                    try:
                        px = bg_center_x + int(point['x'] * bg_width / 100)
                        py = bg_center_y + int(point['y'] * bg_height / 100)
                        polygon_points.append((px, py))
                        print(f"[DEBUG-SUB] Point {i}: {point} -> ({px}, {py})", file=sys.stderr)
                    except Exception as e:
                        print(f"[DEBUG-SUB] Error processing point {i}: {point}, error: {e}", file=sys.stderr)

                if len(polygon_points) >= 3:
                    print(f"[DEBUG-SUB] Drawing polygon with {len(polygon_points)} points: {polygon_points}", file=sys.stderr)
                    bg_draw.polygon(polygon_points, fill=(*bg_color, bg_alpha))
                else:
                    print(f"[DEBUG-SUB] Not enough points for polygon (need >= 3, got {len(polygon_points)}). Falling back to rectangle.", file=sys.stderr)
                    bg_draw.rectangle(
                        [bg_left, bg_top, bg_right, bg_bottom],
                        fill=(*bg_color, bg_alpha)
                    )
            else:
                # 默认使用矩形
                print(f"[DEBUG-SUB] Drawing DEFAULT RECTANGLE (didn't match any shape type)", file=sys.stderr)
                bg_draw.rectangle(
                    [bg_left, bg_top, bg_right, bg_bottom],
                    fill=(*bg_color, bg_alpha)
                )

            # ✅ 如果需要旋转，旋转背景图层
            if subtitle_background_rotation != 0:
                print(f"Rotating subtitle background by {subtitle_background_rotation}°", file=sys.stderr)
                bg_layer = bg_layer.rotate(-subtitle_background_rotation, resample=Image.BICUBIC, expand=False, fillcolor=(0, 0, 0, 0))
            
            # 使用alpha_composite合成背景层
            result = Image.alpha_composite(result, bg_layer)
            draw = ImageDraw.Draw(result)  # 重新创建draw对象

        # ✅ 修复：直接在原始图层上绘制，不使用临时图层
        # 这样可以确保坐标计算和前端Canvas完全一致
        print(f"Drawing title text directly on original layer (no temp layer)", file=sys.stderr)
        title_draw = draw
        
        # 绘制标题文字（带描边），使用anchor='mm'实现中心对齐
        # ✅ 新增：检查是否使用titles参数（支持direction、charSpacing、lineSpacing、maxLength）
        titles_config = self.template.get('titles')

        # 📋 调试日志：显示 titles_config 的完整信息
        print(f"[DEBUG-TITLES] titles_config exists: {titles_config is not None}", file=sys.stderr)
        if titles_config and 'main' in titles_config:
            print(f"[DEBUG-TITLES] titles.main exists", file=sys.stderr)
            print(f"[DEBUG-TITLES] titles.main keys: {list(titles_config['main'].keys())}", file=sys.stderr)
            print(f"[DEBUG-TITLES] titles.main.maxLength: {titles_config['main'].get('maxLength')}", file=sys.stderr)
        else:
            print(f"[DEBUG-TITLES] titles.main does NOT exist, will use defaults or titleMaxCharsPerLine", file=sys.stderr)
            print(f"[DEBUG-TITLES] template.titleMaxCharsPerLine: {self.template.get('titleMaxCharsPerLine')}", file=sys.stderr)

        # ✅ 修复：总是使用图层渲染方式（支持旋转），即使没有titles配置
        # 从顶级模板读取direction等参数，确保走新逻辑分支
        if not titles_config or 'main' not in titles_config:
            # 创建默认的titles配置，从顶级模板读取参数
            titles_config = {
                'main': {
                    'direction': self.template.get('titleDirection', 'horizontal'),
                    'charSpacing': self.template.get('titleCharSpacing'),
                    'lineSpacing': self.template.get('titleLineSpacing'),
                    'maxLength': self.template.get('titleMaxCharsPerLine', 10),
                    'rotation': self.template.get('titleRotation', 0),
                    'backgroundRotation': self.template.get('titleBackgroundRotation', 0),
                }
            }

        if titles_config and 'main' in titles_config:
            # 使用titles参数配置绘制主标题（支持横竖排、字符间距、行间距、自动折行）
            print(f"[advanced_cover_generator] Using titles.main config for title rendering", file=sys.stderr)
            main_config = titles_config['main']

            # ✅ 修复：优先从 titles.main 读取字体大小，确保与前端一致
            font_size_from_config = main_config.get('fontSize', font_size)
            if font_size_from_config != font_size:
                print(f"  [INFO] Using fontSize from titles.main: {font_size_from_config} (was {font_size})", file=sys.stderr)
                font_size = font_size_from_config
                # 重新加载字体
                try:
                    font = ImageFont.truetype(font_path, font_size)
                except:
                    pass

            # 获取排版参数 - 优先使用 titles.main 中的值，否则使用顶级配置，最后使用默认值
            direction = main_config.get('direction', self.template.get('titleDirection', 'horizontal'))

            # ✅ 修复：优先使用 titles.main 中的间距值，然后是顶级配置，最后是默认值
            char_spacing = main_config.get('charSpacing')
            if char_spacing is None:
                char_spacing = self.template.get('titleCharSpacing')
            if char_spacing is None:
                char_spacing = int(font_size * 0.2)

            line_spacing = main_config.get('lineSpacing')
            if line_spacing is None:
                line_spacing = self.template.get('titleLineSpacing')
            if line_spacing is None:
                line_spacing = int(font_size * 1.2)

            max_chars_per_line = main_config.get('maxLength', self.template.get('titleMaxCharsPerLine', 10))

            # 📋 调试日志：显示 maxLength 的实际值和来源
            print(f"[DEBUG-MAXLENGTH] main_config.get('maxLength'): {main_config.get('maxLength')}", file=sys.stderr)
            print(f"[DEBUG-MAXLENGTH] self.template.get('titleMaxCharsPerLine'): {self.template.get('titleMaxCharsPerLine')}", file=sys.stderr)
            print(f"[DEBUG-MAXLENGTH] Final max_chars_per_line: {max_chars_per_line}", file=sys.stderr)

            # ✅ 新增：获取阴影参数
            shadow_enabled = main_config.get('shadowEnabled', self.template.get('titleShadowEnabled', False))
            shadow_color = self.hex_to_rgb(main_config.get('shadowColor', self.template.get('titleShadowColor', '#000000')))
            shadow_offset_x = main_config.get('shadowOffsetX', self.template.get('titleShadowOffsetX', 0))
            shadow_offset_y = main_config.get('shadowOffsetY', self.template.get('titleShadowOffsetY', 0))
            shadow_blur = main_config.get('shadowBlur', self.template.get('titleShadowBlur', 0))

            # ✅ 新增：获取多层阴影参数
            shadow_layers = main_config.get('shadowLayers', self.template.get('titleShadowLayers', []))
            print(f"  📦 Shadow layers: {len(shadow_layers)} layer(s)", file=sys.stderr)
            if shadow_layers:
                for i, layer in enumerate(shadow_layers):
                    if layer.get('enabled', True):
                        print(f"    Layer {i}: offset=({layer.get('offsetX', 0)}, {layer.get('offsetY', 0)}), blur={layer.get('blur', 0)}, color={layer.get('color', '#000000')}, opacity={layer.get('opacity', 100)}", file=sys.stderr)
            rotation_angle = main_config.get('rotation', self.template.get('titleRotation', 0))
            title_background_rotation = main_config.get('backgroundRotation', self.template.get('titleBackgroundRotation', 0))

            # ✅ 修复旋转坐标问题：根据旋转角度使用不同的变换
            # 将角度归一化到0-360范围
            normalized_angle = rotation_angle % 360

            if 45 <= normalized_angle < 135:
                # ~90度旋转：X=Y, Y=100-X
                text_x = int(width * text_y_from_config / 100)
                text_y = int(height * (100 - text_x_from_config) / 100)
                print(f"[ROTATION 90°] Main title: ({text_x_from_config}%, {text_y_from_config}%) → ({text_y_from_config}%, {100-text_x_from_config}%) → ({text_x}px, {text_y}px)", file=sys.stderr)
            elif 135 <= normalized_angle < 225:
                # ~180度旋转：X=100-X, Y=100-Y
                text_x = int(width * (100 - text_x_from_config) / 100)
                text_y = int(height * (100 - text_y_from_config) / 100)
                print(f"[ROTATION 180°] Main title: ({text_x_from_config}%, {text_y_from_config}%) → ({100-text_x_from_config}%, {100-text_y_from_config}%) → ({text_x}px, {text_y}px)", file=sys.stderr)
            elif 225 <= normalized_angle < 315:
                # ~270度旋转：X=100-Y, Y=X
                text_x = int(width * (100 - text_y_from_config) / 100)
                text_y = int(height * text_x_from_config / 100)
                print(f"[ROTATION 270°] Main title: ({text_x_from_config}%, {text_y_from_config}%) → ({100-text_y_from_config}%, {text_x_from_config}%) → ({text_x}px, {text_y}px)", file=sys.stderr)
            else:
                # ~0度或360度：不变换
                text_x = int(width * text_x_from_config / 100)
                text_y = int(height * text_y_from_config / 100)
                print(f"[NO ROTATION] Main title: ({text_x_from_config}%, {text_y_from_config}%) → ({text_x}px, {text_y}px)", file=sys.stderr)

            # ✅ 新增：计算文字实际高度并调整Y坐标，与前端getElementStyleWithSize保持一致
            # 不限制范围，允许文字超出边界
            try:
                bbox = draw.textbbox((text_x, text_y), title_text, font=font, anchor='mm')
                text_height = bbox[3] - bbox[1]
                # 调整Y坐标：top = centerY - height/2（与前端一致）
                text_y = text_y - text_height // 2
                print(f"[TITLE HEIGHT ADJUST] text_height={text_height}, adjusted text_y={text_y}", file=sys.stderr)
            except Exception as e:
                print(f"[TITLE HEIGHT ADJUST] Warning: {e}", file=sys.stderr)

            print(f"[DEBUG] Main title config:", file=sys.stderr)
            print(f"  Text: '{title_text}' (length: {len(title_text)})", file=sys.stderr)
            print(f"  maxLength: {max_chars_per_line}", file=sys.stderr)
            print(f"  Direction: {direction}", file=sys.stderr)
            print(f"  Char spacing: {char_spacing}px, Line spacing: {line_spacing}px", file=sys.stderr)
            print(f"  Position: ({text_x}, {text_y})", file=sys.stderr)
            print(f"  ⚠️ Shadow params: color={shadow_color}, offsetX={shadow_offset_x}, offsetY={shadow_offset_y}, blur={shadow_blur}", file=sys.stderr)
            print(f"  🔄 Rotation angle: {rotation_angle}°", file=sys.stderr)

            # 将文字分行
            lines = []
            for i in range(0, len(title_text), max_chars_per_line):
                lines.append(title_text[i:i + max_chars_per_line])

            print(f"  Split into {len(lines)} lines: {lines}", file=sys.stderr)

            if direction == 'vertical':
                # ✅ 修复：与前端一致，竖排从左到右排列，每列从上到下
                total_width = (len(lines) - 1) * line_spacing + font_size
                max_col_chars = max(len(line) for line in lines) if lines else 1
                total_height = (max_col_chars - 1) * (font_size + char_spacing) + font_size

                # ✅ 修复：计算起始位置（整体居中）
                # 前端：left = centerX - totalWidth/2，第一列colX=0
                # 所以第一列中心 = centerX - totalWidth/2 + fontSize/2
                start_x = text_x - total_width // 2
                start_y = text_y - total_height // 2
                print(f"  [Vertical] total_size=({total_width},{total_height}), start=({start_x},{start_y})", file=sys.stderr)

                # ✅ 计算padding：确保文字+阴影+模糊完全在图层内
                # 基础padding：考虑负坐标和超出边界
                base_padding = max(
                    abs(min(0, start_x)),
                    abs(min(0, start_y)),
                    max(0, start_x + total_width - width),
                    max(0, start_y + total_height - height),
                    shadow_blur * 3,
                    abs(shadow_offset_x),
                    abs(shadow_offset_y)
                )
                # 旋转padding：旋转会扩大边界框，预留足够空间
                # 对角线长度作为旋转后的最大可能尺寸
                diagonal = int(((total_width ** 2 + total_height ** 2) ** 0.5) / 2)
                rotation_padding = diagonal if rotation_angle != 0 else 0

                padding = max(base_padding, rotation_padding) + 100  # 额外安全边距

                expanded_width = width + padding * 2
                expanded_height = height + padding * 2
                print(f"  [Vertical Title] Using expanded layer: {width}x{height} → {expanded_width}x{expanded_height}, padding={padding} (base={base_padding}, rotation={rotation_padding})", file=sys.stderr)

                # ✅ 步骤1: 处理多层阴影或单层阴影
                has_shadow = shadow_enabled and (shadow_blur > 0 or shadow_offset_x != 0 or shadow_offset_y != 0)
                has_multiple_shadows = len(shadow_layers) > 0 and any(layer.get('enabled', True) for layer in shadow_layers)

                if has_multiple_shadows or has_shadow:
                    print(f"  [Vertical Title] Creating shadow layer(s): {len([l for l in shadow_layers if l.get('enabled', True)])} multi-layer + single={has_shadow}", file=sys.stderr)
                    shadow_layer = Image.new('RGBA', (expanded_width, expanded_height), (0, 0, 0, 0))

                    # ✅ 首先绘制多层阴影（如果有）
                    if has_multiple_shadows:
                        for layer_idx, layer in enumerate(shadow_layers):
                            if layer.get('enabled', True):
                                layer_color = self.hex_to_rgb(layer.get('color', '#000000'))
                                layer_opacity = int(255 * (layer.get('opacity', 100) / 100))
                                layer_offset_x = layer.get('offsetX', 0)
                                layer_offset_y = layer.get('offsetY', 0)
                                layer_blur = layer.get('blur', 0)

                                shadow_draw = ImageDraw.Draw(shadow_layer)

                                # 为这一层绘制文字
                                for col_idx, line in enumerate(lines):
                                    col_x = start_x + padding + col_idx * line_spacing
                                    for char_idx, char in enumerate(line):
                                        char_y = start_y + padding + char_idx * (font_size + char_spacing) + font_size // 2
                                        char_x = col_x
                                        shadow_x = char_x + layer_offset_x
                                        shadow_y = char_y + layer_offset_y
                                        shadow_draw.text((shadow_x, shadow_y), char, font=font, fill=(*layer_color, layer_opacity), anchor='mm')

                                # 对这一层应用模糊
                                if layer_blur > 0:
                                    print(f"    [Vertical Title] Applying blur={layer_blur} to shadow layer {layer_idx}", file=sys.stderr)
                                    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=layer_blur))

                                print(f"    [Vertical Title] Shadow layer {layer_idx} composited", file=sys.stderr)

                    # ✅ 然后绘制传统单层阴影（如果有）
                    if has_shadow:
                        shadow_draw = ImageDraw.Draw(shadow_layer)
                        for col_idx, line in enumerate(lines):
                            col_x = start_x + padding + col_idx * line_spacing
                            for char_idx, char in enumerate(line):
                                char_y = start_y + padding + char_idx * (font_size + char_spacing) + font_size // 2
                                char_x = col_x
                                shadow_x = char_x + shadow_offset_x
                                shadow_y = char_y + shadow_offset_y
                                shadow_draw.text((shadow_x, shadow_y), char, font=font, fill=(*shadow_color, 160), anchor='mm')

                        # 应用真正的高斯模糊（如果blur > 0）
                        if shadow_blur > 0:
                            print(f"  [Vertical Title] Applying GaussianBlur with radius={shadow_blur}", file=sys.stderr)
                            shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=shadow_blur))

                    # ✅ 旋转扩展图层并裁剪回原始尺寸
                    if rotation_angle != 0:
                        print(f"  [Vertical Title] Rotating shadow layer by {rotation_angle}°", file=sys.stderr)
                        shadow_layer = shadow_layer.rotate(-rotation_angle, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
                        crop_x = (shadow_layer.width - width) // 2
                        crop_y = (shadow_layer.height - height) // 2
                        shadow_layer = shadow_layer.crop((crop_x, crop_y, crop_x + width, crop_y + height))
                        result = Image.alpha_composite(result, shadow_layer)
                    else:
                        shadow_layer = shadow_layer.crop((padding, padding, padding + width, padding + height))
                        result = Image.alpha_composite(result, shadow_layer)
                    title_draw = ImageDraw.Draw(result)  # 重新创建draw对象
                    print(f"  [Vertical Title] Shadow layer composited", file=sys.stderr)

                # ✅ 步骤2: 在扩展图层绘制描边和主文字
                print(f"  [Vertical Title] Creating text layer", file=sys.stderr)
                text_layer = Image.new('RGBA', (expanded_width, expanded_height), (0, 0, 0, 0))
                text_draw = ImageDraw.Draw(text_layer)

                for col_idx, line in enumerate(lines):
                    col_x = start_x + padding + col_idx * line_spacing

                    for char_idx, char in enumerate(line):
                        char_y = start_y + padding + char_idx * (font_size + char_spacing) + font_size // 2
                        char_x = col_x

                        # 绘制描边
                        if stroke_width > 0:
                            for offset_x in range(-stroke_width, stroke_width + 1):
                                for offset_y in range(-stroke_width, stroke_width + 1):
                                    if offset_x == 0 and offset_y == 0:
                                        continue
                                    text_draw.text((char_x + offset_x, char_y + offset_y),
                                                 char, font=font, fill=(*stroke_color, 255), anchor='mm')

                        # 绘制主体
                        text_draw.text((char_x, char_y), char, font=font, fill=(*text_color, 255), anchor='mm')

                # ✅ 步骤3: 旋转扩展图层并裁剪回原始尺寸
                if rotation_angle != 0:
                    print(f"  [Vertical Title] Rotating text layer by {rotation_angle}°", file=sys.stderr)
                    text_layer = text_layer.rotate(-rotation_angle, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
                    crop_x = (text_layer.width - width) // 2
                    crop_y = (text_layer.height - height) // 2
                    text_layer = text_layer.crop((crop_x, crop_y, crop_x + width, crop_y + height))
                    result = Image.alpha_composite(result, text_layer)
                else:
                    text_layer = text_layer.crop((padding, padding, padding + width, padding + height))
                    result = Image.alpha_composite(result, text_layer)
                title_draw = ImageDraw.Draw(result)  # 重新创建draw对象
                print(f"  [Vertical Title] Text layer composited", file=sys.stderr)
            else:
                # 横排：从左到右，从上到下（默认）
                # ✅ 修复：与前端一致，行间距 = font_size + line_spacing
                total_height = (len(lines) - 1) * (font_size + line_spacing) + font_size

                # ✅ 修复：计算最长行的宽度，所有行都基于此宽度左对齐（与前端一致）
                max_line_chars = max(len(line) for line in lines) if lines else 1
                total_width = (max_line_chars - 1) * (font_size + char_spacing) + font_size

                # 计算整体起始位置（基于最长行居中，然后所有行左对齐）
                start_x = text_x - total_width // 2
                start_y = text_y - total_height // 2
                print(f"  [Horizontal] total_size=({total_width},{total_height}), start=({start_x},{start_y})", file=sys.stderr)

                # ✅ 计算padding：确保文字+阴影+模糊完全在图层内
                base_padding = max(
                    abs(min(0, start_x)),
                    abs(min(0, start_y)),
                    max(0, start_x + total_width - width),
                    max(0, start_y + total_height - height),
                    shadow_blur * 3,
                    abs(shadow_offset_x),
                    abs(shadow_offset_y)
                )
                diagonal = int(((total_width ** 2 + total_height ** 2) ** 0.5) / 2)
                rotation_padding = diagonal if rotation_angle != 0 else 0
                padding = max(base_padding, rotation_padding) + 100

                expanded_width = width + padding * 2
                expanded_height = height + padding * 2
                print(f"  [Horizontal Title] Using expanded layer: {width}x{height} → {expanded_width}x{expanded_height}, padding={padding} (base={base_padding}, rotation={rotation_padding})", file=sys.stderr)

                # ✅ 步骤1: 处理多层阴影或单层阴影
                has_shadow = shadow_enabled and (shadow_blur > 0 or shadow_offset_x != 0 or shadow_offset_y != 0)
                has_multiple_shadows = len(shadow_layers) > 0 and any(layer.get('enabled', True) for layer in shadow_layers)

                if has_multiple_shadows or has_shadow:
                    print(f"  [Horizontal Title] Creating shadow layer(s): {len([l for l in shadow_layers if l.get('enabled', True)])} multi-layer + single={has_shadow}", file=sys.stderr)
                    shadow_layer = Image.new('RGBA', (expanded_width, expanded_height), (0, 0, 0, 0))

                    # ✅ 首先绘制多层阴影（如果有）
                    if has_multiple_shadows:
                        for layer_idx, layer in enumerate(shadow_layers):
                            if layer.get('enabled', True):
                                layer_color = self.hex_to_rgb(layer.get('color', '#000000'))
                                layer_opacity = int(255 * (layer.get('opacity', 100) / 100))
                                layer_offset_x = layer.get('offsetX', 0)
                                layer_offset_y = layer.get('offsetY', 0)
                                layer_blur = layer.get('blur', 0)

                                shadow_draw = ImageDraw.Draw(shadow_layer)

                                # 为这一层绘制文字
                                for row_idx, line in enumerate(lines):
                                    line_y = start_y + padding + row_idx * (font_size + line_spacing) + font_size // 2
                                    for char_idx, char in enumerate(line):
                                        char_x = start_x + padding + char_idx * (font_size + char_spacing) + font_size // 2
                                        char_y = line_y
                                        shadow_x = char_x + layer_offset_x
                                        shadow_y = char_y + layer_offset_y
                                        shadow_draw.text((shadow_x, shadow_y), char, font=font, fill=(*layer_color, layer_opacity), anchor='mm')

                                # 对这一层应用模糊
                                if layer_blur > 0:
                                    print(f"    [Horizontal Title] Applying blur={layer_blur} to shadow layer {layer_idx}", file=sys.stderr)
                                    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=layer_blur))

                                print(f"    [Horizontal Title] Shadow layer {layer_idx} composited", file=sys.stderr)

                    # ✅ 然后绘制传统单层阴影（如果有）
                    if has_shadow:
                        shadow_draw = ImageDraw.Draw(shadow_layer)
                        for row_idx, line in enumerate(lines):
                            line_y = start_y + padding + row_idx * (font_size + line_spacing) + font_size // 2
                            for char_idx, char in enumerate(line):
                                char_x = start_x + padding + char_idx * (font_size + char_spacing) + font_size // 2
                                char_y = line_y
                                shadow_x = char_x + shadow_offset_x
                                shadow_y = char_y + shadow_offset_y
                                shadow_draw.text((shadow_x, shadow_y), char, font=font, fill=(*shadow_color, 160), anchor='mm')

                        # 应用真正的高斯模糊（如果blur > 0）
                        if shadow_blur > 0:
                            print(f"  [Horizontal Title] Applying GaussianBlur with radius={shadow_blur}", file=sys.stderr)
                            shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=shadow_blur))

                    # ✅ 旋转扩展图层并裁剪回原始尺寸
                    if rotation_angle != 0:
                        print(f"  [Horizontal Title] Rotating shadow layer by {rotation_angle}°", file=sys.stderr)
                        shadow_layer = shadow_layer.rotate(-rotation_angle, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
                        crop_x = (shadow_layer.width - width) // 2
                        crop_y = (shadow_layer.height - height) // 2
                        shadow_layer = shadow_layer.crop((crop_x, crop_y, crop_x + width, crop_y + height))
                        result = Image.alpha_composite(result, shadow_layer)
                    else:
                        shadow_layer = shadow_layer.crop((padding, padding, padding + width, padding + height))
                        result = Image.alpha_composite(result, shadow_layer)
                    title_draw = ImageDraw.Draw(result)  # 重新创建draw对象
                    print(f"  [Horizontal Title] Shadow layer composited", file=sys.stderr)

                # ✅ 步骤2: 在扩展图层绘制描边和主文字
                print(f"  [Horizontal Title] Creating text layer", file=sys.stderr)
                text_layer = Image.new('RGBA', (expanded_width, expanded_height), (0, 0, 0, 0))
                text_draw = ImageDraw.Draw(text_layer)

                for row_idx, line in enumerate(lines):
                    line_y = start_y + padding + row_idx * (font_size + line_spacing) + font_size // 2

                    for char_idx, char in enumerate(line):
                        char_x = start_x + padding + char_idx * (font_size + char_spacing) + font_size // 2
                        char_y = line_y

                        # 绘制描边
                        if stroke_width > 0:
                            for offset_x in range(-stroke_width, stroke_width + 1):
                                for offset_y in range(-stroke_width, stroke_width + 1):
                                    if offset_x == 0 and offset_y == 0:
                                        continue
                                    text_draw.text((char_x + offset_x, char_y + offset_y),
                                                 char, font=font, fill=(*stroke_color, 255), anchor='mm')

                        # 绘制主体
                        text_draw.text((char_x, char_y), char, font=font, fill=(*text_color, 255), anchor='mm')

                # ✅ 步骤3: 旋转扩展图层并裁剪回原始尺寸
                if rotation_angle != 0:
                    print(f"  [Horizontal Title] Rotating text layer by {rotation_angle}°", file=sys.stderr)
                    text_layer = text_layer.rotate(-rotation_angle, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
                    crop_x = (text_layer.width - width) // 2
                    crop_y = (text_layer.height - height) // 2
                    text_layer = text_layer.crop((crop_x, crop_y, crop_x + width, crop_y + height))
                    result = Image.alpha_composite(result, text_layer)
                else:
                    text_layer = text_layer.crop((padding, padding, padding + width, padding + height))
                    result = Image.alpha_composite(result, text_layer)
                title_draw = ImageDraw.Draw(result)  # 重新创建draw对象
                print(f"  [Horizontal Title] Text layer composited", file=sys.stderr)
        elif '\n' in title_text:
            # 多行文字渲染（原有逻辑）
            if stroke_width > 0:
                title_draw.multiline_text(
                    (text_x, text_y),  # 直接使用text_x, text_y
                    title_text,
                    font=font,
                    fill=(*text_color, 255),
                    align='center',
                    anchor='mm',
                    stroke_width=stroke_width,
                    stroke_fill=(*stroke_color, 255)
                )
            else:
                title_draw.multiline_text(
                    (text_x, text_y),  # 直接使用text_x, text_y
                    title_text,
                    font=font,
                    fill=(*text_color, 255),
                    align='center',
                    anchor='mm'
                )
        else:
            # 单行文字渲染（原有逻辑）
            if stroke_width > 0:
                title_draw.text(
                    (text_x, text_y),  # 直接使用text_x, text_y
                    title_text,
                    font=font,
                    fill=(*text_color, 255),
                    anchor='mm',
                    stroke_width=stroke_width,
                    stroke_fill=(*stroke_color, 255)
                )
            else:
                title_draw.text(
                    (text_x, text_y),  # 直接使用text_x, text_y
                    title_text,
                    font=font,
                    fill=(*text_color, 255),
                    anchor='mm'
                )

        # 绘制副标题（如果有）
        if subtitle_text:
            print(f"Adding subtitle text: {subtitle_text}", file=sys.stderr)
            
            # 获取副标题参数
            subtitle_font_family = self.template.get('subtitleFontFamily', 'SimHei')
            subtitle_font_size = self.template.get('subtitleFontSize', 60)
            subtitle_font_weight = self.template.get('subtitleFontWeight', 500)
            subtitle_text_color = self.hex_to_rgb(self.template.get('subtitleColor', '#FFFFFF'))
            subtitle_stroke_color = self.hex_to_rgb(self.template.get('subtitleStrokeColor', '#000000'))
            subtitle_stroke_width = self.template.get('subtitleStrokeWidth', 1)
            
            # 修复：处理副标题位置参数
            subtitle_position = self.template.get('subtitlePosition', {'x': 50, 'y': 90})
            
            # 如果是字符串（旧格式），转换为字典
            if isinstance(subtitle_position, str):
                position_map = {
                    'top': {'x': 50, 'y': 30},
                    'center': {'x': 50, 'y': 50},
                    'bottom': {'x': 50, 'y': 90}
                }
                subtitle_position = position_map.get(subtitle_position, {'x': 50, 'y': 90})
                print(f"Converted subtitle position from string to dict: {subtitle_position}", file=sys.stderr)
            
            # 加载副标题字体
            subtitle_font_path = self._get_font_path(subtitle_font_family)
            try:
                subtitle_font = ImageFont.truetype(subtitle_font_path, subtitle_font_size)
            except:
                print(f"Warning: Failed to load subtitle font {subtitle_font_path}, using default", file=sys.stderr)
                subtitle_font = ImageFont.load_default()
            
            # 计算副标题中心点位置（百分比转像素）
            # ✅ 修复旋转坐标问题：有旋转时Y轴需要反转，无旋转时不需要
            subtitle_x = int(width * subtitle_position['x'] / 100)
            # 注意：这里还没有读取到rotation_angle，先使用正常计算，后面会根据rotation调整
            subtitle_y_from_config = subtitle_position['y']
            subtitle_y = int(height * subtitle_y_from_config / 100)

            print(f"Rendering subtitle, initial center=({subtitle_x},{subtitle_y}), text='{subtitle_text}' (from {subtitle_position['x']}%, {subtitle_y_from_config}%)", file=sys.stderr)
            
            # ✅ 直接在原图上绘制副标题（不使用临时图层）
            print(f"Drawing subtitle directly on original image at ({subtitle_x},{subtitle_y})", file=sys.stderr)

            # 直接在原图上绘制，不使用临时图层
            subtitle_draw = draw
            
            # 绘制副标题（使用anchor='mm'实现中心对齐）
            # ✅ 新增：检查是否使用titles.sub参数（支持direction、charSpacing、lineSpacing、maxLength）

            # ✅ 修复：总是使用图层渲染方式（支持旋转），即使没有titles配置
            if not titles_config or 'sub' not in titles_config:
                # 创建默认的titles配置，从顶级模板读取参数
                if not titles_config:
                    titles_config = {}
                titles_config['sub'] = {
                    'direction': self.template.get('subtitleDirection', 'horizontal'),
                    'charSpacing': self.template.get('subtitleCharSpacing'),
                    'lineSpacing': self.template.get('subtitleLineSpacing'),
                    'maxLength': self.template.get('subtitleMaxCharsPerLine', 15),
                    'rotation': self.template.get('subtitleRotation', 0),
                    'backgroundRotation': self.template.get('subtitleBackgroundRotation', 0),
                }

            if titles_config and 'sub' in titles_config:
                # 使用titles.sub参数配置绘制副标题（支持横竖排、字符间距、行间距、自动折行）
                print(f"[advanced_cover_generator] Using titles.sub config for subtitle rendering", file=sys.stderr)
                sub_config = titles_config['sub']

                # ✅ 修复：优先从 titles.sub 读取字体大小，确保与前端一致
                subtitle_font_size_from_config = sub_config.get('fontSize', subtitle_font_size)
                if subtitle_font_size_from_config != subtitle_font_size:
                    print(f"  [INFO] Using fontSize from titles.sub: {subtitle_font_size_from_config} (was {subtitle_font_size})", file=sys.stderr)
                    subtitle_font_size = subtitle_font_size_from_config
                    # 重新加载字体
                    try:
                        subtitle_font = ImageFont.truetype(subtitle_font_path, subtitle_font_size)
                    except:
                        pass

                # 获取排版参数 - 优先使用 titles.sub 中的值，否则使用顶级配置，最后使用默认值
                direction = sub_config.get('direction', self.template.get('subtitleDirection', 'horizontal'))

                # ✅ 修复：优先使用 titles.sub 中的间距值，然后是顶级配置，最后是默认值
                char_spacing = sub_config.get('charSpacing')
                if char_spacing is None:
                    char_spacing = self.template.get('subtitleCharSpacing')
                if char_spacing is None:
                    char_spacing = int(subtitle_font_size * 0.2)

                line_spacing = sub_config.get('lineSpacing')
                if line_spacing is None:
                    line_spacing = self.template.get('subtitleLineSpacing')
                if line_spacing is None:
                    line_spacing = int(subtitle_font_size * 1.2)

                max_chars_per_line = sub_config.get('maxLength', self.template.get('subtitleMaxCharsPerLine', 15))

                # ✅ 新增：获取副标题阴影参数
                subtitle_shadow_enabled = sub_config.get('shadowEnabled', self.template.get('subtitleShadowEnabled', False))
                subtitle_shadow_color = self.hex_to_rgb(sub_config.get('shadowColor', self.template.get('subtitleShadowColor', '#000000')))
                subtitle_shadow_offset_x = sub_config.get('shadowOffsetX', self.template.get('subtitleShadowOffsetX', 0))
                subtitle_shadow_offset_y = sub_config.get('shadowOffsetY', self.template.get('subtitleShadowOffsetY', 0))
                subtitle_shadow_blur = sub_config.get('shadowBlur', self.template.get('subtitleShadowBlur', 0))
                subtitle_rotation_angle = sub_config.get('rotation', self.template.get('subtitleRotation', 0))
                subtitle_background_rotation = sub_config.get('backgroundRotation', self.template.get('subtitleBackgroundRotation', 0))

                # ✅ 修复旋转坐标问题：根据旋转角度使用不同的变换（和主标题一致）
                normalized_subtitle_angle = subtitle_rotation_angle % 360

                if 45 <= normalized_subtitle_angle < 135:
                    # ~90度旋转
                    subtitle_x = int(width * subtitle_y_from_config / 100)
                    subtitle_y = int(height * (100 - subtitle_position['x']) / 100)
                    print(f"[ROTATION 90°] Subtitle: ({subtitle_position['x']}%, {subtitle_y_from_config}%) → ({subtitle_y_from_config}%, {100-subtitle_position['x']}%) → ({subtitle_x}px, {subtitle_y}px)", file=sys.stderr)
                elif 135 <= normalized_subtitle_angle < 225:
                    # ~180度旋转
                    subtitle_x = int(width * (100 - subtitle_position['x']) / 100)
                    subtitle_y = int(height * (100 - subtitle_y_from_config) / 100)
                    print(f"[ROTATION 180°] Subtitle: ({subtitle_position['x']}%, {subtitle_y_from_config}%) → ({100-subtitle_position['x']}%, {100-subtitle_y_from_config}%) → ({subtitle_x}px, {subtitle_y}px)", file=sys.stderr)
                elif 225 <= normalized_subtitle_angle < 315:
                    # ~270度旋转
                    subtitle_x = int(width * (100 - subtitle_y_from_config) / 100)
                    subtitle_y = int(height * subtitle_position['x'] / 100)
                    print(f"[ROTATION 270°] Subtitle: ({subtitle_position['x']}%, {subtitle_y_from_config}%) → ({100-subtitle_y_from_config}%, {subtitle_position['x']}%) → ({subtitle_x}px, {subtitle_y}px)", file=sys.stderr)
                else:
                    # ~0度或360度
                    print(f"[NO ROTATION] Subtitle: ({subtitle_position['x']}%, {subtitle_y_from_config}%) → ({subtitle_x}px, {subtitle_y}px)", file=sys.stderr)

                # ✅ 新增：计算副标题实际高度并调整Y坐标，与前端getElementStyleWithSize保持一致
                # 不限制范围，允许文字超出边界
                try:
                    subtitle_bbox = draw.textbbox((subtitle_x, subtitle_y), subtitle_text, font=subtitle_font, anchor='mm')
                    subtitle_height = subtitle_bbox[3] - subtitle_bbox[1]
                    # 调整Y坐标：top = centerY - height/2（与前端一致）
                    subtitle_y = subtitle_y - subtitle_height // 2
                    print(f"[SUBTITLE HEIGHT ADJUST] subtitle_height={subtitle_height}, adjusted subtitle_y={subtitle_y}", file=sys.stderr)
                except Exception as e:
                    print(f"[SUBTITLE HEIGHT ADJUST] Warning: {e}", file=sys.stderr)

                print(f"[DEBUG] Sub title config:", file=sys.stderr)
                print(f"  Text: '{subtitle_text}' (length: {len(subtitle_text)})", file=sys.stderr)
                print(f"  maxLength: {max_chars_per_line}", file=sys.stderr)
                print(f"  Direction: {direction}", file=sys.stderr)
                print(f"  Char spacing: {char_spacing}px, Line spacing: {line_spacing}px", file=sys.stderr)
                print(f"  Position: ({subtitle_x}, {subtitle_y})", file=sys.stderr)

                # 将文字分行
                lines = []
                for i in range(0, len(subtitle_text), max_chars_per_line):
                    lines.append(subtitle_text[i:i + max_chars_per_line])

                print(f"  Split into {len(lines)} lines: {lines}", file=sys.stderr)

                if direction == 'vertical':
                    # ✅ 修复：与前端一致，竖排从左到右排列，每列从上到下
                    total_width = (len(lines) - 1) * line_spacing + subtitle_font_size
                    max_col_chars = max(len(line) for line in lines) if lines else 1
                    total_height = (max_col_chars - 1) * (subtitle_font_size + char_spacing) + subtitle_font_size

                    # ✅ 修复：计算起始位置（整体居中），与前端一致
                    start_x = subtitle_x - total_width // 2
                    start_y = subtitle_y - total_height // 2

                    print(f"  [Vertical] total_size=({total_width},{total_height}), start=({start_x},{start_y})", file=sys.stderr)

                    # ✅ 计算padding：确保文字+阴影+模糊完全在图层内
                    base_padding = max(
                        abs(min(0, start_x)),
                        abs(min(0, start_y)),
                        max(0, start_x + total_width - width),
                        max(0, start_y + total_height - height),
                        subtitle_shadow_blur * 3,
                        abs(subtitle_shadow_offset_x),
                        abs(subtitle_shadow_offset_y)
                    )
                    diagonal = int(((total_width ** 2 + total_height ** 2) ** 0.5) / 2)
                    rotation_padding = diagonal if subtitle_rotation_angle != 0 else 0
                    padding = max(base_padding, rotation_padding) + 100

                    expanded_width = width + padding * 2
                    expanded_height = height + padding * 2
                    print(f"  [Vertical Subtitle] Using expanded layer: {width}x{height} → {expanded_width}x{expanded_height}, padding={padding} (base={base_padding}, rotation={rotation_padding})", file=sys.stderr)

                    # ✅ 步骤1: 处理多层阴影或单层阴影（与主标题逻辑一致）
                    subtitle_has_shadow = subtitle_shadow_enabled and (subtitle_shadow_blur > 0 or subtitle_shadow_offset_x != 0 or subtitle_shadow_offset_y != 0)
                    subtitle_shadow_layers = sub_config.get('shadowLayers', self.template.get('subtitleShadowLayers', []))
                    subtitle_has_multiple_shadows = len(subtitle_shadow_layers) > 0 and any(layer.get('enabled', True) for layer in subtitle_shadow_layers)

                    if subtitle_has_multiple_shadows or subtitle_has_shadow:
                        print(f"  [Vertical Subtitle] Creating shadow layer(s): {len([l for l in subtitle_shadow_layers if l.get('enabled', True)])} multi-layer + single={subtitle_has_shadow}", file=sys.stderr)
                        shadow_layer = Image.new('RGBA', (expanded_width, expanded_height), (0, 0, 0, 0))

                        # ✅ 首先绘制多层阴影（如果有）
                        if subtitle_has_multiple_shadows:
                            for layer_idx, layer in enumerate(subtitle_shadow_layers):
                                if layer.get('enabled', True):
                                    layer_color = self.hex_to_rgb(layer.get('color', '#000000'))
                                    layer_opacity = int(255 * (layer.get('opacity', 100) / 100))
                                    layer_offset_x = layer.get('offsetX', 0)
                                    layer_offset_y = layer.get('offsetY', 0)
                                    layer_blur = layer.get('blur', 0)

                                    shadow_draw = ImageDraw.Draw(shadow_layer)

                                    # 为这一层绘制文字
                                    for col_idx, line in enumerate(lines):
                                        col_x = start_x + padding + col_idx * line_spacing
                                        for char_idx, char in enumerate(line):
                                            char_y = start_y + padding + char_idx * (subtitle_font_size + char_spacing) + subtitle_font_size // 2
                                            char_x = col_x
                                            shadow_x = char_x + layer_offset_x
                                            shadow_y = char_y + layer_offset_y
                                            shadow_draw.text((shadow_x, shadow_y), char, font=subtitle_font, fill=(*layer_color, layer_opacity), anchor='mm')

                                    # 对这一层应用模糊
                                    if layer_blur > 0:
                                        print(f"    [Vertical Subtitle] Applying blur={layer_blur} to shadow layer {layer_idx}", file=sys.stderr)
                                        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=layer_blur))

                                    print(f"    [Vertical Subtitle] Shadow layer {layer_idx} composited", file=sys.stderr)

                        # ✅ 然后绘制传统单层阴影（如果有）
                        if subtitle_has_shadow:
                            shadow_draw_temp = ImageDraw.Draw(shadow_layer)
                            for col_idx, line in enumerate(lines):
                                col_x = start_x + padding + col_idx * line_spacing
                                for char_idx, char in enumerate(line):
                                    char_y = start_y + padding + char_idx * (subtitle_font_size + char_spacing) + subtitle_font_size // 2
                                    char_x = col_x
                                    shadow_x = char_x + subtitle_shadow_offset_x
                                    shadow_y = char_y + subtitle_shadow_offset_y
                                    shadow_draw_temp.text((shadow_x, shadow_y), char, font=subtitle_font, fill=(*subtitle_shadow_color, 160), anchor='mm')

                            if subtitle_shadow_blur > 0:
                                print(f"  [Vertical Subtitle] Applying GaussianBlur with radius={subtitle_shadow_blur}", file=sys.stderr)
                                shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=subtitle_shadow_blur))

                        # ✅ 旋转扩展图层并裁剪回原始尺寸
                        if subtitle_rotation_angle != 0:
                            print(f"  [Vertical Subtitle] Rotating shadow layer by {subtitle_rotation_angle}°", file=sys.stderr)
                            shadow_layer = shadow_layer.rotate(-subtitle_rotation_angle, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
                            crop_x = (shadow_layer.width - width) // 2
                            crop_y = (shadow_layer.height - height) // 2
                            shadow_layer = shadow_layer.crop((crop_x, crop_y, crop_x + width, crop_y + height))
                            result = Image.alpha_composite(result, shadow_layer)
                        else:
                            shadow_layer = shadow_layer.crop((padding, padding, padding + width, padding + height))
                            result = Image.alpha_composite(result, shadow_layer)
                        subtitle_draw = ImageDraw.Draw(result)
                        print(f"  [Vertical Subtitle] Shadow layer composited", file=sys.stderr)

                    # ✅ 步骤2: 在扩展图层绘制描边和主文字
                    print(f"  [Vertical Subtitle] Creating text layer", file=sys.stderr)
                    text_layer = Image.new('RGBA', (expanded_width, expanded_height), (0, 0, 0, 0))
                    text_draw = ImageDraw.Draw(text_layer)

                    for col_idx, line in enumerate(lines):
                        col_x = start_x + padding + col_idx * line_spacing

                        for char_idx, char in enumerate(line):
                            char_y = start_y + padding + char_idx * (subtitle_font_size + char_spacing) + subtitle_font_size // 2
                            char_x = col_x

                            # 绘制描边
                            if subtitle_stroke_width > 0:
                                for offset_x in range(-subtitle_stroke_width, subtitle_stroke_width + 1):
                                    for offset_y in range(-subtitle_stroke_width, subtitle_stroke_width + 1):
                                        if offset_x == 0 and offset_y == 0:
                                            continue
                                        text_draw.text((char_x + offset_x, char_y + offset_y),
                                                     char, font=subtitle_font, fill=(*subtitle_stroke_color, 255), anchor='mm')

                            # 绘制主体
                            text_draw.text((char_x, char_y), char, font=subtitle_font, fill=(*subtitle_text_color, 255), anchor='mm')

                    # ✅ 步骤3: 旋转扩展图层并裁剪回原始尺寸
                    if subtitle_rotation_angle != 0:
                        print(f"  [Vertical Subtitle] Rotating text layer by {subtitle_rotation_angle}°", file=sys.stderr)
                        text_layer = text_layer.rotate(-subtitle_rotation_angle, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
                        crop_x = (text_layer.width - width) // 2
                        crop_y = (text_layer.height - height) // 2
                        text_layer = text_layer.crop((crop_x, crop_y, crop_x + width, crop_y + height))
                        result = Image.alpha_composite(result, text_layer)
                    else:
                        text_layer = text_layer.crop((padding, padding, padding + width, padding + height))
                        result = Image.alpha_composite(result, text_layer)
                    subtitle_draw = ImageDraw.Draw(result)
                    print(f"  [Vertical Subtitle] Text layer composited", file=sys.stderr)
                else:
                    # 横排：从左到右，从上到下（默认）
                    # ✅ 修复：与前端一致，行间距 = subtitle_font_size + line_spacing
                    total_height = (len(lines) - 1) * (subtitle_font_size + line_spacing) + subtitle_font_size

                    # ✅ 修复：计算最长行的宽度，所有行都基于此宽度左对齐（与前端一致）
                    max_line_chars = max(len(line) for line in lines) if lines else 1
                    total_width = (max_line_chars - 1) * (subtitle_font_size + char_spacing) + subtitle_font_size

                    # 计算整体起始位置（基于最长行居中，然后所有行左对齐）
                    start_x = subtitle_x - total_width // 2
                    start_y = subtitle_y - total_height // 2

                    print(f"  [Horizontal] total_size=({total_width},{total_height}), start=({start_x},{start_y})", file=sys.stderr)

                    # ✅ 计算padding：确保文字+阴影+模糊完全在图层内
                    base_padding = max(
                        abs(min(0, start_x)),
                        abs(min(0, start_y)),
                        max(0, start_x + total_width - width),
                        max(0, start_y + total_height - height),
                        subtitle_shadow_blur * 3,
                        abs(subtitle_shadow_offset_x),
                        abs(subtitle_shadow_offset_y)
                    )
                    diagonal = int(((total_width ** 2 + total_height ** 2) ** 0.5) / 2)
                    rotation_padding = diagonal if subtitle_rotation_angle != 0 else 0
                    padding = max(base_padding, rotation_padding) + 100

                    expanded_width = width + padding * 2
                    expanded_height = height + padding * 2
                    print(f"  [Horizontal Subtitle] Using expanded layer: {width}x{height} → {expanded_width}x{expanded_height}, padding={padding} (base={base_padding}, rotation={rotation_padding})", file=sys.stderr)

                    # ✅ 步骤1: 处理多层阴影或单层阴影（与主标题逻辑一致）
                    subtitle_has_shadow = subtitle_shadow_enabled and (subtitle_shadow_blur > 0 or subtitle_shadow_offset_x != 0 or subtitle_shadow_offset_y != 0)
                    subtitle_shadow_layers = sub_config.get('shadowLayers', self.template.get('subtitleShadowLayers', []))
                    subtitle_has_multiple_shadows = len(subtitle_shadow_layers) > 0 and any(layer.get('enabled', True) for layer in subtitle_shadow_layers)

                    if subtitle_has_multiple_shadows or subtitle_has_shadow:
                        print(f"  [Horizontal Subtitle] Creating shadow layer(s): {len([l for l in subtitle_shadow_layers if l.get('enabled', True)])} multi-layer + single={subtitle_has_shadow}", file=sys.stderr)
                        shadow_layer = Image.new('RGBA', (expanded_width, expanded_height), (0, 0, 0, 0))

                        # ✅ 首先绘制多层阴影（如果有）
                        if subtitle_has_multiple_shadows:
                            for layer_idx, layer in enumerate(subtitle_shadow_layers):
                                if layer.get('enabled', True):
                                    layer_color = self.hex_to_rgb(layer.get('color', '#000000'))
                                    layer_opacity = int(255 * (layer.get('opacity', 100) / 100))
                                    layer_offset_x = layer.get('offsetX', 0)
                                    layer_offset_y = layer.get('offsetY', 0)
                                    layer_blur = layer.get('blur', 0)

                                    shadow_draw = ImageDraw.Draw(shadow_layer)

                                    # 为这一层绘制文字
                                    for row_idx, line in enumerate(lines):
                                        line_y = start_y + padding + row_idx * (subtitle_font_size + line_spacing) + subtitle_font_size // 2
                                        for char_idx, char in enumerate(line):
                                            char_x = start_x + padding + char_idx * (subtitle_font_size + char_spacing) + subtitle_font_size // 2
                                            char_y = line_y
                                            shadow_x = char_x + layer_offset_x
                                            shadow_y = char_y + layer_offset_y
                                            shadow_draw.text((shadow_x, shadow_y), char, font=subtitle_font, fill=(*layer_color, layer_opacity), anchor='mm')

                                    # 对这一层应用模糊
                                    if layer_blur > 0:
                                        print(f"    [Horizontal Subtitle] Applying blur={layer_blur} to shadow layer {layer_idx}", file=sys.stderr)
                                        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=layer_blur))

                                    print(f"    [Horizontal Subtitle] Shadow layer {layer_idx} composited", file=sys.stderr)

                        # ✅ 然后绘制传统单层阴影（如果有）
                        if subtitle_has_shadow:
                            shadow_draw_temp = ImageDraw.Draw(shadow_layer)
                            for row_idx, line in enumerate(lines):
                                line_y = start_y + padding + row_idx * (subtitle_font_size + line_spacing) + subtitle_font_size // 2
                                for char_idx, char in enumerate(line):
                                    char_x = start_x + padding + char_idx * (subtitle_font_size + char_spacing) + subtitle_font_size // 2
                                    char_y = line_y
                                    shadow_x = char_x + subtitle_shadow_offset_x
                                    shadow_y = char_y + subtitle_shadow_offset_y
                                    shadow_draw_temp.text((shadow_x, shadow_y), char, font=subtitle_font, fill=(*subtitle_shadow_color, 160), anchor='mm')

                            if subtitle_shadow_blur > 0:
                                print(f"  [Horizontal Subtitle] Applying GaussianBlur with radius={subtitle_shadow_blur}", file=sys.stderr)
                                shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=subtitle_shadow_blur))

                        # ✅ 旋转扩展图层并裁剪回原始尺寸
                        if subtitle_rotation_angle != 0:
                            print(f"  [Horizontal Subtitle] Rotating shadow layer by {subtitle_rotation_angle}°", file=sys.stderr)
                            shadow_layer = shadow_layer.rotate(-subtitle_rotation_angle, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
                            # 裁剪回原始尺寸：计算中心位置
                            crop_x = (shadow_layer.width - width) // 2
                            crop_y = (shadow_layer.height - height) // 2
                            shadow_layer = shadow_layer.crop((crop_x, crop_y, crop_x + width, crop_y + height))
                            result = Image.alpha_composite(result, shadow_layer)
                        else:
                            # 裁剪掉padding
                            shadow_layer = shadow_layer.crop((padding, padding, padding + width, padding + height))
                            result = Image.alpha_composite(result, shadow_layer)
                        subtitle_draw = ImageDraw.Draw(result)
                        print(f"  [Horizontal Subtitle] Shadow layer composited", file=sys.stderr)

                    # ✅ 步骤2: 在扩展图层绘制描边和主文字
                    print(f"  [Horizontal Subtitle] Creating text layer", file=sys.stderr)
                    text_layer = Image.new('RGBA', (expanded_width, expanded_height), (0, 0, 0, 0))
                    text_draw = ImageDraw.Draw(text_layer)

                    for row_idx, line in enumerate(lines):
                        line_y = start_y + padding + row_idx * (subtitle_font_size + line_spacing) + subtitle_font_size // 2

                        for char_idx, char in enumerate(line):
                            char_x = start_x + padding + char_idx * (subtitle_font_size + char_spacing) + subtitle_font_size // 2
                            char_y = line_y

                            # 绘制描边
                            if subtitle_stroke_width > 0:
                                for offset_x in range(-subtitle_stroke_width, subtitle_stroke_width + 1):
                                    for offset_y in range(-subtitle_stroke_width, subtitle_stroke_width + 1):
                                        if offset_x == 0 and offset_y == 0:
                                            continue
                                        text_draw.text((char_x + offset_x, char_y + offset_y),
                                                     char, font=subtitle_font, fill=(*subtitle_stroke_color, 255), anchor='mm')

                            # 绘制主体
                            text_draw.text((char_x, char_y), char, font=subtitle_font, fill=(*subtitle_text_color, 255), anchor='mm')

                    # ✅ 步骤3: 旋转扩展图层并裁剪回原始尺寸
                    if subtitle_rotation_angle != 0:
                        print(f"  [Horizontal Subtitle] Rotating text layer by {subtitle_rotation_angle}°", file=sys.stderr)
                        text_layer = text_layer.rotate(-subtitle_rotation_angle, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
                        crop_x = (text_layer.width - width) // 2
                        crop_y = (text_layer.height - height) // 2
                        text_layer = text_layer.crop((crop_x, crop_y, crop_x + width, crop_y + height))
                        result = Image.alpha_composite(result, text_layer)
                    else:
                        # 裁剪掉padding
                        text_layer = text_layer.crop((padding, padding, padding + width, padding + height))
                        result = Image.alpha_composite(result, text_layer)
                    subtitle_draw = ImageDraw.Draw(result)
                    print(f"  [Horizontal Subtitle] Text layer composited", file=sys.stderr)
            elif subtitle_stroke_width > 0:
                # 原有逻辑：带描边（回退到简单multiline_text）
                subtitle_draw.text(
                    (subtitle_x, subtitle_y),
                    subtitle_text,
                    font=subtitle_font,
                    fill=(*subtitle_text_color, 255),
                    anchor='mm',
                    stroke_width=subtitle_stroke_width,
                    stroke_fill=(*subtitle_stroke_color, 255)
                )
            else:
                # 原有逻辑：不带描边（回退到简单multiline_text）
                subtitle_draw.text(
                    (subtitle_x, subtitle_y),
                    subtitle_text,
                    font=subtitle_font,
                    fill=(*subtitle_text_color, 255),
                    anchor='mm'
                )

        # 保存预览（保持RGBA模式）
        self.save_preview(result, "text_added")

        return result

    
    def _get_font_path(self, font_family: str) -> str:
        """
        获取字体文件路径（优先使用字体管理器，支持模糊匹配ziti字体，回退到系统字体）

        Args:
            font_family: 字体家族名称

        Returns:
            字体文件路径
        """
        if not font_family:
            return 'C:\\Windows\\Fonts\\msyh.ttc'

        # 优先使用字体管理器（支持动态扫描ziti目录和系统字体）
        try:
            from modules.font_manager import get_font_manager
            font_manager = get_font_manager()
            font_path = font_manager.find_font(font_family, 400)  # 默认weight为400
            if font_path and os.path.exists(font_path):
                print(f"Found font via font_manager: {font_family} -> {font_path}", file=sys.stderr)
                return font_path
        except Exception as e:
            print(f"Warning: Failed to use font_manager: {e}, trying ziti directory scan", file=sys.stderr)

        # 🔧 修复：支持模糊匹配ziti目录中的字体（就像subtitle_cover_generator_simple.py）
        # 获取APP_ROOT环境变量以支持ASAR打包环境
        app_root = os.environ.get('APP_ROOT', None)

        possible_ziti_paths = []
        if app_root:
            possible_ziti_paths.append(os.path.join(app_root, 'resources-bundles', 'ziti'))
            possible_ziti_paths.append(os.path.join(app_root, 'app.asar.unpacked', 'ziti'))

        # 添加开发环境路径
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        possible_ziti_paths.extend([
            os.path.join(project_root, 'ziti'),
            os.path.join(os.getcwd(), 'ziti'),
        ])

        # 在ziti目录中查找字体（支持模糊匹配）
        for ziti_dir in possible_ziti_paths:
            if os.path.isdir(ziti_dir):
                print(f"Scanning ziti directory: {ziti_dir}", file=sys.stderr)
                try:
                    for file in os.listdir(ziti_dir):
                        if not file.startswith('.') and (file.endswith('.ttf') or file.endswith('.otf') or file.endswith('.ttc')):
                            file_base = os.path.splitext(file)[0]
                            # 检查是否匹配（精确或包含）
                            if file_base == font_family or font_family in file_base or file_base in font_family:
                                font_path = os.path.join(ziti_dir, file)
                                print(f"Found ziti font by fuzzy match: {font_family} -> {font_path}", file=sys.stderr)
                                return font_path
                except Exception as e:
                    print(f"Error scanning ziti directory {ziti_dir}: {e}", file=sys.stderr)

        # 回退到硬编码映射表
        ziti_dir = os.path.join(project_root, 'ziti')
        
        font_map = {
            # 系统字体
            'SimHei': 'C:\\Windows\\Fonts\\simhei.ttf',
            'SimSun': 'C:\\Windows\\Fonts\\simsun.ttc',
            'Microsoft YaHei': 'C:\\Windows\\Fonts\\msyh.ttc',
            'Arial': 'C:\\Windows\\Fonts\\arial.ttf',
            'Times New Roman': 'C:\\Windows\\Fonts\\times.ttf',
            
            # 自定义字体 - 中文字体
            'Maoken Assorted Sans': os.path.join(ziti_dir, 'MaokenAssortedSans.ttf'),
            'MaokenAssortedSans': os.path.join(ziti_dir, 'MaokenAssortedSans.ttf'),
            'Maoken Assorted Sans Lite': os.path.join(ziti_dir, 'MaokenAssortedSans-Lite.ttf'),
            'MaokenAssortedSans-Lite': os.path.join(ziti_dir, 'MaokenAssortedSans-Lite.ttf'),
            'Mo Qu Gu Feng Ti': os.path.join(ziti_dir, '墨趣古风体.ttf'),
            '墨趣古风体': os.path.join(ziti_dir, '墨趣古风体.ttf'),
            'PingFang Zhang Yaling Hei': os.path.join(ziti_dir, '平方张亚玲黑方体.ttf'),
            '平方张亚玲黑方体': os.path.join(ziti_dir, '平方张亚玲黑方体.ttf'),
            'Hu Xiaobo Sao Bao Ti': os.path.join(ziti_dir, '胡晓波骚包体2.0.otf'),
            '胡晓波骚包体': os.path.join(ziti_dir, '胡晓波骚包体2.0.otf'),
            '胡晓波骚包体2.0': os.path.join(ziti_dir, '胡晓波骚包体2.0.otf'),
            
            # 自定义字体 - 手写体
            'Dymon ShouXieTi': os.path.join(ziti_dir, 'Dymon-ShouXieTi.otf'),
            'Dymon-ShouXieTi': os.path.join(ziti_dir, 'Dymon-ShouXieTi.otf'),
            'Dymon手写体': os.path.join(ziti_dir, 'Dymon-ShouXieTi.otf'),
            
            # 自定义字体 - 日文字体
            'Murecho': os.path.join(ziti_dir, 'Murecho-Regular.ttf'),
            'Murecho-Regular': os.path.join(ziti_dir, 'Murecho-Regular.ttf'),
            'Murecho-Black': os.path.join(ziti_dir, 'Murecho-Black.ttf'),
            'Murecho-Bold': os.path.join(ziti_dir, 'Murecho-Bold.ttf'),
            'Keinan Maru Pop JP': os.path.join(ziti_dir, 'けいなん丸ポップ体JP.ttf'),
            'けいなん丸ポップ体': os.path.join(ziti_dir, 'けいなん丸ポップ体JP.ttf'),
        }

        font_path = font_map.get(font_family)
        
        # 如果映射表中没有，尝试在ziti目录中查找（模糊匹配）
        if not font_path and os.path.exists(ziti_dir):
            import glob
            font_extensions = ['.ttf', '.otf', '.ttc']
            for ext in font_extensions:
                # 尝试精确匹配文件名
                possible_path = os.path.join(ziti_dir, f"{font_family}{ext}")
                if os.path.exists(possible_path):
                    font_path = possible_path
                    break
                # 尝试模糊匹配（忽略大小写和空格）
                pattern = os.path.join(ziti_dir, f"*{font_family.replace(' ', '*')}*{ext}")
                matches = glob.glob(pattern, recursive=False)
                if matches:
                    font_path = matches[0]
                    break
        
        # 如果还是找不到，使用默认字体
        if not font_path or not os.path.exists(font_path):
            print(f"Warning: Font file not found for '{font_family}', using fallback", file=sys.stderr)
            if font_path:
                print(f"  Attempted path: {font_path}", file=sys.stderr)
            return 'C:\\Windows\\Fonts\\msyh.ttc'
        
        return font_path

    # ✅ 标准封面尺寸 3:4 比例（与前端 CoverCustomEditor.vue 一致）
    COVER_WIDTH = 1080
    COVER_HEIGHT = 1440  # 3:4 比例

    def _resize_to_cover_size(self, image: Image.Image) -> Image.Image:
        """
        将图片调整到标准封面尺寸 (1080x1920)，保持比例并居中裁剪

        Args:
            image: 输入图像

        Returns:
            调整后的图像
        """
        target_width = self.COVER_WIDTH
        target_height = self.COVER_HEIGHT
        target_ratio = target_width / target_height  # 9:16 = 0.5625

        orig_width, orig_height = image.size
        orig_ratio = orig_width / orig_height

        print(f"[resize_to_cover_size] Original: {orig_width}x{orig_height} (ratio: {orig_ratio:.4f})", file=sys.stderr)
        print(f"[resize_to_cover_size] Target: {target_width}x{target_height} (ratio: {target_ratio:.4f})", file=sys.stderr)

        # 计算缩放和裁剪
        if orig_ratio > target_ratio:
            # 原图更宽，以高度为基准缩放，然后裁剪宽度
            new_height = target_height
            new_width = int(orig_width * (target_height / orig_height))
            resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            # 居中裁剪
            left = (new_width - target_width) // 2
            cropped = resized.crop((left, 0, left + target_width, target_height))
        else:
            # 原图更高或相等，以宽度为基准缩放，然后裁剪高度
            new_width = target_width
            new_height = int(orig_height * (target_width / orig_width))
            resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            # 居中裁剪
            top = (new_height - target_height) // 2
            cropped = resized.crop((0, top, target_width, top + target_height))

        print(f"[resize_to_cover_size] Result: {cropped.size}", file=sys.stderr)
        return cropped

    def generate(self) -> Dict[str, Any]:
        """
        生成封面（完整流程）

        正确流程：
        1. 人物抠图（带透明背景）
        2. 人物描边（在抠图上添加描边）
        3. 模糊背景（原图模糊处理）
        4. 合成2和3（将描边后的人物合成到模糊背景上）
        5. 添加文字和其他信息（文字背景半透明）

        Returns:
            生成结果
        """
        try:
            print("=" * 80, file=sys.stderr)
            print("Starting advanced cover generation", file=sys.stderr)
            print(f"Target cover size: {self.COVER_WIDTH}x{self.COVER_HEIGHT}", file=sys.stderr)
            print("=" * 80, file=sys.stderr)

            # 加载原始图像
            original_image = self.load_image(self.config.get('video', ''))

            # ✅ 关键修复：将图片调整到标准封面尺寸，与前端画布一致
            original_image = self._resize_to_cover_size(original_image)

            self.save_preview(original_image, "original")

            # 步骤1: 人物抠图（如果启用）
            person_rgba = None
            if self.template.get('personBorderEnabled', False) and SEGMENT_AVAILABLE:
                print("Step 1: Extracting person from original image using PersonSegmenter", file=sys.stderr)
                try:
                    # 使用PersonSegmenter进行抠图（支持MODNet优先级）
                    person_rgba = self._segment_person_with_modnet(original_image)

                    if person_rgba.mode != 'RGBA':
                        person_rgba = person_rgba.convert('RGBA')

                    # 提取 alpha 通道并优化（确保只有人物轮廓，其他部分完全透明）
                    alpha_channel = np.array(person_rgba.split()[3])
                    print(f"Alpha channel before refinement: min={alpha_channel.min()}, max={alpha_channel.max()}, unique_values={len(np.unique(alpha_channel))}", file=sys.stderr)

                    refined_alpha = self.refine_mask(alpha_channel)
                    print(f"Alpha channel after refinement: min={refined_alpha.min()}, max={refined_alpha.max()}, unique_values={len(np.unique(refined_alpha))}", file=sys.stderr)

                    # 关键修复：确保只有人物形状是不透明的，周围完全透明
                    # 使用严格的二值化，避免灰度值导致的半透明边缘扩展
                    _, refined_alpha_binary = cv2.threshold(refined_alpha, 127, 255, cv2.THRESH_BINARY)

                    person_rgba.putalpha(Image.fromarray(refined_alpha_binary))

                    self.save_preview(person_rgba, "step1_person_extracted")
                    print("Step 1: Person extraction completed with PersonSegmenter and mask refinement", file=sys.stderr)
                except Exception as e:
                    print(f"Step 1: Person extraction failed: {e}", file=sys.stderr)
                    import traceback
                    traceback.print_exc(file=sys.stderr)
                    person_rgba = None

            # 步骤2: 人物描边（如果有抠图）
            if person_rgba is not None:
                print("Step 2: Applying person outline", file=sys.stderr)
                person_rgba = self._apply_outline_to_person(person_rgba)
                self.save_preview(person_rgba, "step2_person_outlined")

            # 步骤3: 模糊背景
            print("Step 3: Applying background blur", file=sys.stderr)
            blurred_background = self.apply_background_blur(original_image)
            
            # 步骤4: 合成人物到模糊背景
            if person_rgba is not None:
                print("Step 4: Compositing person onto blurred background", file=sys.stderr)
                result = self._composite_person_to_background(person_rgba, blurred_background)
                self.save_preview(result, "step4_person_composited")
            else:
                result = blurred_background.convert('RGBA')

            # 步骤5: 蒙版叠加
            result = self.apply_mask(result)

            # 步骤6: 添加文字（文字背景半透明）
            result = self.add_text(result)

            # 保存最终结果（PNG格式保留透明度）
            print(f"Saving final cover to: {self.output_path}", file=sys.stderr)
            
            # 确保输出为PNG格式以保留透明度
            if not self.output_path.lower().endswith('.png'):
                print("Warning: Output format should be PNG to preserve transparency", file=sys.stderr)
            
            # 保存为RGBA模式的PNG
            if result.mode != 'RGBA':
                result = result.convert('RGBA')
            
            result.save(self.output_path, 'PNG', quality=95)

            print("=" * 80, file=sys.stderr)
            print("Cover generation completed successfully", file=sys.stderr)
            print(f"Total preview images: {len(self.preview_images)}", file=sys.stderr)
            print("=" * 80, file=sys.stderr)

            return {
                'success': True,
                'coverPath': self.output_path,
                'previewImages': self.preview_images,
                'message': 'Cover generated successfully'
            }

        except Exception as e:
            print(f"Error generating cover: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'message': f'Cover generation failed: {str(e)}'
            }
    
    def _apply_outline_to_person(self, person_rgba: Image.Image) -> Image.Image:
        """
        对抠出的人物应用描边
        
        正确方案：扩大画布 → 绘制完整描边 → 保持扩大后的尺寸
        
        Args:
            person_rgba: 抠出的人物图像（RGBA模式）
            
        Returns:
            添加描边后的人物图像（尺寸会比原图大）
        """
        # 获取描边参数
        border_color = self.hex_to_rgb(self.template.get('personBorderColor', '#FFFFFF'))
        border_width = self.template.get('personBorderWidth', 6)
        border_style = self.template.get('personBorderStyle', 'solid')
        
        # 使用文档规定的默认值
        dash_length = self.template.get('personBorderDashLength')
        gap_length = self.template.get('personBorderGapLength')
        
        if dash_length is None:
            dash_length = border_width * 3
        if gap_length is None:
            gap_length = border_width * 2

        print(f"Outline params: color={border_color}, width={border_width}, style={border_style}, dash={dash_length}, gap={gap_length}", file=sys.stderr)

        # 步骤1: 扩大画布（给描边留出空间）
        padding = border_width + 2  # 描边宽度 + 2像素余量
        original_width, original_height = person_rgba.size
        
        # 创建扩大后的画布
        expanded_person = Image.new('RGBA',
                                    (original_width + padding * 2, original_height + padding * 2),
                                    (0, 0, 0, 0))
        # 将原始人物图像粘贴到中心
        expanded_person.paste(person_rgba, (padding, padding), person_rgba)
        
        print(f"Expanded person canvas: original={person_rgba.size}, expanded={expanded_person.size}, padding={padding}", file=sys.stderr)
        
        # 步骤2: 从扩大后的图像提取 alpha 通道
        alpha = expanded_person.split()[3]
        alpha_np = np.array(alpha)
        
        # 确保是uint8格式
        if alpha_np.dtype != np.uint8:
            if alpha_np.max() <= 1.0:
                alpha_np = (alpha_np * 255).astype(np.uint8)
            else:
                alpha_np = alpha_np.astype(np.uint8)
        
        # 二值化mask（与参考项目一致 - cover.py:1221）
        # 这一步很关键：确保mask只有0和255两个值，提高轮廓检测精度
        _, alpha_binary = cv2.threshold(alpha_np, 127, 255, cv2.THRESH_BINARY)
        print(f"Alpha channel binarized: non-zero pixels = {np.count_nonzero(alpha_binary)}", file=sys.stderr)

        # 步骤3: 创建描边 mask - 使用轮廓检测（向外扩散，不覆盖人物）
        border_mask = None

        # 方法1: 轮廓检测（在扩大的画布上，描边不会被截断）
        try:
            contours, _ = cv2.findContours(alpha_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if len(contours) > 0:
                print(f"Using contour detection method, found {len(contours)} contours", file=sys.stderr)

                # 创建空白 mask（与扩大后的画布同尺寸）
                border_mask = np.zeros_like(alpha_np)

                # 🔧 优化：使用 border_width * 2 作为绘制宽度
                # 因为后面会减去人物本身，实际描边只会保留外部的一半
                # 所以需要加倍线宽才能达到用户期望的描边粗细
                draw_width = border_width * 2
                cv2.drawContours(border_mask, contours, -1, 255, draw_width)

                # 🔧 关键修复：从描边mask中减去人物本身，确保描边只在外部
                # 这样描边就是向外扩散的，不会覆盖人物边缘
                border_mask = cv2.subtract(border_mask, alpha_binary)

                print(f"Contour detection succeeded, border_pixels={np.count_nonzero(border_mask)} (外部描边, 实际宽度≈{border_width}px)", file=sys.stderr)
        except Exception as e:
            print(f"Contour detection failed: {e}", file=sys.stderr)

        # 方法2: 形态学操作（后备）- 这个方法本身就是向外扩散的
        if border_mask is None or np.sum(border_mask) == 0:
            print("Using morphological operation method (fallback)", file=sys.stderr)

            # 计算 kernel 大小和迭代次数
            kernel_size = border_width * 2 + 1
            kernel = np.ones((kernel_size, kernel_size), np.uint8)
            iterations = max(1, border_width // 2)

            # 膨胀操作（使用二值化的alpha_binary以获得更清晰的边缘）
            dilated_mask = cv2.dilate(alpha_binary, kernel, iterations=iterations)

            # 边缘 = 膨胀后的mask - 原始mask（这就是向外扩散的描边）
            border_mask = cv2.subtract(dilated_mask, alpha_binary)

            print(f"Morphological method: kernel_size={kernel_size}, iterations={iterations}", file=sys.stderr)

        # 根据描边样式处理
        if border_style == 'dashed':
            print("Applying dashed border style", file=sys.stderr)
            border_mask = self._create_dashed_border(border_mask, border_width, dash_length, gap_length)
        
        # 步骤4: 在扩大的画布上应用描边
        person_width, person_height = expanded_person.size
        person_array = np.array(expanded_person)
        border_mask_3d = np.stack([border_mask] * 3, axis=2) / 255.0  # 归一化到0-1
        
        # 确保border_mask尺寸与人物图像匹配
        if border_mask.shape[:2] != (person_height, person_width):
            border_mask = cv2.resize(border_mask, (person_width, person_height), interpolation=cv2.INTER_NEAREST)
            border_mask_3d = np.stack([border_mask] * 3, axis=2) / 255.0
            print(f"Resized border_mask to match person image: {border_mask.shape}", file=sys.stderr)
        
        # 应用描边颜色到透明画布
        border_rgb_array = np.array(border_color, dtype=np.float32)
        h, w = person_array.shape[:2]
        border_rgb_3d = np.tile(border_rgb_array.reshape(1, 1, 3), (h, w, 1))
        
        # 分离RGB和Alpha通道
        person_rgb = person_array[:, :, :3].astype(np.float32)
        person_alpha = person_array[:, :, 3:4].astype(np.float32) / 255.0  # 归一化alpha到0-1
        
        # 关键修复：处理透明区域的RGB值
        # 在完全透明的区域（alpha=0），RGB值应该被保留为原值（通常是0）
        # 只在有描边和人物的地方应用颜色混合

        # 对RGB通道应用描边：只在border_mask > 0的地方混合颜色
        person_rgb = (person_rgb * (1 - border_mask_3d) +
                     border_rgb_3d * border_mask_3d).astype(np.uint8)

        # 对Alpha通道：描边区域应该是不透明的（255），人物区域保持原有alpha
        # border_mask是单通道的，值在0-255之间
        border_alpha_mask = border_mask[:, :, np.newaxis] / 255.0  # 归一化到0-1

        # 关键修复：确保完全透明的区域保持透明
        # 只在border_mask有值或person_alpha > 0的地方设置alpha
        # 这样可以避免扩大画布周围被填充成白色
        person_alpha_new = np.where(
            (border_alpha_mask > 0) | (person_alpha > 0),
            np.maximum(person_alpha, border_alpha_mask),
            0  # 透明区域保持完全透明
        ) * 255.0
        person_alpha_new = person_alpha_new.astype(np.uint8)
        
        # 合并RGB和Alpha通道
        person_array = np.concatenate([person_rgb, person_alpha_new], axis=2)
        
        person_with_border = Image.fromarray(person_array, 'RGBA')
        print(f"Border applied on expanded canvas, final size={person_with_border.size}, color RGB: {border_color}", file=sys.stderr)
        
        # 步骤5: 返回扩大后的图像（不裁剪，保持描边完整）
        return person_with_border
    
    def _create_dashed_border(self, border_mask: np.ndarray, border_width: int,
                             dash_length: int, gap_length: int) -> np.ndarray:
        """
        将实线描边转换为虚线描边
        
        使用轮廓路径追踪算法，沿着轮廓路径交替绘制虚线段和间隔
        关键优化：扩展画布以避免边缘虚线被截断
        
        Args:
            border_mask: 实线描边 mask
            border_width: 描边宽度
            dash_length: 虚线长度
            gap_length: 间隔长度
            
        Returns:
            虚线描边 mask
        """
        # 扩展画布以避免边缘虚线被截断
        padding = border_width * 2
        h, w = border_mask.shape
        
        # 创建扩展后的画布
        padded_border_mask = np.zeros((h + padding * 2, w + padding * 2), dtype=np.uint8)
        padded_border_mask[padding:padding+h, padding:padding+w] = border_mask
        
        print(f"Padded border_mask for dashed border: original={border_mask.shape}, padded={padded_border_mask.shape}, padding={padding}", file=sys.stderr)
        
        # 在扩展后的画布上找到轮廓
        contours, _ = cv2.findContours(padded_border_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # 在扩展后的画布上创建虚线mask
        padded_dashed_mask = np.zeros_like(padded_border_mask)
        
        print(f"Creating dashed border: {len(contours)} contours, dash={dash_length}px, gap={gap_length}px", file=sys.stderr)
        
        # 对每个轮廓绘制虚线
        for contour_idx, contour in enumerate(contours):
            if len(contour) < 2:
                continue
            
            # 将轮廓点连接成连续的路径
            contour_points = [tuple(pt[0]) for pt in contour]
            
            # 计算轮廓总长度
            total_length = 0.0
            for i in range(len(contour_points) - 1):
                pt1 = contour_points[i]
                pt2 = contour_points[i + 1]
                total_length += np.sqrt((pt2[0] - pt1[0])**2 + (pt2[1] - pt1[1])**2)
            
            print(f"Contour {contour_idx}: {len(contour_points)} points, length={total_length:.1f}px", file=sys.stderr)
            
            # 沿着轮廓路径绘制虚线
            is_dash = True  # 当前是否在绘制虚线段
            dash_remaining = float(dash_length)  # 当前虚线段剩余长度
            gap_remaining = float(gap_length)    # 当前间隔剩余长度
            
            for i in range(len(contour_points) - 1):
                pt1 = contour_points[i]
                pt2 = contour_points[i + 1]
                
                # 计算两点间距离
                segment_dist = np.sqrt((pt2[0] - pt1[0])**2 + (pt2[1] - pt1[1])**2)
                
                if segment_dist < 0.1:  # 跳过太短的点
                    continue
                
                # 沿着这个线段绘制虚线
                remaining_in_segment = segment_dist
                segment_offset = 0.0  # 在当前线段中的偏移
                
                while remaining_in_segment > 0.01:  # 还有剩余距离
                    if is_dash:
                        # 绘制虚线段
                        draw_length = min(dash_remaining, remaining_in_segment)
                        
                        # 计算起点和终点在 pt1-pt2 线段上的位置
                        t1 = segment_offset / segment_dist
                        t2 = (segment_offset + draw_length) / segment_dist
                        
                        # 确保 t 在 [0, 1] 范围内
                        t1 = max(0.0, min(1.0, t1))
                        t2 = max(0.0, min(1.0, t2))
                        
                        x1 = int(pt1[0] + (pt2[0] - pt1[0]) * t1)
                        y1 = int(pt1[1] + (pt2[1] - pt1[1]) * t1)
                        x2 = int(pt1[0] + (pt2[0] - pt1[0]) * t2)
                        y2 = int(pt1[1] + (pt2[1] - pt1[1]) * t2)
                        
                        # 绘制虚线段（在扩展画布上）
                        if abs(x2 - x1) > 0 or abs(y2 - y1) > 0:  # 确保不是同一个点
                            cv2.line(padded_dashed_mask, (x1, y1), (x2, y2), 255, border_width)
                        
                        segment_offset += draw_length
                        remaining_in_segment -= draw_length
                        dash_remaining -= draw_length
                        
                        # 如果虚线段绘制完成，切换到间隔
                        if dash_remaining <= 0.01:
                            is_dash = False
                            gap_remaining = float(gap_length)  # 重置间隔长度
                    else:
                        # 跳过间隔段
                        skip_length = min(gap_remaining, remaining_in_segment)
                        segment_offset += skip_length
                        remaining_in_segment -= skip_length
                        gap_remaining -= skip_length
                        
                        # 如果间隔段完成，切换到虚线
                        if gap_remaining <= 0.01:
                            is_dash = True
                            dash_remaining = float(dash_length)  # 重置虚线长度
        
        # 裁剪回原始尺寸
        dashed_mask = padded_dashed_mask[padding:padding+h, padding:padding+w]
        print(f"Dashed border created and cropped back to original size", file=sys.stderr)
        
        return dashed_mask
    
    def _composite_person_to_background(self, person_rgba: Image.Image, background: Image.Image) -> Image.Image:
        """
        将人物合成到背景上
        
        Args:
            person_rgba: 人物图像（RGBA模式，可能带描边）
            background: 背景图像（RGB模式）
            
        Returns:
            合成后的图像（RGBA模式）
        """
        # 调整人物大小
        person_size = self.template.get('personSize', 100)
        person_rotation = self.template.get('personRotation', 0)
        if person_size != 100:
            new_width = int(person_rgba.width * person_size / 100)
            new_height = int(person_rgba.height * person_size / 100)
            person_rgba = person_rgba.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # 调整人物位置
        person_position = self.template.get('personPosition', {'x': 50, 'y': 50})
        person_x = int(background.width * person_position['x'] / 100) - person_rgba.width // 2
        person_y = int(background.height * person_position['y'] / 100) - person_rgba.height // 2

        # 合成
        result = background.convert('RGBA')
        result.paste(person_rgba, (person_x, person_y), person_rgba)
        
        return result

    def run_and_output_json(self):
        """
        运行生成器并输出JSON结果（只输出一行JSON）
        """
        result = self.generate()
        # 确保只输出一行JSON
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(description='Advanced Cover Generator')
    parser.add_argument('--video', required=True, help='Path to video or image file')
    parser.add_argument('--title', required=True, help='Title text')
    parser.add_argument('--output', required=True, help='Output cover path')
    parser.add_argument('--config', default='{}', help='JSON configuration')

    args = parser.parse_args()

    try:
        # 确保系统编码支持中文
        import sys
        import locale
        if sys.platform == 'win32':
            # Windows 设置控制台编码
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleOutputCP(65001)  # UTF-8

        # 解析配置
        config = json.loads(args.config)

        # ⚠️ 诊断日志：同时输出到 stdout 和 stderr，确保能看到
        import sys
        diag_msg = f"""
=== ADVANCED COVER GENERATOR DIAGNOSTIC ===
[CONFIG] Received config keys: {list(config.keys())[:20]}... (showing first 20)
[CONFIG] titleStrokeWidth: {config.get('titleStrokeWidth', 'NOT SET')}
[CONFIG] titleStrokeColor: {config.get('titleStrokeColor', 'NOT SET')}
[CONFIG] titleFontFamily: {config.get('titleFontFamily', 'NOT SET')}
[CONFIG] personBorderEnabled: {config.get('personBorderEnabled', 'NOT SET')}
[CONFIG] personBorderWidth: {config.get('personBorderWidth', 'NOT SET')}
[CONFIG] personBorderColor: {config.get('personBorderColor', 'NOT SET')}
[CONFIG] backgroundBlurEnabled: {config.get('backgroundBlurEnabled', 'NOT SET')}
===========================================
"""
        print(diag_msg, file=sys.stderr, flush=True)
        sys.stderr.flush()

        # 添加命令行参数到配置
        config['video'] = args.video
        config['title'] = args.title
        config['output'] = args.output

        # 创建生成器
        generator = AdvancedCoverGenerator(config)

        # 运行并输出结果（只输出一行JSON）
        generator.run_and_output_json()

    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'message': f'Error: {str(e)}'
        }
        sys.stdout.write(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(1)


if __name__ == '__main__':
    main()