#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试情感驱动的字幕生成功能
Test Sentiment-Driven Subtitle Generation
"""

import os
import sys
import json
import tempfile

def create_test_config():
    """创建测试配置"""
    config = {
        'videoPath': 'test_video.mp4',  # 需要替换为实际视频路径
        'scriptText': """今天真是太开心了！
这个产品质量很糟糕。
明天我们去公园玩。
这个电影太精彩了！
天气不好，我很失望。
普通的一天，没什么特别的。""",
        'subtitleStyle': 'default',  # 这会被情感分析覆盖
        'coverStyle': 'default',
        'outputDir': './test_output',
        'useFunasr': False,  # 使用文本模式
        'coverOnly': False
    }

    return config

def test_sentiment_analysis():
    """测试情感分析功能"""
    print("=" * 60)
    print("测试情感分析功能")
    print("=" * 60)

    try:
        from subtitle_cover_generator_simple import SubtitleCoverGenerator

        config = create_test_config()
        generator = SubtitleCoverGenerator(config)

        # 测试句子
        test_sentences = [
            "今天真是太开心了！",  # 应该是positive
            "这个产品质量很糟糕。",  # 应该是negative
            "明天我们去公园玩。",  # 应该是neutral
            "这个电影太精彩了！",  # 应该是positive (强)
            "天气不好，我很失望。",  # 应该是negative
        ]

        print("\n逐句情感分析测试:")
        print("-" * 60)

        for sentence in test_sentences:
            result = generator.analyze_sentence_sentiment(sentence)
            sentiment = result['sentiment']
            score = result['score']
            style = generator.get_style_by_sentiment(sentiment, score)

            print(f"\n句子: {sentence}")
            print(f"  情感: {sentiment} (分数: {score:.4f})")
            print(f"  推荐样式: {style}")

        print("\n" + "=" * 60)
        print("✓ 情感分析功能测试通过!")
        return True

    except Exception as e:
        print(f"\n✗ 情感分析测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_subtitle_generation():
    """测试字幕生成功能"""
    print("\n" + "=" * 60)
    print("测试字幕生成功能")
    print("=" * 60)

    try:
        from subtitle_cover_generator_simple import SubtitleCoverGenerator

        config = create_test_config()
        generator = SubtitleCoverGenerator(config)

        # 生成字幕
        subtitles = generator.generate_subtitles()

        print(f"\n生成了 {len(subtitles)} 条字幕:")
        print("-" * 60)

        for sub in subtitles:
            print(f"\n[{sub['index']}] {sub['start_time']:.1f}s - {sub['end_time']:.1f}s")
            print(f"  文本: {sub['text']}")
            print(f"  情感: {sub.get('sentiment', 'N/A')} (分数: {sub.get('sentiment_score', 0):.4f})")
            print(f"  样式: {sub.get('style', 'N/A')}")

        print("\n" + "=" * 60)
        print("✓ 字幕生成功能测试通过!")
        return True

    except Exception as e:
        print(f"\n✗ 字幕生成测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_ass_file_generation():
    """测试ASS字幕文件生成"""
    print("\n" + "=" * 60)
    print("测试ASS字幕文件生成")
    print("=" * 60)

    try:
        from subtitle_cover_generator_simple import SubtitleCoverGenerator

        config = create_test_config()
        os.makedirs(config['outputDir'], exist_ok=True)

        generator = SubtitleCoverGenerator(config)

        # 生成字幕
        subtitles = generator.generate_subtitles()

        # 保存ASS文件
        ass_path = generator.save_ass(subtitles)

        # 读取并显示ASS文件内容
        with open(ass_path, 'r', encoding='utf-8-sig') as f:
            content = f.read()

        print(f"\nASS文件已生成: {ass_path}")
        print("\n文件内容预览 (前30行):")
        print("-" * 60)
        lines = content.split('\n')[:30]
        for i, line in enumerate(lines, 1):
            print(f"{i:3d}: {line}")

        print("\n" + "=" * 60)
        print("✓ ASS字幕文件生成测试通过!")
        return True

    except Exception as e:
        print(f"\n✗ ASS文件生成测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def print_summary():
    """打印功能说明"""
    print("\n" + "=" * 60)
    print("情感驱动字幕功能说明")
    print("=" * 60)
    print("""
工作原理:
1. 对每句话进行情感分析（使用Transformer模型或关键词匹配）
2. 根据情感类型和强度自动选择字幕样式:

   情感类型      情感强度    字幕样式      视觉效果
   --------------------------------------------------------
   positive     > 0.8       neon         霓虹样式-明亮彩色描边
   positive     <= 0.8      highlight    高亮样式-黄色背景
   negative     > 0.8       minimal      极简样式-低调细线
   negative     <= 0.8      card         卡片样式-半透明背景
   neutral      任意        default      默认样式-白字黑边

3. 使用ASS字幕格式支持每个字幕不同的样式
4. FFmpeg将ASS字幕烧录到视频

使用方法:
- 自动模式: 系统自动根据情感选择样式
- 手动模式: 设置 force_style=True 强制使用指定样式
""")

def main():
    """主测试函数"""
    print_summary()

    tests = [
        ("情感分析", test_sentiment_analysis),
        ("字幕生成", test_subtitle_generation),
        ("ASS文件生成", test_ass_file_generation),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        if test_func():
            passed += 1

    print("\n" + "=" * 60)
    print(f"测试结果: {passed}/{total} 通过")
    print("=" * 60)

    if passed == total:
        print("🎉 所有测试通过! 情感驱动字幕功能已就绪!")
        return 0
    else:
        print("⚠️  部分测试未通过，请检查配置")
        return 1

if __name__ == '__main__':
    sys.exit(main())