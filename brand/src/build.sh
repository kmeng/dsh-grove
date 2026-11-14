#!/bin/bash
# 重新生成 brand/exports 下的全部 PNG。在 brand/src 目录执行。
set -euo pipefail
cd "$(dirname "$0")"
. ./render.sh
out=../exports
mkdir -p "$out"

render_svg ../mark.svg "$out/icon-1024.png" 1024 1024
render_svg ../mark.svg "$out/icon-512.png" 512 512
render_svg ../mark.svg "$out/icon-180.png" 180 180
render_html icon-tile.html "$out/icon-180-tile.png" 180 180
render_svg ../logo-light.svg "$out/logo-light.png" 528 160
render_svg ../logo-dark.svg "$out/logo-dark.png" 528 160
render_html social-preview.html "$out/social-preview-1280x640.png" 1280 640
render_html readme-header.html "$out/readme-header-1600x480.png" 1600 480
render_html overview.html "$out/overview.png" 1600 1040

echo "已生成："
ls -1 "$out"
