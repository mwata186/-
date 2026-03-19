# Threads AI 完全自動運用システム

6エージェントによる Threads アカウントの完全自動投稿・分析・改善システム。

```
リサーチャー → アナリスト → ライター → ポスター → フェッチャー → スーパーバイザー
```

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
cd threads-automation
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して以下を埋める:

| 変数名 | 説明 |
|--------|------|
| `ANTHROPIC_API_KEY` | Anthropic API キー（[取得先](https://console.anthropic.com)） |
| `THREADS_USER_ID` | Threads のユーザーID（数字） |
| `THREADS_ACCESS_TOKEN` | Threads API アクセストークン |
| `YOUTUBE_API_KEY` | YouTube Data API v3 キー（省略可） |

### 3. Threads API アクセストークンの取得手順

1. [Meta for Developers](https://developers.facebook.com) にログイン
2. 「マイアプリ」→「アプリを作成」→「その他」→「ビジネス」を選択
3. 左メニュー「製品を追加」→「Threads API」を追加
4. 「Threads API > 設定」→「User Token Generator」でトークンを発行
5. 発行された `User ID` と `Access Token` を `.env` に記入
6. ⚠️ トークンは **60日ごと** に更新が必要（Long-lived token）

### 4. YouTube API キーの取得（省略可）

1. [Google Cloud Console](https://console.cloud.google.com) でプロジェクトを作成
2. 「APIとサービス」→「YouTube Data API v3」を有効化
3. 「認証情報」→「APIキーを作成」
4. `.env` の `YOUTUBE_API_KEY` に記入

YouTube API を使わない場合は、手動でネタを追加できます（後述）。

---

## 基本的な使い方

### デイリー実行（手動）

```bash
bash scripts/run-daily.sh career
```

フロー: フェッチャー → アナリスト → リサーチャー → ライター → スーパーバイザー

### cron 自動実行のセットアップ

```bash
bash scripts/setup-cron.sh career
```

- 毎朝 **7:50** にデイリーバッチを実行
- **1日10回**（08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 21:00, 22:00, 23:00）投稿

### 緊急停止

```bash
# 即座に投稿を停止
bash scripts/kill-switch.sh career

# 全アカウント停止
bash scripts/kill-switch.sh all

# 停止を解除して再開
bash scripts/kill-switch.sh career --resume
```

---

## エージェントの個別実行

```bash
# リサーチャー（ネタ収集）
node agents/researcher.js career

# アナリスト（分析・指示書生成）
node agents/analyst.js career

# ライター（投稿生成）
node agents/writer.js career

# ポスター（1回投稿）
node agents/poster.js career

# フェッチャー（メトリクス取得）
node agents/fetcher.js career

# スーパーバイザー（ヘルスチェック）
node agents/supervisor.js career
```

---

## 手動でネタを追加する方法

YouTube API を使わず、手動でコンテンツネタを追加できます。

`state/career/manual-research.json` を作成:

```json
{
  "items": [
    {
      "category": "転職準備",
      "subtopic": "面接対策",
      "notes": [
        "面接で落ちる理由の9割は準備不足。具体的なエピソードがない。",
        "逆質問で「給与はいくら上がりますか？」と聞く人は必ず落ちる。"
      ]
    }
  ]
}
```

次回リサーチャー実行時に自動で読み込まれます。

---

## 新しいアカウントを追加する方法

1. `knowledge/accounts/` に新しいナレッジファイルを作成（`career.json` をコピーして編集）
2. `config/accounts.json` にアカウントを追加
3. `state/<accountId>/` ディレクトリを作成し、初期 JSON ファイルをコピー
4. `bash scripts/run-daily.sh <accountId>` で初回実行

---

## ディレクトリ構成

```
threads-automation/
├── agents/
│   ├── researcher.js    # ネタ収集（YouTube / 手動）
│   ├── analyst.js       # パフォーマンス分析・指示書生成
│   ├── writer.js        # 投稿生成（品質スコアリング込み）
│   ├── poster.js        # Threads API で投稿
│   ├── fetcher.js       # メトリクス取得
│   └── supervisor.js    # 監視・異常検知・KILL_SWITCH
├── knowledge/
│   ├── accounts/
│   │   └── career.json  # アカウントナレッジ（ペルソナ等）
│   ├── patterns.json    # 投稿パターン15種
│   └── hooks.json       # 1行目フック100件以上
├── state/
│   └── career/
│       ├── queue.json      # 投稿待ちキュー
│       ├── history.json    # 投稿履歴（メトリクス付き）
│       ├── theme-tree.json # テーマ管理ツリー
│       ├── writer-brief.md # ライター指示書
│       └── supervisor.log  # 監視ログ
├── config/
│   ├── accounts.json    # アクティブアカウント一覧
│   └── settings.json    # 全体設定
├── scripts/
│   ├── run-daily.sh     # デイリー一括実行
│   ├── setup-cron.sh    # crontab 登録
│   └── kill-switch.sh   # 緊急停止
└── utils/
    ├── ai-client.js     # Claude API ラッパー
    ├── threads-api.js   # Threads API ラッパー
    ├── similarity.js    # コサイン類似度計算
    ├── scorer.js        # 品質スコアリング
    └── state-manager.js # 状態ファイル管理
```

---

## 品質管理の仕組み

### 投稿品質スコアリング（10基準）

| 基準 | 説明 |
|------|------|
| hook_strength | 1行目のインパクト |
| value | 有益な情報があるか |
| specificity | 具体的な数字・事例 |
| pacing | 読みやすいテンポ・改行 |
| persona_fit | アカウントのトーンと一致 |
| engagement | コメント・シェアを誘発しそうか |
| originality | 新鮮な切り口か |
| pattern_compliance | 指定パターンに沿っているか |
| cta | 次のアクションへの誘導 |
| format | Threads に最適化されたフォーマット |

**平均 7.0/10 未満** → 最大2回再生成 → それでも不合格は棄却

### 類似度チェック

過去100件の投稿とコサイン類似度を計算し、**0.85以上** の場合は自動棄却（同じ投稿のループを防止）

### 安全装置

- 1日最大 **15件** の投稿上限
- 投稿間隔 **最低1時間**
- 同じパターン **3回連続禁止**
- 同じテーマ **3回連続禁止**
- 連続エラー **3回** でKILL_SWITCH自動起動
- 緊急停止スイッチ（ファイルベース）

---

## 設定のカスタマイズ

`config/settings.json` で調整できます:

```json
{
  "maxPostsPerDay": 15,       // 1日の投稿上限
  "minIntervalHours": 1,      // 最低投稿間隔（時間）
  "qualityThreshold": 7.0,   // 合格品質スコア
  "similarityThreshold": 0.85, // 類似度棄却閾値
  "targetPostsPerBatch": 10   // 1バッチの目標生成数
}
```
