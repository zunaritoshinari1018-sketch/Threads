import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePerformance, calculateScore, classifyKeyword, extractCompetitorInsights, generateKeywordSuggestions,
  inferIntent, makeAnalysisNodes, makeBrief, makeDraft, SCORE_FIELDS,
} from '../src/domain.js';
import { handleApi } from '../server/api.mjs';

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    headersSent: false,
    setHeader(key, value) { this.headers[key] = value; },
    end(body) { this.body = body || ''; this.headersSent = true; },
  };
}

function mockFetchResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data) };
}

 test('rule classification is explicitly heuristic and allows multiple pain categories', () => {
  const categories = classifyKeyword('Threads 投稿が伸びない 原因と改善方法');
  assert.ok(categories.includes('cause'));
  assert.ok(categories.includes('method'));
  assert.ok(categories.includes('problem'));
  assert.equal(inferIntent('YouTube 集客 方法'), '情報収集');
  assert.deepEqual(classifyKeyword('独自の単語'), ['review']);
});

test('local keyword candidates never masquerade as observed search data', () => {
  const candidates = generateKeywordSuggestions('Threads 集客', 18);
  assert.equal(candidates.length, 18);
  assert.ok(candidates.every((item) => item.origin === 'derived' && item.retrievalStatus === 'local-generated'));
  assert.ok(candidates.every((item) => typeof item.note === 'string'));
  assert.ok(candidates.some((item) => item.kind === '質問'));
});

test('brief and graph cover reader, competitor, content and verification dimensions', () => {
  const keyword = { id: 'k1', projectId: 'p1', text: 'Threads 集客', intent: '課題解決', categories: ['problem'] };
  const brief = makeBrief(keyword, { audience: '個人事業主', product: '講座', goal: '投稿ネタの発掘' });
  assert.ok(brief.keywordExamples.length > 0);
  assert.ok(brief.questions.length > 0);
  assert.match(brief.sourceLabel, /仮説|実測|読者/);
  assert.match(brief.competitor, /未登録/);
  const graph = makeAnalysisNodes(keyword, {});
  assert.equal(graph.nodes.length, 16);
  assert.ok(graph.edges.length >= 12);
  assert.ok(graph.nodes.every((item) => item.source === 'derived' && item.confidence === 'low'));
  const draft = makeDraft('threads', keyword, {});
  for (const field of ['hook', 'claim', 'evidence', 'steps', 'cta', 'objection', 'response']) assert.ok(draft.fields[field]);
  assert.equal(draft.source, 'ローカルテンプレート');
});

test('weighted score normalizes 1–5 values and stays unscored when any required field is missing', () => {
  const allFive = Object.fromEntries(SCORE_FIELDS.map((field) => [field.id, 5]));
  const allOne = Object.fromEntries(SCORE_FIELDS.map((field) => [field.id, 1]));
  const balanced = Object.fromEntries(SCORE_FIELDS.map((field) => [field.id, 3]));
  assert.equal(calculateScore(allFive).score, 100);
  assert.equal(calculateScore(allOne).score, 0);
  assert.equal(calculateScore(balanced).score, 50);
  const partial = calculateScore({ ...allFive, demand: null });
  assert.equal(partial.score, null);
  assert.ok(partial.missing.includes('需要の裏付け'));
  assert.equal(calculateScore(allFive, SCORE_FIELDS.map((field) => ({ ...field, weight: 0 }))).score, null);
});

test('performance ratios return unavailable for missing values and zero denominators', () => {
  const missing = calculatePerformance({ impressions: null, likes: null, comments: null, saves: null, shares: null });
  assert.equal(missing.reactionRate, null);
  assert.equal(missing.profileVisitRate, null);
  assert.equal(missing.revenue, null);
  const zeroDenominator = calculatePerformance({ impressions: 0, profileVisits: 0, linkClicks: 0, lineRegistrations: 0, inquiries: 0, conversions: 0, likes: 0, comments: 0, saves: 0, shares: 0 });
  assert.equal(zeroDenominator.reactionRate, null);
  assert.equal(zeroDenominator.profileVisitRate, null);
  const rates = calculatePerformance({ impressions: 200, likes: 4, comments: 2, saves: 3, shares: 1, profileVisits: 20, linkClicks: 10, lineRegistrations: 2, inquiries: 1, conversions: 1, revenue: 5000 });
  assert.equal(rates.reactionRate, 5);
  assert.equal(rates.profileVisitRate, 10);
  assert.equal(rates.linkClickRate, 50);
  assert.equal(rates.lineRegistrationRate, 20);
  assert.equal(rates.conversionRate, 100);
});

test('competitor insights summarize only the provided sample', () => {
  const sample = [
    { title: 'SNS集客の方法', text: '集客の方法と投稿手順を解説' },
    { title: '集客の方法 3選', text: '投稿の改善と集客の手順' },
  ];
  const insights = extractCompetitorInsights(sample);
  assert.equal(insights.sampleSize, 2);
  assert.match(insights.warning, /サンプル内/);
  assert.ok(insights.frequent.length > 0);
  assert.ok(insights.patterns.some((item) => item.label === 'howto'));
});

test('API gateway reports missing credentials honestly and does not expose secrets', async () => {
  const response = mockResponse();
  await handleApi({ method: 'GET', url: '/api/status' }, response);
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  for (const platform of ['instagram', 'threads']) {
    assert.equal(payload.platforms[platform].configured, platform === 'instagram'
      ? Boolean(process.env.INSTAGRAM_ACCESS_TOKEN?.trim() && process.env.INSTAGRAM_USER_ID?.trim())
      : Boolean(process.env.THREADS_ACCESS_TOKEN?.trim()));
    assert.ok(['not_configured', 'not_tested', 'connected', 'permission', 'quota', 'error', 'reauth_required', 'temporary_error'].includes(payload.platforms[platform].status));
  }
  const serialized = JSON.stringify(payload);
  for (const key of ['YOUTUBE_API_KEY', 'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'INSTAGRAM_ACCESS_TOKEN', 'THREADS_ACCESS_TOKEN']) {
    if (process.env[key]) assert.ok(!serialized.includes(process.env[key]), `status leaked the value of ${key}`);
  }
  if (!process.env.YOUTUBE_API_KEY) {
    const testResponse = mockResponse();
    await handleApi({ method: 'POST', url: '/api/youtube/test' }, testResponse);
    assert.equal(testResponse.statusCode, 503);
    assert.equal(JSON.parse(testResponse.body).status, 'not_configured');
    const searchResponse = mockResponse();
    await handleApi({ method: 'GET', url: '/api/youtube/search?keyword=test' }, searchResponse);
    assert.equal(searchResponse.statusCode, 503);
    assert.equal(JSON.parse(searchResponse.body).status, 'not_configured');
  }
  if (!process.env.INSTAGRAM_ACCESS_TOKEN?.trim() || !process.env.INSTAGRAM_USER_ID?.trim()) {
    const testResponse = mockResponse();
    await handleApi({ method: 'POST', url: '/api/instagram/test' }, testResponse);
    assert.equal(testResponse.statusCode, 503);
    assert.equal(JSON.parse(testResponse.body).status, 'not_configured');
    const searchResponse = mockResponse();
    await handleApi({ method: 'GET', url: '/api/instagram/search?hashtag=threads' }, searchResponse);
    assert.equal(searchResponse.statusCode, 503);
    assert.equal(JSON.parse(searchResponse.body).status, 'not_configured');
  }
  if (!process.env.THREADS_ACCESS_TOKEN?.trim()) {
    const testResponse = mockResponse();
    await handleApi({ method: 'POST', url: '/api/threads/test' }, testResponse);
    assert.equal(testResponse.statusCode, 503);
    assert.equal(JSON.parse(testResponse.body).status, 'not_configured');
    const searchResponse = mockResponse();
    await handleApi({ method: 'GET', url: '/api/threads/search?keyword=threads' }, searchResponse);
    assert.equal(searchResponse.statusCode, 503);
    assert.equal(JSON.parse(searchResponse.body).status, 'not_configured');
  }
});

test('Instagram preflight checks Meta account quota and blocks a 31st active hashtag before lookup', async () => {
  const originalFetch = globalThis.fetch;
  const previous = { token: process.env.INSTAGRAM_ACCESS_TOKEN, userId: process.env.INSTAGRAM_USER_ID, version: process.env.META_GRAPH_API_VERSION };
  process.env.INSTAGRAM_ACCESS_TOKEN = 'test-instagram-token';
  process.env.INSTAGRAM_USER_ID = 'test-instagram-user';
  process.env.META_GRAPH_API_VERSION = 'v23.0';
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    calls.push(url);
    assert.match(url.pathname, /recently_searched_hashtags$/);
    return mockFetchResponse({ data: Array.from({ length: 30 }, (_, index) => ({ id: `id-${index}`, name: `tag${index}` })) });
  };
  try {
    const response = mockResponse();
    await handleApi({ method: 'GET', url: '/api/instagram/search?hashtag=newtag' }, response);
    const payload = JSON.parse(response.body);
    assert.equal(response.statusCode, 429);
    assert.equal(payload.status, 'quota');
    assert.equal(payload.activeHashtagsUsed, 30);
    assert.equal(calls.length, 1, 'must not query a new hashtag after the authoritative cap is reached');
    assert.ok(!response.body.includes(process.env.INSTAGRAM_ACCESS_TOKEN));
  } finally {
    globalThis.fetch = originalFetch;
    if (previous.token === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN; else process.env.INSTAGRAM_ACCESS_TOKEN = previous.token;
    if (previous.userId === undefined) delete process.env.INSTAGRAM_USER_ID; else process.env.INSTAGRAM_USER_ID = previous.userId;
    if (previous.version === undefined) delete process.env.META_GRAPH_API_VERSION; else process.env.META_GRAPH_API_VERSION = previous.version;
  }
});

test('Threads search reads the real rolling query window and only /me test marks the connector successful', async () => {
  const originalFetch = globalThis.fetch;
  const previousToken = process.env.THREADS_ACCESS_TOKEN;
  process.env.THREADS_ACCESS_TOKEN = 'test-threads-token';
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    calls.push(url);
    if (url.pathname.endsWith('/keyword_search')) return mockFetchResponse({ data: [{ id: 'post-1', text: 'test post', permalink: 'https://www.threads.com/@example/post/1', username: 'example', timestamp: new Date().toISOString() }] });
    if (url.pathname.endsWith('/me') && url.searchParams.get('fields') === 'recently_searched_keywords') return mockFetchResponse({ recently_searched_keywords: [] });
    if (url.pathname.endsWith('/me') && url.searchParams.get('fields') === 'id,username') return mockFetchResponse({ id: 'user-1', username: 'example' });
    throw new Error('Unexpected Threads API request');
  };
  try {
    const before = mockResponse();
    await handleApi({ method: 'GET', url: '/api/status' }, before);
    assert.equal(JSON.parse(before.body).platforms.threads.status, 'not_tested');

    const search = mockResponse();
    await handleApi({ method: 'GET', url: '/api/threads/search?keyword=research' }, search);
    const searchPayload = JSON.parse(search.body);
    assert.equal(search.statusCode, 200);
    assert.equal(searchPayload.activeQueriesUsed, 1);
    assert.equal(searchPayload.items[0].source_url, 'https://www.threads.com/@example/post/1');

    const afterSearch = mockResponse();
    await handleApi({ method: 'GET', url: '/api/status' }, afterSearch);
    assert.equal(JSON.parse(afterSearch.body).platforms.threads.status, 'not_tested', 'search success alone must not be labelled a connection-test success');

    const connectionTest = mockResponse();
    await handleApi({ method: 'POST', url: '/api/threads/test' }, connectionTest);
    assert.equal(connectionTest.statusCode, 200);
    assert.equal(JSON.parse(connectionTest.body).status, 'connected');
    assert.ok(calls.some((url) => url.hostname === 'graph.threads.com' && url.pathname.endsWith('/keyword_search')));
    assert.ok(calls.some((url) => url.searchParams.get('fields') === 'recently_searched_keywords'));
    assert.ok(!connectionTest.body.includes(process.env.THREADS_ACCESS_TOKEN));
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.THREADS_ACCESS_TOKEN; else process.env.THREADS_ACCESS_TOKEN = previousToken;
  }
});

test('Threads search stops before the 2,200-query rolling cap', async () => {
  const originalFetch = globalThis.fetch;
  const previousToken = process.env.THREADS_ACCESS_TOKEN;
  process.env.THREADS_ACCESS_TOKEN = 'test-threads-token';
  let searchCalls = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/keyword_search')) searchCalls += 1;
    assert.ok(!url.pathname.endsWith('/keyword_search'), 'full quota should block search before the endpoint call');
    return mockFetchResponse({ recently_searched_keywords: Array.from({ length: 2200 }, (_, index) => ({ query: `query-${index}`, timestamp: Date.now() - index })) });
  };
  try {
    const response = mockResponse();
    await handleApi({ method: 'GET', url: '/api/threads/search?keyword=research' }, response);
    const payload = JSON.parse(response.body);
    assert.equal(response.statusCode, 429);
    assert.equal(payload.status, 'quota');
    assert.equal(payload.activeQueriesUsed, 2200);
    assert.equal(searchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.THREADS_ACCESS_TOKEN; else process.env.THREADS_ACCESS_TOKEN = previousToken;
  }
});

test('API gateway rejects unknown routes without exposing internal details', async () => {
  const response = mockResponse();
  await handleApi({ method: 'GET', url: '/api/not-a-route' }, response);
  assert.equal(response.statusCode, 404);
  assert.equal(JSON.parse(response.body).status, 'not_found');
});
