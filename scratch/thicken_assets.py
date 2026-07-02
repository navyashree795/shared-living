import os
from PIL import Image, ImageOps, ImageFilter

def extract_region(img, box):
    x1, y1, x2, y2 = box
    w_orig, h_orig = img.size
    
    w = x2 - x1
    h = y2 - y1
    region = Image.new("RGBA", (w, h))
    reg_pixels = region.load()
    in_pixels = img.load()
    
    for y in range(h):
        y_orig = y1 + y
        for x in range(w):
            x_orig = x1 + x
            r, g, b, a = in_pixels[x_orig, y_orig]
            bg = x_orig * (115.0 / (w_orig - 1))
            
            a_req = 0.0
            for val in (r, g, b):
                a1 = (bg - val) / bg if bg > 0 else 0.0
                a2 = (val - bg) / (255.0 - bg) if 255.0 - bg > 0 else 0.0
                a_req = max(a_req, a1, a2)
            
            a_req = min(max(a_req, 0.0), 1.0)
            
            if a_req > 0.08:
                rf = int(round((r - (1 - a_req) * bg) / a_req))
                gf = int(round((g - (1 - a_req) * bg) / a_req))
                bf = int(round((b - (1 - a_req) * bg) / a_req))
                rf = min(max(rf, 0), 255)
                gf = min(max(gf, 0), 255)
                bf = min(max(bf, 0), 255)
                reg_pixels[x, y] = (rf, gf, bf, int(round(a_req * 255)))
            else:
                reg_pixels[x, y] = (0, 0, 0, 0)
                
    return region

def boost_image_alpha(img):
    w, h = img.size
    pixels = img.load()
    
    max_alpha = 0
    for y in range(h):
        for x in range(w):
            _, _, _, a = pixels[x, y]
            max_alpha = max(max_alpha, a)
            
    if max_alpha == 0:
        return img
        
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0:
                # Boost alpha using power curve to make it bold and solid
                new_a = int(round(((a / max_alpha) ** 0.3) * 255))
                new_a = min(max(new_a, 0), 255)
                pixels[x, y] = (r, g, b, new_a)
    return img

def make_centered_canvas(content, canvas_size, content_size_ratio=0.6, transparent=True, bg_gradient_source=None):
    w_c, h_c = content.size
    aspect = w_c / h_c
    
    target_canvas_w, target_canvas_h = canvas_size
    if aspect > 1.0:
        new_w = int(target_canvas_w * content_size_ratio)
        new_h = int(new_w / aspect)
    else:
        new_h = int(target_canvas_h * content_size_ratio)
        new_w = int(new_h * aspect)
        
    resized_content = content.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    if transparent:
        canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    else:
        if bg_gradient_source:
            canvas = bg_gradient_source.copy().resize(canvas_size, Image.Resampling.LANCZOS)
        else:
            canvas = Image.new("RGBA", canvas_size, (15, 23, 42, 255))
            
    offset = ((canvas_size[0] - new_w) // 2, (canvas_size[1] - new_h) // 2)
    canvas.paste(resized_content, offset, resized_content)
    return canvas

def main():
    input_path = "/home/jeevan/.gemini/antigravity-ide/brain/a2dd6afe-f377-428c-85cf-0782c178b908/media__1782899869502.png"
    assets_dir = "/home/jeevan/Desktop/my projects/shared living/assets"
    
    img = Image.open(input_path).convert("RGBA")
    
    # 1. Crop and extract Monogram
    mono_box = (290, 260, 735, 512)
    print("Extracting monogram...")
    monogram = extract_region(img, mono_box)
    
    # Crop to content bbox
    mono_bbox = monogram.getbbox()
    if mono_bbox:
        monogram = monogram.crop(mono_bbox)
    
    # Apply thickening filter to make the monogram line work bolder
    print("Thickening monogram...")
    monogram = monogram.filter(ImageFilter.MaxFilter(3))
    monogram = boost_image_alpha(monogram)
    print(f"Monogram thickened, size: {monogram.size}")
    
    # 2. Crop and extract Text (Crop ONLY "House Sync" title, excluding old tagline)
    text_box = (225, 670, 850, 782)
    print("Extracting brand title text...")
    title_img = extract_region(img, text_box)
    
    title_bbox = title_img.getbbox()
    if title_bbox:
        title_img = title_img.crop(title_bbox)
        
    # Apply thickening filter to make the logo text bolder
    print("Thickening brand title...")
    title_img = title_img.filter(ImageFilter.MaxFilter(3))
    title_img = boost_image_alpha(title_img)
    
    # Programmatically render the new tagline: "Shared living & travel made simpler"
    from PIL import ImageDraw, ImageFont
    spacing = 16
    font_size = 23
    tagline_text = "Shared living & travel made simpler"
    
    # Create canvas for title + tagline
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    font = ImageFont.truetype(font_path, font_size)
    
    # Measure tagline
    dummy_draw = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    tag_bbox = dummy_draw.textbbox((0, 0), tagline_text, font=font)
    tag_w = tag_bbox[2] - tag_bbox[0]
    tag_h = tag_bbox[3] - tag_bbox[1]
    
    text_w = max(title_img.width, tag_w + 20)
    text_h = title_img.height + spacing + tag_h + 10
    
    text = Image.new("RGBA", (text_w, text_h), (0, 0, 0, 0))
    # Paste title centered
    title_x = (text_w - title_img.width) // 2
    text.paste(title_img, (title_x, 0), title_img)
    
    # Draw new tagline centered
    draw = ImageDraw.Draw(text)
    tag_x = (text_w - tag_w) // 2
    tag_y = title_img.height + spacing
    
    # Use light blue/gray color matching original logo
    draw.text((tag_x, tag_y), tagline_text, font=font, fill=(173, 214, 244, 255))
    print(f"New brand text graphic generated, size: {text.size}")
    
    # 3. Generate adaptive-icon.png
    print("Generating adaptive-icon.png...")
    adaptive_icon = make_centered_canvas(monogram, (1024, 1024), content_size_ratio=0.55, transparent=True)
    adaptive_icon.save(os.path.join(assets_dir, "adaptive-icon.png"), "PNG")
    
    # 4. Generate icon.png
    print("Generating icon.png...")
    icon = make_centered_canvas(monogram, (1024, 1024), content_size_ratio=0.55, transparent=False, bg_gradient_source=img)
    icon.save(os.path.join(assets_dir, "icon.png"), "PNG")
    
    # 5. Generate favicon.png
    print("Generating favicon.png...")
    favicon = make_centered_canvas(monogram, (48, 48), content_size_ratio=0.8, transparent=True)
    favicon.save(os.path.join(assets_dir, "favicon.png"), "PNG")
    
    # 6. Generate splash.png
    print("Generating splash.png...")
    spacing = 40
    combo_w = max(monogram.width, text.width)
    combo_h = monogram.height + spacing + text.height
    combo = Image.new("RGBA", (combo_w, combo_h), (0, 0, 0, 0))
    combo.paste(monogram, ((combo_w - monogram.width) // 2, 0), monogram)
    combo.paste(text, ((combo_w - text.width) // 2, monogram.height + spacing), text)
    
    splash = make_centered_canvas(combo, (1024, 1024), content_size_ratio=0.55, transparent=True)
    splash.save(os.path.join(assets_dir, "splash.png"), "PNG")
    
    # 7. Generate logo.png
    print("Generating logo.png...")
    logo_transparent = make_centered_canvas(combo, (512, 512), content_size_ratio=0.85, transparent=True)
    logo_bbox = logo_transparent.getbbox()
    if logo_bbox:
        logo_transparent = logo_transparent.crop(logo_bbox)
    logo_transparent.save(os.path.join(assets_dir, "logo.png"), "PNG")
    
    # 8. Generate logo_landscape.png
    print("Generating logo_landscape.png...")
    land_spacing = 30
    land_w = monogram.width + land_spacing + text.width
    land_h = max(monogram.height, text.height)
    land_combo = Image.new("RGBA", (land_w, land_h), (0, 0, 0, 0))
    mono_y = (land_h - monogram.height) // 2
    land_combo.paste(monogram, (0, mono_y), monogram)
    text_y = (land_h - text.height) // 2
    land_combo.paste(text, (monogram.width + land_spacing, text_y), text)
    
    logo_landscape = make_centered_canvas(land_combo, (1024, 384), content_size_ratio=0.85, transparent=True)
    land_bbox = logo_landscape.getbbox()
    if land_bbox:
        logo_landscape = logo_landscape.crop(land_bbox)
    logo_landscape.save(os.path.join(assets_dir, "logo_landscape.png"), "PNG")
    print("All assets successfully thickened and regenerated!")

if __name__ == "__main__":
    main()
