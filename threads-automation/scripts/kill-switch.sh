#!/bin/bash
# ============================================================
# kill-switch.sh
# 指定アカウントの投稿を即座に停止する緊急停止スクリプト
# ============================================================
# 使い方:
#   bash scripts/kill-switch.sh <accountId>       # 1アカウント停止
#   bash scripts/kill-switch.sh all               # 全アカウント停止
#   bash scripts/kill-switch.sh career --resume   # 停止を解除
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ACCOUNT=${1:-career}
ACTION=${2:-""}

cd "$APP_DIR"

resume_account() {
  local acc="$1"
  local ks_path="state/$acc/KILL_SWITCH"
  if [ -f "$ks_path" ]; then
    rm "$ks_path"
    echo "[kill-switch] $acc の KILL_SWITCH を解除しました。"
  else
    echo "[kill-switch] $acc は停止中ではありません。"
  fi
}

activate_account() {
  local acc="$1"
  local ks_path="state/$acc/KILL_SWITCH"
  mkdir -p "state/$acc"
  echo "$(date): 手動による緊急停止" > "$ks_path"
  echo "[kill-switch] $acc の投稿を停止しました。"
}

if [ "$ACTION" = "--resume" ]; then
  if [ "$ACCOUNT" = "all" ]; then
    for dir in state/*/; do
      acc=$(basename "$dir")
      resume_account "$acc"
    done
  else
    resume_account "$ACCOUNT"
  fi
else
  if [ "$ACCOUNT" = "all" ]; then
    for dir in state/*/; do
      acc=$(basename "$dir")
      activate_account "$acc"
    done
    echo "[kill-switch] 全アカウントを停止しました。"
  else
    activate_account "$ACCOUNT"
  fi
  echo ""
  echo "再開するには: bash scripts/kill-switch.sh $ACCOUNT --resume"
fi
