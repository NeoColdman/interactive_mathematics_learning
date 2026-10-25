#!/bin/bash
set -u

PROJECT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)" || exit 1
cd "$PROJECT_DIR" || exit 1
NODE_BIN=""

accept_node() {
  local candidate="$1"
  local major=""
  if [ ! -x "$candidate" ]; then return 1; fi
  major="$("$candidate" -p 'process.versions.node.split(".")[0]' 2>/dev/null)" || return 1
  if [ "$major" = "22" ] || [ "$major" = "24" ]; then
    NODE_BIN="$candidate"
    return 0
  fi
  return 1
}

for candidate in "$PROJECT_DIR/runtime/bin/node" "$PROJECT_DIR/runtime/node"; do
  if accept_node "$candidate"; then break; fi
done

if [ -z "$NODE_BIN" ]; then
  candidate="$(command -v node 2>/dev/null || true)"
  if [ -n "$candidate" ]; then accept_node "$candidate" || true; fi
fi

# A Finder-launched Terminal may not load the user's nvm shell setup.
if [ -z "$NODE_BIN" ]; then
  for candidate in "$HOME"/.nvm/versions/node/v24.*/bin/node "$HOME"/.nvm/versions/node/v22.*/bin/node /opt/homebrew/bin/node /usr/local/bin/node; do
    if accept_node "$candidate"; then break; fi
  done
fi

if [ -z "$NODE_BIN" ]; then
  echo "首次准备：请先从 https://nodejs.org/ 安装 Node.js 24（或22），再双击本文件。"
  echo "也可以由熟悉电脑的人把匹配此电脑的 Node 放到项目 runtime/bin/node。"
  echo "本程序不会自动安装软件或修改系统配置。"
  read -r -p "按回车关闭窗口……" _
  exit 1
fi

echo "正在启动交互学数学……"
echo "请保留这个窗口。停止学习时可按 Control+C；平板访问期间电脑须保持开机。"
"$NODE_BIN" "$PROJECT_DIR/scripts/open-browser.mjs" >/dev/null 2>&1 &
"$NODE_BIN" "$PROJECT_DIR/server.mjs"
STATUS=$?
if [ "$STATUS" -ne 0 ] && [ "$STATUS" -ne 130 ]; then
  echo "启动或运行未完成，请查看上方说明。"
  read -r -p "按回车关闭窗口……" _
fi
exit "$STATUS"
