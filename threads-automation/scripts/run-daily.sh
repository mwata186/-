#!/bin/bash
# ============================================================
# run-daily.sh
# デイリー実行スクリプト（毎朝 run-daily.sh <accountId> で実行）
# フロー: フェッチャー → アナリスト → リサーチャー → ライター → スーパーバイザー
# ============================================================

set -e

ACCOUNT=${1:-career}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "======================================"
echo "[run-daily] 開始: $(date)"
echo "[run-daily] アカウント: $ACCOUNT"
echo "======================================"

cd "$APP_DIR"

# 1. フェッチャー: 昨日の投稿メトリクスを取得
echo ""
echo "--- [1/5] フェッチャー起動 ---"
node agents/fetcher.js "$ACCOUNT" || echo "[WARN] フェッチャーでエラーが発生しました"

# 2. アナリスト: メトリクスを分析してライター指示書を生成
echo ""
echo "--- [2/5] アナリスト起動 ---"
node agents/analyst.js "$ACCOUNT" || echo "[WARN] アナリストでエラーが発生しました"

# 3. リサーチャー: テーマツリーのネタを補充
echo ""
echo "--- [3/5] リサーチャー起動 ---"
node agents/researcher.js "$ACCOUNT" || echo "[WARN] リサーチャーでエラーが発生しました"

# 4. ライター: 投稿を生成してキューに追加
echo ""
echo "--- [4/5] ライター起動 ---"
node agents/writer.js "$ACCOUNT" || {
  echo "[ERROR] ライターでエラーが発生しました"
  exit 1
}

# 5. スーパーバイザー: 全体ヘルスチェック
echo ""
echo "--- [5/5] スーパーバイザー起動 ---"
node agents/supervisor.js "$ACCOUNT" || echo "[WARN] スーパーバイザーでエラーが発生しました"

echo ""
echo "======================================"
echo "[run-daily] 完了: $(date)"
echo "[run-daily] ポスターは cron で自動投稿されます"
echo "======================================"
