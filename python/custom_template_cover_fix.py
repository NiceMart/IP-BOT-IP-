#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自定义模板封面修复补丁
将这段代码复制到 subtitle_cover_generator_simple.py 替换 _generate_custom_template_cover 方法
"""

def _generate_custom_template_cover(self, frame):
    """
    使用自定义模板生成封面 (修复版)

    Args:
        frame: 视频帧

    Returns:
        生成的封面路径
    """
    try:
        print("Generating custom template cover (fixed version)...", file=sys.stderr)
        template = self.template

        # 转换为PIL图像
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        width, height = image.size

        # 1. 应用背景模糊
        if template.get('background', {}).get('blurEnabled', False):
            blur_radius = template['background'].get('blurRadius', 15)
            print(f"Applying background blur: {blur_radius}", file=sys.stderr)
            image = image.filter(ImageFilter.GaussianBlur(radius=blur_radius))

        # 2. 处理人像描边（如果启用RMBG）
        if template.get('portrait', {}).get('strokeEnabled', False):
            if RMBG_AVAILABLE:
                try:
                    print("Extracting portrait for stroke effect...", file=sys.stderr)
                    portrait = rembg_remove(image)

                    # 创建描边效果
                    stroke_color = template['portrait'].get('strokeColor', '#FFD700')
                    stroke_width = template['portrait'].get('strokeWidth', 3)
                    stroke_type = template['portrait'].get('strokeType', 'solid')

                    print(f"Stroke: color={stroke_color}, width={stroke_width}, type={stroke_type}", file=sys.stderr)

                    # 合成带描边的人像
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
                    traceback.print_exc(file=sys.stderr)
            else:
                print("RMBG not available, skipping portrait stroke", file=sys.stderr)

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

        # 4. 添加标题
        draw = ImageDraw.Draw(image)

        # 加载字体
        try:
            font_main = ImageFont.truetype("msyh.ttc", template['titles']['main'].get('fontSize', 60))
            font_sub = ImageFont.truetype("msyh.ttc", template['titles']['sub'].get('fontSize', 40))
        except:
            try:
                font_main = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", template['titles']['main'].get('fontSize', 60))
                font_sub = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", template['titles']['sub'].get('fontSize', 40))
            except:
                font_main = ImageFont.load_default()
                font_sub = ImageFont.load_default()
                print("Warning: Failed to load custom font, using default", file=sys.stderr)

        # 绘制主标题（支持自动换行）
        main_title = template['titles']['main']
        if main_title.get('text'):
            main_text = main_title['text']
            main_color = self._hex_to_rgb(main_title.get('color', '#FFFFFF'))
            main_pos_x = int(width * main_title['position']['x'] / 100)
            main_pos_y = int(height * main_title['position']['y'] / 100)
            max_chars_per_line = main_title.get('maxLength', 4)  # 每行最多字符数

            # 将文字分行
            lines = []
            for i in range(0, len(main_text), max_chars_per_line):
                lines.append(main_text[i:i + max_chars_per_line])

            # 计算行高和总高度
            line_height = int(font_main.size * 1.2)  # 行高为字体大小的1.2倍
            total_height = len(lines) * line_height

            # 计算起始Y坐标，使多行文字垂直居中
            start_y = main_pos_y - total_height // 2 + line_height // 2

            # 逐行绘制
            for i, line in enumerate(lines):
                line_y = start_y + i * line_height

                # 绘制描边
                if main_title.get('strokeWidth', 0) > 0:
                    stroke_color = self._hex_to_rgb(main_title.get('strokeColor', '#000000'))
                    for offset_x in range(-main_title['strokeWidth'], main_title['strokeWidth'] + 1):
                        for offset_y in range(-main_title['strokeWidth'], main_title['strokeWidth'] + 1):
                            if offset_x == 0 and offset_y == 0:
                                continue
                            draw.text((main_pos_x + offset_x, line_y + offset_y),
                                     line, font=font_main, fill=stroke_color, anchor='mm')

                # 绘制主体
                draw.text((main_pos_x, line_y), line, font=font_main, fill=main_color, anchor='mm')

            print(f"Drew main title: '{main_text}' ({len(lines)} lines) at ({main_pos_x}, {main_pos_y})", file=sys.stderr)

        # 绘制副标题（支持自动换行）
        sub_title = template['titles']['sub']
        if sub_title.get('text'):
            sub_text = sub_title['text']
            sub_color = self._hex_to_rgb(sub_title.get('color', '#FFFFFF'))
            sub_pos_x = int(width * sub_title['position']['x'] / 100)
            sub_pos_y = int(height * sub_title['position']['y'] / 100)
            max_chars_per_line = sub_title.get('maxLength', 3)  # 每行最多字符数

            # 将文字分行
            lines = []
            for i in range(0, len(sub_text), max_chars_per_line):
                lines.append(sub_text[i:i + max_chars_per_line])

            # 计算行高和总高度
            line_height = int(font_sub.size * 1.2)  # 行高为字体大小的1.2倍
            total_height = len(lines) * line_height

            # 计算起始Y坐标，使多行文字垂直居中
            start_y = sub_pos_y - total_height // 2 + line_height // 2

            # 逐行绘制
            for i, line in enumerate(lines):
                line_y = start_y + i * line_height

                # 绘制描边
                if sub_title.get('strokeWidth', 0) > 0:
                    stroke_color = self._hex_to_rgb(sub_title.get('strokeColor', '#000000'))
                    for offset_x in range(-sub_title['strokeWidth'], sub_title['strokeWidth'] + 1):
                        for offset_y in range(-sub_title['strokeWidth'], sub_title['strokeWidth'] + 1):
                            if offset_x == 0 and offset_y == 0:
                                continue
                            draw.text((sub_pos_x + offset_x, line_y + offset_y),
                                     line, font=font_sub, fill=stroke_color, anchor='mm')

                # 绘制主体
                draw.text((sub_pos_x, line_y), line, font=font_sub, fill=sub_color, anchor='mm')

            print(f"Drew sub title: '{sub_text}' ({len(lines)} lines) at ({sub_pos_x}, {sub_pos_y})", file=sys.stderr)

        # 保存封面
        cover_path = os.path.join(self.output_dir, 'cover_custom_template.png')
        image.save(cover_path, quality=95)

        print(f"Custom template cover generated successfully: {cover_path}", file=sys.stderr)
        return cover_path

    except Exception as e:
        print(f"Error generating custom template cover: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        raise Exception(f"Custom template cover generation failed: {str(e)}")
