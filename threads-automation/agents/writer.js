'use strict';

/**
 * エージェント③: ライター
 * テーマツリーのネタ＋ライター指示書をもとに投稿を生成し、
 * 品質スコアリング・類似度チェックを経てキューに追加する。
 *
 * 使い方:
 *   node agents/writer.js <accountId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const { generate } = require('../utils/ai-client');
const { scorePost }         = require('../utils/scorer');
const { maxSimilarity }     = require('../utils/similarity');
const {
  readHistory,
  readQueue, writeQueue,
  readThemeTree,
  readWriterBrief,
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

function loadPatterns() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'knowledge/patterns.json'), 'utf8'));
}

function loadHooks() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'knowledge/hooks.json'), 'utf8')).hooks;
}

/** テーマツリーからネタ（notes がある subtopic）を収集 */
function collectNotes(tree) {
  const items = [];
  for (const [category, subtopics] of Object.entries(tree)) {
    for (const [subtopic, info] of Object.entries(subtopics)) {
      for (const note of (info.notes || [])) {
        items.push({ category, subtopic, note });
      }
    }
  }
  return items;
}

/** 直近 n 件で使ったパターン・テーマを取得 */
function recentUsed(posts, n = 3) {
  const recent = posts.slice(-n);
  return {
    patterns: recent.map(p => p.pattern).filter(Boolean),
    themes:   recent.map(p => p.theme).filter(Boolean),
  };
}

/** パターンをローテーション選択（最近使ったものを避ける） */
function selectPattern(patterns, usedPatterns, lastUsedPatternIdx) {
  const available = patterns.filter(p => !usedPatterns.includes(p.id));
  if (available.length === 0) return patterns[(lastUsedPatternIdx + 1) % patterns.length];
  // 直前に使ったもの以外からランダム
  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
}

/** ランダムなフックを選ぶ */
function pickHook(hooks) {
  return hooks[Math.floor(Math.random() * hooks.length)];
}

// ─── 投稿生成 ─────────────────────────────────────────────

async function generatePost(account, pattern, theme, note, hookTemplate, brief) {
  const systemPrompt = `あなたはThreads専門のSNSライターです。
以下の条件に厳密に従って、1本の投稿を生成してください。

【アカウントペルソナ】
トーン: ${account.persona.tone}
NGワード: ${account.persona.ngWords.join('、')}

【投稿パターン】
${pattern.name}（${pattern.id}）: ${pattern.desc}

【1行目フックの構造（参考）】
${hookTemplate}
※「〇〇」の部分を「${account.niche}」のテーマに置き換えて使う

【フォーマット指示】
- 文字数: 150〜400文字
- 改行を適切に使い、読みやすく
- 絵文字は最大3個まで（使わなくてもよい）
- 投稿テキストのみを出力すること（説明・タイトルは不要）`;

  const userPrompt = `【ライター指示書（今バッチの方針）】
${brief || '特になし'}

【テーマ】${theme}
【ネタ（参考にする内容）】${note}

上記を元に、${pattern.name}パターンの投稿を1本生成してください。`;

  return await generate(systemPrompt, userPrompt, 1024);
}

// ─── メイン ───────────────────────────────────────────────

async function run(accountId) {
  console.log(`[Writer] アカウント: ${accountId}`);

  const account  = loadAccount(accountId);
  const settings = loadSettings();
  const patterns = loadPatterns();
  const hooks    = loadHooks();
  const tree     = readThemeTree(accountId);
  const brief    = readWriterBrief(accountId);
  const history  = readHistory(accountId, settings.historyWindow);
  const queue    = readQueue(accountId);

  const historyTexts = history.posts.map(p => p.content);
  const { patterns: usedPatterns, themes: usedThemes } = recentUsed(history.posts);
  const notes = collectNotes(tree);

  if (notes.length === 0) {
    console.log('[Writer] テーマツリーにネタがありません。先にリサーチャーを実行してください。');
    return;
  }

  const target  = settings.targetPostsPerBatch || 10;
  let generated = 0;
  let patternIdx = 0;
  const sessionUsedPatterns = [...usedPatterns];
  const sessionUsedThemes   = [...usedThemes];

  for (let noteIdx = 0; noteIdx < notes.length && generated < target; noteIdx++) {
    const { category, subtopic, note } = notes[noteIdx % notes.length];
    const theme = `${category} > ${subtopic}`;

    // テーマのローテーション確認
    if (sessionUsedThemes.slice(-settings.themeRepeatLimit).filter(t => t === theme).length >= settings.themeRepeatLimit) {
      continue;
    }

    const pattern     = selectPattern(patterns, sessionUsedPatterns.slice(-settings.patternRepeatLimit), patternIdx);
    const hookTemplate = pickHook(hooks);

    let postContent = '';
    let scoreResult  = null;
    let accepted     = false;

    for (let attempt = 0; attempt <= settings.maxRewrites; attempt++) {
      if (attempt > 0) console.log(`  [Writer] 再生成 ${attempt}回目`);

      postContent = await generatePost(account, pattern, theme, note, hookTemplate, brief);

      // 品質スコアリング
      scoreResult = await scorePost(postContent, account, pattern.id);
      console.log(`  [Writer] スコア: ${scoreResult.average} (${pattern.name} / ${subtopic})`);

      if (scoreResult.average >= settings.qualityThreshold) {
        accepted = true;
        break;
      }
      console.log(`  [Writer] スコア不足 (${scoreResult.average} < ${settings.qualityThreshold})。${attempt < settings.maxRewrites ? '再生成...' : '棄却'}`);
    }

    if (!accepted) {
      console.log(`  [Writer] 棄却: ${subtopic}`);
      continue;
    }

    // 類似度チェック
    const allTexts = [...historyTexts, ...queue.posts.map(p => p.content)];
    const sim = maxSimilarity(postContent, allTexts);
    if (sim >= settings.similarityThreshold) {
      console.log(`  [Writer] 類似度超過 (${sim.toFixed(2)} >= ${settings.similarityThreshold})。棄却`);
      continue;
    }

    // キューに追加
    const post = {
      id:          `post_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      content:     postContent,
      pattern:     pattern.id,
      theme,
      score:       scoreResult.average,
      scoreFeedback: scoreResult.feedback,
      createdAt:   new Date().toISOString(),
    };
    queue.posts.push(post);
    historyTexts.push(postContent);
    sessionUsedPatterns.push(pattern.id);
    sessionUsedThemes.push(theme);
    patternIdx = (patternIdx + 1) % patterns.length;
    generated++;
    console.log(`  [Writer] 追加: ${generated}/${target} (スコア: ${scoreResult.average})`);
  }

  writeQueue(accountId, queue);
  console.log(`[Writer] 完了。${generated}本の投稿をキューに追加しました。`);
}

const accountId = process.argv[2] || 'career';
run(accountId).catch(err => {
  console.error('[Writer] エラー:', err.message);
  process.exit(1);
});
