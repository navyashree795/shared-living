import os
from PIL import Image, ImageOps

logo_path = "/home/jeevan/Desktop/my projects/shared living/assets/logo.png"
output_path = "/home/jeevan/Desktop/my projects/shared living/assets/logo_landscape.png"

if os.path.exists(logo_path):
    img = Image.open(logo_path)
    width, height = img.size

    # Convert to grayscale and invert to find navy blue pixels (which become light on black bg)
    gray = img.convert("L")
    inverted = ImageOps.invert(gray)

    # Monogram is in the top 65% of the image height, text is in the bottom 35%
    split_y = int(height * 0.65)

    # Get bounding box for monogram
    mono_inverted = inverted.crop((0, 0, width, split_y))
    mono_bbox = mono_inverted.getbbox()
    if mono_bbox:
        monogram_img = img.crop(mono_bbox)
    else:
        monogram_img = img.crop((0, 0, width, split_y))

    # Get bounding box for text
    text_inverted = inverted.crop((0, split_y, width, height))
    text_bbox = text_inverted.getbbox()
    if text_bbox:
        actual_text_bbox = (text_bbox[0], text_bbox[1] + split_y, text_bbox[2], text_bbox[3] + split_y)
        text_img = img.crop(actual_text_bbox)
    else:
        text_img = img.crop((0, split_y, width, height))

    # Create landscape canvas
    # Layout: [Monogram] <spacing> [Text]
    spacing = 24
    padding_x = 40
    padding_y = 40

    new_width = monogram_img.width + spacing + text_img.width + (padding_x * 2)
    new_height = max(monogram_img.height, text_img.height) + (padding_y * 2)

    # Create new white background canvas
    canvas = Image.new("RGB", (new_width, new_height), "#FFFFFF")

    # Center items vertically on the canvas
    mono_y = (new_height - monogram_img.height) // 2
    canvas.paste(monogram_img, (padding_x, mono_y))

    text_y = (new_height - text_img.height) // 2
    canvas.paste(text_img, (padding_x + monogram_img.width + spacing, text_y))

    # Save landscape version
    canvas.save(output_path, "PNG")
    print(f"Successfully generated side-by-side logo at {output_path} (size: {new_width}x{new_height})")

else:
    print("Base logo.png not found!")
