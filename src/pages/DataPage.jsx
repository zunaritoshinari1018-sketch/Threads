import React, { useRef, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, FileJson, FileSpreadsheet, Printer, RefreshCw, Settings2, ShieldCheck, Upload } from 'lucide-react';
import { createBackup, validateImport } from '../store.js';
import { makeId, nowIso, SCORE_FIELDS } from '../domain.js';
import { Button, Card, EmptyState, Field, PageHeader, Pill, TextInput } from '../ui.jsx';

function download(name, value, type) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
function csv(rows) {
  if (!rows.length) return '\uFEFF';
  const headers = [...new Set(rows.flatMap((item) => Object.keys(item)))];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return `\uFEFF${[headers.map(escape).join(','), ...rows.map((item) => headers.map((header) => escape(item[header] && typeof item[header] === 'object' ? JSON.stringify(item[header]) : item[header])).join(','))].join('\r\n')}`;
}
function parseCsv(source) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]; const next = source[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function DataPage({ store, setStore, activeProject, notify, onReset }) {
  const [backupImportError, setBackupImportError] = useState('');
  const [csvImportError, setCsvImportError] = useState('');
  const jsonRef = useRef(null); const csvRef = useRef(null);
  const weights = SCORE_FIELDS.map((field) => ({ ...field, weight: Number(store.settings.weights?.[field.id] ?? field.weight) }));
  const totalWeight = weights.reduce((sum, field) => sum + (Number(field.weight) || 0), 0);
  const metricByKeyword = new Map();
  for (const metric of [...(store.searchMetrics || [])].sort((a, b) => (b.collectedAt || '').localeCompare(a.collectedAt || ''))) if (!metricByKeyword.has(metric.keywordId)) metricByKeyword.set(metric.keywordId, metric);
  const exportKeywords = () => {
    const rows = store.keywords.map((item) => { const metric = metricByKeyword.get(item.id); return { keyword: item.text, project_id: item.projectId, intent: item.intent || '', categories: item.categories || [], monthly_searches: metric?.value ?? item.searchVolume ?? '', metric_origin: metric?.dataOrigin || item.origin || 'manual', metric_source: metric?.sourceType || item.volumeSource || '', google_ad_competition: metric?.competition || '', google_competition_index: metric?.competitionIndex ?? '', region: metric?.region || '', language: metric?.language || '', retrieval_status: metric?.retrievalStatus || item.retrievalStatus || '', collected_at: metric?.collectedAt || item.collectedAt || '', source_url: metric?.sourceUrl || item.sourceUrl || '', note: item.note || '', scores: item.scores || {}, created_at: item.createdAt || '', updated_at: item.updatedAt || '' }; });
    download('layer-keywords.csv', csv(rows), 'text/csv;charset=utf-8'); notify(`${rows.length}件のキーワードをCSVで出力しました。`);
  };
  const exportIdeas = () => {
    const rows = store.contentIdeas.map((item) => ({ title: item.title, platform: item.platform, format: item.format, status: item.status, scheduled_date: item.scheduledDate, keyword_id: item.keywordId, data_origin: item.source || 'ローカルテンプレート', fields: item.fields, created_at: item.createdAt, updated_at: item.updatedAt }));
    download('layer-content-ideas.csv', csv(rows), 'text/csv;charset=utf-8'); notify(`${rows.length}件の投稿企画をCSVで出力しました。`);
  };
  const exportCalendar = () => {
    const rows = store.contentIdeas.filter((item) => item.scheduledDate).map((item) => ({ date: item.scheduledDate, title: item.title, platform: item.platform, status: item.status, format: item.format, source: item.source, project_id: item.projectId }));
    download('layer-publishing-calendar.csv', csv(rows), 'text/csv;charset=utf-8'); notify(`${rows.length}件の予定をCSVで出力しました。`);
  };
  const exportJson = () => {
    const value = createBackup(store);
    download(`layer-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(value, null, 2), 'application/json;charset=utf-8');
    notify('完全バックアップを出力しました。認証情報は含まれません。');
  };
  const importJsonFile = async (file) => {
    setBackupImportError('');
    try {
      const value = JSON.parse(await file.text()); const problem = validateImport(value);
      if (problem) return setBackupImportError(problem);
      if (!window.confirm('このブラウザのLayerデータをバックアップ内容で置き換えます。現在のデータは事前にエクスポートしてください。続行しますか？')) return;
      const imported = { ...value, settings: { ...(value.settings || {}) }, importedAt: nowIso() };
      delete imported.application; delete imported.schemaVersion; delete imported.exportedAt; delete imported.storage;
      setStore(imported); notify('バックアップを復元しました。');
    } catch { setBackupImportError('JSONを読み込めませんでした。Layerのバックアップファイルか確認してください。'); }
  };
  const importCsvFile = async (file) => {
    setCsvImportError('');
    try {
      const text = (await file.text()).replace(/^\uFEFF/, ''); const rows = parseCsv(text); const header = rows.shift()?.map((item) => item.trim().toLowerCase()) || [];
      const keywordIndex = header.findIndex((name) => ['keyword', 'キーワード', 'text'].includes(name));
      if (keywordIndex < 0) return setCsvImportError('CSVに「keyword」または「キーワード」列がありません。LayerのキーワードCSVを使用してください。');
      const at = nowIso(); const currentProjectId = activeProject?.id || store.projects[0]?.id || null;
      const items = rows.map((row) => row[keywordIndex]?.trim()).filter(Boolean).filter((text) => !store.keywords.some((item) => item.text.toLowerCase() === text.toLowerCase() && item.projectId === currentProjectId)).map((text) => ({ id: makeId('keyword'), text, projectId: currentProjectId, intent: '要確認', categories: ['review'], origin: 'imported', retrievalStatus: 'imported', searchVolume: null, scores: {}, createdAt: at, updatedAt: at }));
      if (!items.length) return setCsvImportError('追加できる新しいキーワードがありませんでした（重複または空欄）。');
      setStore((current) => ({ ...current, keywords: [...items, ...current.keywords] })); notify(`${items.length}件のキーワードをインポートしました。出所はインポートとして記録。`);
    } catch { setCsvImportError('CSVを読み込めませんでした。UTF-8形式を確認してください。'); }
  };
  const changeWeight = (id, value) => setStore((current) => ({ ...current, settings: { ...current.settings, weights: { ...current.settings.weights, [id]: Math.max(0, Math.min(100, Number(value) || 0)) } } }));
  const clearData = () => { if (window.confirm('このブラウザに保存されているLayerの全データを削除します。先にバックアップを作成しましたか？')) onReset?.(); };
  const printReport = () => window.print();
  return <div className="page-content">
    <PageHeader eyebrow="DATA & PREFERENCES" title="データ管理" description="ブラウザ内の保存データ、バックアップ、エクスポート、スコアリング設定を管理します。" icon={Settings2} actions={<Button variant="primary" icon={ArrowDownToLine} onClick={exportJson}>バックアップを保存</Button>} />
    <div className="data-storage-banner"><div className="data-storage-icon"><ShieldCheck size={19} /></div><div><strong>このブラウザのローカルストレージに自動保存</strong><p>アカウント間の同期やサーバーバックアップはありません。ブラウザデータの削除・端末故障に備えて、定期的にJSONバックアップをダウンロードしてください。</p></div><Pill tone="blue">個人利用</Pill></div>
    <div className="data-grid"><Card title="データのエクスポート" subtitle="UTF-8（BOM付き）CSV。出所・取得日時を含めて出力します。"><div className="export-list"><div className="export-item"><span className="export-icon export-blue"><FileSpreadsheet size={17} /></span><div><strong>キーワード一覧</strong><small>検索意図・分類・検索数・data_origin・取得状態</small></div><Button size="sm" icon={ArrowDownToLine} onClick={exportKeywords}>CSV</Button></div><div className="export-item"><span className="export-icon export-purple"><FileSpreadsheet size={17} /></span><div><strong>投稿企画</strong><small>媒体・ステータス・企画フィールド・生成元</small></div><Button size="sm" icon={ArrowDownToLine} onClick={exportIdeas}>CSV</Button></div><div className="export-item"><span className="export-icon export-green"><FileSpreadsheet size={17} /></span><div><strong>投稿カレンダー</strong><small>公開予定日・媒体・企画・ステータス</small></div><Button size="sm" icon={ArrowDownToLine} onClick={exportCalendar}>CSV</Button></div><div className="export-item"><span className="export-icon export-dark"><FileJson size={17} /></span><div><strong>完全バックアップ</strong><small>リサーチ・分析・競合・実績・設定を含むJSON</small></div><Button size="sm" variant="primary" icon={ArrowDownToLine} onClick={exportJson}>JSON</Button></div><div className="export-item"><span className="export-icon export-amber"><Printer size={17} /></span><div><strong>調査レポート</strong><small>現在の画面をブラウザの印刷機能で保存</small></div><Button size="sm" icon={Printer} onClick={printReport}>印刷</Button></div></div></Card>
      <Card title="インポート・復元" subtitle="LayerのバックアップまたはキーワードCSVからデータを追加"><div className="import-block"><div><strong>JSONバックアップを復元</strong><p>現在のLayerデータをバックアップ内容で置き換えます。まず現在データを保存してください。</p></div><Button icon={Upload} onClick={() => jsonRef.current?.click()}>JSONを選択</Button><input ref={jsonRef} hidden type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && importJsonFile(event.target.files[0])} />{backupImportError && <div className="inline-error">{backupImportError}</div>}</div><div className="import-block"><div><strong>キーワードCSVを追加</strong><p>「keyword」または「キーワード」列が必要です。検索数はインポートファイルに記載されていても自動で公式実測に変更しません。</p></div><Button icon={Upload} onClick={() => csvRef.current?.click()}>CSVを選択</Button><input ref={csvRef} hidden type="file" accept="text/csv,.csv" onChange={(event) => event.target.files?.[0] && importCsvFile(event.target.files[0])} />{csvImportError && <div className="inline-error">{csvImportError}</div>}</div></Card></div>
    <Card title="キーワード評価の重み" subtitle="初期設定：悩みの深さ20%、意図15%、需要15%、商品適合20%、独自性15%、投稿変換15%。全項目が埋まらない限り総合スコアは確定しません。"><div className="weight-editor">{weights.map((field) => <div className="weight-row" key={field.id}><div><strong>{field.label}</strong><small>{field.help}</small></div><label><TextInput type="number" min="0" max="100" value={field.weight} onChange={(value) => changeWeight(field.id, value)} /><span>%</span></label></div>)}</div><div className={`weight-total ${totalWeight === 100 ? 'weight-total-ok' : 'weight-total-warn'}`}><span>重み合計</span><strong>{totalWeight}%</strong><small>{totalWeight === 100 ? '100%です' : 'スコア計算時は合計値で正規化します'}</small></div></Card>
    <Card title="保存データの内訳" subtitle="このブラウザ内に保存された件数"><div className="data-count-grid">{[['プロジェクト', store.projects.length], ['調査セッション', store.researchSessions.length], ['キーワード', store.keywords.length], ['検索指標', store.searchMetrics?.length || 0], ['競合コンテンツ', store.collectedContents.length], ['分析ノード', store.analysisNodes.length], ['投稿企画', store.contentIdeas.length], ['投稿記録', store.publishedPosts.length], ['実績記録', store.performanceMetrics.length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></Card>
    <div className="danger-zone"><div><div className="danger-title"><AlertTriangle size={17} /><strong>すべてのローカルデータを削除</strong></div><p>この操作は取り消せません。API認証情報は保存していませんが、リサーチ・企画・投稿実績はすべて消去されます。</p></div><Button variant="danger" onClick={clearData}>データを初期化</Button></div>
  </div>;
}
