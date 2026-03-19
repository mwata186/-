#!/bin/bash
# ============================================================
# setup-cron.sh
# ポスターを crontab に登録する（1日10スロット）
# ============================================================
# 使い方:
#   bash scripts/setup-cron.sh <accountId>
#   bash scripts/setup-cron.sh career
# ============================================================

ACCOUNT=${1:-career}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
NODE_BIN=$(which node)

# デイリー実行（毎朝7:50 にフェッチャー〜ライターを一括実行）
DAILY_JOB="50 7 * * * cd $APP_DIR && bash scripts/run-daily.sh $ACCOUNT >> state/$ACCOUNT/daily.log 2>&1"

# ポスター（1日10スロット: 8,10,12,14,16,18,20,21,22,23 時）
POSTER_JOB="0 8,10,12,14,16,18,20,21,22,23 * * * cd $APP_DIR && $NODE_BIN agents/poster.js $ACCOUNT >> state/$ACCOUNT/poster.log 2>&1"

echo "[setup-cron] 以下のcronジョブを登録します:"
echo ""
echo "  デイリー: $DAILY_JOB"
echo "  ポスター: $POSTER_JOB"
echo ""

# 既存の crontab に追記（重複を避ける）
CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")

# 既に同じジョブが登録されていたら削除してから追加
CLEANED=$(echo "$CURRENT_CRON" | grep -v "threads-automation.*$ACCOUNT" || true)

NEW_CRON="$CLEANED
$DAILY_JOB
$POSTER_JOB"

echo "$NEW_CRON" | crontab -

echo "[setup-cron] crontab に登録しました。"
echo ""
echo "確認:"
crontab -l | grep "threads-automation"
