#!/usr/bin/env python3
"""
inject_logo.py
Reads the Base64-encoded logo, finds the brand header block inside
travel_wrap_web.html and replaces the SVG house icon + text with the
real House Sync logo image tag.
"""
import re, pathlib

HTML_PATH  = pathlib.Path("/home/jeevan/Desktop/my projects/shared living/public/travel_wrap_web.html")
B64_PATH   = pathlib.Path("/tmp/logo_b64.txt")

b64 = B64_PATH.read_text().strip()
data_uri = f"data:image/png;base64,{b64}"

html = HTML_PATH.read_text()

# ── 1. Add CSS for the logo img into the <style> block ──────────────
logo_css = """
    /* Real House Sync logo image */
    .hs-logo {
      height: 30px;
      width: auto;
      /* Dark filter for the white card header (logo has light text on transparent bg) */
      filter: brightness(0) saturate(100%) invert(22%) sepia(60%) saturate(600%) hue-rotate(213deg) brightness(90%);
    }
"""

# Insert before closing </style>
html = html.replace("  </style>", logo_css + "  </style>", 1)

# ── 2. Replace the JS svgHouseIcon() helper and brand name span ──────
# The current header renders:
#   <div class="brand-icon">${svgHouseIcon()}</div>
#   <span class="brand-name">House Sync</span>
# We replace it with just the logo <img>.

old_header_js = """    <!-- Header -->
    <div class="card-header">
      <div>
        <div class="brand-row">
          <div class="brand-icon">${svgHouseIcon()}</div>
          <span class="brand-name">House Sync</span>
        </div>
        <div class="brand-tagline">Shared living made simpler</div>
      </div>
      <button class="share-btn">${svgShareIcon()}</button>
    </div>"""

new_header_js = f"""    <!-- Header -->
    <div class="card-header">
      <img class="hs-logo" src="{data_uri}" alt="House Sync">
      <button class="share-btn">${{svgShareIcon()}}</button>
    </div>"""

if old_header_js in html:
    html = html.replace(old_header_js, new_header_js)
    print("✅  Header block replaced with logo img tag.")
else:
    print("⚠️  Could not find the exact header block — check indentation.")
    # Fallback: patch just the brand-row div
    html = re.sub(
        r'<div class="brand-row">.*?</div>\s*<div class="brand-tagline">.*?</div>',
        f'<img class="hs-logo" src="{data_uri}" alt="House Sync">',
        html,
        flags=re.DOTALL
    )
    print("✅  Fallback regex replacement applied.")

HTML_PATH.write_text(html)
print(f"✅  Saved to {HTML_PATH}")
print(f"    Final file size: {HTML_PATH.stat().st_size / 1024:.1f} KB")
