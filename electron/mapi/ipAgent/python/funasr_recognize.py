#!/usr/bin/env python3
"""
FUNASR语音识别备用方案
使用speech_recognition库进行本地语音识别
如果speech_recognition库不可用，降级使用pydub和SpeechRecognition
"""

import json
import sys
import argparse
import os
from pathlib import Path
from datetime import datetime

def recognize_with_funasr(audio_path: str, language: str = 'zh', enable_word_timestamp: bool = True):
    """
    使用FUNASR本地模型进行语音识别
    """
    try:
        from funasr import AutoModel

        model = AutoModel(
            model="paraformer-zh",  # 中文模型
            vad_model="fsmn-vad",   # 语音活动检测
            vad_kwargs={"max_single_segment_time": 30000},
            device="cpu"  # 使用CPU，避免GPU依赖
        )

        res = model.generate(
            input=audio_path,
            cache={},
            language=language,
            merge_consecutive_texts=False
        )

        # 转换为标准格式
        segments = []
        current_time = 0.0

        for item in res:
            if isinstance(item, dict) and 'text' in item:
                text = item['text']
                # 估算时长（假设每个字0.5秒）
                duration = len(text) * 0.5
                segment = {
                    'text': text,
                    'start': current_time,
                    'end': current_time + duration,
                    'words': []
                }

                # 如果启用词级时间戳
                if enable_word_timestamp and isinstance(item, dict) and 'details' in item:
                    words = item['details']
                    for word_info in words:
                        word = {
                            'word': word_info.get('text', ''),
                            'start': word_info.get('start', 0) / 1000,  # 转换为秒
                            'end': word_info.get('end', 0) / 1000,
                            'confidence': word_info.get('confidence', 0.0)
                        }
                        segment['words'].append(word)

                segments.append(segment)
                current_time += duration

        return {
            'segments': segments,
            'language': language,
            'duration': current_time
        }

    except ImportError:
        return recognize_with_speech_recognition(audio_path, language, enable_word_timestamp)


def recognize_with_speech_recognition(audio_path: str, language: str = 'zh', enable_word_timestamp: bool = True):
    """
    使用SpeechRecognition库作为备用方案
    支持Google Cloud Speech API、Sphinx等
    """
    try:
        import speech_recognition as sr

        recognizer = sr.Recognizer()

        # 支持多种音频格式
        if audio_path.endswith('.wav'):
            with sr.AudioFile(audio_path) as source:
                audio = recognizer.record(source)
        else:
            # 对于其他格式，首先需要转换为WAV
            # 这里假设音频已经被转换为WAV
            with sr.AudioFile(audio_path) as source:
                audio = recognizer.record(source)

        # 尝试使用Google Cloud Speech Recognition（需要网络）
        try:
            text = recognizer.recognize_google(audio, language='zh-CN' if language == 'zh' else language)

            # 转换为标准格式
            segments = [{
                'text': text,
                'start': 0.0,
                'end': 5.0,  # 默认5秒
                'words': []
            }]

            return {
                'segments': segments,
                'language': language,
                'duration': 5.0
            }
        except sr.UnknownValueError:
            raise Exception("无法识别音频内容")
        except sr.RequestError as e:
            raise Exception(f"Google Speech Recognition请求失败: {e}")

    except ImportError:
        return recognize_with_pydub(audio_path, language, enable_word_timestamp)


def recognize_with_pydub(audio_path: str, language: str = 'zh', enable_word_timestamp: bool = True):
    """
    如果都不可用，提供一个有用的错误信息
    """
    raise Exception(
        f"语音识别失败。需要安装以下至少一个库:\n"
        f"1. pip install funasr torch torchaudio\n"
        f"2. pip install SpeechRecognition pydub\n"
        f"3. 或者配置FUNASR HTTP服务 (FUNASR_API_URL环境变量)"
    )


def split_audio_into_segments(audio_path: str, segment_duration: int = 30):
    """
    将长音频分割成短段进行识别（避免超时）
    """
    try:
        from pydub import AudioSegment

        audio = AudioSegment.from_file(audio_path)
        total_duration = len(audio)  # 毫秒

        segments = []
        for i in range(0, total_duration, segment_duration * 1000):
            segment = audio[i:i + segment_duration * 1000]
            segments.append(segment)

        return segments
    except ImportError:
        raise Exception("需要安装pydub库: pip install pydub")


def main():
    parser = argparse.ArgumentParser(description='语音识别脚本')
    parser.add_argument('--audio', required=True, help='音频文件路径')
    parser.add_argument('--language', default='zh', help='语言代码（zh或en）')
    parser.add_argument('--enable-word-timestamp', default='1', help='是否启用词级时间戳')

    args = parser.parse_args()

    if not os.path.exists(args.audio):
        print(json.dumps({
            'success': False,
            'error': f"音频文件不存在: {args.audio}"
        }))
        sys.exit(1)

    try:
        enable_word_timestamp = args.enable_word_timestamp == '1'

        # 尝试多种识别方式
        result = recognize_with_funasr(
            args.audio,
            args.language,
            enable_word_timestamp
        )

        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
