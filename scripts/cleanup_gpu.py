#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GPU显存清理脚本（强化版）
在任务完成后调用，彻底释放GPU显存和内存
支持强制杀死占用GPU的Python进程
"""

import sys
import subprocess
import os
import gc
import time

def get_gpu_processes():
    """获取占用GPU的进程列表"""
    try:
        result = subprocess.run(
            "nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader",
            shell=True,
            capture_output=True,
            text=True,
            timeout=5
        )

        processes = []
        if result.returncode == 0 and result.stdout.strip():
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    parts = [p.strip() for p in line.split(',')]
                    if len(parts) >= 3:
                        pid, name, memory = parts
                        processes.append({
                            'pid': int(pid),
                            'name': name,
                            'memory': memory
                        })
        return processes
    except Exception as e:
        print("[GPU清理] 获取GPU进程失表: {}".format(e))
        return []

def get_all_python_processes():
    """获取所有Python进程列表（包括孤儿进程）"""
    try:
        result = subprocess.run(
            "tasklist /FI \"IMAGENAME eq python.exe\" /FO CSV /NH",
            shell=True,
            capture_output=True,
            text=True,
            timeout=5
        )

        processes = []
        if result.returncode == 0 and result.stdout.strip():
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    parts = [p.strip('"') for p in line.split(',')]
                    if len(parts) >= 2:
                        name = parts[0]
                        pid = parts[1]
                        try:
                            processes.append({
                                'pid': int(pid),
                                'name': name
                            })
                        except:
                            pass
        return processes
    except Exception as e:
        print("[GPU清理] 获取Python进程失败: {}".format(e))
        return []

def should_kill_process(pid, model_paths=None):
    """判断进程是否应该被清理（只清理AI模型相关进程）

    Args:
        pid: 进程ID
        model_paths: 模型路径列表，如果提供，只清理这些路径下的进程
    """
    try:
        # 获取进程命令行
        cmdline_result = subprocess.run(
            "wmic process where ProcessId={} get CommandLine /format:list".format(pid),
            shell=True,
            capture_output=True,
            text=True,
            timeout=2
        )

        if cmdline_result.returncode != 0 or not cmdline_result.stdout:
            return False

        cmdline = cmdline_result.stdout.lower()

        # 白名单（包含这些关键词的进程不清理）
        whitelist_keywords = [
            '直播伴侣',
            'finderliveobs',
            'xwechat',
            'obs',
            'obs-studio',
            'streamlabs',
            'douyin',
            'tiktok',
            'bilibili',
            '抖音',
            'kuaishou',
            '快手',
            'pycharm',
            'vscode',
            'visual studio code',
            'jupyter',
            'spyder',
            'anaconda',
            'conda',
            'sublime',
            'notepad++',
            'wechat',
            'weixin',
            '微信',
            'qq',
            'asr',
            'funasr',
            'aigcpanel',
            'whisper',
            'cosyvoice',
        ]

        # 检查白名单
        for keyword in whitelist_keywords:
            if keyword in cmdline:
                # 提取进程名称（从命令行中获取）
                process_name = "未知"
                if "python" in cmdline:
                    process_name = "Python进程"
                elif "finderliveobs" in cmdline or "xwechat" in cmdline:
                    process_name = "视频号直播伴侣"
                elif "obs" in cmdline:
                    process_name = "OBS直播软件"
                elif "wechat" in cmdline or "weixin" in cmdline:
                    process_name = "微信"

                print("[GPU清理] [保护] 跳过白名单进程 PID={} ({}, 匹配关键词: {})".format(pid, process_name, keyword))
                return False

        # 🔧 必须提供模型路径才进行清理（安全模式）
        if model_paths and len(model_paths) > 0:
            for model_path in model_paths:
                # 标准化路径格式（统一使用小写和反斜杠）
                normalized_path = model_path.lower().replace('/', '\\')
                if normalized_path in cmdline:
                    print("[GPU清理] 匹配模型路径 PID={} (路径: {})".format(pid, model_path))
                    return True
            # 如果提供了路径但都不匹配，不清理
            return False
        else:
            # 🔧 安全修复：没有提供路径时，不清理任何进程（防止误杀）
            # 之前的关键词匹配模式已移除，确保只清理模型路径下的进程
            print("[GPU清理] 警告: 未提供模型路径，跳过进程 PID={}".format(pid))
            return False

    except Exception as e:
        print("[GPU清理] 检查进程 PID={} 失败: {}".format(pid, e))
        return False

def cleanup_gpu(force_kill=True, model_paths=None):
    """彻底清理GPU显存和内存（默认强力模式）

    Args:
        force_kill: 是否强制清理
        model_paths: 模型路径列表，只清理这些路径下的进程
    """
    try:
        print("[GPU清理] ========== 开始GPU显存和内存清理 ==========")
        if model_paths and len(model_paths) > 0:
            print("[GPU清理] [模式] 路径过滤：只清理模型路径下的Python进程")
            print("[GPU清理] [路径] 共 {} 个模型路径:".format(len(model_paths)))
            for path in model_paths:
                print("[GPU清理]   - {}".format(path))
        else:
            print("[GPU清理] [模式] 智能清理：只清理AI模型进程，保护其他Python应用")

        # ==================== 步骤1：PyTorch GPU深度清理 ====================
        print("[GPU清理] [步骤1] PyTorch GPU深度清理...")
        try:
            import torch

            if torch.cuda.is_available():
                # 显示清理前的显存状态
                allocated_before = torch.cuda.memory_allocated() / 1024**3
                reserved_before = torch.cuda.memory_reserved() / 1024**3
                print("[GPU清理] 清理前: 已分配={:.2f}GB, 已保留={:.2f}GB".format(allocated_before, reserved_before))

                # 1. 清空CUDA缓存（多次循环确保彻底清理）
                print("[GPU清理] 正在清空CUDA缓存...")
                for i in range(5):
                    torch.cuda.empty_cache()
                    gc.collect()
                    time.sleep(0.1)

                # 2. 同步所有CUDA设备
                print("[GPU清理] 同步CUDA设备...")
                torch.cuda.synchronize()

                # 3. 重置内存统计
                torch.cuda.reset_peak_memory_stats()
                torch.cuda.reset_accumulated_memory_stats()

                # 4. 尝试释放所有未使用的缓存内存
                try:
                    # 清理内存分配器的缓存
                    torch.cuda.memory.empty_cache()
                except:
                    pass

                # 5. 设置内存分配器配置（优化内存使用）
                try:
                    os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'
                except:
                    pass

                # 显示清理后的显存状态
                allocated_after = torch.cuda.memory_allocated() / 1024**3
                reserved_after = torch.cuda.memory_reserved() / 1024**3
                freed_memory = (reserved_before - reserved_after)
                print("[GPU清理] 清理后: 已分配={:.2f}GB, 已保留={:.2f}GB".format(allocated_after, reserved_after))
                print("[GPU清理] 释放显存: {:.2f}GB".format(freed_memory))

                print("[GPU清理] [OK] PyTorch GPU清理完成")
            else:
                print("[GPU清理] CUDA不可用，跳过GPU清理")
        except ImportError:
            print("[GPU清理] PyTorch未安装，跳过GPU清理")
        except Exception as e:
            print("[GPU清理] PyTorch清理出错: {}".format(e))

        # ==================== 步骤2：强制系统内存清理 ====================
        print("[GPU清理] [步骤2] 执行强制系统内存清理...")

        # 1. 多轮垃圾回收（清理不同代的对象）
        total_collected = 0
        for i in range(5):
            collected = gc.collect(generation=2)  # 清理所有代
            total_collected += collected
            time.sleep(0.05)

        print("[GPU清理] 垃圾回收: 清理了 {} 个对象".format(total_collected))

        # 2. 清理Python内部缓存
        try:
            import ctypes
            # 尝试释放Python未使用的内存回操作系统
            if hasattr(ctypes, 'windll'):
                # Windows平台
                ctypes.windll.kernel32.SetProcessWorkingSetSize(-1, -1, -1)
        except:
            pass

        print("[GPU清理] [OK] 系统内存清理完成")

        # ==================== 步骤3：显示当前状态 ====================
        print("[GPU清理] [步骤3] 检查GPU状态...")
        try:
            result = subprocess.run(
                "nvidia-smi --query-gpu=index,memory.used,memory.free,memory.total --format=csv,noheader",
                shell=True,
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                print("[GPU清理] ========== GPU 显存状态 ==========")
                for line in result.stdout.strip().split('\n'):
                    if line.strip():
                        print("[GPU清理] {}".format(line.strip()))
        except:
            pass

        # ==================== 步骤4：清理所有Python进程（包括孤儿进程） ====================
        print("[GPU清理] [步骤4] 检查并清理所有Python进程...")

        # 获取所有Python进程（包括GPU和非GPU进程）
        all_python_processes = get_all_python_processes()

        if all_python_processes:
            print("[GPU清理] 检测到 {} 个Python进程（包括AI任务和孤儿进程）".format(len(all_python_processes)))

            # 过滤需要清理的进程
            print("[GPU清理] [智能过滤] 正在识别需要清理的进程...")
            processes_to_kill = []
            skipped_count = 0

            for proc in all_python_processes:
                if should_kill_process(proc['pid'], model_paths):
                    processes_to_kill.append(proc)
                    print("[GPU清理]   PID={}, 将被清理 (AI模型进程)".format(proc['pid']))
                else:
                    skipped_count += 1

            print("[GPU清理] 识别完成: {} 个进程将被清理, {} 个进程已跳过".format(
                len(processes_to_kill), skipped_count
            ))

            # 清理识别出的AI模型进程
            if processes_to_kill:
                print("[GPU清理] [智能清理] 开始清理AI模型进程...")
                killed_count = 0
                failed_pids = []

                for proc in processes_to_kill:
                    try:
                        # 使用 PowerShell 强制杀死进程（更可靠）
                        result = subprocess.run(
                            'powershell -Command "Stop-Process -Id {} -Force"'.format(proc['pid']),
                            shell=True,
                            capture_output=True,
                            timeout=3
                        )

                        if result.returncode == 0:
                            print("[GPU清理] [OK] 已清理进程 PID={}".format(proc['pid']))
                            killed_count += 1
                        else:
                            failed_pids.append(proc['pid'])
                            print("[GPU清理] [FAIL] 清理进程 PID={} 失败".format(proc['pid']))

                        time.sleep(0.2)
                    except Exception as e:
                        failed_pids.append(proc['pid'])
                        print("[GPU清理] [ERROR] 清理进程PID={} 异常: {}".format(proc['pid'], str(e)))

                print("[GPU清理] [完成] 成功清理 {} 个进程, 失败 {} 个".format(killed_count, len(failed_pids)))
            else:
                print("[GPU清理] [OK] 没有需要清理的AI模型进程")

            # 清理后再次检查
            time.sleep(1)
            remaining = get_all_python_processes()
            remaining_ai_processes = [p for p in remaining if should_kill_process(p['pid'], model_paths)]

            if not remaining_ai_processes:
                print("[GPU清理] [OK] AI模型进程已清理完成")
            else:
                print("[GPU清理] [提示] 仍有 {} 个AI模型进程存在".format(len(remaining_ai_processes)))
                for proc in remaining_ai_processes:
                    print("[GPU清理]   残留进程 PID={}".format(proc['pid']))
        else:
            print("[GPU清理] [OK] 没有检测到Python进程")

        # ==================== 步骤5：最终GPU显存清理 ====================
        print("[GPU清理] [步骤5] 最终GPU显存清理...")
        try:
            import torch
            if torch.cuda.is_available():
                # 进程清理后，再次清理GPU缓存
                for i in range(3):
                    torch.cuda.empty_cache()
                    gc.collect()
                    time.sleep(0.1)

                # 显示最终状态
                final_allocated = torch.cuda.memory_allocated() / 1024**3
                final_reserved = torch.cuda.memory_reserved() / 1024**3
                print("[GPU清理] 最终状态: 已分配={:.2f}GB, 已保留={:.2f}GB".format(final_allocated, final_reserved))
                print("[GPU清理] [OK] 最终清理完成")
            else:
                print("[GPU清理] CUDA不可用")
        except:
            pass

        print("[GPU清理] ========== GPU和内存清理完成 ==========\n")
        return True

    except Exception as e:
        print("[GPU清理] [ERROR] 清理失败: {}".format(str(e)))
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # 解析命令行参数获取模型路径
    model_paths = []
    if len(sys.argv) > 1:
        # 从命令行参数获取模型路径（以逗号分隔）
        paths_arg = sys.argv[1]
        if paths_arg and paths_arg.strip():
            model_paths = [p.strip() for p in paths_arg.split(',') if p.strip()]

    if model_paths:
        print("[GPU清理] [信息] 路径过滤模式：只清理指定模型路径下的Python进程")
        print("[GPU清理] [信息] 受保护的应用：直播伴侣、OBS、IDE等不会被清理")
        print("[GPU清理] [信息] 模型路径数: {}\n".format(len(model_paths)))
    else:
        print("[GPU清理] [警告] 未提供模型路径参数！")
        print("[GPU清理] [说明] 脚本仅在提供模型路径时才进行进程清理")
        print("[GPU清理] [说明] 用法: python cleanup_gpu.py \"path1,path2,path3\"")
        print("[GPU清理] [信息] 将执行GPU显存和系统内存清理（不清理任何进程）\n")

    cleanup_gpu(force_kill=True, model_paths=model_paths)
    sys.exit(0)
