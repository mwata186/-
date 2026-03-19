'use strict';

/**
 * エージェント④: ポスター
 * キューから投稿を取り出し、Threads API で公開する。
 * node-cron で 1日10スロットのスケジュールで起動。
 *
 * 使い方:
 *   node agents/poster.js <accountId>        # 1回実行モード（cron から呼ばれる）
 *   node agents/poster.js <accountId> --cron # プロセスを常駐させて cron 起動
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs   = require('fs');
const cron = require('node-cron');
const { createPost } = require('../utils/threads-api');
const {
  readQueue, writeQueue,
  appendHistory,
  isKillSwitchActive,
  getErrorCount, setErrorCount, resetErrorCount,
} = require('../utils/state-manager');

const ROOT = path.join(__dirname, '..');

function loadAccount(accountId) {
  const accounts = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/accounts.json'), 'utf8'));
  const acc = accounts.accounts.find(a => a.id === accountId);
  if (!acc) throw new Error(`Account not found: ${accountId}`);
  return JSON.parse(fs.readFileSync(path.join(ROOT, acc.knowledgePath), 'utf8'));
}

function loadSettings() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/settings.json'), 'utf8'));
}

/** 今日の投稿数を履歴から取得 */
function todayPostCount(accountId) {
  const histPath = path.join(ROOT, 'state', accountId, 'history.json');
  if (!fs.existsSync(histPath)) return 0;
  const data = JSON.parse(fs.readFileSync(histPath, 'utf8'));
  const today = new Date().toISOString().split('T')[0];
  return (data.posts || []).filter(p => p.postedAt && p.postedAt.startsWith(today)).length;
}

/** 最後に投稿した日時を取得 */
function lastPostedAt(accountId) {
  const histPath = path.join(ROOT, 'state', accountId, 'history.json');
  if (!fs.existsSync(histPath)) return null;
  const data = JSON.parse(fs.readFileSync(histPath, 'utf8'));
  const posts = (data.posts || []).filter(p => p.postedAt);
  if (posts.length === 0) return null;
  return new Date(posts[posts.length - 1].postedAt);
}

/** アカウントのアクセストークンを取得（環境変数 or knowledgeファイル） */
function getCredentials(account) {
  const userId      = process.env.THREADS_USER_ID      || account.accountRef?.threadsUserId;
  const accessToken = process.env.THREADS_ACCESS_TOKEN || account.accountRef?.threadsAccessToken;
  if (!userId || !accessToken) {
    throw new Error('THREADS_USER_ID または THREADS_ACCESS_TOKEN が未設定です。.env を確認してください。');
  }
  return { userId, accessToken };
}

// ─── 投稿実行 ─────────────────────────────────────────────

async function postOne(accountId) {
  const settings = loadSettings();
  const account  = loadAccount(accountId);

  // KILL_SWITCH チェック
  if (isKillSwitchActive(accountId)) {
    console.log(`[Poster] KILL_SWITCH が有効です。投稿を停止します。`);
    return;
  }

  // 今日の投稿上限チェック
  const todayCount = todayPostCount(accountId);
  if (todayCount >= settings.maxPostsPerDay) {
    console.log(`[Poster] 本日の投稿上限 (${settings.maxPostsPerDay}件) に達しました。`);
    return;
  }

  // 最低インターバルチェック
  const last = lastPostedAt(accountId);
  if (last) {
    const diffHours = (Date.now() - last.getTime()) / (1000 * 60 * 60);
    if (diffHours < settings.minIntervalHours) {
      console.log(`[Poster] 最低インターバル未経過 (${diffHours.toFixed(1)}h < ${settings.minIntervalHours}h)`);
      return;
    }
  }

  // キューから取得
  const queue = readQueue(accountId);
  if (!queue.posts || queue.posts.length === 0) {
    console.log('[Poster] キューが空です。ライターを先に実行してください。');
    return;
  }

  const post = queue.posts.shift();
  const { userId, accessToken } = getCredentials(account);

  try {
    console.log(`[Poster] 投稿中: "${post.content.slice(0, 50)}..."`);
    const threadsPostId = await createPost(post.content, userId, accessToken);

    const historyEntry = {
      ...post,
      threadsPostId,
      postedAt: new Date().toISOString(),
      metrics: null,
    };
    appendHistory(accountId, historyEntry);
    writeQueue(accountId, queue);
    resetErrorCount(accountId);

    console.log(`[Poster] 投稿完了。ID: ${threadsPostId} (本日 ${todayCount + 1}件目)`);
  } catch (err) {
    // エラーカウントを増加
    const count = getErrorCount(accountId) + 1;
    setErrorCount(accountId, count);

    console.error(`[Poster] 投稿失敗 (${count}回目): ${err.message}`);

    if (count >= settings.errorStrikeLimit) {
      console.error(`[Poster] 連続エラー ${count}回。スーパーバイザーによる停止が必要です。`);
      // queue に戻す
      queue.posts.unshift(post);
      writeQueue(accountId, queue);
    } else {
      // キューの先頭に戻す
      queue.posts.unshift(post);
      writeQueue(accountId, queue);
    }
  }
}

// ─── エントリポイント ─────────────────────────────────────

const accountId  = process.argv[2] || 'career';
const cronMode   = process.argv.includes('--cron');

if (cronMode) {
  const settings = loadSettings();
  console.log(`[Poster] cron モードで起動 (${settings.cronSchedule})`);
  cron.schedule(settings.cronSchedule, () => {
    postOne(accountId).catch(err => console.error('[Poster] cron エラー:', err.message));
  });
  console.log('[Poster] スケジュール: 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 21:00, 22:00, 23:00');
} else {
  // 1回実行モード（cron コマンドから呼ばれる場合）
  postOne(accountId).catch(err => {
    console.error('[Poster] エラー:', err.message);
    process.exit(1);
  });
}
