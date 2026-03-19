'use strict';

/**
 * エージェント⑥: スーパーバイザー
 * 全体の状態を監視し、異常を検知してログに記録する。
 * 連続エラーが閾値に達した場合は KILL_SWITCH を作成して全停止する。
 *
 * 使い方:
 *   node agents/supervisor.js <accountId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs   = require('fs');
const {
  readQueue,
  readHistory,
  isKillSwitchActive,
  getErrorCount,
} = require('../utils/state-manager');

const ROOT = path.join(__dirname, '..');

function loadSettings() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/settings.json'), 'utf8'));
}

function loadAccounts() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/accounts.json'), 'utf8')).accounts;
}

function log(accountId, level, message) {
  const logDir = path.join(ROOT, 'state', accountId);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'supervisor.log');
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  fs.appendFileSync(logPath, line, 'utf8');
  console.log(`[Supervisor] ${line.trim()}`);
}

function activateKillSwitch(accountId, reason) {
  const p = path.join(ROOT, 'state', accountId, 'KILL_SWITCH');
  fs.writeFileSync(p, reason, 'utf8');
  log(accountId, 'CRITICAL', `KILL_SWITCH を起動しました: ${reason}`);
}

/** 今日の投稿数を取得 */
function todayPostCount(history) {
  const today = new Date().toISOString().split('T')[0];
  return (history.posts || []).filter(p => p.postedAt?.startsWith(today)).length;
}

/** 直近24時間の投稿数を取得 */
function last24hPostCount(history) {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  return (history.posts || []).filter(p => p.postedAt && new Date(p.postedAt).getTime() >= since).length;
}

async function checkAccount(accountId, settings) {
  log(accountId, 'INFO', `ヘルスチェック開始`);
  const issues = [];

  // 1. KILL_SWITCH 確認
  if (isKillSwitchActive(accountId)) {
    log(accountId, 'WARN', 'KILL_SWITCH が有効です。投稿は停止中。');
    return;
  }

  // 2. 連続エラーチェック
  const errCount = getErrorCount(accountId);
  if (errCount >= settings.errorStrikeLimit) {
    issues.push(`連続エラー ${errCount}回 (閾値: ${settings.errorStrikeLimit})`);
    activateKillSwitch(accountId, `連続エラー ${errCount}回により自動停止`);
  } else if (errCount > 0) {
    log(accountId, 'WARN', `連続エラーカウント: ${errCount}/${settings.errorStrikeLimit}`);
  }

  // 3. キューの残量チェック
  const queue = readQueue(accountId);
  const queueLen = queue.posts?.length || 0;
  if (queueLen === 0) {
    issues.push('キューが空です。ライターを実行してください。');
    log(accountId, 'WARN', 'キューが空です');
  } else {
    log(accountId, 'INFO', `キュー残量: ${queueLen}件`);
  }

  // 4. 過投稿チェック（直近24時間が上限超え）
  const history = readHistory(accountId);
  const count24h = last24hPostCount(history);
  if (count24h > settings.maxPostsPerDay) {
    issues.push(`直近24時間の投稿数が上限超過: ${count24h}/${settings.maxPostsPerDay}`);
    log(accountId, 'CRITICAL', `過投稿検知: ${count24h}件 (上限: ${settings.maxPostsPerDay})`);
    activateKillSwitch(accountId, `過投稿 ${count24h}件により自動停止`);
  } else {
    log(accountId, 'INFO', `直近24時間の投稿数: ${count24h}/${settings.maxPostsPerDay}`);
  }

  // 5. 今日の投稿数
  const todayCount = todayPostCount(history);
  log(accountId, 'INFO', `本日の投稿数: ${todayCount}件`);

  // 6. 最後の投稿からの経過時間
  const postedPosts = (history.posts || []).filter(p => p.postedAt);
  if (postedPosts.length > 0) {
    const lastPost = postedPosts[postedPosts.length - 1];
    const elapsedH = (Date.now() - new Date(lastPost.postedAt).getTime()) / (1000 * 60 * 60);
    log(accountId, 'INFO', `最後の投稿から ${elapsedH.toFixed(1)}時間経過`);
  }

  if (issues.length === 0) {
    log(accountId, 'INFO', 'ヘルスチェック完了: 異常なし');
  } else {
    log(accountId, 'WARN', `ヘルスチェック完了: ${issues.length}件の問題を検知`);
    for (const issue of issues) {
      log(accountId, 'WARN', `  - ${issue}`);
    }
  }
}

async function run(accountId) {
  const settings = loadSettings();

  if (accountId === 'all') {
    const accounts = loadAccounts().filter(a => a.active);
    for (const acc of accounts) {
      await checkAccount(acc.id, settings);
    }
  } else {
    await checkAccount(accountId, settings);
  }
}

const accountId = process.argv[2] || 'career';
run(accountId).catch(err => {
  console.error('[Supervisor] エラー:', err.message);
  process.exit(1);
});
