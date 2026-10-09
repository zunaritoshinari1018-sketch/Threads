import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowDownToLine, ArrowUpRight, MessageSquareText, Plus, RefreshCw, Search, Sparkles } from 'lucide-react';
import { extractCompetitorInsights, makeId, nowIso, PLATFORMS } from '../domain.js';
import { Button, Card, DataOrigin, DateLabel, EmptyState, Field, Modal, PageHeader, Pill, PlatformBadge, LinkButton, SelectInput, TextArea, TextInput, formatNumber } from '../ui.jsx';

function externalSearch(platform, keyword) {
  const q = encodeURIComponent(keyword);
  const routes = {
    google: `https://www.google.com/search?q=${q}`,
    youtube: `https://www.youtube.com/results?search_query=${q}`,
    instagram: `https://www.instagram.com/explore/tags/${q.replace(/^%23/i, '')}/`,
    threads: `https://www.threads.com/search?q=${q}`,
  };
  return routes[platform] || routes.google;
}

export function CompetitorPage({ store, setStore, activeProject, notify, apiStatus, refreshApiStatus }) {
  const project = activeProject || store.projects[0] || null;
  const projectKeywords = store.keywords.filter((item) => !project || item.projectId === project.id);
  const seed = projectKeywords.find((item) => item.isSeed)?.text || project?.seedKeyword || '';
  const [keyword, setKeyword] = useState(seed);
  const [searchPlatform, setSearchPlatform] = useState('youtube');
  const [maxResults, setMaxResults] = useState('10');
  const [days, setDays] = useState('90');
  const [order, setOrder] = useState('relevance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState('');
  const [instagramMetaCount, setInstagramMetaCount] = useState(null);
  const [threadsRecentQueries, setThreadsRecentQueries] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ platform: 'threads', title: '', url: '', text: '', publishedAt: '', views: '', likes: '', comments: '', saves: '', shares: '' });
  const [filterPlatform, setFilterPlatform] = useState('all');
  React.useEffect(() => { if (!keyword && seed) setKeyword(seed); }, [seed]);
  const allContents = store.collectedContents.filter((item) => !project || item.projectId === project.id);
  const contents = allContents.filter((item) => filterPlatform === 'all' || item.platform === filterPlatform).sort((a, b) => (b.collectedAt || '').localeCompare(a.collectedAt || ''));
  const insight = useMemo(() => extractCompetitorInsights(contents), [contents]);
  const estimatedUnits = store.settings.youtubeQuota?.date === new Date().toISOString().slice(0, 10) ? store.settings.youtubeQuota.estimatedUnits || 0 : 0;
  const connection = apiStatus?.platforms?.[searchPlatform];
  const instagramHistory = (store.settings.instagramHashtagRequests || []).filter((item) => Date.now() - new Date(item.at).getTime() < 7 * 86400000);
  const instagramUniqueCount = new Set(instagramHistory.map((item) => item.tag)).size;
  const searchTermLabel = searchPlatform === 'instagram' ? 'ハッシュタグ名' : searchPlatform === 'threads' ? 'キーワード' : '検索キーワード';

  const searchOfficialApi = async (cursor = '') => {
    if (loading) return;
    if (!cursor) setNextCursor('');
    if (!keyword.trim()) return setError({ status: 'input', message: '検索語を入力してください。' });
    const today = new Date().toISOString().slice(0, 10);
    const normalizedTag = keyword.trim().replace(/^#+/, '').toLowerCase();
    if (searchPlatform === 'instagram') {
      const recent = (store.settings.instagramHashtagRequests || []).filter((item) => Date.now() - new Date(item.at).getTime() < 7 * 86400000);
      const unique = new Set(recent.map((item) => item.tag));
      if (!unique.has(normalizedTag) && unique.size >= 30) return setError({ status: 'local_quota', message: 'このブラウザーで過去7日間に30種類のハッシュタグを記録しています。Meta側の上限を超えないよう、新しいタグ検索を停止しました。' });
    }
    const used = store.settings.youtubeQuota?.date === today ? Number(store.settings.youtubeQuota.estimatedUnits || 0) : 0;
    const requestUnits = 101;
    if (searchPlatform === 'youtube' && used + requestUnits > 10000) return setError({ status: 'local_quota', message: `ローカル概算クォータが10,000 unitsを超えるため停止しました（本日 ${used} units）。翌日に再試行してください。` });
    setLoading(true); setError(null);
    try {
      let endpoint; const params = new URLSearchParams(); let retrievalConditions;
      if (searchPlatform === 'youtube') {
        const regionCodes = { '日本': 'JP', '米国': 'US', '英国': 'GB', 'カナダ': 'CA', 'オーストラリア': 'AU' };
        const regionCode = regionCodes[project?.region] || 'JP'; const language = project?.language === '英語' ? 'en' : 'ja';
        endpoint = '/api/youtube/search'; params.set('keyword', keyword.trim()); params.set('maxResults', maxResults); params.set('order', order); params.set('publishedWithinDays', days); params.set('regionCode', regionCode); params.set('language', language); if (cursor) params.set('cursor', cursor);
        retrievalConditions = { query: keyword.trim(), queryType: 'keyword', order, maxResults: Number(maxResults), publishedWithinDays: Number(days), regionCode, language, cursor: cursor || null };
      } else if (searchPlatform === 'instagram') {
        endpoint = '/api/instagram/search'; params.set('hashtag', normalizedTag); params.set('limit', maxResults); params.set('sort', order); if (cursor) params.set('cursor', cursor);
        retrievalConditions = { query: `#${normalizedTag}`, queryType: 'hashtag', order, maxResults: Number(maxResults), cursor: cursor || null };
      } else {
        endpoint = '/api/threads/search'; params.set('keyword', keyword.trim()); params.set('limit', maxResults); params.set('sort', order); if (cursor) params.set('cursor', cursor);
        const until = new Date().toISOString(); const since = Number(days) > 0 ? new Date(Date.now() - Number(days) * 86400000).toISOString() : null;
        if (since) { params.set('since', since); params.set('until', until); }
        retrievalConditions = { query: keyword.trim(), queryType: 'keyword', order, maxResults: Number(maxResults), since, until: since ? until : null, cursor: cursor || null };
      }
      if (searchPlatform === 'instagram' && connection?.configured) {
        setStore((current) => {
          const history = current.settings.instagramHashtagRequests || [];
          const recent = history.filter((item) => Date.now() - new Date(item.at).getTime() < 7 * 86400000);
          if (!recent.some((item) => item.tag === normalizedTag)) recent.unshift({ tag: normalizedTag, at: nowIso() });
          return { ...current, settings: { ...current.settings, instagramHashtagRequests: recent } };
        });
      }
      const response = await fetch(`${endpoint}?${params}`);
      const result = await response.json();
      if (searchPlatform === 'instagram' && Number.isFinite(Number(result.activeHashtagsUsed))) setInstagramMetaCount(Number(result.activeHashtagsUsed));
      if (searchPlatform === 'threads' && Number.isFinite(Number(result.activeQueriesUsed))) setThreadsRecentQueries(Number(result.activeQueriesUsed));
      if (!response.ok || !result.ok) throw Object.assign(new Error(result.message || '公式API検索に失敗しました。'), { status: result.status || 'error' });
      const at = result.collectedAt || nowIso();
      const termForContent = searchPlatform === 'instagram' ? `#${normalizedTag}` : keyword.trim();
      const converted = (result.items || []).map((item) => ({
        id: makeId('content'), projectId: project?.id || null, platform: item.platform || searchPlatform, sourceType: item.source_type || 'public_content', sourceUrl: item.source_url || '',
        keyword: termForContent, retrievalConditions, collectedAt: item.collected_at || at, publishedAt: item.published_at || null, title: item.title || '', text: item.text || '', description: item.description || '',
        channelTitle: item.channel_title || item.username || '', channelUrl: item.channel_url || item.author_url || '', channelId: item.channel_id || '', metrics: item.metrics || {},
        mediaType: item.media_type || null, retrievalStatus: item.retrieval_status || 'success', dataOrigin: item.data_origin || 'official_api', confidence: item.confidence || 'measured', rawData: { videoId: item.video_id || null, postId: item.post_id || null, mediaType: item.media_type || null }, analysisStatus: 'not_analyzed',
      }));
      setNextCursor(result.nextCursor || '');
      setStore((current) => {
        const nextSettings = { ...current.settings };
        if (searchPlatform === 'youtube') {
          const currentUsed = current.settings.youtubeQuota?.date === today ? Number(current.settings.youtubeQuota.estimatedUnits || 0) : 0;
          nextSettings.youtubeQuota = { date: today, estimatedUnits: currentUsed + (result.quotaEstimate || requestUnits) };
        }
        return { ...current, collectedContents: [...converted, ...current.collectedContents], apiEvents: [{ id: makeId('api-event'), platform: searchPlatform, action: `${searchPlatform}_search`, status: 'success', count: converted.length, message: `${converted.length}件を取得${result.sampleNote ? ` · ${result.sampleNote}` : ''}`, createdAt: at }, ...(current.apiEvents || [])].slice(0, 100), settings: nextSettings };
      });
      await refreshApiStatus?.();
      if (result.sampleCount === 0) setError({ status: 'empty', message: result.message || '検索結果は0件でした。条件を変更して再試行してください。' });
      else notify(`${result.sampleCount}件を${PLATFORMS.find((item) => item.id === searchPlatform)?.label || searchPlatform}公式APIから取得しました。検索件数は検索需要ではありません。`);
    } catch (cause) {
      const message = cause.message || '検索に失敗しました。設定・権限を確認し、時間をおいて再試行してください。';
      setError({ status: cause.status || 'network', message });
      setStore((current) => ({ ...current, apiEvents: [{ id: makeId('api-event'), platform: searchPlatform, action: `${searchPlatform}_search`, status: 'error', count: 0, message, createdAt: nowIso() }, ...(current.apiEvents || [])].slice(0, 100) }));
    } finally { setLoading(false); }
  };

  const addManual = (event) => {
    event.preventDefault();
    if (!manual.title.trim() && !manual.text.trim()) return notify('タイトルまたは本文を入力してください。', 'error');
    const at = nowIso();
    const asNumber = (value) => value === '' ? null : Number(value);
    const item = { id: makeId('content'), projectId: project?.id || null, platform: manual.platform, sourceType: 'manual_content', sourceUrl: manual.url.trim(), keyword: keyword.trim() || seed || '', collectedAt: at, publishedAt: manual.publishedAt || null, title: manual.title.trim() || manual.text.trim().slice(0, 48), text: manual.text.trim(), description: '', channelTitle: '', metrics: { views: asNumber(manual.views), likes: asNumber(manual.likes), comments: asNumber(manual.comments), saves: asNumber(manual.saves), shares: asNumber(manual.shares) }, retrievalStatus: 'manual', dataOrigin: 'manual', confidence: 'user-entered', rawData: {}, analysisStatus: 'not_analyzed' };
    setStore((current) => ({ ...current, collectedContents: [item, ...current.collectedContents] })); setManualOpen(false); setManual({ platform: 'threads', title: '', url: '', text: '', publishedAt: '', views: '', likes: '', comments: '', saves: '', shares: '' }); notify('手入力コンテンツを保存しました。');
  };
  const deleteContent = (id) => { if (!window.confirm('このコンテンツを削除しますか？')) return; setStore((current) => ({ ...current, collectedContents: current.collectedContents.filter((item) => item.id !== id) })); notify('コンテンツを削除しました。'); };
  const exportContent = () => {
    const rows = contents.map((item) => ({ platform: item.platform, source_type: item.sourceType || '', title: item.title, text: item.text, description: item.description, source_url: item.sourceUrl, keyword: item.keyword, retrieval_conditions: item.retrievalConditions ? JSON.stringify(item.retrievalConditions) : '', published_at: item.publishedAt || '', collected_at: item.collectedAt || '', data_origin: item.dataOrigin, retrieval_status: item.retrievalStatus, views: item.metrics?.views ?? '', likes: item.metrics?.likes ?? '', comments: item.metrics?.comments ?? '', saves: item.metrics?.saves ?? '', shares: item.metrics?.shares ?? '' }));
    const headers = [...new Set(rows.flatMap((item) => Object.keys(item)))]; const q = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = `\uFEFF${[headers.map(q).join(','), ...rows.map((row) => headers.map((header) => q(row[header])).join(','))].join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'layer-competitor-contents.csv'; link.click(); URL.revokeObjectURL(url); notify(`${rows.length}件をCSV出力しました。`);
  };

  return <div className="page-content">
    <PageHeader eyebrow="COMPETITIVE RESEARCH" title="競合コンテンツ分析" description="API取得・手入力したサンプルのみを比較します。網羅データや検索ボリュームとして扱いません。" icon={Search} actions={<><Button icon={ArrowDownToLine} onClick={exportContent}>CSV出力</Button><Button variant="primary" icon={Plus} onClick={() => setManualOpen(true)}>手動で追加</Button></>} />
    <div className="competitor-search-panel card"><div className="competitor-search-intro"><div className="search-panel-icon"><PlatformBadge platform={searchPlatform} compact /></div><div><h2>{searchPlatform === 'youtube' ? 'YouTube Data API v3で動画検索' : searchPlatform === 'instagram' ? 'Instagram Graph APIでハッシュタグ検索' : 'Threads APIで公開投稿を検索'}</h2><p>{searchPlatform === 'youtube' ? 'search.list + videos.list · 検索件数は検索ボリュームではありません。' : searchPlatform === 'instagram' ? `Business / Creatorアカウント・審査済み権限が必要。一般キーワード検索ではありません。${order === 'recent' ? '新着順は直近24時間に公開されたメディアのみ。' : ''}` : 'threads_keyword_search · 権限により自分の投稿だけが返る場合があります。'}</p></div><Pill tone={connection?.status === 'connected' ? 'success' : connection?.status === 'manual_only' ? 'neutral' : connection?.configured ? 'amber' : 'neutral'} dot>{connection?.status === 'connected' ? '接続テスト成功' : connection?.configured ? '設定済み・未テスト' : '未設定'}</Pill></div>
      <div className="competitor-controls"><Field label="検索媒体"><SelectInput value={searchPlatform} onChange={(value) => { setSearchPlatform(value); setOrder(value === 'youtube' ? 'relevance' : 'recent'); setNextCursor(''); setError(null); }} options={[{ value: 'youtube', label: 'YouTube' }, { value: 'instagram', label: 'Instagram（ハッシュタグ）' }, { value: 'threads', label: 'Threads（キーワード）' }]} /></Field><Field label={searchTermLabel}><TextInput value={keyword} onChange={(value) => { setKeyword(value); setNextCursor(''); }} placeholder={searchPlatform === 'instagram' ? '例：threads（#なし）' : '例：Threads 集客'} onKeyDown={(event) => event.key === 'Enter' && searchOfficialApi()} /></Field><Field label="取得件数"><SelectInput value={maxResults} onChange={(value) => { setMaxResults(value); setNextCursor(''); }} options={['5', '10', '20', '50', ...(searchPlatform === 'threads' ? ['100'] : [])]} /></Field>{searchPlatform !== 'instagram' && <Field label="公開期間"><SelectInput value={days} onChange={(value) => { setDays(value); setNextCursor(''); }} options={[{ value: '0', label: '期間指定なし' }, { value: '30', label: '直近30日' }, { value: '90', label: '直近90日' }, { value: '365', label: '直近1年' }]} /></Field>}<Field label="並び順"><SelectInput value={order} onChange={(value) => { setOrder(value); setNextCursor(''); }} options={searchPlatform === 'youtube' ? [{ value: 'relevance', label: '関連度' }, { value: 'date', label: '公開日' }, { value: 'viewCount', label: '再生数' }, { value: 'rating', label: '評価順' }] : searchPlatform === 'instagram' ? [{ value: 'recent', label: '新着順（24時間）' }, { value: 'top', label: '人気順（TOP）' }] : [{ value: 'recent', label: '新着順' }, { value: 'top', label: '人気順（TOP）' }]} /></Field><Button variant="primary" icon={loading ? RefreshCw : Search} disabled={loading} onClick={() => searchOfficialApi()}>{loading ? '検索中...' : '公式APIで検索'}</Button></div>
      <div className="platform-search-links"><span>公式検索画面を開く</span>{PLATFORMS.map((platform) => <a key={platform.id} href={externalSearch(platform.id, keyword)} target="_blank" rel="noreferrer"><PlatformBadge platform={platform.id} compact />{platform.label}<ArrowUpRight size={12} /></a>)}</div>
      {searchPlatform === 'youtube' && <div className="quota-line"><span>本日の概算YouTubeクォータ</span><strong>{formatNumber(estimatedUnits)} / 10,000 units</strong><span className="quota-estimate">search.list: 100 + videos.list: 1 / 回（概算）</span><a href="https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas" target="_blank" rel="noreferrer">クォータ <ArrowUpRight size={12} /></a></div>}
      {searchPlatform === 'instagram' && <div className="quota-line"><span>Instagram使用中ハッシュタグ枠</span><strong>{instagramMetaCount == null ? instagramUniqueCount : instagramMetaCount} / 30</strong><span className="quota-estimate">{instagramMetaCount == null ? 'ブラウザー内の利用記録（目安）。検索時にMetaのrecently_searched_hashtagsで枠を確認します。' : '直近の公式API確認値。Meta側のローリング7日上限を優先します。'}</span><LinkButton href="https://developers.facebook.com/docs/instagram-api/guides/hashtag-search/">公式仕様</LinkButton></div>}
      {searchPlatform === 'threads' && <div className="quota-line"><span>Threads検索クエリ（直近24時間）</span><strong>{threadsRecentQueries == null ? '未確認 / 2,200' : `${threadsRecentQueries} / 2,200`}</strong><span className="quota-estimate">公式recently_searched_keywordsを検索前に照会。1ページ最大100件、結果は網羅的ではありません。</span></div>}
      {error && <div className={`api-message ${error.status === 'empty' ? 'api-message-info' : 'api-message-error'}`}><AlertCircle size={16} /><span>{error.message}</span>{error.status !== 'empty' && <Button size="sm" variant="quiet" disabled={loading} onClick={() => searchOfficialApi()}>再試行</Button>}</div>}
    </div>
    <div className="competitor-overview-grid"><Card title="登録サンプルの傾向" subtitle={`対象 ${contents.length} 件 · サンプル範囲のみ`} className="insight-card"><div className="insight-warning"><Sparkles size={14} />ローカルルールによる集計。人気や市場全体の傾向ではありません。</div>{contents.length ? <><div className="insight-section-label">サンプル内の頻出語</div><div className="term-cloud">{insight.frequent.length ? insight.frequent.map((item, index) => <span className={`term-chip term-size-${Math.min(4, 1 + index)}`} key={item.word}>{item.word}<b>{item.count}</b></span>) : <p className="muted-copy">頻出語を抽出できる本文・説明文がありません。手動で本文を追加してください。</p>}</div><div className="insight-section-label">コンテンツ形式に含まれるパターン</div><div className="pattern-list">{insight.patterns.length ? insight.patterns.map((item) => <div className="pattern-row" key={item.label}><span>{item.label === 'question' ? '問い・原因' : item.label === 'howto' ? '方法・手順' : item.label === 'list' ? 'リスト形式' : item.label === 'warning' ? '注意・失敗' : '比較・選択'}</span><div><i style={{ width: `${Math.min(100, (item.count / Math.max(1, contents.length)) * 100)}%` }} /></div><strong>{item.count}</strong></div>) : <p className="muted-copy">該当パターンなし。コンテンツ本文を追加すると抽出します。</p>}</div></> : <EmptyState icon={Sparkles} title="分析できるサンプルがありません" description="YouTube検索または手動登録後、登録データのテキストだけを集計します。" />}</Card>
      <Card title="独自の切り口をつくる" subtitle="競合のコピーではなく、一次情報で差分を作る" className="gap-card"><div className="gap-card-inner"><div className="gap-step"><span>01</span><div><strong>サンプルの主張を記録</strong><p>登録した動画・投稿に含まれる要点を個別にメモします。</p></div></div><div className="gap-step"><span>02</span><div><strong>未回答の論点を見つける</strong><p>条件・対象・例外・失敗時の検証方法を比較します。</p></div></div><div className="gap-step"><span>03</span><div><strong>自分の一次情報を足す</strong><p>経験・計測値・利用者の質問を根拠として企画に反映します。</p></div></div></div><div className="sample-scope"><MessageSquareText size={15} /> {insight.warning}</div></Card></div>
    <Card title="収集・登録したコンテンツ" subtitle="取得元・日時・指標を保持します。第三者コンテンツの取得範囲はAPI仕様に従います。" className="contents-card" padding="none" action={<div className="content-filter">{nextCursor && <Button size="sm" variant="quiet" disabled={loading} onClick={() => searchOfficialApi(nextCursor)}>次のページ <ArrowUpRight size={12} /></Button>}<SelectInput aria-label="媒体で絞り込み" value={filterPlatform} onChange={setFilterPlatform} options={[{ value: 'all', label: 'すべての媒体' }, ...PLATFORMS.map((item) => ({ value: item.id, label: item.label }))]} /><span>{contents.length}件</span></div>}>
      {contents.length ? <div className="content-record-list">{contents.map((item) => <article className="content-record" key={item.id}><div className="content-record-platform"><PlatformBadge platform={item.platform} compact /></div><div className="content-record-main"><div className="content-record-title"><strong>{item.title || item.text?.slice(0, 80) || 'タイトル未取得'}</strong>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" title="元コンテンツ"><ArrowUpRight size={15} /></a>}</div><p>{item.text || item.description || '本文はAPIから取得していません。公開タイトル・説明のみ。'}</p><div className="content-record-meta"><DataOrigin origin={item.dataOrigin} /><span>取得 <DateLabel date={item.collectedAt} /></span><span>公開 <DateLabel date={item.publishedAt} /></span><span>検索語：{item.keyword || '—'}</span>{item.retrievalConditions?.order && <span>並び順：{item.retrievalConditions.order}</span>}{Number(item.retrievalConditions?.publishedWithinDays) > 0 && <span>期間：{item.retrievalConditions.publishedWithinDays}日</span>}{item.retrievalConditions?.since && <span>期間：<DateLabel date={item.retrievalConditions.since} />〜<DateLabel date={item.retrievalConditions.until} /></span>}{item.channelTitle && <span>チャンネル：{item.channelTitle}</span>}</div></div><div className="content-record-metrics"><div><small>再生</small><strong>{item.metrics?.views == null ? '未取得' : formatNumber(item.metrics.views)}</strong></div><div><small>いいね</small><strong>{item.metrics?.likes == null ? '未取得' : formatNumber(item.metrics.likes)}</strong></div><div><small>コメント</small><strong>{item.metrics?.comments == null ? '未取得' : formatNumber(item.metrics.comments)}</strong></div><button className="text-danger" onClick={() => deleteContent(item.id)}>削除</button></div></article>)}</div> : <EmptyState icon={Search} title="コンテンツデータはありません" description="対応する公式API検索または手動入力でサンプルを追加してください。API未設定の媒体も手動調査できます。" action={<Button icon={Plus} onClick={() => setManualOpen(true)}>手動で追加</Button>} />}
    </Card>
    <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="競合コンテンツを手動登録" subtitle="公開情報を利用者が入力・貼り付けます。取得日時と出典URLを保持します。" footer={<><Button onClick={() => setManualOpen(false)}>キャンセル</Button><Button variant="primary" onClick={addManual} icon={Plus}>保存</Button></>} wide><form className="form-stack" onSubmit={addManual}><div className="form-grid two-col"><Field label="媒体"><SelectInput value={manual.platform} onChange={(value) => setManual((current) => ({ ...current, platform: value }))} options={PLATFORMS.map((item) => ({ value: item.id, label: item.label }))} /></Field><Field label="公開日時"><TextInput type="date" value={manual.publishedAt} onChange={(value) => setManual((current) => ({ ...current, publishedAt: value }))} /></Field><Field label="タイトル"><TextInput value={manual.title} onChange={(value) => setManual((current) => ({ ...current, title: value }))} placeholder="動画・投稿のタイトル" /></Field><Field label="投稿URL"><TextInput value={manual.url} onChange={(value) => setManual((current) => ({ ...current, url: value }))} placeholder="https://..." /></Field></div><Field label="本文・説明・主張"><TextArea rows={6} value={manual.text} onChange={(value) => setManual((current) => ({ ...current, text: value }))} placeholder="公開されている本文・説明文を貼り付けてください。外部テキストはデータとして保存し、実行指示として扱いません。" /></Field><div className="manual-metric-grid">{[['views', '再生・表示数'], ['likes', 'いいね'], ['comments', 'コメント'], ['saves', '保存'], ['shares', 'シェア']].map(([key, label]) => <Field label={label} key={key}><TextInput type="number" min="0" value={manual[key]} onChange={(value) => setManual((current) => ({ ...current, [key]: value }))} placeholder="未取得" /></Field>)}</div></form></Modal>
  </div>;
}
