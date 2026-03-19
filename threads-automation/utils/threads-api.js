'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const BASE_URL = 'https://graph.threads.net/v1.0';

/**
 * Threads にテキスト投稿する（2ステップ）
 * @param {string} text - 投稿テキスト
 * @param {string} userId - Threads ユーザーID
 * @param {string} accessToken - アクセストークン
 * @returns {Promise<string>} 投稿ID
 */
async function createPost(text, userId, accessToken) {
  // Step 1: コンテナ作成
  const containerRes = await axios.post(`${BASE_URL}/${userId}/threads`, null, {
    params: {
      media_type: 'TEXT',
      text,
      access_token: accessToken,
    },
  });
  const containerId = containerRes.data.id;

  // Step 2: 公開
  const publishRes = await axios.post(`${BASE_URL}/${userId}/threads_publish`, null, {
    params: {
      creation_id: containerId,
      access_token: accessToken,
    },
  });
  return publishRes.data.id;
}

/**
 * 投稿へのリプライを作成する（ツリー / コメント欄追記）
 * @param {string} text - リプライテキスト
 * @param {string} replyToId - 返信先の投稿ID
 * @param {string} userId
 * @param {string} accessToken
 * @returns {Promise<string>} リプライID
 */
async function createReply(text, replyToId, userId, accessToken) {
  const containerRes = await axios.post(`${BASE_URL}/${userId}/threads`, null, {
    params: {
      media_type: 'TEXT',
      text,
      reply_to_id: replyToId,
      access_token: accessToken,
    },
  });
  const containerId = containerRes.data.id;

  const publishRes = await axios.post(`${BASE_URL}/${userId}/threads_publish`, null, {
    params: {
      creation_id: containerId,
      access_token: accessToken,
    },
  });
  return publishRes.data.id;
}

/**
 * 投稿メトリクスを取得する
 * @param {string} postId - Threads 投稿ID
 * @param {string} accessToken
 * @returns {Promise<{views:number, likes:number, replies:number, reposts:number}>}
 */
async function getMetrics(postId, accessToken) {
  const res = await axios.get(`${BASE_URL}/${postId}/insights`, {
    params: {
      metric: 'views,likes,replies,reposts_count',
      access_token: accessToken,
    },
  });

  const result = { views: 0, likes: 0, replies: 0, reposts: 0 };
  for (const item of res.data.data || []) {
    switch (item.name) {
      case 'views':          result.views   = item.values?.[0]?.value ?? 0; break;
      case 'likes':          result.likes   = item.values?.[0]?.value ?? 0; break;
      case 'replies':        result.replies = item.values?.[0]?.value ?? 0; break;
      case 'reposts_count':  result.reposts = item.values?.[0]?.value ?? 0; break;
    }
  }
  return result;
}

module.exports = { createPost, createReply, getMetrics };
