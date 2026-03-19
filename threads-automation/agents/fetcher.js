'use strict';

/**
 * エージェント⑤: フェッチャー
 * 投稿から24時間以上経過したものを対象に Threads API からメトリクスを取得し、
 * history.json を更新する。
 *
 * 使い方:
 *   node agents/fetcher.js <accountId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs   = require('fs');
const { getMetrics } = require('../utils/threads-api');
const { updateHistoryMetrics } = require('../utils/state-manager');

const ROOT = path.join(__dirname, '..');

function loadAccount(accountId) {
  const accounts = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/accounts.json'), 'utf8'));
  const acc = accounts.accounts.find(a => a.id === accountId);
  if (!acc) throw new Error(`Account not found: ${accountId}`);
  return JSON.parse(fs.readFileSync(path.join(ROOT, acc.knowledgePath), 'utf8'));
}

function getCredentials(account) {
  const accessToken = process.env.THREADS_ACCESS_TOKEN || account.accountRef?.threadsAccessToken;
  if (!accessToken) throw new Error('THREADS_ACCESS_TOKEN が未設定です。');
  return { accessToken };
}

async function run(accountId) {
  console.log(`[Fetcher] アカウント: ${accountId}`);
  const account = loadAccount(accountId);
  const { accessToken } = getCredentials(account);

  const histPath = path.join(ROOT, 'state', accountId, 'history.json');
  if (!fs.existsSync(histPath)) {
    console.log('[Fetcher] 履歴ファイルなし。スキップ。');
    return;
  }

  const history = JSON.parse(fs.readFileSync(histPath, 'utf8'));
  const posts   = history.posts || [];

  // 24時間以上経過 & メトリクス未取得の投稿を抽出
  const now         = Date.now();
  const twentyFourH = 24 * 60 * 60 * 1000;
  const targets = posts.filter(p =>
    p.threadsPostId &&
    !p.metrics?.fetchedAt &&
    p.postedAt &&
    (now - new Date(p.postedAt).getTime()) >= twentyFourH
  );

  if (targets.length === 0) {
    console.log('[Fetcher] メトリクス取得対象なし。');
    return;
  }

  console.log(`[Fetcher] ${targets.length}件のメトリクスを取得します...`);
  let updated = 0;

  for (const post of targets) {
    try {
      const metrics = await getMetrics(post.threadsPostId, accessToken);
      const success = updateHistoryMetrics(accountId, post.threadsPostId, metrics);
      if (success) {
        updated++;
        console.log(`  [Fetcher] ${post.threadsPostId}: views=${metrics.views}, likes=${metrics.likes}, replies=${metrics.replies}`);
      }
      // API レート制限を考慮して少し待つ
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`  [Fetcher] ${post.threadsPostId} の取得失敗: ${err.message}`);
    }
  }

  console.log(`[Fetcher] ${updated}件のメトリクスを更新しました。`);
}

const accountId = process.argv[2] || 'career';
run(accountId).catch(err => {
  console.error('[Fetcher] エラー:', err.message);
  process.exit(1);
});
