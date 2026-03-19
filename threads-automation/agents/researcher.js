'use strict';

/**
 * エージェント①: リサーチャー
 * YouTube API または手動 JSON からネタを収集し、テーマツリーを更新する。
 *
 * 使い方:
 *   node agents/researcher.js <accountId>
 *   node agents/researcher.js career
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs   = require('fs');
const axios = require('axios');
const { generate } = require('../utils/ai-client');
const {
  readThemeTree,
  writeThemeTree,
} = require('../utils/state-manager');

const ROOT = path.join(__dirname, '..');

// ─── ヘルパー ──────────────────────────────────────────────

function loadAccount(accountId) {
  const accounts = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'config/accounts.json'), 'utf8')
  );
  const acc = accounts.accounts.find(a => a.id === accountId);
  if (!acc) throw new Error(`Account not found: ${accountId}`);
  return JSON.parse(fs.readFileSync(path.join(ROOT, acc.knowledgePath), 'utf8'));
}

function loadSettings() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/settings.json'), 'utf8'));
}

/** テーマツリーから coverage が低いノードを返す */
function findLowCoverageNodes(tree, topN = 3) {
  const nodes = [];
  for (const [category, subtopics] of Object.entries(tree)) {
    for (const [subtopic, info] of Object.entries(subtopics)) {
      nodes.push({ category, subtopic, coverage: info.coverage });
    }
  }
  return nodes
    .sort((a, b) => a.coverage - b.coverage)
    .slice(0, topN);
}

// ─── YouTube リサーチ ──────────────────────────────────────

async function searchYouTube(query, maxResults = 5) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[Researcher] YOUTUBE_API_KEY が未設定のため YouTube 検索をスキップします。');
    return [];
  }
  const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
    params: {
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults,
      key: apiKey,
    },
  });
  return res.data.items.map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
  }));
}

async function fetchTranscript(videoId) {
  try {
    const { YoutubeTranscript } = require('youtube-transcript');
    const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ja' });
    return items.map(i => i.text).join(' ');
  } catch {
    return '';
  }
}

// ─── AI によるネタ抽出 ─────────────────────────────────────

async function extractKnowledge(account, category, subtopic, rawText) {
  const systemPrompt = `あなたはSNSコンテンツ戦略の専門家です。
与えられたテキストから、Threadsで使えるコンテンツネタを抽出してください。
ニッチ・ターゲット・ペルソナに合ったネタのみ抽出します。
箇条書きで10件以内にまとめてください。各ネタは1〜2文で具体的に。`;

  const userPrompt = `【アカウント情報】
ニッチ: ${account.niche}
テーマ: ${category} > ${subtopic}
ターゲット: ${account.persona.targetConcern}

【参考テキスト（YouTubeトランスクリプト等）】
${rawText.slice(0, 3000)}

このテキストから使えるコンテンツネタを箇条書きで抽出してください。`;

  const result = await generate(systemPrompt, userPrompt, 1024);
  return result
    .split('\n')
    .map(l => l.replace(/^[-•*・\d.]+\s*/, '').trim())
    .filter(l => l.length > 5);
}

// ─── 手動ネタファイルのロード ──────────────────────────────

function loadManualNotes(accountId) {
  const p = path.join(ROOT, 'state', accountId, 'manual-research.json');
  if (!fs.existsSync(p)) return [];
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  return data.items || [];
}

function consumeManualNotes(accountId, usedIndexes) {
  const p = path.join(ROOT, 'state', accountId, 'manual-research.json');
  if (!fs.existsSync(p)) return;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  data.items = data.items.filter((_, i) => !usedIndexes.includes(i));
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

// ─── メイン ───────────────────────────────────────────────

async function run(accountId) {
  console.log(`[Researcher] アカウント: ${accountId}`);
  const account  = loadAccount(accountId);
  const settings = loadSettings();
  const tree     = readThemeTree(accountId);

  // 手動ネタ（優先）
  const manualNotes = loadManualNotes(accountId);
  const usedManualIndexes = [];

  // coverage が低いノード TOP3 を対象にリサーチ
  const targets = findLowCoverageNodes(tree, settings.researchKeywordsPerTheme || 3);
  console.log(`[Researcher] リサーチ対象: ${targets.map(t => `${t.category}>${t.subtopic}`).join(', ')}`);

  for (const { category, subtopic } of targets) {
    const notes = [];

    // 1. 手動ネタがあればそちらを使う
    const matchedManual = manualNotes
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.category === category && item.subtopic === subtopic);

    if (matchedManual.length > 0) {
      for (const { item, i } of matchedManual) {
        notes.push(...(item.notes || []));
        usedManualIndexes.push(i);
      }
      console.log(`[Researcher] 手動ネタ使用: ${category}>${subtopic} (${notes.length}件)`);
    } else {
      // 2. YouTube API でリサーチ
      const query = `${account.keywords[0]} ${subtopic}`;
      const videos = await searchYouTube(query, settings.youtubeMaxResults || 5);

      for (const video of videos.slice(0, 2)) {
        console.log(`  YouTube: ${video.title}`);
        const transcript = await fetchTranscript(video.videoId);
        if (!transcript) continue;
        const extracted = await extractKnowledge(account, category, subtopic, transcript);
        notes.push(...extracted);
      }
    }

    if (notes.length === 0) {
      console.log(`  [Researcher] ${subtopic}: ネタ取得なし、スキップ`);
      continue;
    }

    // テーマツリーを更新
    tree[category][subtopic].notes = [
      ...(tree[category][subtopic].notes || []),
      ...notes,
    ].slice(0, 30); // 最大30件保持
    tree[category][subtopic].coverage = Math.min(
      1.0,
      (tree[category][subtopic].coverage || 0) + 0.3
    );
    tree[category][subtopic].lastResearched = new Date().toISOString().split('T')[0];

    console.log(`  [Researcher] ${subtopic}: ${notes.length}件のネタを追加`);
  }

  writeThemeTree(accountId, tree);
  consumeManualNotes(accountId, usedManualIndexes);
  console.log('[Researcher] テーマツリー更新完了');
}

// ─── エントリポイント ─────────────────────────────────────

const accountId = process.argv[2] || 'career';
run(accountId).catch(err => {
  console.error('[Researcher] エラー:', err.message);
  process.exit(1);
});
