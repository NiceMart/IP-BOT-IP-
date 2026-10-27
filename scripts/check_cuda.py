#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CUDA可用性检测脚本
用于检测用户电脑是否支持CUDA加速
"""

import sys
import json
import subprocess

def check_cuda_availability():
    """
    全面检测CUDA可用性
    返回JSON格式的检测结果
    """
    result = {
        "cuda_available": False,
        "pytorch_available": False,
        "pytorch_cuda": False,
        "nvidia_smi_available": False,
        "gpu_info": [],
        "cuda_version": None,
        "pytorch_version": None,
        "error": None
    }

    try:
        # ==================== 检测1: PyTorch CUDA支持 ====================
        try:
            import torch
            result["pytorch_available"] = True
            result["pytorch_version"] = torch.__version__
            result["pytorch_cuda"] = torch.cuda.is_available()

            if torch.cuda.is_available():
                result["cuda_available"] = True
                result["cuda_version"] = torch.version.cuda

                # 获取GPU设备信息
                gpu_count = torch.cuda.device_count()
                for i in range(gpu_count):
                    gpu_name = torch.cuda.get_device_name(i)
                    gpu_memory = torch.cuda.get_device_properties(i).total_memory / (1024**3)
                    result["gpu_info"].append({
                        "id": i,
                        "name": gpu_name,
                        "memory_gb": round(gpu_memory, 2)
                    })
        except ImportError:
            result["error"] = "PyTorch未安装"
        except Exception as e:
            result["error"] = f"PyTorch检测失败: {str(e)}"

        # ==================== 检测2: nvidia-smi命令 ====================
        if not result["cuda_available"]:
            try:
                nvidia_smi_result = subprocess.run(
                    "nvidia-smi --query-gpu=index,name,memory.total --format=csv,noheader",
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=5
                )

                if nvidia_smi_result.returncode == 0 and nvidia_smi_result.stdout.strip():
                    result["nvidia_smi_available"] = True
                    result["cuda_available"] = True

                    # 解析GPU信息
                    for line in nvidia_smi_result.stdout.strip().split('\n'):
                        if line.strip():
                            parts = [p.strip() for p in line.split(',')]
                            if len(parts) >= 3:
                                gpu_id, gpu_name, gpu_memory = parts
                                memory_value = float(gpu_memory.replace(' MiB', '')) / 1024
                                result["gpu_info"].append({
                                    "id": int(gpu_id),
                                    "name": gpu_name,
                                    "memory_gb": round(memory_value, 2)
                                })
            except Exception as e:
                pass  # nvidia-smi不可用

        # ==================== 检测3: CUDA驱动版本 ====================
        if result["nvidia_smi_available"]:
            try:
                version_result = subprocess.run(
                    "nvidia-smi --query-gpu=driver_version --format=csv,noheader",
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=5
                )

                if version_result.returncode == 0:
                    driver_version = version_result.stdout.strip().split('\n')[0].strip()
                    if not result["cuda_version"]:
                        result["cuda_version"] = f"Driver {driver_version}"
            except:
                pass

    except Exception as e:
        result["error"] = f"检测过程出错: {str(e)}"

    return result

def print_human_readable(result):
    """打印人类可读的检测结果"""
    print("=" * 60)
    print("CUDA 可用性检测结果")
    print("=" * 60)

    if result["cuda_available"]:
        print("✅ CUDA 可用")
        print(f"📦 CUDA 版本: {result['cuda_version'] or '未知'}")

        if result["pytorch_available"]:
            print(f"🔥 PyTorch 版本: {result['pytorch_version']}")
            print(f"🔥 PyTorch CUDA 支持: {'是' if result['pytorch_cuda'] else '否'}")

        if result["gpu_info"]:
            print("\n🎮 检测到的GPU设备:")
            for gpu in result["gpu_info"]:
                print(f"  [{gpu['id']}] {gpu['name']} ({gpu['memory_gb']} GB)")
    else:
        print("❌ CUDA 不可用")
        if result["error"]:
            print(f"⚠️  错误信息: {result['error']}")
        else:
            print("💡 建议:")
            print("  1. 检查是否安装了NVIDIA显卡驱动")
            print("  2. 确认显卡支持CUDA")
            print("  3. 安装PyTorch CUDA版本")

    print("=" * 60)

if __name__ == "__main__":
    result = check_cuda_availability()

    # 如果有 --json 参数，输出JSON格式
    if "--json" in sys.argv:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_human_readable(result)

    # 退出码：0=CUDA可用，1=CUDA不可用
    sys.exit(0 if result["cuda_available"] else 1)
