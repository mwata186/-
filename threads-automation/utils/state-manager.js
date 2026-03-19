'use strict';

const fs   = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../state');

/**
 * アカウントの状態ファイルパスを返す
 * @param {string} accountId
 * @param {string} filename  - 'queue' | 'history' | 'metrics' | 'theme-tree'
 */
function statePath(accountId, filename) {
  return path.join(STATE_DIR, accountId, `${filename}.json`);
}

/**
 * JSONファイルを読み込む（存在しない場合は defaultValue を返す）
 */
function readJSON(filePath, defaultValue = {}) {
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return defaultValue;
  }
}

/**
 * JSONファイルに書き込む（ディレクトリが無ければ作成）
 */
function writeJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/** キューを読み込む */
function readQueue(accountId) {
  return readJSON(statePath(accountId, 'queue'), { posts: [] });
}

/** キューを書き込む */
function writeQueue(accountId, queue) {
  writeJSON(statePath(accountId, 'queue'), queue);
}

/** 履歴を読み込む（最新 n 件） */
function readHistory(accountId, limit = 100) {
  const data = readJSON(statePath(accountId, 'history'), { posts: [] });
  data.posts = data.posts.slice(-limit);
  return data;
}

/** 履歴に1件追加（最大 100 件に切り詰め） */
function appendHistory(accountId, post) {
  const data = readJSON(statePath(accountId, 'history'), { posts: [] });
  data.posts.push(post);
  if (data.posts.length > 100) data.posts = data.posts.slice(-100);
  writeJSON(statePath(accountId, 'history'), data);
}

/** 履歴のメトリクスを更新 */
function updateHistoryMetrics(accountId, threadsPostId, metrics) {
  const data = readJSON(statePath(accountId, 'history'), { posts: [] });
  const post = data.posts.find(p => p.threadsPostId === threadsPostId);
  if (post) {
    post.metrics = { ...metrics, fetchedAt: new Date().toISOString() };
    writeJSON(statePath(accountId, 'history'), data);
    return true;
  }
  return false;
}

/** テーマツリーを読み込む */
function readThemeTree(accountId) {
  return readJSON(statePath(accountId, 'theme-tree'), {});
}

/** テーマツリーを書き込む */
function writeThemeTree(accountId, tree) {
  writeJSON(statePath(accountId, 'theme-tree'), tree);
}

/** ライター指示書（markdown）を読み込む */
function readWriterBrief(accountId) {
  const p = path.join(STATE_DIR, accountId, 'writer-brief.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

/** ライター指示書を書き込む */
function writeWriterBrief(accountId, content) {
  const dir = path.join(STATE_DIR, accountId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'writer-brief.md'), content, 'utf8');
}

/** KILL_SWITCH の存在確認 */
function isKillSwitchActive(accountId) {
  return fs.existsSync(path.join(STATE_DIR, accountId, 'KILL_SWITCH'));
}

/** 連続エラーカウンターの読み書き */
function getErrorCount(accountId) {
  const p = path.join(STATE_DIR, accountId, 'error-count.json');
  return readJSON(p, { count: 0 }).count;
}

function setErrorCount(accountId, count) {
  const p = path.join(STATE_DIR, accountId, 'error-count.json');
  writeJSON(p, { count, updatedAt: new Date().toISOString() });
}

function resetErrorCount(accountId) {
  setErrorCount(accountId, 0);
}

module.exports = {
  statePath,
  readQueue, writeQueue,
  readHistory, appendHistory, updateHistoryMetrics,
  readThemeTree, writeThemeTree,
  readWriterBrief, writeWriterBrief,
  isKillSwitchActive,
  getErrorCount, setErrorCount, resetErrorCount,
};
