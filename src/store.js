import { nowIso } from './domain.js';

const STORAGE_KEY = 'layer-research-studio:v1';

export const EMPTY_STORE = {
  projects: [],
  researchSessions: [],
  keywords: [],
  keywordRelations: [],
  searchMetrics: [],
  collectedContents: [],
  analysisNodes: [],
  analysisEdges: [],
  contentIdeas: [],
  publishedPosts: [],
  performanceMetrics: [],
  apiEvents: [],
  settings: {
    activeProjectId: null,
    weights: {
      painDepth: 20,
      intentClarity: 15,
      demand: 15,
      productFit: 20,
      originality: 15,
      convertibility: 15,
    },
    youtubeQuota: { date: '', estimatedUnits: 0 },
    connectionTests: {},
  },
};

export function loadStore() {
  if (typeof window === 'undefined') return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY_STORE,
      ...parsed,
      settings: { ...EMPTY_STORE.settings, ...(parsed.settings || {}) },
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      researchSessions: Array.isArray(parsed.researchSessions) ? parsed.researchSessions : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      keywordRelations: Array.isArray(parsed.keywordRelations) ? parsed.keywordRelations : [],
      searchMetrics: Array.isArray(parsed.searchMetrics) ? parsed.searchMetrics : [],
      collectedContents: Array.isArray(parsed.collectedContents) ? parsed.collectedContents : [],
      analysisNodes: Array.isArray(parsed.analysisNodes) ? parsed.analysisNodes : [],
      analysisEdges: Array.isArray(parsed.analysisEdges) ? parsed.analysisEdges : [],
      contentIdeas: Array.isArray(parsed.contentIdeas) ? parsed.contentIdeas : [],
      publishedPosts: Array.isArray(parsed.publishedPosts) ? parsed.publishedPosts : [],
      performanceMetrics: Array.isArray(parsed.performanceMetrics) ? parsed.performanceMetrics : [],
      apiEvents: Array.isArray(parsed.apiEvents) ? parsed.apiEvents : [],
    };
  } catch (error) {
    console.error('Local research data could not be read.', error);
    return EMPTY_STORE;
  }
}

export function saveStore(store) {
  if (typeof window === 'undefined') return { ok: false, reason: 'browser-only' };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...store, updatedAt: nowIso() }));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.name === 'QuotaExceededError' ? 'quota' : 'unknown' };
  }
}

export function validateImport(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'JSONのルートはオブジェクトである必要があります。';
  const required = ['projects', 'researchSessions', 'keywords', 'contentIdeas'];
  for (const key of required) if (!Array.isArray(value[key])) return `「${key}」が配列ではありません。LayerのバックアップJSONを選択してください。`;
  return null;
}

export function createBackup(store) {
  return {
    application: 'Layer Research Studio',
    schemaVersion: 1,
    exportedAt: nowIso(),
    storage: 'This browser localStorage; API credentials are not included.',
    ...store,
  };
}
