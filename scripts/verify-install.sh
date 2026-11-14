#!/bin/bash
# 在一个临时 profile 里真实安装本包，确认 grove 行真的出现在 composition 里，然后删掉该 profile。
# 用法：bash scripts/verify-install.sh        （可用 GROVE_TEST_PROFILE 换个名字）
set -euo pipefail
cd "$(dirname "$0")/.."

profile="${GROVE_TEST_PROFILE:-grove-install-check}"
profiles_dir="${DSH_HOME:-$HOME/.dsh}/profiles"

if [ -e "$profiles_dir/$profile" ]; then
  echo "profile 已存在：$profiles_dir/$profile；换个名字：GROVE_TEST_PROFILE=... bash scripts/verify-install.sh" >&2
  exit 2
fi

if [[ "${DSH_INSTALL_DIR:-}" == *".asar"* && -n "${DSH_NODE_EXECUTABLE:-}" ]]; then
  dsh=(env ELECTRON_RUN_AS_NODE=1 "$DSH_NODE_EXECUTABLE" "$DSH_INSTALL_DIR/lib/bin.js")
elif command -v dsh >/dev/null 2>&1; then
  dsh=(dsh)
else
  echo "找不到 dsh。请安装 dsh，或在 Desktop 会话里运行本脚本。" >&2
  exit 2
fi

cleanup() { rm -rf "$profiles_dir/$profile"; }
trap cleanup EXIT

"${dsh[@]}" plugin --profile "$profile" add "$PWD"
if ! "${dsh[@]}" --profile "$profile" --dump-config | grep -q '^  name: dsh-grove$'; then
  echo "安装后 composition 里没有 grove 行——bundle 可能被判不兼容。" >&2
  exit 1
fi

echo "ok：grove 行已出现在 $profile 的 composition 里（profile 已清理）"
