"""
人像分割模块
使用 MODNet/RMBG 进行人物抠图
"""

import os
import sys
import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, Dict, Any

# ⚠️ 诊断输出：验证 segment.py 导入开始
print("[SEGMENT.PY] Starting import...", file=sys.stderr, flush=True)

try:
    from loguru import logger
    print("[SEGMENT.PY] ✅ loguru imported successfully", file=sys.stderr, flush=True)
except ImportError as e:
    print(f"[SEGMENT.PY] ⚠️ loguru import failed: {e}, using print instead", file=sys.stderr, flush=True)
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

# 检查cv2是否可用
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("OpenCV不可用，某些功能可能受限")

# 尝试导入AI库，如果不可用则使用简化实现
try:
    from rembg import remove, new_session
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False
    logger.warning("rembg不可用，使用简化的抠图方法")

try:
    import torch
    import torch.nn as nn
    from torchvision import transforms
    PYTORCH_AVAILABLE = True
except ImportError:
    PYTORCH_AVAILABLE = False
    logger.warning("PyTorch不可用，高级AI功能受限")

# 尝试导入MODNet（如果可用）
MODNET_AVAILABLE = False
try:
    # 尝试导入MODNet（可能有多种实现方式）
    try:
        from modnet import MODNet as MODNetLib
        MODNET_AVAILABLE = True
        logger.info("MODNet库可用（modnet包）")
    except ImportError:
        try:
            # 尝试从本地MODNet实现导入
            import sys
            # 尝试多个可能的路径
            possible_paths = [
                Path(__file__).parent.parent / "MODNet",
                Path(__file__).parent.parent / "MODNet-master",
            ]
            for modnet_path in possible_paths:
                if modnet_path.exists():
                    sys.path.insert(0, str(modnet_path))
                    try:
                        from src.models.modnet import MODNet as MODNetLib
                        MODNET_AVAILABLE = True
                        logger.info(f"MODNet库可用（本地实现: {modnet_path.name}）")
                        break
                    except ImportError:
                        # 尝试其他可能的导入路径
                        try:
                            from models.modnet import MODNet as MODNetLib
                            MODNET_AVAILABLE = True
                            logger.info(f"MODNet库可用（本地实现: {modnet_path.name}，models路径）")
                            break
                        except ImportError:
                            continue
        except Exception as e:
            logger.debug(f"MODNet本地导入失败: {e}")
except Exception as e:
    logger.debug(f"MODNet不可用: {e}")

try:
    from .utils import ensure_dir, save_image
    print("[SEGMENT.PY] ✅ utils module imported successfully", file=sys.stderr, flush=True)
except ImportError as e:
    print(f"[SEGMENT.PY] ❌ Failed to import utils: {e}", file=sys.stderr, flush=True)
    raise

print("[SEGMENT.PY] ✅ Module import completed successfully", file=sys.stderr, flush=True)


class PersonSegmenter:
    """人像分割器"""

    def __init__(self, model_name: str = "u2net"):
        """
        初始化分割器

        Args:
            model_name: 使用的模型名称
                - "u2net": U2Net模型（默认，效果较好）
                - "u2netp": U2Net轻量版
                - "silueta": Silueta模型
                - "isnet": ISNet模型
                - "modnet": MODNet模型（专门用于人像，需要PyTorch和MODNet库）
                - "simple": 简化的抠图方法（当AI库不可用时）
        """
        self.model_name = model_name
        self.session = None
        self.modnet_model = None
        self.use_modnet = False
        
        # 检查是否使用MODNet
        if model_name == "modnet":
            if MODNET_AVAILABLE and PYTORCH_AVAILABLE:
                self.use_modnet = True
                self._load_modnet()
            else:
                logger.warning("MODNet不可用（需要PyTorch和MODNet库），使用rembg作为后备")
                self.use_simple_method = not REMBG_AVAILABLE or model_name == "simple"
                if not self.use_simple_method:
                    self._load_model()
        else:
            self.use_simple_method = not REMBG_AVAILABLE or model_name == "simple"
            if not self.use_simple_method:
                self._load_model()

    def _load_model(self):
        """加载rembg模型 - 支持本地模型路径"""
        try:
            logger.info(f"加载人像分割模型: {self.model_name}")

            # 关键修复：优先使用本地打包的模型
            local_model_path = self._get_local_model_path()

            if local_model_path and os.path.exists(local_model_path):
                logger.info(f"✅ 使用本地模型文件: {local_model_path}")
                # 设置环境变量，让 rembg 使用本地模型目录
                cache_dir = os.path.dirname(local_model_path)
                os.environ['U2NET_HOME'] = cache_dir
                logger.info(f"设置 U2NET_HOME = {cache_dir}")

                # 使用 rembg 加载模型（会从 U2NET_HOME 读取）
                self.session = new_session(self.model_name)
            else:
                # 回退到 rembg 的默认行为（尝试从网络下载）
                logger.warning(f"⚠️ 未找到本地模型，尝试使用默认下载方式")
                cache_dir = self._get_cache_dir()
                os.environ['U2NET_HOME'] = cache_dir
                logger.info(f"设置缓存目录: {cache_dir}")
                self.session = new_session(self.model_name)

            logger.info(f"人像分割模型加载成功: {self.model_name}")
            logger.info(f"Session类型: {type(self.session)}")
        except Exception as e:
            logger.error(f"❌ 加载人像分割模型失败: {e}")
            logger.error(f"尝试加载的模型: {self.model_name}")
            import traceback
            logger.error(traceback.format_exc())
            raise

    def _get_local_model_path(self) -> Optional[str]:
        """获取本地模型文件路径 - 自动识别开发/打包环境"""
        model_filename = f"{self.model_name}.onnx" if self.model_name in ["u2net", "u2netp", "u2net_human_seg", "silueta", "isnet"] else "u2net.onnx"

        # 🔧 修复：支持ASAR打包环境，优先使用APP_ROOT环境变量
        app_root = os.environ.get('APP_ROOT', None)

        possible_paths = []

        if app_root:
            # 打包环境：优先使用 resources-bundles/models
            possible_paths.append(Path(app_root) / "resources-bundles" / "models" / model_filename)
            # 打包环境：使用APP_ROOT定位资源（回退）
            possible_paths.append(Path(app_root) / "extra" / "common" / "models" / model_filename)
            logger.info(f"🔧 打包环境检测: APP_ROOT={app_root}")

        # 添加其他可能的路径（开发环境和回退）
        possible_paths.extend([
            # 打包后的路径（生产环境 - 回退）
            Path(__file__).parent.parent.parent / "extra" / "common" / "models" / model_filename,
            # 开发环境路径 1
            Path(__file__).parent.parent / "models" / model_filename,
            # 开发环境路径 2（electron/resources/extra/common/models）
            Path(__file__).parent.parent.parent / "electron" / "resources" / "extra" / "common" / "models" / model_filename,
            # 备用路径
            Path(__file__).parent.parent.parent / "models" / model_filename,
        ])

        logger.info(f"🔍 搜索本地模型: {model_filename}")
        for i, path in enumerate(possible_paths, 1):
            exists = path.exists()
            logger.debug(f"  尝试路径 {i}: {path} (存在: {exists})")
            if exists:
                size_mb = path.stat().st_size / (1024 * 1024)
                logger.info(f"✅ 找到本地模型: {path} ({size_mb:.1f}MB)")
                return str(path)
            else:
                logger.debug(f"  ❌ 路径不存在: {path}")

        logger.warning(f"⚠️ 未找到本地模型文件: {model_filename}")
        logger.warning(f"  已检查{len(possible_paths)}个路径，全部不存在")
        logger.warning(f"   APP_ROOT环境变量: {app_root}")
        logger.warning(f"   __file__路径: {__file__}")
        return None

    def _get_cache_dir(self) -> str:
        """获取模型缓存目录"""
        # 优先使用应用资源目录
        possible_cache_dirs = [
            Path(__file__).parent.parent.parent / "extra" / "common" / "models",
            Path(__file__).parent.parent / "models",
        ]

        for cache_dir in possible_cache_dirs:
            try:
                cache_dir.mkdir(parents=True, exist_ok=True)
                logger.info(f"使用缓存目录: {cache_dir}")
                return str(cache_dir)
            except Exception as e:
                logger.warning(f"无法创建缓存目录 {cache_dir}: {e}")
                continue

        # 最后回退到用户主目录
        from pathlib import Path
        fallback_dir = Path.home() / ".u2net"
        fallback_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"使用回退缓存目录: {fallback_dir}")
        return str(fallback_dir)
    
    def _load_modnet(self):
        """加载MODNet模型"""
        try:
            logger.info("加载MODNet人像分割模型...")
            if not MODNET_AVAILABLE or not PYTORCH_AVAILABLE:
                logger.warning("MODNet不可用（需要PyTorch和MODNet库），使用rembg作为后备")
                self.use_modnet = False
                self.use_simple_method = not REMBG_AVAILABLE
                if not self.use_simple_method:
                    self._load_model()
                return
            
            # 查找预训练模型文件（支持多个可能的位置）
            possible_paths = [
                # pretrained目录下
                Path(__file__).parent.parent / "MODNet-master" / "pretrained" / "modnet_webcam_portrait_matting.ckpt",
                Path(__file__).parent.parent / "MODNet-master" / "pretrained" / "modnet_photographic_portrait_matting.ckpt",
                Path(__file__).parent.parent / "MODNet" / "pretrained" / "modnet_webcam_portrait_matting.ckpt",
                Path(__file__).parent.parent / "MODNet" / "pretrained" / "modnet_photographic_portrait_matting.ckpt",
                # MODNet-master根目录下（用户可能直接放在这里）
                Path(__file__).parent.parent / "MODNet-master" / "modnet_webcam_portrait_matting.ckpt",
                Path(__file__).parent.parent / "MODNet-master" / "modnet_photographic_portrait_matting.ckpt",
                Path(__file__).parent.parent / "MODNet" / "modnet_webcam_portrait_matting.ckpt",
                Path(__file__).parent.parent / "MODNet" / "modnet_photographic_portrait_matting.ckpt",
            ]
            
            ckpt_path = None
            for path in possible_paths:
                if path.exists():
                    ckpt_path = path
                    logger.info(f"找到MODNet预训练模型: {ckpt_path}")
                    break
            
            if ckpt_path is None:
                logger.warning("未找到MODNet预训练模型，使用rembg作为后备")
                logger.info("请下载预训练模型到 MODNet-master/pretrained/ 目录")
                logger.info("下载地址: https://github.com/ZHKKKe/MODNet/releases")
                self.use_modnet = False
                self.use_simple_method = not REMBG_AVAILABLE
                if not self.use_simple_method:
                    self._load_model()
                return
            
            # 创建MODNet模型
            self.modnet_model = MODNetLib(backbone_pretrained=False)
            
            # 加载预训练权重
            device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            if device.type == 'cpu':
                weights = torch.load(str(ckpt_path), map_location=device)
            else:
                weights = torch.load(str(ckpt_path))
            
            # 处理权重（可能包含 'module.' 前缀）
            if any(k.startswith('module.') for k in weights.keys()):
                weights = {k.replace('module.', ''): v for k, v in weights.items()}
            
            self.modnet_model.load_state_dict(weights, strict=False)
            self.modnet_model.eval()
            self.modnet_model = self.modnet_model.to(device)
            self.modnet_device = device
            self.modnet_ref_size = 512  # MODNet的标准输入尺寸
            self.use_modnet = True  # 确认启用MODNet
            
            logger.info(f"MODNet模型加载成功，设备: {device}")
            
        except Exception as e:
            logger.error(f"加载MODNet模型失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            logger.info("使用rembg作为后备方案")
            self.use_modnet = False
            self.use_simple_method = not REMBG_AVAILABLE
            if not self.use_simple_method:
                self._load_model()

    def segment_person(self, image: np.ndarray,
                      return_mask: bool = False) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        进行人像分割

        Args:
            image: 输入图像 (BGR格式)
            return_mask: 是否返回mask

        Returns:
            (分割后的图像, mask) 或 (分割后的图像, None)
        """
        try:
            if self.use_modnet:
                return self._segment_with_modnet(image, return_mask)
            elif self.use_simple_method:
                return self._simple_segment_person(image, return_mask)
            else:
                # 转换颜色空间 BGR -> RGB
                if image.shape[2] == 3:
                    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                else:
                    rgb_image = image

                # 使用rembg进行分割，启用后处理以提高精度
                # post_process_mask=True 会自动优化mask边缘
                # alpha_matting=True 可以改善边缘质量（提高精度，但速度较慢）
                # 针对低对比度图像（如浅色衣服+浅色背景），调整alpha_matting参数：
                # - foreground_threshold: 200（从240降低，更宽松地识别前景）
                # - background_threshold: 20（从10提高，更严格地排除背景）
                # - erode_size: 8（从10减小，保留更多边缘细节）
                logger.info(f"使用模型 {self.model_name} 进行人像分割，启用后处理以提高精度（优化低对比度场景）")
                output = remove(
                    rgb_image, 
                    session=self.session, 
                    post_process_mask=True,
                    alpha_matting=True,  # 启用alpha_matting以提高边缘精度
                    alpha_matting_foreground_threshold=200,  # 降低阈值，更宽松地识别前景（适合低对比度）
                    alpha_matting_background_threshold=20,    # 提高阈值，更严格地排除背景
                    alpha_matting_erode_size=8                # 减小腐蚀尺寸，保留更多边缘细节
                )
                logger.info(f"rembg分割完成，输出形状: {output.shape}, 模型: {self.model_name}")

                # 如果需要返回mask，计算mask
                mask = None
                if return_mask:
                    # 从alpha通道提取mask
                    if output.shape[2] == 4:
                        mask = output[:, :, 3]
                        # 优化mask：形态学操作去除噪点
                        mask = self.refine_mask(mask)
                    else:
                        # 如果没有alpha通道，转换为灰度图作为mask
                        gray = cv2.cvtColor(output, cv2.COLOR_RGB2GRAY)
                        # 使用更低的阈值，确保捕获更多细节
                        _, mask = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
                        mask = self.refine_mask(mask)

                # 转换回BGR格式
                if output.shape[2] == 4:
                    bgr_output = cv2.cvtColor(output[:, :, :3], cv2.COLOR_RGB2BGR)
                else:
                    bgr_output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)

                return bgr_output, mask

        except Exception as e:
            logger.error(f"人像分割失败: {e}")
            raise

    def _simple_segment_person(self, image: np.ndarray,
                             return_mask: bool = False) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        简化的背景去除方法（当AI库不可用时使用）
        使用颜色距离和边缘检测的简单方法
        """
        try:
            # 确保numpy已导入（虽然文件顶部已导入，但这里再次确认）
            import numpy as np
            
            # 转换为HSV色彩空间，更容易处理颜色
            if not CV2_AVAILABLE:
                logger.warning("OpenCV不可用，无法进行简化抠图，返回原始图像")
                return image, None
            
            h, w = image.shape[:2]
            
            # 方法1: 尝试使用GrabCut算法（更准确）
            try:
                # 创建初始mask：假设中心区域是前景（人物）
                mask_gc = np.zeros((h, w), np.uint8)
                
                # 改进的初始区域设置：
                # 1. 中心区域标记为确定的前景（更大范围）
                center_x, center_y = w // 2, h // 2
                # 使用更大的初始区域（50% 而不是 33%）
                rect_size_w = int(w * 0.4)
                rect_size_h = int(h * 0.4)
                mask_gc[center_y - rect_size_h:center_y + rect_size_h, 
                       center_x - rect_size_w:center_x + rect_size_w] = cv2.GC_FGD
                
                # 2. 中心区域周围标记为可能的前景
                rect_size_w2 = int(w * 0.45)
                rect_size_h2 = int(h * 0.45)
                outer_mask = np.zeros((h, w), np.uint8)
                outer_mask[center_y - rect_size_h2:center_y + rect_size_h2, 
                          center_x - rect_size_w2:center_x + rect_size_w2] = 255
                # 在可能前景区域中，排除已标记为确定前景的部分
                mask_gc[(outer_mask == 255) & (mask_gc == 0)] = cv2.GC_PR_FGD
                
                # 3. 边缘区域标记为确定的背景（更宽的边缘）
                border = max(30, min(w, h) // 15)  # 至少30像素，或图像尺寸的1/15
                mask_gc[:border, :] = cv2.GC_BGD
                mask_gc[-border:, :] = cv2.GC_BGD
                mask_gc[:, :border] = cv2.GC_BGD
                mask_gc[:, -border:] = cv2.GC_BGD
                
                # 使用GrabCut算法，增加迭代次数以提高精度
                bgd_model = np.zeros((1, 65), np.float64)
                fgd_model = np.zeros((1, 65), np.float64)
                
                # 第一次迭代：使用初始mask
                cv2.grabCut(image, mask_gc, None, bgd_model, fgd_model, 10, cv2.GC_INIT_WITH_MASK)
                
                # 第二次迭代：基于第一次结果继续优化
                cv2.grabCut(image, mask_gc, None, bgd_model, fgd_model, 5, cv2.GC_EVAL)
                
                # 提取前景mask（包括确定前景和可能前景）
                mask = np.where((mask_gc == cv2.GC_FGD) | (mask_gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
                
                # 检查mask的有效性
                mask_area = np.count_nonzero(mask)
                total_area = h * w
                mask_ratio = mask_area / total_area
                
                logger.info(f"使用GrabCut算法完成简化抠图 - mask占比: {mask_ratio:.2%} ({mask_area}/{total_area})")
                
                # 如果mask太小（小于5%），可能是过度分割，尝试更宽松的设置
                if mask_ratio < 0.05:
                    logger.warning(f"GrabCut结果mask过小 ({mask_ratio:.2%})，尝试更宽松的设置")
                    # 重新初始化，使用更宽松的前景区域
                    mask_gc = np.zeros((h, w), np.uint8)
                    rect_size_w = int(w * 0.5)
                    rect_size_h = int(h * 0.5)
                    mask_gc[center_y - rect_size_h:center_y + rect_size_h, 
                           center_x - rect_size_w:center_x + rect_size_w] = cv2.GC_PR_FGD
                    border = max(20, min(w, h) // 20)
                    mask_gc[:border, :] = cv2.GC_BGD
                    mask_gc[-border:, :] = cv2.GC_BGD
                    mask_gc[:, :border] = cv2.GC_BGD
                    mask_gc[:, -border:] = cv2.GC_BGD
                    
                    bgd_model = np.zeros((1, 65), np.float64)
                    fgd_model = np.zeros((1, 65), np.float64)
                    cv2.grabCut(image, mask_gc, None, bgd_model, fgd_model, 15, cv2.GC_INIT_WITH_MASK)
                    mask = np.where((mask_gc == cv2.GC_FGD) | (mask_gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
                    mask_ratio = np.count_nonzero(mask) / total_area
                    logger.info(f"宽松设置后mask占比: {mask_ratio:.2%}")
            except Exception as e:
                logger.warning(f"GrabCut算法失败，使用备用方法: {e}")
                # 方法2: 改进的颜色距离方法
                hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
                
                # 使用中心区域的颜色作为前景参考（假设人物在中心）
                center_region = hsv[h//4:3*h//4, w//4:3*w//4]
                if center_region.size > 0:
                    fg_color = np.mean(center_region.reshape(-1, 3), axis=0)
                else:
                    fg_color = np.mean(hsv.reshape(-1, 3), axis=0)
                
                # 计算边缘区域的平均颜色（作为背景参考）
                border_region = np.concatenate([
                    hsv[:10, :].reshape(-1, 3),
                    hsv[-10:, :].reshape(-1, 3),
                    hsv[:, :10].reshape(-1, 3),
                    hsv[:, -10:].reshape(-1, 3)
                ], axis=0)
                bg_color = np.mean(border_region, axis=0) if border_region.size > 0 else np.mean(hsv.reshape(-1, 3), axis=0)
                
                # 计算每个像素到前景和背景的距离
                hsv_float = hsv.astype(np.float32)
                fg_dist = np.sqrt(np.sum((hsv_float - fg_color) ** 2, axis=2))
                bg_dist = np.sqrt(np.sum((hsv_float - bg_color) ** 2, axis=2))
                
                # 如果到前景的距离小于到背景的距离，则认为是前景
                mask = np.where(fg_dist < bg_dist, 255, 0).astype(np.uint8)
                
                logger.info("使用改进的颜色距离方法完成简化抠图")
            
            # 形态学操作优化mask
            kernel = np.ones((5, 5), np.uint8)
            # 先闭运算填充小洞
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
            # 再开运算去除小噪点
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
            
            # 找到最大连通区域（通常是人物主体）
            num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
            if num_labels > 1:
                # 找到面积最大的连通区域（排除背景，索引0）
                largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
                mask = np.where(labels == largest_label, 255, 0).astype(np.uint8)
            
            # 轻微高斯模糊使边缘更自然
            mask = cv2.GaussianBlur(mask, (5, 5), 1.0)
            _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

            # 创建输出图像
            output = image.copy()
            if output.shape[2] == 3:
                # 添加alpha通道
                alpha = mask
                output = np.dstack([output, alpha])

            logger.info("使用简化的抠图方法完成")
            return output, mask if return_mask else None

        except Exception as e:
            logger.error(f"简化抠图失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # 返回原始图像
            return image, None

    def segment_and_composite(self, image: np.ndarray,
                             background_color: Tuple[int, int, int] = (255, 255, 255),
                             background_image: Optional[np.ndarray] = None) -> np.ndarray:
        """
        分割并合成到新背景

        Args:
            image: 输入图像
            background_color: 背景颜色 (BGR格式)
            background_image: 背景图像，如果提供则使用图片背景

        Returns:
            合成后的图像
        """
        segmented, mask = self.segment_person(image, return_mask=True)

        if background_image is not None:
            # 使用背景图片
            result = background_image.copy()
            # 调整背景图片大小以匹配segmented
            if result.shape[:2] != segmented.shape[:2]:
                result = cv2.resize(result, (segmented.shape[1], segmented.shape[0]))
        else:
            # 使用纯色背景
            result = np.full_like(segmented, background_color)

        # 如果有mask，进行透明合成
        if mask is not None:
            mask_normalized = mask.astype(float) / 255.0
            mask_3ch = np.stack([mask_normalized] * 3, axis=2)

            result = (segmented * mask_3ch + result * (1 - mask_3ch)).astype(np.uint8)

        return result

    def refine_mask(self, mask: np.ndarray) -> np.ndarray:
        """优化mask，提高人像分割精度"""
        try:
            if not CV2_AVAILABLE:
                return mask
            
            # 确保mask是uint8格式
            if mask.dtype != np.uint8:
                if mask.max() <= 1.0:
                    mask = (mask * 255).astype(np.uint8)
                else:
                    mask = mask.astype(np.uint8)
            
            # 使用自适应阈值而不是固定阈值，提高边缘精度
            # 进一步减小高斯模糊强度以保留更多边缘细节（从(3,3),0.5降到(3,3),0.3）
            mask_blurred = cv2.GaussianBlur(mask, (3, 3), 0.3)
            
            # 使用OTSU自适应阈值，自动找到最佳阈值
            _, mask_binary = cv2.threshold(mask_blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # 形态学操作优化mask
            # 使用较小的kernel，保持边缘细节
            kernel_small = np.ones((3, 3), np.uint8)
            kernel_medium = np.ones((5, 5), np.uint8)

            # 先进行开运算去除小噪点（使用小kernel保持细节，减少迭代次数）
            mask_cleaned = cv2.morphologyEx(mask_binary, cv2.MORPH_OPEN, kernel_small, iterations=1)

            # 闭运算填充小洞（使用中等kernel，减少迭代次数以保留更多细节）
            # 进一步减少迭代次数（从1降到0，或者完全移除闭运算）
            mask_filled = cv2.morphologyEx(mask_cleaned, cv2.MORPH_CLOSE, kernel_medium, iterations=1)

            # 使用轮廓检测找到最大连通区域（通常是人物）
            # 这样可以去除背景中的小噪点
            contours, _ = cv2.findContours(mask_filled, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if len(contours) > 0:
                # 找到最大的轮廓（通常是人物主体）
                largest_contour = max(contours, key=cv2.contourArea)
                
                # 创建新的mask，只保留最大轮廓
                mask_refined = np.zeros_like(mask_filled)
                cv2.fillPoly(mask_refined, [largest_contour], 255)
                
                # 如果还有其他较大的轮廓（可能是手臂等），也保留
                # 进一步降低阈值以保留更多细节（从2%降到1.5%，特别适合低对比度场景）
                for contour in contours:
                    area = cv2.contourArea(contour)
                    # 保留面积大于最大轮廓1.5%的轮廓（进一步降低阈值以保留更多细节，适合低对比度场景）
                    if area > cv2.contourArea(largest_contour) * 0.015:
                        cv2.fillPoly(mask_refined, [contour], 255)
                        logger.debug(f"保留轮廓，面积: {area}, 占比: {area/cv2.contourArea(largest_contour)*100:.1f}%")
                
                mask_filled = mask_refined
            
            # 轻微的高斯模糊使边缘更自然（但保持清晰）
            # 进一步减小模糊强度以保留更多边缘细节（从0.3降到0.2）
            mask_smooth = cv2.GaussianBlur(mask_filled, (3, 3), 0.2)
            
            # 最终二值化，使用更低的阈值以保留更多边缘细节（从127降到100）
            _, mask_final = cv2.threshold(mask_smooth, 100, 255, cv2.THRESH_BINARY)
            
            logger.info(f"mask优化完成 - 原始非零像素: {np.count_nonzero(mask)}, 优化后: {np.count_nonzero(mask_final)}")
            
            return mask_final

        except Exception as e:
            logger.warning(f"mask优化失败: {e}")
            import traceback
            logger.warning(traceback.format_exc())
            return mask

    def generate_border_mask(self, mask: np.ndarray, border_width: int = 3) -> np.ndarray:
        """生成描边mask
        
        Args:
            mask: 原始mask
            border_width: 描边宽度
            
        Returns:
            描边mask（只包含边缘区域）
        """
        try:
            if not CV2_AVAILABLE:
                return mask
            
            # 使用形态学操作生成描边
            kernel_size = border_width * 2 + 1
            kernel = np.ones((kernel_size, kernel_size), np.uint8)
            
            # 膨胀操作
            dilated = cv2.dilate(mask, kernel, iterations=1)
            
            # 描边 = 膨胀后的mask - 原始mask
            border_mask = cv2.subtract(dilated, mask)
            
            return border_mask

        except Exception as e:
            logger.warning(f"生成描边mask失败: {e}")
            return mask
    
    def _segment_with_modnet(self, image: np.ndarray, return_mask: bool = False) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """使用MODNet进行人像分割"""
        try:
            if not PYTORCH_AVAILABLE or not MODNET_AVAILABLE or self.modnet_model is None:
                logger.warning("MODNet不可用，使用rembg作为后备")
                if not self.use_simple_method:
                    return self._segment_with_rembg(image, return_mask)
                else:
                    return self._simple_segment_person(image, return_mask)
            
            # 转换BGR到RGB
            if image.shape[2] == 3:
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            else:
                rgb_image = image
            
            # 预处理图像
            # MODNet通常需要输入尺寸为512x512
            h, w = rgb_image.shape[:2]
            ref_size = self.modnet_ref_size
            
            # 计算缩放比例，保持宽高比
            if max(h, w) > ref_size:
                scale = ref_size / max(h, w)
                new_h, new_w = int(h * scale), int(w * scale)
            else:
                new_h, new_w = h, w
            
            # 调整大小（必须是32的倍数，MODNet的要求）
            new_h = (new_h // 32) * 32
            new_w = (new_w // 32) * 32
            if new_h < 32:
                new_h = 32
            if new_w < 32:
                new_w = 32
            
            rgb_resized = cv2.resize(rgb_image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
            
            # 转换为PIL Image并归一化
            from PIL import Image
            pil_image = Image.fromarray(rgb_resized)
            
            # MODNet的预处理（根据官方实现）
            transform = transforms.Compose([
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
            ])
            
            input_tensor = transform(pil_image).unsqueeze(0).to(self.modnet_device)
            
            # 推理
            with torch.no_grad():
                # MODNet的前向传播返回 (pred_semantic, pred_detail, pred_matte)
                # 我们只需要 pred_matte（alpha matte）
                _, _, pred_matte = self.modnet_model(input_tensor, inference=True)
                
                # 处理输出
                alpha = pred_matte.squeeze().cpu().numpy()
                if len(alpha.shape) == 3:
                    alpha = alpha[0]  # 取第一个通道
                
                # 归一化到0-255
                if alpha.max() <= 1.0:
                    alpha = (alpha * 255).astype(np.uint8)
                else:
                    alpha = alpha.astype(np.uint8)
            
            # 调整alpha大小回原始尺寸
            if new_h != h or new_w != w:
                alpha = cv2.resize(alpha, (w, h), interpolation=cv2.INTER_LINEAR)
            
            # 创建RGBA图像
            bgr_image = image.copy()
            if bgr_image.shape[2] == 4:
                bgr_image = bgr_image[:, :, :3]
            
            # 应用alpha通道
            rgba_output = np.dstack([bgr_image, alpha])
            
            # 如果需要mask
            mask = None
            if return_mask:
                mask = alpha.copy()
                mask = self.refine_mask(mask)
            
            logger.info(f"MODNet分割完成，输出形状: {rgba_output.shape}")
            return rgba_output, mask
            
        except Exception as e:
            logger.error(f"MODNet分割失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # 回退到rembg
            logger.info("MODNet失败，使用rembg作为后备")
            if not self.use_simple_method:
                return self._segment_with_rembg(image, return_mask)
            else:
                return self._simple_segment_person(image, return_mask)
    
    def _segment_with_rembg(self, image: np.ndarray, return_mask: bool = False) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """使用rembg进行人像分割（内部方法）"""
        # 转换颜色空间 BGR -> RGB
        if image.shape[2] == 3:
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        else:
            rgb_image = image

        # 使用rembg进行分割
        logger.info(f"使用模型 {self.model_name} 进行人像分割，启用后处理以提高精度（优化低对比度场景）")
        output = remove(
            rgb_image, 
            session=self.session, 
            post_process_mask=True,
            alpha_matting=True,
            alpha_matting_foreground_threshold=200,
            alpha_matting_background_threshold=20,
            alpha_matting_erode_size=8
        )
        logger.info(f"rembg分割完成，输出形状: {output.shape}, 模型: {self.model_name}")

        # 如果需要返回mask，计算mask
        mask = None
        if return_mask:
            # 从alpha通道提取mask
            if output.shape[2] == 4:
                mask = output[:, :, 3]
                # 优化mask：形态学操作去除噪点
                mask = self.refine_mask(mask)
            else:
                # 如果没有alpha通道，转换为灰度图作为mask
                gray = cv2.cvtColor(output, cv2.COLOR_RGB2GRAY)
                # 使用更低的阈值，确保捕获更多细节
                _, mask = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
                mask = self.refine_mask(mask)

        # 转换回BGR格式
        if output.shape[2] == 4:
            bgr_output = cv2.cvtColor(output[:, :, :3], cv2.COLOR_RGB2BGR)
            # 合并alpha通道
            alpha = output[:, :, 3:4]
            bgr_output = np.dstack([bgr_output, alpha])
        else:
            bgr_output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)

        return bgr_output, mask


class MODNetSegmenter:
    """基于MODNet的专业人像分割器"""

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or "models/modnet_photographic_portrait_matting.ckpt"
        self.model = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self._load_model()

    def _load_model(self):
        """加载MODNet模型"""
        try:
            logger.info("加载MODNet人像分割模型")

            # 这里需要预训练的MODNet模型
            # 由于模型较大，这里提供接口，实际使用时需要下载模型
            logger.warning("MODNet模型需要单独下载，请确保模型文件存在")

            # 简化的实现，使用rembg作为后备
            self.fallback_segmenter = PersonSegmenter("u2net")

        except Exception as e:
            logger.error(f"加载MODNet模型失败: {e}")
            logger.info("使用U2Net作为后备方案")
            self.fallback_segmenter = PersonSegmenter("u2net")

    def segment_person(self, image: np.ndarray) -> np.ndarray:
        """使用MODNet进行人像分割"""
        # 如果MODNet可用，使用MODNet
        if self.model is not None:
            try:
                return self._segment_with_modnet(image)
            except Exception as e:
                logger.warning(f"MODNet分割失败，使用后备方案: {e}")

        # 使用后备方案
        return self.fallback_segmenter.segment_person(image, return_mask=False)[0]

    def _segment_with_modnet(self, image: np.ndarray, return_mask: bool = False) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """使用MODNet进行人像分割"""
        try:
            if not PYTORCH_AVAILABLE or not MODNET_AVAILABLE or self.modnet_model is None:
                logger.warning("MODNet不可用，使用rembg作为后备")
                if not self.use_simple_method:
                    return self._segment_with_rembg(image, return_mask)
                else:
                    return self._simple_segment_person(image, return_mask)
            
            # 转换BGR到RGB
            if image.shape[2] == 3:
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            else:
                rgb_image = image
            
            # 预处理图像
            # MODNet通常需要输入尺寸为512x512
            h, w = rgb_image.shape[:2]
            ref_size = self.modnet_ref_size
            
            # 计算缩放比例，保持宽高比
            if max(h, w) > ref_size:
                scale = ref_size / max(h, w)
                new_h, new_w = int(h * scale), int(w * scale)
            else:
                new_h, new_w = h, w
            
            # 调整大小（必须是32的倍数，MODNet的要求）
            new_h = (new_h // 32) * 32
            new_w = (new_w // 32) * 32
            if new_h < 32:
                new_h = 32
            if new_w < 32:
                new_w = 32
            
            rgb_resized = cv2.resize(rgb_image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
            
            # 转换为PIL Image并归一化
            from PIL import Image
            pil_image = Image.fromarray(rgb_resized)
            
            # MODNet的预处理（根据官方实现）
            transform = transforms.Compose([
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
            ])
            
            input_tensor = transform(pil_image).unsqueeze(0).to(self.modnet_device)
            
            # 推理
            with torch.no_grad():
                # MODNet的前向传播返回 (pred_semantic, pred_detail, pred_matte)
                # 我们只需要 pred_matte（alpha matte）
                _, _, pred_matte = self.modnet_model(input_tensor, inference=True)
                
                # 处理输出
                alpha = pred_matte.squeeze().cpu().numpy()
                if len(alpha.shape) == 3:
                    alpha = alpha[0]  # 取第一个通道
                
                # 归一化到0-255
                if alpha.max() <= 1.0:
                    alpha = (alpha * 255).astype(np.uint8)
                else:
                    alpha = alpha.astype(np.uint8)
            
            # 调整alpha大小回原始尺寸
            if new_h != h or new_w != w:
                alpha = cv2.resize(alpha, (w, h), interpolation=cv2.INTER_LINEAR)
            
            # 创建RGBA图像
            bgr_image = image.copy()
            if bgr_image.shape[2] == 4:
                bgr_image = bgr_image[:, :, :3]
            
            # 应用alpha通道
            rgba_output = np.dstack([bgr_image, alpha])
            
            # 如果需要mask
            mask = None
            if return_mask:
                mask = alpha.copy()
                mask = self.refine_mask(mask)
            
            logger.info(f"MODNet分割完成，输出形状: {rgba_output.shape}")
            return rgba_output, mask
            
        except Exception as e:
            logger.error(f"MODNet分割失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # 回退到rembg
            logger.info("MODNet失败，使用rembg作为后备")
            if not self.use_simple_method:
                return self._segment_with_rembg(image, return_mask)
            else:
                return self._simple_segment_person(image, return_mask)


def segment_image(image_path: str, output_path: Optional[str] = None,
                 model_name: str = "u2net") -> str:
    """便捷的图像分割函数

    Args:
        image_path: 输入图像路径
        output_path: 输出路径，如果为None则自动生成
        model_name: 使用的模型名称

    Returns:
        输出图像路径
    """
    try:
        # 读取图像
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"无法读取图像: {image_path}")

        # 创建分割器
        segmenter = PersonSegmenter(model_name)

        # 进行分割
        segmented, _ = segmenter.segment_person(image)

        # 确定输出路径
        if output_path is None:
            image_name = Path(image_path).stem
            output_dir = ensure_dir("output")
            output_path = str(output_dir / f"{image_name}_segmented.png")

        # 保存结果
        save_image(segmented, output_path)

        logger.info(f"人像分割完成: {output_path}")
        return output_path

    except Exception as e:
        logger.error(f"人像分割失败: {e}")
        raise


def segment_person_from_video_frame(video_path: str, time_seconds: float = 1.0,
                                   output_path: Optional[str] = None,
                                   model_name: str = "u2net") -> str:
    """从视频帧中分割人物

    Args:
        video_path: 视频路径
        time_seconds: 抽帧时间
        output_path: 输出路径
        model_name: 模型名称

    Returns:
        分割后的图像路径
    """
    from .extractor import VideoExtractor

    try:
        # 抽取帧
        extractor = VideoExtractor(video_path)
        frame = extractor.extract_frame_at_time(time_seconds)

        # 保存临时帧
        temp_frame_path = f"temp_frame_{time_seconds}.jpg"
        save_image(frame, temp_frame_path)

        # 分割人物
        result_path = segment_image(temp_frame_path, output_path, model_name)

        # 清理临时文件
        try:
            os.remove(temp_frame_path)
        except:
            pass

        return result_path

    except Exception as e:
        logger.error(f"视频帧人物分割失败: {e}")
        raise
