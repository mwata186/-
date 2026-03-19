'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

/**
 * Claude にテキスト生成を依頼する汎用ラッパー
 * @param {string} systemPrompt - システムプロンプト
 * @param {string} userPrompt  - ユーザープロンプト
 * @param {number} maxTokens   - 最大トークン数（デフォルト 2048）
 * @returns {Promise<string>} 生成テキスト
 */
async function generate(systemPrompt, userPrompt, maxTokens = 2048) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });
  return response.content[0].text.trim();
}

/**
 * JSON を返すことを前提とした生成（パース失敗時はエラーをスロー）
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {number} maxTokens
 * @returns {Promise<object>}
 */
async function generateJSON(systemPrompt, userPrompt, maxTokens = 2048) {
  const raw = await generate(systemPrompt, userPrompt, maxTokens);
  // コードブロックを除去してパース
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { generate, generateJSON };
