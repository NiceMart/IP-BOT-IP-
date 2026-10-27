#!/usr/bin/env python3
"""
数字人处理脚本
用于调用 Gradio API 生成数字人视频
"""

import sys
import json


def main():
    if len(sys.argv) < 4:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": "参数不足: 需要 api_url, audio_file, video_file",
                }
            )
        )
        sys.exit(1)

    api_url = sys.argv[1]
    audio_file = sys.argv[2]
    video_file = sys.argv[3]

    try:
        from gradio_client import Client, handle_file

        client = Client(api_url)
        result = client.predict(
            audio_file=handle_file(audio_file),
            video_file={"video": handle_file(video_file)},
            api_name="/process_single",
        )

        if isinstance(result, dict) and result.get("video"):
            print(
                json.dumps(
                    {
                        "success": True,
                        "videoPath": result["video"],
                        "subtitles": result.get("subtitles"),
                    }
                )
            )
            sys.exit(0)

        print(
            json.dumps(
                {"success": False, "error": f"未获取到视频结果: {str(result)[:500]}"}
            )
        )
        sys.exit(1)

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
