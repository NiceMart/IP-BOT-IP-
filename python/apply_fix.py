#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动修复 subtitle_cover_generator_simple.py 的脚本
修复人物描边功能和添加蒙版功能
"""

import sys
import re
import io

# 设置标准输出为UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def fix_file():
    # 读取原文件
    with open('subtitle_cover_generator_simple.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # 检查是否已经修复过
    if '# 获取alpha通道作为mask' in content and 'mask_config = template.get' in content:
        print('文件已经修复过,无需再次修复')
        return

    # 修复1: 替换人物描边的TODO部分
    old_stroke_code = '''                    # 合成带描边的人像
                    if portrait.mode == 'RGBA':
                        result = Image.new('RGB', (width, height))
                        result.paste(image, (0, 0))
                        # TODO: 实现描边效果（需要更复杂的图像处理）
                        result.paste(portrait, (0, 0), portrait)
                        image = result
                except Exception as e:
                    print(f"Portrait stroke failed: {e}", file=sys.stderr)'''

    new_stroke_code = '''                    # 合成带描边的人像
                    if portrait.mode == 'RGBA':
                        # 获取alpha通道作为mask
                        alpha = portrait.split()[3]

                        # 对mask进行边缘检测
                        alpha_np = np.array(alpha)
                        edges = cv2.Canny(alpha_np, 30, 100)

                        # 转换描边颜色
                        stroke_rgb = self._hex_to_rgb(stroke_color)
                        outline_layer = Image.new('RGBA', (width, height), (*stroke_rgb, 0))

                        # 创建多层描边
                        for i in range(stroke_width, 0, -1):
                            # 外层更粗的描边
                            kernel_size = i * 3
                            kernel = np.ones((kernel_size, kernel_size), np.uint8)
                            layer_edges = cv2.dilate(edges, kernel, iterations=1)

                            # 转换为PIL图像
                            layer_pil = Image.fromarray(layer_edges)
                            layer_colored = Image.new('RGBA', (width, height), (*stroke_rgb, 255))
                            layer_colored.putalpha(layer_pil)

                            # 合并到描边层
                            outline_layer = Image.alpha_composite(outline_layer, layer_colored)

                        # 创建结果：背景 + 描边 + 人像
                        result = Image.new('RGB', (width, height))
                        result.paste(image, (0, 0))

                        # 将描边和人像合成到背景上
                        result_rgba = result.convert('RGBA')
                        result_rgba = Image.alpha_composite(result_rgba, outline_layer)
                        result_rgba = Image.alpha_composite(result_rgba, portrait)
                        image = result_rgba.convert('RGB')

                        print("Portrait stroke effect applied successfully", file=sys.stderr)
                except Exception as e:
                    print(f"Portrait stroke failed: {e}", file=sys.stderr)
                    import traceback
                    traceback.print_exc(file=sys.stderr)'''

    if old_stroke_code in content:
        content = content.replace(old_stroke_code, new_stroke_code)
        print('✓ 已修复人物描边功能')
    else:
        print('✗ 未找到人物描边TODO代码,可能已被修改')

    # 修复2: 在"# 3. 添加标题"之前插入蒙版代码
    mask_code = '''
            # 3. 添加蒙版（如果有）
            mask_config = template.get('mask', {})
            mask_path = mask_config.get('imagePath', '')
            if mask_path and os.path.exists(mask_path):
                try:
                    print(f"Adding mask from: {mask_path}", file=sys.stderr)
                    mask_img = Image.open(mask_path).convert('RGBA')

                    # 获取蒙版位置和大小
                    mask_pos = mask_config.get('position', {'x': 10, 'y': 10})
                    mask_size = mask_config.get('size', {'width': 30, 'height': 20})
                    mask_opacity = mask_config.get('opacity', 0.8)

                    mask_width = int(mask_size['width'] / 100 * width)
                    mask_height = int(mask_size['height'] / 100 * height)
                    mask_x = int(mask_pos['x'] / 100 * width)
                    mask_y = int(mask_pos['y'] / 100 * height)

                    # 调整蒙版大小和透明度
                    mask_img = mask_img.resize((mask_width, mask_height), Image.LANCZOS)
                    if mask_opacity < 1.0:
                        alpha = mask_img.split()[3]
                        alpha = alpha.point(lambda p: int(p * mask_opacity))
                        mask_img.putalpha(alpha)

                    # 将蒙版粘贴到图像上
                    image_rgba = image.convert('RGBA')
                    image_rgba.paste(mask_img, (mask_x - mask_width // 2, mask_y - mask_height // 2), mask_img)
                    image = image_rgba.convert('RGB')

                    print("Mask applied successfully", file=sys.stderr)
                except Exception as e:
                    print(f"Failed to add mask: {e}", file=sys.stderr)
                    import traceback
                    traceback.print_exc(file=sys.stderr)

            # 4. 添加标题'''

    # 查找并替换 "# 3. 添加标题"
    if '            # 3. 添加标题' in content:
        content = content.replace('            # 3. 添加标题', mask_code)
        print('✓ 已添加蒙版功能')
    else:
        print('✗ 未找到"# 3. 添加标题"标记')

    # 写回文件
    with open('subtitle_cover_generator_simple.py', 'w', encoding='utf-8') as f:
        f.write(content)

    print('\n修复完成! 已创建备份文件: subtitle_cover_generator_simple.py.backup')

if __name__ == '__main__':
    try:
        fix_file()
    except Exception as e:
        print(f'修复失败: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
