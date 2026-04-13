#!/bin/bash
# Script to zoom out icons using ImageMagick

# Function to zoom out an image
zoom_out() {
  local input=$1
  local output=$2
  local scale=$3
  echo "Processing $input -> $output (scale: $scale%)"
  convert "$input" -resize "$scale%" -background white -gravity center -extent 1024x1024 "$output"
}

# Zoom out the adaptive icon
zoom_out assets/adaptive-icon.png assets/adaptive-icon.png 70

# Zoom out the main icon
zoom_out assets/icon.png assets/icon.png 70

echo "Done!"
