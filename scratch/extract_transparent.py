import os
from PIL import Image

def extract_foreground(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    
    # Create output image
    out_img = Image.new("RGBA", (w, h))
    out_pixels = out_img.load()
    in_pixels = img.load()
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = in_pixels[x, y]
            
            # Background is a horizontal linear gradient from (0,0,0) to (115,115,115)
            bg = x * (115.0 / (w - 1))
            
            # Calculate minimum alpha to keep reconstructed channels in [0, 255]
            # Channels: R, G, B
            a_req = 0.0
            for val in (r, g, b):
                # Constraint 1: C_f >= 0  => a >= (bg - C)/bg
                if bg > 0:
                    a1 = (bg - val) / bg
                else:
                    a1 = 0.0
                
                # Constraint 2: C_f <= 255 => a >= (C - bg)/(255 - bg)
                if 255.0 - bg > 0:
                    a2 = (val - bg) / (255.0 - bg)
                else:
                    a2 = 0.0
                
                a_req = max(a_req, a1, a2)
            
            # Clamp alpha to [0, 1]
            a_req = min(max(a_req, 0.0), 1.0)
            
            if a_req > 0.05:
                # Reconstruct foreground color
                rf = int(round((r - (1 - a_req) * bg) / a_req))
                gf = int(round((g - (1 - a_req) * bg) / a_req))
                bf = int(round((b - (1 - a_req) * bg) / a_req))
                
                # Clamp colors to [0, 255]
                rf = min(max(rf, 0), 255)
                gf = min(max(gf, 0), 255)
                bf = min(max(bf, 0), 255)
                
                # Set pixel with the calculated alpha
                out_pixels[x, y] = (rf, gf, bf, int(round(a_req * 255)))
            else:
                out_pixels[x, y] = (0, 0, 0, 0)
                
    out_img.save(output_path, "PNG")
    print(f"Extracted transparent foreground saved to {output_path}")

input_img = "/home/jeevan/.gemini/antigravity-ide/brain/a2dd6afe-f377-428c-85cf-0782c178b908/media__1782899869502.png"
output_img = "/home/jeevan/Desktop/my projects/shared living/scratch/logo_transparent.png"
extract_foreground(input_img, output_img)
