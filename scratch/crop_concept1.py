import os
from PIL import Image

grid_image_path = "/home/jeevan/.gemini/antigravity-ide/brain/43cd4623-e273-4373-b1ef-1d0ca24f5812/house_sync_lettermark_logos_1782896344166.png"
output_path = "/home/jeevan/Desktop/my projects/shared living/assets/logo.png"

if os.path.exists(grid_image_path):
    img = Image.open(grid_image_path)
    # The grid image is 1024x1024. Crop the top-left quadrant (Concept 1)
    # Crop slightly inside 0-512 to avoid border edges
    cropped = img.crop((15, 15, 497, 497))
    cropped.save(output_path, "PNG")
    print("Successfully cropped Concept 1 and saved to assets/logo.png")
else:
    print("Grid image not found!")
