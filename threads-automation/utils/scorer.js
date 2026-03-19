'use strict';

const { generateJSON } = require('./ai-client');

const SCORING_CRITERIA = [
  { id: 'hook_strength',      label: 'フックの強さ',     desc: '1行目のインパクト・続きを読みたくなるか' },
  { id: 'value',              label: '有益性',           desc: '読者に有益な情報・気づきがあるか' },
  { id: 'specificity',        label: '具体性',           desc: '具体的な数字・事例・固有名詞があるか' },
  { id: 'pacing',             label: 'テンポ感',         desc: '改行・読みやすさのリズムが良いか' },
  { id: 'persona_fit',        label: 'ペルソナ適合',     desc: 'アカウントのトーン・ターゲットと合っているか' },
  { id: 'engagement',         label: 'エンゲージ誘発',   desc: 'コメント・シェアを誘発しやすいか' },
  { id: 'originality',        label: '独自性',           desc: '既視感がなく新鮮な切り口か' },
  { id: 'pattern_compliance', label: 'パターン適合',     desc: '指定した投稿パターンに沿っているか' },
  { id: 'cta',                label: 'CTA',              desc: '次のアクション（フォロー・コメント等）への誘導があるか' },
  { id: 'format',             label: 'フォーマット',     desc: '文字数・改行がThreads向けに最適化されているか' },
];

/**
 * 投稿テキストを10基準で採点し、平均スコアと詳細を返す
 * @param {string} postContent - 採点する投稿テキスト
 * @param {object} account     - アカウントナレッジ（ペルソナ情報）
 * @param {string} pattern     - 使用パターンID
 * @returns {Promise<{average: number, scores: object, feedback: string}>}
 */
async function scorePost(postContent, account, pattern) {
  const systemPrompt = `あなたはSNS投稿の品質を評価するエキスパートです。
以下の10基準で投稿を採点してください。各基準は0〜10点（小数点1桁まで）。
必ずJSONで返してください。

採点基準：
${SCORING_CRITERIA.map((c, i) => `${i + 1}. ${c.id} (${c.label}): ${c.desc}`).join('\n')}

出力形式（JSON）:
{
  "scores": {
    "hook_strength": 8.0,
    "value": 7.5,
    ...（10項目全て）
  },
  "average": 7.8,
  "feedback": "改善点の簡潔なコメント"
}`;

  const userPrompt = `【アカウント情報】
ニッチ: ${account.niche}
ペルソナ: ${JSON.stringify(account.persona)}
使用パターン: ${pattern}

【採点対象の投稿】
${postContent}`;

  const result = await generateJSON(systemPrompt, userPrompt, 1024);

  // average を再計算して整合性を保証
  const values = Object.values(result.scores);
  result.average = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;

  return result;
}

module.exports = { scorePost, SCORING_CRITERIA };
