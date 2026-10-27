"""
工具函数模块
提供字幕封面生成过程中需要的通用工具函数
"""

import os
import sys
from pathlib import Path
from typing import Tuple, Optional, List, Dict, Any

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

# 尝试导入图像处理库
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("opencv-python不可用，图像处理功能受限")

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("PIL不可用，图像处理功能受限")


def ensure_dir(path: str) -> Path:
    """确保目录存在"""
    path_obj = Path(path)
    path_obj.mkdir(parents=True, exist_ok=True)
    return path_obj


def get_video_info(video_path: str) -> Dict[str, Any]:
    """获取视频信息"""
    if not CV2_AVAILABLE:
        # 如果opencv不可用，返回基本信息
        try:
            import os
            file_size = os.path.getsize(video_path)
            return {
                'fps': 30,  # 默认值
                'frame_count': 0,
                'width': 1920,  # 默认值
                'height': 1080,  # 默认值
                'duration': 0,  # 未知
                'path': video_path,
                'file_size': file_size,
                'note': '视频信息不完整，opencv不可用'
            }
        except Exception as e:
            logger.error(f"获取基本视频信息失败: {e}")
            raise

    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"无法打开视频文件: {video_path}")

        # 获取视频属性
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = frame_count / fps if fps > 0 else 0

        cap.release()

        return {
            'fps': fps,
            'frame_count': frame_count,
            'width': width,
            'height': height,
            'duration': duration,
            'path': video_path
        }
    except Exception as e:
        logger.error(f"获取视频信息失败: {e}")
        raise


def extract_frame_at_time(video_path: str, time_seconds: float):
    """在指定时间抽取视频帧"""
    if not CV2_AVAILABLE:
        logger.warning("opencv不可用，无法抽取视频帧")
        # 返回一个占位符
        return None

    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"无法打开视频文件: {video_path}")

        # 设置帧位置
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_number = int(time_seconds * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)

        ret, frame = cap.read()
        cap.release()

        if not ret:
            raise ValueError(f"无法读取帧: {frame_number}")

        return frame
    except Exception as e:
        logger.error(f"抽帧失败: {e}")
        raise


def save_image(image, output_path: str, quality: int = 95) -> None:
    """保存图像
    
    如果输出路径是PNG格式，会保留alpha通道（透明背景）
    如果是JPEG格式，会转换为RGB格式
    """
    try:
        ensure_dir(os.path.dirname(output_path))
        
        is_png = output_path.lower().endswith('.png')

        if CV2_AVAILABLE and isinstance(image, np.ndarray):
            # 使用OpenCV保存
            if is_png and image.shape[2] == 4:
                # PNG格式且有alpha通道，保存为BGRA（OpenCV使用BGR格式）
                # 确保图像是BGRA格式（B, G, R, A）
                # 如果输入是RGBA（R, G, B, A），需要转换为BGRA
                if image.dtype != np.uint8:
                    image = image.astype(np.uint8)
                # OpenCV的imwrite会自动处理BGRA格式
                success = cv2.imwrite(output_path, image, [cv2.IMWRITE_PNG_COMPRESSION, 3])
            elif is_png:
                # PNG格式但没有alpha通道，转换为RGB
                if image.shape[2] == 3:
                    success = cv2.imwrite(output_path, image, [cv2.IMWRITE_PNG_COMPRESSION, 3])
                else:
                    # 如果是单通道，转换为3通道
                    if len(image.shape) == 2:
                        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
                    success = cv2.imwrite(output_path, image, [cv2.IMWRITE_PNG_COMPRESSION, 3])
            else:
                # JPEG格式，确保是3通道BGR
                if image.shape[2] == 4:
                    # 有alpha通道，先合成到白色背景
                    bgr = image[:, :, :3]
                    alpha = image[:, :, 3:4] / 255.0
                    white_bg = np.ones_like(bgr) * 255
                    image = (bgr * alpha + white_bg * (1 - alpha)).astype(np.uint8)
                elif len(image.shape) == 2:
                    image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
                success = cv2.imwrite(output_path, image, [cv2.IMWRITE_JPEG_QUALITY, quality])
            
            if not success:
                raise ValueError(f"保存图像失败: {output_path}")
        elif PIL_AVAILABLE and hasattr(image, 'save'):
            # 使用PIL保存
            if is_png:
                image.save(output_path, 'PNG', compress_level=3)
            else:
                # JPEG格式，确保是RGB
                if image.mode == 'RGBA':
                    # 合成到白色背景
                    rgb = Image.new('RGB', image.size, (255, 255, 255))
                    rgb.paste(image, mask=image.split()[3])
                    image = rgb
                image.save(output_path, 'JPEG', quality=quality)
        else:
            raise ValueError("没有可用的图像保存方法")

        logger.info(f"图像已保存: {output_path}")
    except Exception as e:
        logger.error(f"保存图像失败: {e}")
        raise


def format_time(seconds: float) -> str:
    """格式化时间为 HH:MM:SS.mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    milliseconds = int((seconds % 1) * 1000)

    return "02d"


def create_temp_dir(prefix: str = "subtitle_cover_") -> str:
    """创建临时目录"""
    import tempfile
    temp_dir = tempfile.mkdtemp(prefix=prefix)
    logger.info(f"创建临时目录: {temp_dir}")
    return temp_dir


def cleanup_temp_dir(temp_dir: str) -> None:
    """清理临时目录"""
    try:
        import shutil
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            logger.info(f"清理临时目录: {temp_dir}")
    except Exception as e:
        logger.warning(f"清理临时目录失败: {e}")


def validate_file_exists(file_path: str, file_type: str = "文件") -> None:
    """验证文件是否存在"""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"{file_type}不存在: {file_path}")

    if not os.path.isfile(file_path):
        raise ValueError(f"{file_type}不是文件: {file_path}")


def get_file_size_mb(file_path: str) -> float:
    """获取文件大小(MB)"""
    size_bytes = os.path.getsize(file_path)
    return size_bytes / (1024 * 1024)


def calculate_aspect_ratio(width: int, height: int) -> float:
    """计算宽高比"""
    return width / height if height > 0 else 0


def resize_image(image: np.ndarray, target_width: int, target_height: int,
                keep_aspect_ratio: bool = True) -> np.ndarray:
    """调整图像大小"""
    if keep_aspect_ratio:
        # 保持宽高比
        h, w = image.shape[:2]
        aspect_ratio = w / h

        if target_width / target_height > aspect_ratio:
            # 目标更宽，以高度为准
            new_width = int(target_height * aspect_ratio)
            new_height = target_height
        else:
            # 目标更高，以宽度为准
            new_width = target_width
            new_height = int(target_width / aspect_ratio)

        resized = cv2.resize(image, (new_width, new_height))
    else:
        # 不保持宽高比，直接缩放
        resized = cv2.resize(image, (target_width, target_height))

    return resized


def blend_images(background: np.ndarray, foreground: np.ndarray,
                position: Tuple[int, int] = (0, 0)) -> np.ndarray:
    """将前景图像合成到背景图像上"""
    x, y = position
    h, w = foreground.shape[:2]

    # 确保位置不超出边界
    bg_h, bg_w = background.shape[:2]
    x = max(0, min(x, bg_w - w))
    y = max(0, min(y, bg_h - h))

    # 创建ROI
    roi = background[y:y+h, x:x+w]

    # 如果前景有alpha通道，进行透明合成
    if foreground.shape[2] == 4:
        # 分离颜色和alpha通道
        foreground_rgb = foreground[:, :, :3]
        alpha = foreground[:, :, 3] / 255.0

        # 扩展alpha到3通道
        alpha = np.stack([alpha] * 3, axis=2)

        # 透明合成
        blended = foreground_rgb * alpha + roi * (1 - alpha)
        background[y:y+h, x:x+w] = blended.astype(np.uint8)
    else:
        # 直接覆盖
        background[y:y+h, x:x+w] = foreground

    return background


def apply_blur(image: np.ndarray, kernel_size: int = 15) -> np.ndarray:
    """应用模糊效果"""
    return cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)


def apply_gradient_overlay(image: np.ndarray, color: Tuple[int, int, int],
                          opacity: float = 0.5) -> np.ndarray:
    """应用渐变覆盖"""
    overlay = np.full_like(image, color, dtype=np.uint8)
    return cv2.addWeighted(image, 1 - opacity, overlay, opacity, 0)
