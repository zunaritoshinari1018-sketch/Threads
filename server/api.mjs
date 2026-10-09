import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testState = new Map();
const requestWindows = new Map();
const youtubeDailyUsage = { date: '', units: 0 };

function clientKey(req) { return req.socket?.remoteAddress || req.connection?.remoteAddress || 'local'; }
function rateLimit(req, key, limit, windowMs = 60_000) {
  const bucketKey = `${clientKey(req)}:${key}`; const now = Date.now(); const bucket = requestWindows.get(bucketKey);
  if (!bucket || now - bucket.start >= windowMs) { requestWindows.set(bucketKey, { start: now, count: 1 }); return true; }
  if (bucket.count >= limit) return false;
  bucket.count += 1; return true;
}
function reserveYoutubeUnits(units) {
  const today = new Date().toISOString().slice(0, 10);
  if (youtubeDailyUsage.date !== today) { youtubeDailyUsage.date = today; youtubeDailyUsage.units = 0; }
  if (youtubeDailyUsage.units + units > 10_000) return false;
  youtubeDailyUsage.units += units; return true;
}

function loadPrivateEnv() {
  const names = ['.env', '.env.local', '.env.development', '.env.development.local'];
  for (const name of names) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value.replace(/\\n/g, '\n');
    }
  }
}
loadPrivateEnv();

function json(res, status, data) {
  const body = JSON.stringify(data);
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(body);
}

async function readJson(req, maxBytes = 1024 * 1024) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) throw Object.assign(new Error('リクエストのサイズが上限を超えています。'), { status: 413 });
  }
  if (!body) return {};
  try { return JSON.parse(body); } catch { throw Object.assign(new Error('JSON形式の入力を確認してください。'), { status: 400 }); }
}

async function fetchJson(url, options = {}, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    const rawText = await response.text();
    let data;
    try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = {}; }
    return { response, data };
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('外部APIの応答がタイムアウトしました。時間をおいて再試行してください。'), { code: 'timeout' });
    throw Object.assign(new Error('外部APIに接続できませんでした。ネットワークを確認して再試行してください。'), { code: 'network' });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  let date;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0 && (typeof value === 'number' || /^\d{10,13}$/.test(String(value)))) date = new Date(numeric < 1e12 ? numeric * 1000 : numeric);
  else date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function publicApiError(data, status) {
  const message = data?.error?.message || data?.error?.errors?.[0]?.message || '';
  const providerCode = Number(data?.error?.code);
  if (providerCode === 190 || /expired|invalid oauth|access token.*invalid/i.test(message)) return { status: 'reauth_required', message: 'アクセストークンの有効期限または権限を確認し、再認証してください。' };
  if (status === 429 || [4, 17, 32, 368, 613].includes(providerCode) || /rate limit|too many calls|quota|daily limit|resource_exhausted/i.test(message)) return { status: 'quota', message: 'APIの利用上限またはレート制限に達しました。上限のリセット後に再試行してください。' };
  const reasons = [
    ...(data?.error?.errors || []).map((item) => item.reason),
    ...(data?.error?.details || []).map((item) => item?.errors?.[0]?.errorCode ? JSON.stringify(item.errors[0].errorCode) : ''),
  ].filter(Boolean).join(' ').toLowerCase();
  if (/quota|daily limit|resource_exhausted/.test(`${reasons} ${message}`)) return { status: 'quota', message: 'APIの利用上限に達しました。クォータのリセット後に再試行してください。' };
  if ([10, 200, 299].includes(providerCode) || status === 401 || status === 403) return { status: 'permission', message: '認証またはAPI権限を確認してください。Meta App Review・アカウント種別・APIキー制限も確認してください。' };
  if (status === 404) return { status: 'not_found', message: 'APIエンドポイントまたは対象リソースを確認してください。' };
  if (status >= 500) return { status: 'temporary_error', message: '外部APIで一時的な障害が発生しています。時間をおいて再試行してください。' };
  return { status: 'error', message: message ? 'APIがリクエストを拒否しました。設定と入力条件を確認してください。' : 'APIリクエストに失敗しました。設定とネットワークを確認してください。' };
}

function youtubeConfigured() { return Boolean(process.env.YOUTUBE_API_KEY?.trim()); }
function instagramMissing() { return ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_USER_ID'].filter((key) => !process.env[key]?.trim()); }
function threadsMissing() { return ['THREADS_ACCESS_TOKEN'].filter((key) => !process.env[key]?.trim()); }
function metaApiVersion() { return /^v\d+\.0$/.test(process.env.META_GRAPH_API_VERSION || '') ? process.env.META_GRAPH_API_VERSION : 'v23.0'; }
function googleAdsMissing() {
  const required = ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID'];
  return required.filter((key) => !process.env[key]?.trim());
}

function currentStatus(platform) {
  const state = testState.get(platform);
  if (state?.status === 'connected') return { status: 'connected', testedAt: state.testedAt };
  if (state?.status && !['connected', 'not_configured', 'not_tested'].includes(state.status)) return { status: state.status, testedAt: state.testedAt, message: state.message };
  return { status: 'not_tested' };
}

function youtubeUrl(url, params) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') parsed.searchParams.set(key, String(value));
  parsed.searchParams.set('key', process.env.YOUTUBE_API_KEY);
  return parsed;
}

async function getYoutubeTest() {
  if (!youtubeConfigured()) return { ok: false, status: 'not_configured', message: 'YOUTUBE_API_KEY がサーバー環境に設定されていません。' };
  if (!reserveYoutubeUnits(1)) return { ok: false, status: 'quota', message: '本日のYouTube概算クォータ上限に達しました。翌日に再試行してください。' };
  const url = youtubeUrl('https://youtube.googleapis.com/youtube/v3/i18nLanguages', { part: 'snippet', maxResults: 1 });
  const { response, data } = await fetchJson(url);
  if (!response.ok || !Array.isArray(data.items)) {
    const error = publicApiError(data, response.status);
    return { ok: false, ...error };
  }
  const testedAt = new Date().toISOString();
  testState.set('youtube', { status: 'connected', testedAt });
  return { ok: true, status: 'connected', testedAt, message: 'YouTube Data API v3 の接続テストに成功しました。' };
}

function metaUrl(base, params = {}) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  return url;
}

async function getInstagramTest() {
  const missing = instagramMissing();
  if (missing.length) return { ok: false, status: 'not_configured', message: 'Instagram API のサーバー環境変数が未設定です。', missing };
  const url = metaUrl(`https://graph.facebook.com/${metaApiVersion()}/${encodeURIComponent(process.env.INSTAGRAM_USER_ID)}/recently_searched_hashtags`, {
    fields: 'id,name', limit: 1, access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
  });
  const { response, data } = await fetchJson(url);
  if (!response.ok || !Array.isArray(data.data)) {
    const error = publicApiError(data, response.status);
    return { ok: false, ...error };
  }
  const testedAt = new Date().toISOString();
  testState.set('instagram', { status: 'connected', testedAt });
  return { ok: true, status: 'connected', testedAt, message: 'Instagram Graph APIのアカウントと、最近検索したハッシュタグ参照権限を確認しました。新規ハッシュタグ検索権限はApp Review等に依存します。' };
}

async function getThreadsTest() {
  const missing = threadsMissing();
  if (missing.length) return { ok: false, status: 'not_configured', message: 'Threads API のサーバー環境変数が未設定です。', missing };
  const url = metaUrl('https://graph.threads.com/v1.0/me', {
    fields: 'id,username', access_token: process.env.THREADS_ACCESS_TOKEN,
  });
  const { response, data } = await fetchJson(url);
  if (!response.ok || !data.id) {
    const error = publicApiError(data, response.status);
    return { ok: false, ...error };
  }
  const testedAt = new Date().toISOString();
  testState.set('threads', { status: 'connected', testedAt });
  return { ok: true, status: 'connected', testedAt, message: 'Threads APIの /me 接続テストに成功しました。threads_keyword_search権限は実際の検索時に別途検証されます。' };
}

async function getGoogleAccessToken() {
  const missing = googleAdsMissing();
  if (missing.length) return { ok: false, status: 'not_configured', message: 'Google Ads API のサーバー環境変数が未設定です。', missing };
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const { response, data } = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!response.ok || !data.access_token) {
    return { ok: false, status: response.status === 401 ? 'reauth_required' : 'auth_error', message: 'Google OAuth トークンを取得できませんでした。OAuthクライアントとリフレッシュトークンを確認してください。' };
  }
  return { ok: true, token: data.access_token };
}

async function googleAdsRequest(customerId, accessToken, method, body) {
  const version = /^v\d+$/.test(process.env.GOOGLE_ADS_API_VERSION || '') ? process.env.GOOGLE_ADS_API_VERSION : 'v23';
  const cleanCustomer = String(customerId || process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/\D/g, '');
  const url = `https://googleads.googleapis.com/${version}/customers/${cleanCustomer}:${method}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    'Content-Type': 'application/json',
  };
  const loginCustomer = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, '');
  if (loginCustomer) headers['login-customer-id'] = loginCustomer;
  return fetchJson(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function getGoogleAdsTest() {
  const auth = await getGoogleAccessToken();
  if (!auth.ok) return auth;
  const { response, data } = await googleAdsRequest(process.env.GOOGLE_ADS_CUSTOMER_ID, auth.token, 'searchStream', { query: 'SELECT customer.id FROM customer LIMIT 1' });
  if (!response.ok) {
    const error = publicApiError(data, response.status);
    return { ok: false, ...error };
  }
  const testedAt = new Date().toISOString();
  testState.set('google', { status: 'connected', testedAt });
  return { ok: true, status: 'connected', testedAt, message: 'Google Ads API の認証と顧客アカウントへのアクセスを確認しました。' };
}

async function searchYoutube(url) {
  if (!youtubeConfigured()) return { status: 503, body: { ok: false, status: 'not_configured', message: 'YouTube API は未設定です。YOUTUBE_API_KEY をサーバー環境に設定してください。手動調査やローカル分析は引き続き利用できます。' } };
  const keyword = (url.searchParams.get('keyword') || '').trim();
  if (!keyword || keyword.length > 200) return { status: 400, body: { ok: false, status: 'invalid_input', message: '検索語を1〜200文字で入力してください。' } };
  const maxResults = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('maxResults') || '10', 10) || 10));
  const sortBy = ['relevance', 'date', 'viewCount', 'rating', 'title'].includes(url.searchParams.get('order')) ? url.searchParams.get('order') : 'relevance';
  const days = Math.min(3650, Math.max(0, Number.parseInt(url.searchParams.get('publishedWithinDays') || '0', 10) || 0));
  if (!reserveYoutubeUnits(101)) return { status: 429, body: { ok: false, status: 'quota', message: 'YouTube APIのサーバー側概算クォータ（10,000 units/日）に達しました。翌日に再試行してください。' } };
  const publishedAfter = days ? new Date(Date.now() - days * 86400000).toISOString() : '';
  const searchParams = {
    part: 'snippet', type: 'video', maxResults, q: keyword, order: sortBy,
    regionCode: (url.searchParams.get('regionCode') || 'JP').slice(0, 2).toUpperCase(),
    relevanceLanguage: (url.searchParams.get('language') || 'ja').slice(0, 2).toLowerCase(),
    publishedAfter,
    pageToken: (url.searchParams.get('cursor') || '').slice(0, 512),
  };
  const searchUrl = youtubeUrl('https://youtube.googleapis.com/youtube/v3/search', searchParams);
  const searchResult = await fetchJson(searchUrl);
  if (!searchResult.response.ok) {
    const error = publicApiError(searchResult.data, searchResult.response.status);
    return { status: searchResult.response.status, body: { ok: false, ...error } };
  }
  const searchItems = Array.isArray(searchResult.data.items) ? searchResult.data.items : [];
  const ids = searchItems.map((item) => item?.id?.videoId).filter(Boolean);
  let details = [];
  if (ids.length) {
    const videosUrl = youtubeUrl('https://youtube.googleapis.com/youtube/v3/videos', { part: 'snippet,statistics', id: ids.join(',') });
    const detailsResult = await fetchJson(videosUrl);
    if (!detailsResult.response.ok) {
      const error = publicApiError(detailsResult.data, detailsResult.response.status);
      return { status: detailsResult.response.status, body: { ok: false, ...error } };
    }
    details = detailsResult.data.items || [];
  }
  const detailsById = new Map(details.map((item) => [item.id, item]));
  const collectedAt = new Date().toISOString();
  const items = searchItems.map((item) => {
    const id = item?.id?.videoId;
    const extra = detailsById.get(id);
    const stats = extra?.statistics || {};
    return {
      platform: 'youtube',
      source_type: 'public_video',
      source_url: `https://www.youtube.com/watch?v=${encodeURIComponent(id || '')}`,
      video_id: id,
      title: item?.snippet?.title || extra?.snippet?.title || '',
      channel_title: item?.snippet?.channelTitle || extra?.snippet?.channelTitle || '',
      channel_id: item?.snippet?.channelId || extra?.snippet?.channelId || '',
      channel_url: item?.snippet?.channelId ? `https://www.youtube.com/channel/${item.snippet.channelId}` : '',
      description: item?.snippet?.description || extra?.snippet?.description || '',
      published_at: item?.snippet?.publishedAt || extra?.snippet?.publishedAt || null,
      collected_at: collectedAt,
      metrics: {
        views: stats.viewCount != null ? Number(stats.viewCount) : null,
        likes: stats.likeCount != null ? Number(stats.likeCount) : null,
        comments: stats.commentCount != null ? Number(stats.commentCount) : null,
      },
      retrieval_status: 'success',
      data_origin: 'official_api',
      confidence: 'measured',
      analysis_status: 'not_analyzed',
    };
  });
  const testedAt = new Date().toISOString();
  return { status: 200, body: { ok: true, items, collectedAt, sampleCount: items.length, nextCursor: searchResult.data.nextPageToken || null, quotaEstimate: ids.length ? 101 : 100, message: items.length ? '' : '検索結果は0件でした。条件を変更して再試行してください。' } };
}

async function searchThreads(url) {
  const missing = threadsMissing();
  if (missing.length) return { status: 503, body: { ok: false, status: 'not_configured', message: 'Threads APIは未設定です。THREADS_ACCESS_TOKENをサーバー環境に設定してください。', missing } };
  const keyword = (url.searchParams.get('keyword') || '').trim();
  if (!keyword || keyword.length > 200) return { status: 400, body: { ok: false, status: 'invalid_input', message: '検索語を1〜200文字で入力してください。' } };
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '25', 10) || 25));
  const searchType = ['TOP', 'RECENT'].includes((url.searchParams.get('sort') || '').toUpperCase()) ? url.searchParams.get('sort').toUpperCase() : 'RECENT';
  const usageUrl = metaUrl('https://graph.threads.com/v1.0/me', { fields: 'recently_searched_keywords', access_token: process.env.THREADS_ACCESS_TOKEN });
  const usageResult = await fetchJson(usageUrl);
  if (!usageResult.response.ok || !Array.isArray(usageResult.data.recently_searched_keywords)) {
    const error = publicApiError(usageResult.data, usageResult.response.status);
    return { status: usageResult.response.status || 502, body: { ok: false, ...error, message: `${error.message} Threadsの直近検索枠を確認できないため、安全のため検索を停止しました。` } };
  }
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const activeQueryCount = usageResult.data.recently_searched_keywords.filter((item) => {
    const raw = item?.timestamp; const numeric = Number(raw);
    const timestamp = Number.isFinite(numeric) && numeric > 0 ? (numeric < 1e12 ? numeric * 1000 : numeric) : Date.parse(raw);
    return !Number.isFinite(timestamp) || timestamp >= cutoff;
  }).length;
  if (activeQueryCount >= 2200) return { status: 429, body: { ok: false, status: 'quota', activeQueriesUsed: activeQueryCount, message: 'MetaアカウントのThreads検索上限（直近24時間で2,200件）に達しています。ローリング枠が空いてから再試行してください。' } };
  const params = { q: keyword, search_type: searchType, search_mode: 'KEYWORD', fields: 'id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply', limit, access_token: process.env.THREADS_ACCESS_TOKEN };
  const cursor = (url.searchParams.get('cursor') || '').slice(0, 512);
  if (cursor) params.after = cursor;
  const since = url.searchParams.get('since'); const until = url.searchParams.get('until');
  if (since) params.since = since.slice(0, 32);
  if (until) params.until = until.slice(0, 32);
  const requestUrl = metaUrl('https://graph.threads.com/v1.0/keyword_search', params);
  const { response, data } = await fetchJson(requestUrl);
  if (!response.ok || !Array.isArray(data.data)) {
    const error = publicApiError(data, response.status);
    return { status: response.status || 502, body: { ok: false, ...error, activeQueriesUsed: activeQueryCount } };
  }
  const collectedAt = new Date().toISOString();
  const items = data.data.map((item) => ({
    platform: 'threads', source_type: 'public_post', source_url: item.permalink || '', post_id: item.id || '',
    title: (item.text || '').split(/\r?\n/)[0].slice(0, 100), text: item.text || '', username: item.username || '',
    author_url: item.username ? `https://www.threads.com/@${encodeURIComponent(item.username)}` : '',
media_type: item.media_type || null, published_at: normalizeTimestamp(item.timestamp), collected_at: collectedAt,
    metrics: { replies_available: item.has_replies === true ? true : item.has_replies === false ? false : null, likes: null, comments: null, shares: null },
    retrieval_status: 'success', data_origin: 'official_api', confidence: 'measured', analysis_status: 'not_analyzed',
  }));
  const activeQueriesUsed = Math.min(2200, activeQueryCount + (items.length ? 1 : 0));
  return { status: 200, body: { ok: true, items, collectedAt, sampleCount: items.length, activeQueriesUsed, nextCursor: data.paging?.cursors?.after || null, sampleNote: 'APIが返したページのサンプルです。権限・App Review・検索条件により範囲が異なり、網羅的な投稿一覧や検索需要を示しません。', message: items.length ? '' : '検索結果が0件でした。検索語や権限を確認してください。' } };
}

async function searchInstagram(url) {
  const missing = instagramMissing();
  if (missing.length) return { status: 503, body: { ok: false, status: 'not_configured', message: 'Instagram Graph APIは未設定です。INSTAGRAM_ACCESS_TOKEN と INSTAGRAM_USER_ID をサーバー環境に設定してください。', missing } };
  const hashtag = (url.searchParams.get('hashtag') || '').trim().replace(/^#+/, '');
  if (!hashtag || hashtag.length > 80 || !/^[\p{L}\p{N}_]+$/u.test(hashtag)) return { status: 400, body: { ok: false, status: 'invalid_input', message: 'ハッシュタグ名を入力してください（#・空白を除く、80文字まで）。' } };
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '25', 10) || 25));
  const sortBy = ['top', 'recent'].includes((url.searchParams.get('sort') || '').toLowerCase()) ? url.searchParams.get('sort').toLowerCase() : 'recent';
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  const version = metaApiVersion();
  const recentUrl = metaUrl(`https://graph.facebook.com/${version}/${encodeURIComponent(userId)}/recently_searched_hashtags`, { fields: 'id,name', limit: 30, access_token: token });
  const recentResult = await fetchJson(recentUrl);
  if (!recentResult.response.ok || !Array.isArray(recentResult.data.data)) {
    const error = publicApiError(recentResult.data, recentResult.response.status);
    return { status: recentResult.response.status || 502, body: { ok: false, ...error, message: `${error.message} ハッシュタグ枠を確認できないため、検索を安全のため停止しました。` } };
  }
  const activeHashtagNames = new Set(recentResult.data.data.map((item) => String(item.name || '').replace(/^#+/, '').toLowerCase()).filter(Boolean));
  const activeHashtagsCount = recentResult.data.data.length;
  const alreadyCounted = activeHashtagNames.has(hashtag.toLowerCase());
  if (!alreadyCounted && activeHashtagsCount >= 30) return { status: 429, body: { ok: false, status: 'quota', activeHashtagsUsed: activeHashtagsCount, message: 'Metaアカウントの現在のハッシュタグ枠が30/30です。7日間のローリング枠が空くまで新しいタグ検索を停止しました。' } };
  const activeHashtagsUsed = Math.min(30, activeHashtagsCount + (alreadyCounted ? 0 : 1));
  const tagUrl = metaUrl(`https://graph.facebook.com/${version}/ig_hashtag_search`, { user_id: userId, q: hashtag, access_token: token });
  const tagResult = await fetchJson(tagUrl);
  if (!tagResult.response.ok) {
    const error = publicApiError(tagResult.data, tagResult.response.status);
    return { status: tagResult.response.status, body: { ok: false, ...error, activeHashtagsUsed } };
  }
  const hashtagId = tagResult.data?.data?.[0]?.id;
  if (!hashtagId) return { status: 200, body: { ok: true, items: [], collectedAt: new Date().toISOString(), sampleCount: 0, activeHashtagsUsed, message: '一致するハッシュタグがありませんでした。' } };
  const cursor = (url.searchParams.get('cursor') || '').slice(0, 512);
  const fields = 'id,caption,media_type,permalink,timestamp,like_count,comments_count';
  const mediaUrl = metaUrl(`https://graph.facebook.com/${version}/${encodeURIComponent(hashtagId)}/${sortBy}_media`, {
    user_id: userId, fields, limit, access_token: token, after: cursor,
  });
  const mediaResult = await fetchJson(mediaUrl);
  if (!mediaResult.response.ok || !Array.isArray(mediaResult.data.data)) {
    const error = publicApiError(mediaResult.data, mediaResult.response.status);
    return { status: mediaResult.response.status || 502, body: { ok: false, ...error, activeHashtagsUsed } };
  }
  const collectedAt = new Date().toISOString();
  const items = mediaResult.data.data.map((item) => ({
    platform: 'instagram', source_type: 'public_hashtag_media', source_url: item.permalink || `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`,
    post_id: item.id || '', title: (item.caption || '').split(/\r?\n/)[0].slice(0, 100), text: item.caption || '',
    description: '', media_type: item.media_type || null, published_at: normalizeTimestamp(item.timestamp), collected_at: collectedAt,
    metrics: { likes: item.like_count != null ? Number(item.like_count) : null, comments: item.comments_count != null ? Number(item.comments_count) : null, views: null },
    retrieval_status: 'success', data_origin: 'official_api', confidence: 'measured', analysis_status: 'not_analyzed',
  }));
  return { status: 200, body: { ok: true, items, collectedAt, sampleCount: items.length, hashtag: `#${hashtag}`, hashtagId, activeHashtagsUsed, nextCursor: mediaResult.data.paging?.next ? mediaResult.data.paging.cursors?.after || null : null, sampleNote: `Metaが現在の枠で返した${sortBy === 'recent' ? '直近24時間以内に公開された' : ''}公開メディアのサンプルです。Business/Creatorアカウントと審査済み権限が必要で、最大50件/ページ・一意ハッシュタグ30件/7日などの制限があります。網羅検索ではありません。`, message: items.length ? '' : '検索結果が0件でした。公開期間・ハッシュタグ・権限を確認してください。' } };
}

async function googleKeywordIdeas(body) {
  const missing = googleAdsMissing();
  if (missing.length) return { status: 503, body: { ok: false, status: 'not_configured', message: 'Google Ads API は未設定です。API認証情報はサーバー環境変数に設定してください。', missing } };
  const seed = typeof body.seed === 'string' ? body.seed.trim() : '';
  if (!seed || seed.length > 200) return { status: 400, body: { ok: false, status: 'invalid_input', message: '起点キーワードを1〜200文字で入力してください。' } };
  const token = await getGoogleAccessToken();
  if (!token.ok) return { status: 401, body: token };
  const languageId = String(body.languageId || '1005').replace(/\D/g, '') || '1005';
  const geoTargetId = String(body.geoTargetId || '2392').replace(/\D/g, '') || '2392';
  const requestBody = {
    keywordSeed: { keywords: [seed] },
    language: `languageConstants/${languageId}`,
    geoTargetConstants: [`geoTargetConstants/${geoTargetId}`],
    keywordPlanNetwork: 'GOOGLE_SEARCH',
    includeAdultKeywords: false,
    pageSize: Math.min(100, Math.max(1, Number(body.limit) || 50)),
  };
  const { response, data } = await googleAdsRequest(process.env.GOOGLE_ADS_CUSTOMER_ID, token.token, 'generateKeywordIdeas', requestBody);
  if (!response.ok) {
    const error = publicApiError(data, response.status);
    return { status: response.status, body: { ok: false, ...error } };
  }
  const collectedAt = new Date().toISOString();
  const results = (data.results || []).map((item) => ({
    text: item.text || '',
    avg_monthly_searches: item.keywordIdeaMetrics?.avgMonthlySearches != null ? Number(item.keywordIdeaMetrics.avgMonthlySearches) : null,
    competition: item.keywordIdeaMetrics?.competition || null,
    competition_index: item.keywordIdeaMetrics?.competitionIndex != null ? Number(item.keywordIdeaMetrics.competitionIndex) : null,
    low_top_of_page_bid_micros: item.keywordIdeaMetrics?.lowTopOfPageBidMicros != null ? Number(item.keywordIdeaMetrics.lowTopOfPageBidMicros) : null,
    high_top_of_page_bid_micros: item.keywordIdeaMetrics?.highTopOfPageBidMicros != null ? Number(item.keywordIdeaMetrics.highTopOfPageBidMicros) : null,
    monthly_search_volumes: Array.isArray(item.keywordIdeaMetrics?.monthlySearchVolumes) ? item.keywordIdeaMetrics.monthlySearchVolumes.map((month) => ({ year: Number(month.year), month: month.month, searches: Number(month.monthlySearches) })) : [],
    platform: 'google',
    source_type: 'google_ads_keyword_idea',
    source_url: 'https://ads.google.com/aw/keywordplanner/home',
    keyword: seed,
    collected_at: collectedAt,
    retrieval_status: 'success',
    data_origin: 'official_api',
    confidence: 'measured',
    analysis_status: 'not_analyzed',
    note: 'Google Ads Keyword Planning指標。広告競合度は自然検索SEO難易度ではありません。',
  }));
  const testedAt = new Date().toISOString();
  return { status: 200, body: { ok: true, items: results, collectedAt, sampleCount: results.length, message: results.length ? '' : 'キーワード候補がありませんでした。起点語句や対象地域を確認してください。' } };
}

export async function handleApi(req, res) {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const route = requestUrl.pathname;
  if (!route.startsWith('/api/')) return false;
  try {
    if (route === '/api/status' && req.method === 'GET') {
      const adsMissing = googleAdsMissing();
      return json(res, 200, {
        ok: true,
        server: 'Layer API gateway',
        platforms: {
          youtube: { configured: youtubeConfigured(), ...(youtubeConfigured() ? currentStatus('youtube') : { status: 'not_configured' }), missing: youtubeConfigured() ? [] : ['YOUTUBE_API_KEY'] },
          google: { configured: adsMissing.length === 0, ...(adsMissing.length ? { status: 'not_configured' } : currentStatus('google')), missing: adsMissing },
          instagram: { configured: instagramMissing().length === 0, ...(instagramMissing().length ? { status: 'not_configured' } : currentStatus('instagram')), missing: instagramMissing(), message: 'ハッシュタグ検索はBusiness/Creatorアカウント、instagram_basic・Instagram Public Content Access等の権限に依存します。' },
          threads: { configured: threadsMissing().length === 0, ...(threadsMissing().length ? { status: 'not_configured' } : currentStatus('threads')), missing: threadsMissing(), message: '公開投稿の検索範囲はthreads_keyword_search権限とApp Review状態に依存します。' },
        },
        usage: { youtubeQuota: { date: youtubeDailyUsage.date, estimatedUnits: youtubeDailyUsage.units, dailyLimit: 10_000 } },
        checkedAt: new Date().toISOString(),
      });
    }
    if (route === '/api/youtube/test' && req.method === 'POST') {
      if (!rateLimit(req, 'youtube-test', 10)) return json(res, 429, { ok: false, status: 'rate_limited', message: '接続テストの実行頻度が高すぎます。1分ほど待って再試行してください。' });
      const result = await getYoutubeTest();
      if (!result.ok) testState.set('youtube', { ...result, testedAt: new Date().toISOString() });
      return json(res, result.ok ? 200 : result.status === 'not_configured' ? 503 : 502, result);
    }
    if (route === '/api/youtube/search' && req.method === 'GET') {
      if (!rateLimit(req, 'youtube-search', 25)) return json(res, 429, { ok: false, status: 'rate_limited', message: 'YouTube API検索の実行頻度が高すぎます。1分ほど待って再試行してください。' });
      const result = await searchYoutube(requestUrl);
      return json(res, result.status, result.body);
    }
    if (route === '/api/instagram/test' && req.method === 'POST') {
      if (!rateLimit(req, 'instagram-test', 10)) return json(res, 429, { ok: false, status: 'rate_limited', message: '接続テストの実行頻度が高すぎます。1分ほど待って再試行してください。' });
      const result = await getInstagramTest();
      if (!result.ok) testState.set('instagram', { ...result, testedAt: new Date().toISOString() });
      return json(res, result.ok ? 200 : result.status === 'not_configured' ? 503 : 502, result);
    }
    if (route === '/api/threads/test' && req.method === 'POST') {
      if (!rateLimit(req, 'threads-test', 10)) return json(res, 429, { ok: false, status: 'rate_limited', message: '接続テストの実行頻度が高すぎます。1分ほど待って再試行してください。' });
      const result = await getThreadsTest();
      if (!result.ok) testState.set('threads', { ...result, testedAt: new Date().toISOString() });
      return json(res, result.ok ? 200 : result.status === 'not_configured' ? 503 : 502, result);
    }
    if (route === '/api/instagram/search' && req.method === 'GET') {
      if (!rateLimit(req, 'instagram-search', 20)) return json(res, 429, { ok: false, status: 'rate_limited', message: 'Instagram API検索の実行頻度が高すぎます。しばらく待って再試行してください。' });
      const result = await searchInstagram(requestUrl);
      return json(res, result.status, result.body);
    }
    if (route === '/api/threads/search' && req.method === 'GET') {
      if (!rateLimit(req, 'threads-search', 25)) return json(res, 429, { ok: false, status: 'rate_limited', message: 'Threads API検索の実行頻度が高すぎます。しばらく待って再試行してください。' });
      const result = await searchThreads(requestUrl);
      return json(res, result.status, result.body);
    }
    if (route === '/api/google-ads/test' && req.method === 'POST') {
      if (!rateLimit(req, 'google-ads-test', 10)) return json(res, 429, { ok: false, status: 'rate_limited', message: '接続テストの実行頻度が高すぎます。1分ほど待って再試行してください。' });
      const result = await getGoogleAdsTest();
      if (!result.ok) testState.set('google', { ...result, testedAt: new Date().toISOString() });
      return json(res, result.ok ? 200 : result.status === 'not_configured' ? 503 : 502, result);
    }
    if (route === '/api/google-ads/keywords' && req.method === 'POST') {
      if (!rateLimit(req, 'google-ads-keywords', 15)) return json(res, 429, { ok: false, status: 'rate_limited', message: 'Google Ads APIの検索頻度が高すぎます。1分ほど待って再試行してください。' });
      const body = await readJson(req);
      const result = await googleKeywordIdeas(body);
      return json(res, result.status, result.body);
    }
    return json(res, 404, { ok: false, status: 'not_found', message: 'APIルートが見つかりません。' });
  } catch (error) {
    const status = error.status || 502;
    const message = error.code === 'timeout' || error.code === 'network' ? error.message : 'API処理に失敗しました。設定と入力内容を確認し、再試行してください。';
    return json(res, status, { ok: false, status: error.code || 'error', message });
  }
}
