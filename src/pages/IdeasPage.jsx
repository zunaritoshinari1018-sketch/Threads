import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Copy, FileText, Lightbulb, Plus, Save, Search, Send, Trash2 } from 'lucide-react';
import { makeDraft, makeId, nowIso, PLATFORMS, PLATFORM_FIELDS, PLATFORM_CONTENT_TYPE } from '../domain.js';
import { Button, Card, DateLabel, EmptyState, Field, PageHeader, Pill, PlatformBadge, SelectInput, TextArea, TextInput } from '../ui.jsx';

export const PUBLISH_STATUSES = ['アイデア', 'リサーチ中', '企画作成中', '制作中', '投稿予定', '投稿済み', '効果測定中', '改善対象', '完了'];

export function IdeasPage({ store, setStore, activeProject, notify, navigate }) {
  const project = activeProject || store.projects[0] || null;
  const projectKeywords = store.keywords.filter((item) => !project || item.projectId === project.id);
  const ideas = useMemo(() => store.contentIdeas.filter((item) => !project || item.projectId === project.id).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')), [store.contentIdeas, project?.id]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedKeywordId, setSelectedKeywordId] = useState(projectKeywords.find((item) => item.isSeed)?.id || projectKeywords[0]?.id || '');
  const [platform, setPlatform] = useState('threads');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (projectKeywords.length && !projectKeywords.some((item) => item.id === selectedKeywordId)) setSelectedKeywordId(projectKeywords.find((item) => item.isSeed)?.id || projectKeywords[0].id); }, [project?.id, projectKeywords.map((item) => item.id).join('|')]);
  useEffect(() => { if (ideas.length && !ideas.some((item) => item.id === selectedId)) setSelectedId(ideas[0].id); if (!ideas.length) setSelectedId(''); }, [ideas.map((item) => item.id).join('|')]);
  useEffect(() => { const chosen = ideas.find((item) => item.id === selectedId); setDraft(chosen ? structuredClone(chosen) : null); setDirty(false); }, [selectedId]);
  const visibleIdeas = ideas.filter((item) => `${item.title} ${item.platform} ${item.status}`.toLowerCase().includes(query.toLowerCase()));
  const generate = () => {
    const keyword = projectKeywords.find((item) => item.id === selectedKeywordId);
    if (!keyword) return notify('企画の元になるキーワードを選択してください。', 'error');
    const item = makeDraft(platform, keyword, project || {});
    setStore((current) => ({ ...current, contentIdeas: [item, ...current.contentIdeas] })); setSelectedId(item.id); setDraft(item); setDirty(false); notify(`${PLATFORM_CONTENT_TYPE[platform]}の企画案を作成しました。ローカルテンプレートです。`);
  };
  const patch = (key, value) => { setDraft((current) => ({ ...current, [key]: value, updatedAt: nowIso() })); setDirty(true); };
  const patchField = (key, value) => setDraft((current) => ({ ...current, title: key === 'title' ? value : current.title, fields: { ...current.fields, [key]: value }, updatedAt: nowIso() }));
  const save = () => {
    if (!draft) return;
    const updated = { ...draft, updatedAt: nowIso() };
    setStore((current) => ({ ...current, contentIdeas: current.contentIdeas.map((item) => item.id === updated.id ? updated : item) })); setDraft(updated); setDirty(false); notify('投稿企画を保存しました。');
  };
  const duplicate = () => {
    if (!draft) return;
    const copy = { ...structuredClone(draft), id: makeId('idea'), title: `${draft.title || '企画'}（コピー）`, status: 'アイデア', scheduledDate: '', createdAt: nowIso(), updatedAt: nowIso() };
    setStore((current) => ({ ...current, contentIdeas: [copy, ...current.contentIdeas] })); setSelectedId(copy.id); notify('企画を複製しました。');
  };
  const remove = () => {
    if (!draft || !window.confirm('この投稿企画を削除しますか？')) return;
    setStore((current) => ({ ...current, contentIdeas: current.contentIdeas.filter((item) => item.id !== draft.id) })); setSelectedId(''); setDraft(null); notify('投稿企画を削除しました。');
  };
  const markToCalendar = () => {
    if (!draft) return;
    if (dirty) save();
    const next = { ...draft, status: '投稿予定', scheduledDate: draft.scheduledDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10), updatedAt: nowIso() };
    setStore((current) => ({ ...current, contentIdeas: current.contentIdeas.map((item) => item.id === next.id ? next : item) })); setDraft(next); setDirty(false); notify('企画を投稿カレンダーに登録しました。');
  };
  const fields = draft ? PLATFORM_FIELDS[draft.platform] || [] : [];
  return <div className="page-content">
    <PageHeader eyebrow="CONTENT STUDIO" title="投稿企画" description="悩み・検索意図・媒体に合わせた企画の下書きを作成し、編集・保存します。生成文は公開前に一次情報を追加してください。" icon={Lightbulb} actions={<Button variant="primary" icon={Plus} onClick={generate} disabled={!projectKeywords.length}>企画を生成</Button>} />
    {!project ? <div className="setup-empty"><EmptyState icon={Lightbulb} title="キーワードを起点に企画を作成" description="リサーチを作成すると、媒体別の投稿企画を保存・編集できます。" action={<Button variant="primary" onClick={() => navigate('research')}>新規リサーチ</Button>} /></div> : <>
    <div className="idea-generator-bar card"><div className="idea-generator-heading"><span className="idea-generator-icon"><FileText size={17} /></span><span><strong>新しい企画をつくる</strong><small>キーワードからローカルテンプレートを生成</small></span></div><div className="idea-generator-controls"><Field label="元キーワード"><SelectInput value={selectedKeywordId} onChange={setSelectedKeywordId} options={projectKeywords.map((item) => ({ value: item.id, label: item.text }))} placeholder="キーワードを選択" /></Field><Field label="投稿媒体"><SelectInput value={platform} onChange={setPlatform} options={PLATFORMS.map((item) => ({ value: item.id, label: item.label }))} /></Field><Button variant="primary" icon={Plus} onClick={generate} disabled={!selectedKeywordId}>企画案を作成</Button></div></div>
    <div className="ideas-layout"><aside className="ideas-sidebar card"><div className="ideas-sidebar-head"><div><strong>保存した企画</strong><small>{ideas.length}件</small></div><button className="icon-button" title="新規企画" onClick={generate}><Plus size={17} /></button></div><div className="ideas-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="企画を検索" /></div><div className="idea-list">{visibleIdeas.map((item) => <button key={item.id} className={`idea-list-item ${selectedId === item.id ? 'is-active' : ''}`} onClick={() => setSelectedId(item.id)}><div className="idea-item-top"><PlatformBadge platform={item.platform} compact /><Pill tone={item.status === '投稿済み' || item.status === '完了' ? 'success' : 'neutral'}>{item.status || 'アイデア'}</Pill></div><strong>{item.title || '無題の企画'}</strong><small><DateLabel date={item.updatedAt || item.createdAt} />{item.scheduledDate && ` · ${item.scheduledDate}`}</small></button>)}{!visibleIdeas.length && <div className="idea-list-empty">{ideas.length ? '一致する企画はありません。' : '保存した企画はありません。'}<br />キーワードを選び、企画案を作成してください。</div>}</div></aside>
    <section className="idea-editor card">{draft ? <>
      <div className="idea-editor-head"><div className="idea-editor-meta"><Pill tone="blue">{draft.source || 'ローカルテンプレート'}</Pill><PlatformBadge platform={draft.platform} /><span className="editor-updated">更新 <DateLabel date={draft.updatedAt} /></span></div><div className="idea-editor-actions"><Button size="sm" icon={Copy} onClick={duplicate}>複製</Button><Button size="sm" icon={Trash2} variant="danger-quiet" onClick={remove}>削除</Button><Button size="sm" icon={CalendarDays} onClick={markToCalendar}>カレンダーへ</Button><Button size="sm" variant="primary" icon={Save} onClick={save} disabled={!dirty}>{dirty ? '変更を保存' : '保存済み'}</Button></div></div>
      <div className="idea-editor-title"><div><div className="eyebrow">{PLATFORM_CONTENT_TYPE[draft.platform]} · {draft.fields?.intent || '企画下書き'}</div><Field label="企画タイトル"><TextInput value={draft.title || ''} onChange={(value) => { setDraft((current) => ({ ...current, title: value })); setDirty(true); }} placeholder="企画タイトル" /></Field></div><Field label="運用ステータス"><SelectInput value={draft.status || 'アイデア'} onChange={(value) => patch('status', value)} options={PUBLISH_STATUSES} /></Field></div>
      {draft.platform === 'google' && <div className="seo-distinction"><span className="seo-marker">G</span><div><strong>Google検索向け記事企画</strong><p>Googleの検索意図・関連語を整理する構成案です。SNS内検索の検索回数やSEO効果を保証するものではありません。</p></div></div>}
      <div className="draft-field-grid">{fields.map(([key, label]) => <Field key={key} label={label} className={['outline', 'slides', 'questions', 'related', 'faq', 'caption', 'steps', 'evidence'].includes(key) ? 'draft-field-wide' : ''}><TextArea value={draft.fields?.[key] || ''} onChange={(value) => patchField(key, value)} rows={['outline', 'slides', 'questions', 'faq', 'steps'].includes(key) ? 5 : ['caption', 'evidence', 'cta'].includes(key) ? 3 : 2} placeholder={`${label}を編集...`} /></Field>)}</div>
      <div className="draft-note"><span>ⓘ</span>文章はローカルテンプレートによる下書きです。実績・事例・数値は生成していません。公開前に一次情報、出典、権利を確認してください。</div>
      <div className="schedule-inline"><div><CalendarDays size={15} /><span>公開予定日</span></div><input type="date" value={draft.scheduledDate || ''} onChange={(event) => patch('scheduledDate', event.target.value)} /><Button size="sm" variant="quiet" onClick={markToCalendar}><Send size={14} /> カレンダーに登録</Button></div>
    </> : <EmptyState icon={FileText} title="編集する企画を選択" description="保存済みの企画を開くか、キーワードから新しい案を作成してください。" action={<Button variant="primary" onClick={generate} disabled={!selectedKeywordId}>企画を作成</Button>} />}</section></div>
    </>}
  </div>;
}
