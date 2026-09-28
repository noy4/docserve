#!/bin/bash
# Bake rounded corners + a 1px border into a screenshot for README use
# (GitHub renders <img> without CSS, so the frame must be baked in).
# Corners outside the radius stay transparent.
#
# Usage: cardify.sh <input.png> <output.webp> [radius] [border-color]
# Defaults: radius 8, border #30363d (GitHub dark-theme border gray)
set -euo pipefail

in=${1:?usage: cardify.sh <input.png> <output.webp> [radius] [border-color]}
out=${2:?usage: cardify.sh <input.png> <output.webp> [radius] [border-color]}
radius=${3:-8}
color=${4:-#30363d}

w=$(magick "$in" -format "%w" info:)
h=$(magick "$in" -format "%h" info:)
ir=$((radius > 0 ? radius - 1 : 0))

tmp=$(mktemp /tmp/cardify-XXXX.png)
trap 'rm -f "$tmp"' EXIT

magick "$in" \
  \( -size "${w}x${h}" xc:black -fill white -draw "roundrectangle 0,0 $((w-1)) $((h-1)) $radius $radius" \) \
  -alpha off -compose CopyOpacity -composite \
  \( -size "${w}x${h}" xc:none -strokewidth 1 -stroke "$color" -fill none \
     -draw "roundrectangle 0.5,0.5 $((w-1.5)) $((h-1.5)) $ir $ir" \) \
  -compose over -composite "$tmp"

cwebp -quiet "$tmp" -o "$out"
