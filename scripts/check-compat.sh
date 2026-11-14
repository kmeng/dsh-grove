#!/bin/bash
# 自动选对运行时再判定 engines.dsh：Desktop 的 dsh 在 app.asar 里，普通 node 读不到。
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${DSH_INSTALL_DIR:-}" == *".asar"* && -n "${DSH_NODE_EXECUTABLE:-}" ]]; then
  ELECTRON_RUN_AS_NODE=1 "$DSH_NODE_EXECUTABLE" scripts/check-compat.mjs
else
  node scripts/check-compat.mjs
fi
