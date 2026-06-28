import os
from PIL import Image

def resize_and_center_icon(filepath, target_size=1024, content_size=600):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    # Load original image
    im = Image.open(filepath)
    print(f"Original image {filepath}: size={im.size}, mode={im.mode}")

    # Resize original image to the content size (maintaining aspect ratio)
    im_resized = im.resize((content_size, content_size), Image.Resampling.LANCZOS)

    # Create a new white background canvas (RGB)
    canvas = Image.new("RGB", (target_size, target_size), "#FFFFFF")

    # Paste the resized image into the center
    offset = ((target_size - content_size) // 2, (target_size - content_size) // 2)
    canvas.paste(im_resized, offset)

    # Save it back
    canvas.save(filepath, "PNG")
    print(f"Saved resized and centered icon to {filepath}")

# Resize both icon and adaptive-icon
resize_and_center_icon("assets/adaptive-icon.png")
resize_and_center_icon("assets/icon.png")
