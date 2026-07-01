import os
from PIL import Image, ImageOps

def extract_region(img, box):
    # box is (x1, y1, x2, y2)
    x1, y1, x2, y2 = box
    w_orig, h_orig = img.size
    
    # Create cropped canvas
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
            
            # Gradient value at x_orig
            bg = x_orig * (115.0 / (w_orig - 1))
            
            a_req = 0.0
            for val in (r, g, b):
                # Constraint 1: C_f >= 0  => a >= (bg - C)/bg
                a1 = (bg - val) / bg if bg > 0 else 0.0
                # Constraint 2: C_f <= 255 => a >= (C - bg)/(255 - bg)
                a2 = (val - bg) / (255.0 - bg) if 255.0 - bg > 0 else 0.0
                a_req = max(a_req, a1, a2)
            
            a_req = min(max(a_req, 0.0), 1.0)
            
            # Filter out very low alpha noise
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

def make_centered_canvas(content, canvas_size, content_size_ratio=0.6, transparent=True, bg_gradient_source=None):
    # content_size_ratio is how much of the canvas the content should occupy
    w_c, h_c = content.size
    aspect = w_c / h_c
    
    # Determine new content dimensions
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
        # If we want the original gradient background
        if bg_gradient_source:
            canvas = bg_gradient_source.copy().resize(canvas_size, Image.Resampling.LANCZOS)
        else:
            canvas = Image.new("RGBA", canvas_size, (15, 23, 42, 255)) # Default to app bg slate-900 (#0F172A)
            
    # Paste centered
    offset = ((canvas_size[0] - new_w) // 2, (canvas_size[1] - new_h) // 2)
    canvas.paste(resized_content, offset, resized_content)
    return canvas

def main():
    input_path = "/home/jeevan/.gemini/antigravity-ide/brain/a2dd6afe-f377-428c-85cf-0782c178b908/media__1782899869502.png"
    assets_dir = "/home/jeevan/Desktop/my projects/shared living/assets"
    
    img = Image.open(input_path).convert("RGBA")
    
    # 1. Crop and extract Monogram (house logo symbol)
    # Monogram box: (293, 267, 732, 512)
    mono_box = (290, 260, 735, 520)
    print("Extracting monogram...")
    monogram = extract_region(img, mono_box)
    
    # Crop to content bbox to remove empty space inside the cropped box
    mono_bbox = monogram.getbbox()
    if mono_bbox:
        monogram = monogram.crop(mono_bbox)
    print(f"Monogram extracted, size: {monogram.size}")
    
    # 2. Crop and extract Text
    # Text box: (231, 675, 847, 842)
    text_box = (225, 670, 850, 850)
    print("Extracting text...")
    text = extract_region(img, text_box)
    text_bbox = text.getbbox()
    if text_bbox:
        text = text.crop(text_bbox)
    print(f"Text extracted, size: {text.size}")
    
    # 3. Generate adaptive-icon.png (foreground transparent monogram, centered, 1024x1024)
    print("Generating adaptive-icon.png...")
    adaptive_icon = make_centered_canvas(monogram, (1024, 1024), content_size_ratio=0.55, transparent=True)
    adaptive_icon.save(os.path.join(assets_dir, "adaptive-icon.png"), "PNG")
    adaptive_icon.save(os.path.join(assets_dir, "adaptive-icon-modified.png"), "PNG")
    
    # 4. Generate icon.png (monogram centered on gradient background, 1024x1024)
    print("Generating icon.png...")
    icon = make_centered_canvas(monogram, (1024, 1024), content_size_ratio=0.55, transparent=False, bg_gradient_source=img)
    icon.save(os.path.join(assets_dir, "icon.png"), "PNG")
    
    # 5. Generate favicon.png (48x48 transparent monogram)
    print("Generating favicon.png...")
    favicon = make_centered_canvas(monogram, (48, 48), content_size_ratio=0.8, transparent=True)
    favicon.save(os.path.join(assets_dir, "favicon.png"), "PNG")
    
    # 6. Generate splash.png (monogram + text centered on gradient background, 1024x1024)
    # We can create a vertical layout of monogram + spacing + text, and then place it centered.
    print("Generating splash.png...")
    # Combine monogram and text on a transparent canvas
    spacing = 40
    combo_w = max(monogram.width, text.width)
    combo_h = monogram.height + spacing + text.height
    combo = Image.new("RGBA", (combo_w, combo_h), (0, 0, 0, 0))
    # Paste monogram centered horizontally
    combo.paste(monogram, ((combo_w - monogram.width) // 2, 0), monogram)
    # Paste text centered horizontally
    combo.paste(text, ((combo_w - text.width) // 2, monogram.height + spacing), text)
    
    splash = make_centered_canvas(combo, (1024, 1024), content_size_ratio=0.55, transparent=True)
    splash.save(os.path.join(assets_dir, "splash.png"), "PNG")
    
    # 7. Generate logo.png (stacked vertical layout on transparent background, cropped to content, ~512x512)
    print("Generating logo.png...")
    logo_transparent = make_centered_canvas(combo, (512, 512), content_size_ratio=0.85, transparent=True)
    # Crop to final bounds to be tidy
    logo_bbox = logo_transparent.getbbox()
    if logo_bbox:
        logo_transparent = logo_transparent.crop(logo_bbox)
    logo_transparent.save(os.path.join(assets_dir, "logo.png"), "PNG")
    print(f"Saved logo.png: size={logo_transparent.size}")
    
    # 8. Generate logo_landscape.png (monogram and text side-by-side, transparent background)
    print("Generating logo_landscape.png...")
    land_spacing = 30
    # Center text vertically relative to monogram
    land_w = monogram.width + land_spacing + text.width
    land_h = max(monogram.height, text.height)
    land_combo = Image.new("RGBA", (land_w, land_h), (0, 0, 0, 0))
    # Paste monogram on the left
    mono_y = (land_h - monogram.height) // 2
    land_combo.paste(monogram, (0, mono_y), monogram)
    # Paste text on the right
    text_y = (land_h - text.height) // 2
    land_combo.paste(text, (monogram.width + land_spacing, text_y), text)
    
    logo_landscape = make_centered_canvas(land_combo, (1024, 384), content_size_ratio=0.85, transparent=True)
    land_bbox = logo_landscape.getbbox()
    if land_bbox:
        logo_landscape = logo_landscape.crop(land_bbox)
    logo_landscape.save(os.path.join(assets_dir, "logo_landscape.png"), "PNG")
    print(f"Saved logo_landscape.png: size={logo_landscape.size}")

if __name__ == "__main__":
    main()
