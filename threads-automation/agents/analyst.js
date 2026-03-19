'use strict';

/**
 * エージェント②: アナリスト
 * 過去の投稿メトリクスを分析し、ライター向けの指示書（writer-brief.md）を生成する。
 *
 * 使い方:
 *   node agents/analyst.js <accountId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs   = require('fs');
const { generate } = require('../utils/ai-client');
const {
  readHistory,
  writeWriterBrief,
} = require('../utils/state-manager');

const ROOT = path.join(__dirname, '..');

function loadAccount(accountId) {
  const accounts = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'config/accounts.json'), 'utf8')
  );
  const acc = accounts.accounts.find(a => a.id === accountId);
  if (!acc) throw new Error(`Account not found: ${accountId}`);
  return JSON.parse(fs.readFileSync(path.join(ROOT, acc.knowledgePath), 'utf8'));
}

/** パターン別・テーマ別の平均エンゲージメントを集計 */
function aggregateMetrics(posts) {
  const byPattern = {};
  const byTheme   = {};

  for (const post of posts) {
    if (!post.metrics) continue;
    const eng = (post.metrics.likes || 0) + (post.metrics.replies || 0) * 2 + (post.metrics.reposts || 0) * 3;

    // パターン別
    if (post.pattern) {
      if (!byPattern[post.pattern]) byPattern[post.pattern] = { total: 0, count: 0 };
      byPattern[post.pattern].total += eng;
      byPattern[post.pattern].count++;
    }

    // テーマ別
    if (post.theme) {
      if (!byTheme[post.theme]) byTheme[post.theme] = { total: 0, count: 0 };
      byTheme[post.theme].total += eng;
      byTheme[post.theme].count++;
    }
  }

  const patternAvg = Object.entries(byPattern)
    .map(([id, { total, count }]) => ({ id, avg: Math.round(total / count * 10) / 10 }))
    .sort((a, b) => b.avg - a.avg);

  const themeAvg = Object.entries(byTheme)
    .map(([id, { total, count }]) => ({ id, avg: Math.round(total / count * 10) / 10 }))
    .sort((a, b) => b.avg - a.avg);

  return { patternAvg, themeAvg };
}

/** 直近 n 件で使われたパターン・テーマを返す */
function recentPatterns(posts, n = 3) {
  return posts.slice(-n).map(p => p.pattern).filter(Boolean);
}

function recentThemes(posts, n = 3) {
  return posts.slice(-n).map(p => p.theme).filter(Boolean);
}

async function run(accountId) {
  console.log(`[Analyst] アカウント: ${accountId}`);
  const account = loadAccount(accountId);
  const history = readHistory(accountId, 100);
  const posts   = history.posts || [];

  if (posts.length === 0) {
    console.log('[Analyst] 投稿履歴なし。基本指示書を生成します。');
  }

  const { patternAvg, themeAvg } = aggregateMetrics(posts);
  const usedPatterns = recentPatterns(posts);
  const usedThemes   = recentThemes(posts);

  // 直近30件の高スコア投稿例を抽出
  const topPosts = posts
    .filter(p => p.metrics)
    .sort((a, b) => {
      const engA = (a.metrics.likes || 0) + (a.metrics.replies || 0) * 2;
      const engB = (b.metrics.likes || 0) + (b.metrics.replies || 0) * 2;
      return engB - engA;
    })
    .slice(0, 5)
    .map(p => `【${p.pattern} / ${p.theme}】\n${p.content.slice(0, 150)}`)
    .join('\n\n---\n\n');

  const systemPrompt = `あなたはSNSコンテンツ戦略の専門家です。
投稿メトリクスデータを分析し、次の投稿バッチのためのライター指示書を作成してください。
markdown 形式で、実践的かつ具体的な指示を書いてください。`;

  const userPrompt = `【アカウント情報】
ニッチ: ${account.niche}
ターゲット: ${account.persona.targetConcern}

【パターン別平均エンゲージメント（上位）】
${patternAvg.slice(0, 5).map(p => `- ${p.id}: ${p.avg}`).join('\n') || 'データなし'}

【テーマ別平均エンゲージメント（上位）】
${themeAvg.slice(0, 5).map(t => `- ${t.id}: ${t.avg}`).join('\n') || 'データなし'}

【直近3件で使用済みのパターン（使用禁止）】
${usedPatterns.join(', ') || 'なし'}

【直近3件で使用済みのテーマ（避けるべき）】
${usedThemes.join(', ') || 'なし'}

【バズった投稿例】
${topPosts || 'まだデータなし'}

上記を踏まえ、次の投稿バッチ（10本）のための指示書を以下の形式で作成してください：

## 推奨パターン（使用禁止パターンを除く）
## 推奨テーマ
## 1行目フックのスタイル指示
## 避けるべきこと
## 今バッチの重点ポイント`;

  const brief = await generate(systemPrompt, userPrompt, 2048);
  writeWriterBrief(accountId, brief);

  console.log('[Analyst] ライター指示書を生成しました:');
  console.log(brief.slice(0, 300) + '...');
}

const accountId = process.argv[2] || 'career';
run(accountId).catch(err => {
  console.error('[Analyst] エラー:', err.message);
  process.exit(1);
});
