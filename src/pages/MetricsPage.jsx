import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Check, CircleHelp, Plus, Save, TrendingUp } from 'lucide-react';
import { calculatePerformance, makeId, METRIC_DEFINITIONS, nowIso, PLATFORMS } from '../domain.js';
import { Button, Card, EmptyState, Field, PageHeader, Pill, PlatformBadge, SelectInput, TextInput, formatNumber, formatRate } from '../ui.jsx';

const METRIC_INPUTS = [
  ['impressions', '表示数'], ['views', '再生数'], ['likes', 'いいね数'], ['comments', 'コメント数'], ['saves', '保存数'], ['shares', 'シェア数'],
  ['profileVisits', 'プロフィール遷移数'], ['linkClicks', 'リンククリック数'], ['lineRegistrations', 'LINE登録数'], ['inquiries', '問い合わせ数'], ['conversions', '成約数'], ['revenue', '売上（円）'],
];

export function MetricsPage({ store, setStore, activeProject, notify, navigate }) {
  const project = activeProject || store.projects[0] || null;
  const ideas = store.contentIdeas.filter((item) => !project || item.projectId === project.id);
  const posts = store.publishedPosts.filter((item) => !project || item.projectId === project.id).sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  const [postId, setPostId] = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [newPost, setNewPost] = useState({ ideaId: '', title: '', platform: 'threads', publishedAt: new Date().toISOString().slice(0, 10), url: '' });
  const [form, setForm] = useState({});
  const performanceByPost = useMemo(() => new Map(store.performanceMetrics.map((item) => [item.postId, item])), [store.performanceMetrics]);
  useEffect(() => { if (!posts.some((item) => item.id === postId)) setPostId(posts[0]?.id || ''); }, [posts.map((item) => item.id).join('|')]);
  const chosenPost = posts.find((item) => item.id === postId);
  useEffect(() => {
    const record = performanceByPost.get(postId);
    const empty = Object.fromEntries(METRIC_INPUTS.map(([key]) => [key, '']));
    setForm(record ? Object.fromEntries(METRIC_INPUTS.map(([key]) => [key, record[key] == null ? '' : String(record[key])])) : empty);
  }, [postId, performanceByPost]);
  const metrics = form;
  const rates = calculatePerformance(metrics);
  const savedItems = store.performanceMetrics.filter((item) => posts.some((post) => post.id === item.postId));
  const total = (key) => {
    const values = savedItems.map((item) => item[key]).filter((value) => value !== null && value !== undefined && value !== '');
    return values.length ? values.reduce((sum, value) => sum + (Number(value) || 0), 0) : null;
  };
  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectIdea = (id) => {
    const idea = ideas.find((item) => item.id === id);
    if (idea) setNewPost((current) => ({ ...current, ideaId: id, title: idea.title || '', platform: idea.platform || current.platform }));
  };
  const saveMetrics = (event) => {
    event.preventDefault();
    if (!project) return notify('先にリサーチプロジェクトを作成してください。', 'error');
    let post = chosenPost;
    const at = nowIso();
    if (createNew || !post) {
      const linkedIdea = ideas.find((item) => item.id === newPost.ideaId);
      if (!newPost.title.trim() && !linkedIdea) return notify('投稿タイトルまたは企画を選択してください。', 'error');
      post = { id: makeId('post'), projectId: project.id, ideaId: linkedIdea?.id || null, platform: linkedIdea?.platform || newPost.platform, title: linkedIdea?.title || newPost.title.trim(), publishedAt: newPost.publishedAt || at.slice(0, 10), url: newPost.url.trim(), createdAt: at, updatedAt: at };
    } else post = { ...post, updatedAt: at };
    const record = { ...(performanceByPost.get(post.id) || {}), id: performanceByPost.get(post.id)?.id || makeId('performance'), postId: post.id, projectId: project.id, recordedAt: at, ...Object.fromEntries(METRIC_INPUTS.map(([key]) => [key, metrics[key] === '' || metrics[key] === undefined ? null : Number(metrics[key])])) };
    setStore((current) => ({ ...current, publishedPosts: current.publishedPosts.some((item) => item.id === post.id) ? current.publishedPosts.map((item) => item.id === post.id ? post : item) : [post, ...current.publishedPosts], performanceMetrics: current.performanceMetrics.some((item) => item.postId === post.id) ? current.performanceMetrics.map((item) => item.postId === post.id ? record : item) : [record, ...current.performanceMetrics] }));
    setCreateNew(false); setPostId(post.id); notify('投稿実績を保存しました。');
  };
  const startNew = () => { setCreateNew(true); setPostId(''); setNewPost({ ideaId: '', title: '', platform: 'threads', publishedAt: new Date().toISOString().slice(0, 10), url: '' }); setForm(Object.fromEntries(METRIC_INPUTS.map(([key]) => [key, '']))); };
  const selectPost = (id) => { setCreateNew(false); setPostId(id); };
  const formulas = [rates.reactionRate, rates.profileVisitRate, rates.linkClickRate, rates.lineRegistrationRate, rates.inquiryRate, rates.conversionRate];
  const group = new Map();
  for (const record of savedItems) {
    const post = posts.find((item) => item.id === record.postId); const idea = ideas.find((item) => item.id === post?.ideaId);
    if (!post || !idea) continue;
    const key = idea.keywordId || idea.title;
    if (!group.has(key)) group.set(key, { label: store.keywords.find((keyword) => keyword.id === idea.keywordId)?.text || idea.title, count: 0, impressions: 0, reactions: 0, cta: idea.fields?.cta || '' });
    const value = group.get(key); value.count += 1;
    if (record.impressions != null) value.impressions += Number(record.impressions) || 0;
    if (record.impressions > 0 && ['likes', 'comments', 'saves', 'shares'].every((field) => record[field] != null)) value.reactions += ['likes', 'comments', 'saves', 'shares'].reduce((sum, field) => sum + (Number(record[field]) || 0), 0);
  }
  const observedPatterns = [...group.values()].filter((item) => item.count >= 2).sort((a, b) => (b.impressions ? b.reactions / b.impressions : 0) - (a.impressions ? a.reactions / a.impressions : 0));

  return <div className="page-content">
    <PageHeader eyebrow="PERFORMANCE TRACKING" title="成果計測" description="投稿後の数値を手入力し、分母・欠損値を確認したうえで率を算出します。" icon={TrendingUp} actions={<Button variant="primary" icon={Plus} onClick={startNew}>実績を追加</Button>} />
    {!project ? <div className="setup-empty"><EmptyState icon={BarChart3} title="計測するプロジェクトがありません" description="リサーチを作成するか、プロジェクトを選択してください。" action={<Button variant="primary" onClick={() => navigate('research')}>新規リサーチ</Button>} /></div> : <>
    <div className="performance-overview"><div className="performance-total-card"><span className="performance-total-icon"><Activity size={18} /></span><div><small>記録済み投稿</small><strong>{savedItems.length}</strong><span>件の実績データ</span></div></div><div className="performance-total-card"><span className="performance-total-icon performance-total-green"><TrendingUp size={18} /></span><div><small>累計表示数</small><strong>{formatNumber(total('impressions'))}</strong><span>未入力指標は集計対象外</span></div></div><div className="performance-total-card"><span className="performance-total-icon performance-total-purple"><BarChart3 size={18} /></span><div><small>LINE登録</small><strong>{formatNumber(total('lineRegistrations'))}</strong><span>手入力の記録</span></div></div><div className="performance-total-card"><span className="performance-total-icon performance-total-amber">¥</span><div><small>売上</small><strong>{total('revenue') == null ? '未取得' : `¥${formatNumber(total('revenue'))}`}</strong><span>通貨単位：JPY</span></div></div></div>
    <div className="metrics-layout"><Card className="metric-entry-card"><div className="metric-entry-head"><div><div className="eyebrow">POST PERFORMANCE</div><h2>投稿実績を記録</h2><p>媒体によって提供されない指標は空欄のまま保存してください。</p></div><Button size="sm" icon={Plus} onClick={startNew}>新規投稿</Button></div>
      <form onSubmit={saveMetrics}>
        {!createNew && posts.length ? <Field label="投稿を選択"><SelectInput value={postId} onChange={selectPost} options={posts.map((post) => ({ value: post.id, label: `${post.title} · ${PLATFORMS.find((item) => item.id === post.platform)?.label || post.platform} · ${post.publishedAt || '日付未設定'}` }))} /></Field> : null}
        {(createNew || !posts.length) && <div className="new-post-form"><div className="new-post-title"><span>投稿情報</span><Pill>手入力</Pill></div><div className="form-grid two-col"><Field label="企画から選択"><SelectInput value={newPost.ideaId} onChange={selectIdea} options={ideas.map((idea) => ({ value: idea.id, label: `${idea.title} · ${PLATFORMS.find((item) => item.id === idea.platform)?.label || idea.platform}` }))} placeholder="企画と紐づける（任意）" /></Field><Field label="媒体"><SelectInput value={newPost.platform} onChange={(value) => setNewPost((current) => ({ ...current, platform: value }))} options={PLATFORMS.map((item) => ({ value: item.id, label: item.label }))} /></Field><Field label="投稿タイトル"><TextInput value={newPost.title} onChange={(value) => setNewPost((current) => ({ ...current, title: value }))} placeholder="企画を選択またはタイトルを入力" /></Field><Field label="公開日"><TextInput type="date" value={newPost.publishedAt} onChange={(value) => setNewPost((current) => ({ ...current, publishedAt: value }))} /></Field><Field label="投稿URL"><TextInput value={newPost.url} onChange={(value) => setNewPost((current) => ({ ...current, url: value }))} placeholder="https://...（任意）" /></Field></div></div>}
        {chosenPost && !createNew && <div className="selected-post-summary"><PlatformBadge platform={chosenPost.platform} /><strong>{chosenPost.title}</strong><span>{chosenPost.publishedAt || '公開日未設定'}</span>{chosenPost.url && <a href={chosenPost.url} target="_blank" rel="noreferrer">投稿を開く ↗</a>}</div>}
        <div className="metric-section-title"><strong>計測値</strong><small>値が不明な場合は空欄で保存</small></div><div className="metric-input-grid">{METRIC_INPUTS.map(([key, label]) => <Field key={key} label={label}><TextInput type="number" min="0" step="any" value={form[key] ?? ''} onChange={(value) => setValue(key, value)} placeholder="未取得" /></Field>)}</div><div className="metric-save-row"><span><CircleHelp size={14} />計測日時：保存時に自動記録</span><Button variant="primary" type="submit" icon={Save}>実績を保存</Button></div>
      </form>
    </Card><aside className="metric-side"><Card title="算出された率" subtitle="必要な分母・分子が揃った場合のみ算出"><div className="rate-list">{[['反応率', rates.reactionRate], ['プロフィール遷移率', rates.profileVisitRate], ['リンククリック率', rates.linkClickRate], ['LINE登録率', rates.lineRegistrationRate], ['問い合わせ率', rates.inquiryRate], ['成約率', rates.conversionRate]].map(([label, value]) => <div className="rate-row" key={label}><span>{label}</span><strong className={value === null ? 'rate-unavailable' : ''}>{formatRate(value)}</strong></div>)}</div><div className="rate-formula-link">反応率 = (いいね + コメント + 保存 + シェア) ÷ 表示数 × 100。保存・表示数・率の分母がない場合は「算出不可」です。</div><div className="metric-caveat"><CircleHelp size={14} />媒体ごとに取得可能な指標は異なります。API未実装の媒体は手入力の値だけを使います。</div></Card><Card title="指標の計算式" subtitle="式と算出条件"><div className="formula-list">{METRIC_DEFINITIONS.map(([name, formula, condition]) => <div key={name}><strong>{name}</strong><span>{formula}</span><small>{condition}</small></div>)}</div></Card></aside></div>
    <Card title="過去の投稿比較" subtitle="ユーザーが記録した値のみ。少数サンプルから因果関係を断定しません。" className="post-history-card" padding="none">{savedItems.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>投稿</th><th>媒体</th><th>公開日</th><th className="num-align">表示数</th><th className="num-align">反応率</th><th className="num-align">LINE登録</th><th className="num-align">売上</th></tr></thead><tbody>{savedItems.map((record) => { const post = posts.find((item) => item.id === record.postId); const computed = calculatePerformance(record); return <tr key={record.id}><td><button className="table-title-button" onClick={() => selectPost(post?.id)}>{post?.title || '投稿'}</button></td><td><PlatformBadge platform={post?.platform} compact /></td><td>{post?.publishedAt || '—'}</td><td className="num-align">{record.impressions == null ? '未取得' : formatNumber(record.impressions)}</td><td className="num-align">{formatRate(computed.reactionRate)}</td><td className="num-align">{record.lineRegistrations == null ? '未取得' : formatNumber(record.lineRegistrations)}</td><td className="num-align">{record.revenue == null ? '未取得' : `¥${formatNumber(record.revenue)}`}</td></tr>; })}</tbody></table></div> : <EmptyState icon={TrendingUp} title="比較できる投稿実績がありません" description="公開後の計測値を手入力で記録すると、実際のデータを比較できます。" action={<Button size="sm" variant="secondary" onClick={startNew}>実績を追加</Button>} />}</Card>
    <Card title="パターンの観察" subtitle="企画に紐づいた投稿が同一テーマで2件以上ある場合のみ表示" className="observed-pattern-card">{observedPatterns.length ? <div className="observed-pattern-list">{observedPatterns.map((item) => <div key={item.label}><span className="pattern-topic">{item.label}</span><strong>{item.count}件の記録</strong><span>合算反応率（入力済み分） {item.impressions > 0 ? `${((item.reactions / item.impressions) * 100).toFixed(1)}%` : '算出不可'}</span><small>関連CTA：{item.cta || '未設定'} · 相関の観察であり因果を示すものではありません。</small></div>)}</div> : <div className="observation-empty"><span>記録データが不足しています。</span><small>同じキーワードに紐づく投稿実績を2件以上登録すると、参考値を表示します。</small></div>}</Card>
    </>}
  </div>;
}
