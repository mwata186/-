'use strict';

/**
 * テキストを単語頻度マップ（TF）に変換する
 * @param {string} text
 * @returns {Map<string, number>}
 */
function toFreqMap(text) {
  const map = new Map();
  const tokens = text
    .toLowerCase()
    // 日本語・英数字・ひらがな・カタカナ・漢字の区切りに対応
    .replace(/[^\w\u3041-\u9FFF]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    map.set(token, (map.get(token) || 0) + 1);
  }
  return map;
}

/**
 * 2テキスト間のコサイン類似度を返す（0.0〜1.0）
 * @param {string} textA
 * @param {string} textB
 * @returns {number}
 */
function cosineSimilarity(textA, textB) {
  const mapA = toFreqMap(textA);
  const mapB = toFreqMap(textB);

  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const key of allKeys) {
    const a = mapA.get(key) || 0;
    const b = mapB.get(key) || 0;
    dot   += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 新しい投稿が既存投稿の中で最も類似している値を返す
 * @param {string} newPost
 * @param {string[]} existingPosts
 * @returns {number} 最大類似度
 */
function maxSimilarity(newPost, existingPosts) {
  let max = 0;
  for (const post of existingPosts) {
    const sim = cosineSimilarity(newPost, post);
    if (sim > max) max = sim;
  }
  return max;
}

module.exports = { cosineSimilarity, maxSimilarity };
