#!/bin/bash
# 用 Chrome 把品牌资产渲染成 PNG。Chrome 路径可用 CHROME 覆盖。
set -euo pipefail
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "找不到 Chrome：$CHROME（用 CHROME=/path/to/chrome 覆盖）" >&2; exit 1; }

# render_svg <svg> <out.png> <宽> <高> [背景色，默认透明]
render_svg() {
  local svg="$1" out="$2" w="$3" h="$4" bg="${5:-transparent}" page
  page="$(mktemp -t grove-render).html"
  printf '<html><body style="margin:0;background:%s;overflow:hidden"><img src="file://%s" style="display:block;width:%dpx;height:%dpx;object-fit:contain"></body></html>' \
    "$bg" "$(cd "$(dirname "$svg")" && pwd)/$(basename "$svg")" "$w" "$h" >"$page"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --window-size="$w,$h" --screenshot="$out" "file://$page" >/dev/null 2>&1
  rm -f "$page"
}

# render_html <html> <out.png> <宽> <高>
render_html() {
  local html="$1" out="$2" w="$3" h="$4"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$w,$h" --screenshot="$out" "file://$(cd "$(dirname "$html")" && pwd)/$(basename "$html")" >/dev/null 2>&1
}
