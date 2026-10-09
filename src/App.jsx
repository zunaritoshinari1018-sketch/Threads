import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, Archive, ArrowDownToLine, ArrowRight, BarChart3, CalendarDays, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Database, FileText, Filter, FolderKanban, Globe2,
  Hash, LayoutDashboard, Lightbulb, Link2, ListChecks, Menu, Plus, Search, Settings2, Sparkles,
  Target, Trash2, TrendingUp, X, Youtube,
} from 'lucide-react';
import { loadStore, saveStore, createBackup, validateImport, EMPTY_STORE } from './store.js';
import {
  calculateScore, classifyKeyword, generateKeywordSuggestions, inferIntent, makeBrief, makeId,
  nowIso, PAIN_CATEGORIES, PLATFORMS, PURPOSES, SCORE_FIELDS,
} from './domain.js';
import {
  Button, Card, DataOrigin, DateLabel, EmptyState, Field, LinkButton, Modal, PageHeader,
  Pill, PlatformBadge, SelectInput, TextArea, TextInput, ToggleChip, formatNumber,
} from './ui.jsx';
import { AnalysisPage, CompetitorPage, IdeasPage, CalendarPage, MetricsPage, ConnectionsPage, DataPage } from './pages/ResearchPages.jsx';
import './styles.css';

const NAV = [
  { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard, group: 'ホーム' },
  { id: 'research', label: '新規リサーチ', icon: Plus, group: 'リサーチ' },
  { id: 'keywords', label: 'キーワード探索', icon: Hash, group: 'リサーチ' },
  { id: 'analysis', label: '立体分析', icon: Target, group: 'リサーチ' },
  { id: 'competitors', label: '競合分析', icon: Search, group: 'コンテンツ' },
  { id: 'ideas', label: '投稿企画', icon: Lightbulb, group: 'コンテンツ' },
  { id: 'calendar', label: '投稿カレンダー', icon: CalendarDays, group: '運用' },
  { id: 'metrics', label: '成果計測', icon: TrendingUp, group: '運用' },
  { id: 'connections', label: 'API接続設定', icon: Link2, group: '設定' },
  { id: 'data', label: 'データ管理', icon: Database, group: '設定' },
];

function downloadBlob(name, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const cell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return `\uFEFF${[headers.map(cell).join(','), ...rows.map((row) => headers.map((header) => cell(Array.isArray(row[header]) || typeof row[header] === 'object' ? JSON.stringify(row[header]) : row[header])).join(','))].join('\r\n')}`;
}

function Toast({ item, onClose }) {
  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(onClose, 3800);
    return () => clearTimeout(timer);
  }, [item, onClose]);
  if (!item) return null;
  return <div className={`toast toast-${item.type || 'success'}`} role="status"><span>{item.type === 'error' ? '!' : '✓'}</span><div>{item.message}</div><button onClick={onClose}><X size={15} /></button></div>;
}

function Sidebar({ page, setPage, projects, activeProject, store, mobileOpen, setMobileOpen }) {
  const groups = [...new Set(NAV.map((item) => item.group))];
  const counts = { keywords: store.keywords.filter((item) => !activeProject || item.projectId === activeProject.id).length, ideas: store.contentIdeas.filter((item) => !activeProject || item.projectId === activeProject.id).length };
  return <>
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="メニューを閉じる" />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
      <div className="brand-lockup">
        <div className="brand-mark"><span /><span /><span /></div>
        <div><strong>layer</strong><small>RESEARCH STUDIO</small></div>
        <button className="mobile-close icon-button" aria-label="閉じる" onClick={() => setMobileOpen(false)}><X size={17} /></button>
      </div>
      <div className="workspace-mini"><div className="workspace-avatar">{activeProject?.name?.slice(0, 1) || 'L'}</div><div className="workspace-label"><strong>{activeProject?.name || 'マイワークスペース'}</strong><small>{activeProject ? '個人用リサーチ' : 'プロジェクト未作成'}</small></div><ChevronDown size={14} /></div>
      <nav className="main-nav">
        {groups.map((group) => <div className="nav-group" key={group}>
          <div className="nav-group-label">{group}</div>
          {NAV.filter((item) => item.group === group).map((item) => {
            const Icon = item.icon;
            return <button className={`nav-link ${page === item.id ? 'active' : ''}`} key={item.id} onClick={() => { setPage(item.id); setMobileOpen(false); }}>
              <Icon size={17} strokeWidth={page === item.id ? 2.1 : 1.8} /><span>{item.label}</span>
              {counts[item.id] > 0 && <b>{counts[item.id] > 99 ? '99+' : counts[item.id]}</b>}
              {item.id === 'analysis' && <span className="nav-new">CORE</span>}
            </button>;
          })}
        </div>)}
      </nav>
      <div className="sidebar-footer">
        <div className="storage-note"><span className="storage-dot" /><div><strong>ローカル保存</strong><small>このブラウザに自動保存</small></div></div>
        <div className="sidebar-footline"><span>Layer Research Studio</span><span>v1.0</span></div>
      </div>
    </aside>
  </>;
}

function Topbar({ activeProject, projects, setActiveProject, globalSearch, setGlobalSearch, onSearch, setMobileOpen }) {
  return <header className="topbar">
    <div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)} aria-label="メニュー"><Menu size={19} /></button><div className="topbar-project"><FolderKanban size={15} /><select aria-label="プロジェクト" value={activeProject?.id || ''} onChange={(event) => setActiveProject(event.target.value || null)}><option value="">すべてのプロジェクト</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><ChevronDown size={13} /></div></div>
    <div className="topbar-right"><label className="global-search"><Search size={16} /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSearch()} placeholder="キーワード・企画を検索..." /><kbd>⌘ K</kbd></label><span className="topbar-divider" /><button className="avatar-button" title="個人ワークスペース">Y</button></div>
  </header>;
}

function Dashboard({ store, activeProject, apiStatus, onNavigate, setSelectedKeywordId, onCreateResearch }) {
  const projects = activeProject ? [activeProject] : store.projects;
  const projectIds = new Set(projects.map((item) => item.id));
  const keywords = store.keywords.filter((item) => projectIds.has(item.projectId));
  const ideas = store.contentIdeas.filter((item) => projectIds.has(item.projectId));
  const sessions = store.researchSessions.filter((item) => projectIds.has(item.projectId)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 4);
  const posts = store.publishedPosts.filter((item) => projectIds.has(item.projectId));
  const metrics = store.performanceMetrics.filter((item) => posts.some((post) => post.id === item.postId));
  const sum = (key) => {
    const values = metrics.map((item) => item[key]).filter((value) => value !== null && value !== undefined && value !== '');
    return values.length ? values.reduce((total, value) => total + (Number(value) || 0), 0) : null;
  };
  const integrations = PLATFORMS.map((platform) => ({ ...platform, connection: apiStatus?.platforms?.[platform.id] }));
  const priorities = ideas.filter((idea) => !['完了'].includes(idea.status)).slice(0, 4);
  const recentApiEvents = (store.apiEvents || []).filter((item) => item.projectId == null || projectIds.has(item.projectId)).slice(0, 2);
  const today = new Date().toISOString().slice(0, 10);
  const youtubeUnits = store.settings.youtubeQuota?.date === today ? Number(store.settings.youtubeQuota.estimatedUnits || 0) : 0;
  const statusText = (connection) => connection?.status === 'connected' ? '接続済み' : connection?.status === 'manual_only' ? '手動調査' : connection?.configured ? '未テスト' : '未設定';
  const tone = (connection) => connection?.status === 'connected' ? 'success' : connection?.status === 'manual_only' ? 'neutral' : 'amber';
  return <div className="page-content dashboard-page">
    <div className="hero-panel">
      <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
      <div className="hero-content"><div className="hero-kicker"><Sparkles size={14} /> INSIGHT WORKSPACE</div><h1>データと仮説を、<br /><span>投稿の成果</span>につなぐ。</h1><p>4媒体を横断したリサーチを、読者の悩みから企画・検証までひとつの流れに。</p><div className="hero-actions"><Button variant="white" icon={Plus} onClick={onCreateResearch}>リサーチを始める</Button><button className="hero-link" onClick={() => onNavigate('analysis')}>立体分析を見る <ArrowRight size={14} /></button></div></div>
      <div className="hero-art"><div className="hero-art-grid" /><div className="hero-center"><div className="hero-center-core"><Target size={23} /></div><span className="hero-ring ring-one" /><span className="hero-ring ring-two" /><span className="hero-orbit-node orbit-a"><Hash size={14} /></span><span className="hero-orbit-node orbit-b"><Lightbulb size={14} /></span><span className="hero-orbit-node orbit-c"><Activity size={14} /></span><span className="hero-orbit-node orbit-d"><Link2 size={14} /></span><span className="hero-art-label">RESEARCH → ACTION</span></div></div>
    </div>
    <div className="stat-grid">
      <StatCard icon={Hash} label="保存キーワード" value={keywords.length} detail={keywords.length ? '手入力・生成候補を含む' : 'まだデータがありません'} tint="blue" onClick={() => onNavigate('keywords')} />
      <StatCard icon={Lightbulb} label="投稿企画" value={ideas.length} detail={ideas.length ? `${ideas.filter((item) => item.scheduledDate).length} 件をカレンダー登録` : '分析から企画を作成'} tint="purple" onClick={() => onNavigate('ideas')} />
      <StatCard icon={BarChart3} label="投稿実績" value={posts.length} detail={posts.length ? `表示 ${formatNumber(sum('impressions'))} · 登録 ${formatNumber(sum('lineRegistrations'))}` : '手入力の実績を記録できます'} tint="green" onClick={() => onNavigate('metrics')} />
      <StatCard icon={Activity} label="API連携" value={`${integrations.filter((item) => item.connection?.status === 'connected').length}/4`} detail="接続テスト成功数" tint="amber" onClick={() => onNavigate('connections')} />
    </div>
    <div className="dashboard-grid">
      <Card title="最近のリサーチ" subtitle="保存した調査と起点キーワード" action={<Button size="sm" variant="quiet" onClick={() => onNavigate('research')}>すべて見る <ChevronRight size={14} /></Button>} className="recent-card">
        {sessions.length ? <div className="research-list">{sessions.map((session) => {
          const project = store.projects.find((item) => item.id === session.projectId);
          const keyword = store.keywords.find((item) => item.id === session.seedKeywordId);
          return <button className="research-row" key={session.id} onClick={() => { if (keyword) setSelectedKeywordId(keyword.id); onNavigate('keywords'); }}><span className="research-row-mark"><Search size={16} /></span><span className="research-row-copy"><strong>{session.name}</strong><small>{keyword?.text || '起点キーワード未登録'} <i>·</i> {project?.name || ''}</small></span><DateLabel date={session.createdAt} /><ChevronRight size={15} className="row-chevron" /></button>;
        })}</div> : <EmptyState icon={Search} title="リサーチはまだありません" description="起点キーワードを決めて、最初の調査プロジェクトを作成しましょう。" action={<Button variant="primary" size="sm" icon={Plus} onClick={onCreateResearch}>新規リサーチ</Button>} />}
      </Card>
      <Card title="接続状況" subtitle="APIテストの成功状態。未接続でも手動調査できます。" action={<Button size="sm" variant="quiet" onClick={() => onNavigate('connections')}>設定 <ChevronRight size={14} /></Button>} className="connections-card">
        <div className="integration-list">{integrations.map((platform) => <div className="integration-row" key={platform.id}><PlatformBadge platform={platform.id} /><Pill tone={tone(platform.connection)} dot>{statusText(platform.connection)}</Pill></div>)}</div>
        <div className="integration-hint"><CircleHelp size={14} /><span>APIキーはサーバー環境変数で管理。ブラウザには保存しません。</span></div>
        {(youtubeUnits > 0 || recentApiEvents.length > 0) && <div className="api-dashboard-activity"><div className="api-usage-note"><Activity size={13} /><span>YouTube本日概算 <strong>{formatNumber(youtubeUnits)}</strong> / 10,000 units</span></div>{recentApiEvents.map((event) => <div className={`api-event-row ${event.status === 'error' ? 'api-event-error' : ''}`} key={event.id}><PlatformBadge platform={event.platform} compact /><span>{event.message || event.action}</span><DateLabel date={event.createdAt} /></div>)}</div>}
      </Card>
      <Card title="次のアクション" subtitle="保存した企画から運用を進める" action={<Button size="sm" variant="quiet" onClick={() => onNavigate('ideas')}>企画一覧 <ChevronRight size={14} /></Button>} className="priority-card">
        {priorities.length ? <div className="priority-list">{priorities.map((idea, index) => <button key={idea.id} className="priority-row" onClick={() => onNavigate('ideas')}><span className="priority-index">0{index + 1}</span><span><strong>{idea.title || '無題の企画'}</strong><small><PlatformBadge platform={idea.platform} compact /> <span>{idea.status || 'アイデア'}</span></small></span><ArrowRight size={15} /></button>)}</div> : <EmptyState icon={Lightbulb} title="投稿ネタはまだありません" description="キーワードを選んで、媒体別の企画案を生成できます。" action={<Button size="sm" variant="secondary" onClick={() => onNavigate('ideas')}>企画を作る <ArrowRight size={14} /></Button>} />}
      </Card>
      <Card title="運用のサマリー" subtitle="登録済みの手入力実績のみ" className="summary-card">
        {metrics.length ? <div className="summary-metrics"><div><span>表示数</span><strong>{formatNumber(sum('impressions'))}</strong></div><div><span>LINE登録</span><strong>{formatNumber(sum('lineRegistrations'))}</strong></div><div><span>売上</span><strong>{sum('revenue') == null ? '未取得' : `¥${formatNumber(sum('revenue'))}`}</strong></div><p>集計対象 {metrics.length} 件 · 値が未入力の指標は集計に含めていません。</p></div> : <EmptyState icon={BarChart3} title="実績データはありません" description="公開後の数値を記録すると、投稿ごとの成果を比較できます。" action={<Button size="sm" variant="quiet" onClick={() => onNavigate('metrics')}>計測を開く <ArrowRight size={14} /></Button>} />}
      </Card>
    </div>
    <footer className="page-footnote"><span>データの最終更新</span><DateLabel date={store.updatedAt || store.keywords.at(-1)?.updatedAt} fallback="このセッションで未保存" /><span className="footnote-sep">·</span><span>調査候補は実測データと区別して表示されます。</span></footer>
  </div>;
}

function StatCard({ icon: Icon, label, value, detail, tint, onClick }) {
  return <button className={`stat-card stat-${tint}`} onClick={onClick}><span className="stat-icon"><Icon size={17} /></span><span className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></span><ArrowRight size={15} className="stat-arrow" /></button>;
}

function ResearchPage({ onStartResearch, projects, sessions, onOpenProject }) {
  const [form, setForm] = useState({ name: '', seed: '', platforms: ['google', 'youtube', 'instagram', 'threads'], audience: '', product: '', goal: '投稿ネタの発掘', language: '日本語', region: '日本', period: '直近12か月（設定のみ）', resultCount: '10', intentFocus: '指定なし', painDepth: '探索', ctaGoal: 'LINE登録' });
  const [error, setError] = useState('');
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const togglePlatform = (platform) => change('platforms', form.platforms.includes(platform) ? form.platforms.filter((item) => item !== platform) : [...form.platforms, platform]);
  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.seed.trim()) return setError('リサーチ名と起点キーワードを入力してください。');
    if (!form.platforms.length) return setError('調査対象媒体を1つ以上選択してください。');
    setError(''); onStartResearch(form);
  };
  return <div className="page-content">
    <PageHeader eyebrow="RESEARCH SETUP" title="新規リサーチ" description="調査の目的と読者を設定し、起点キーワードから候補を組み立てます。" icon={Search} />
    <div className="research-layout">
      <form className="card research-form" onSubmit={submit}>
        <div className="form-section"><div className="form-section-title"><span className="step-number">01</span><div><strong>調査の基本情報</strong><small>このプロジェクトを識別する情報</small></div></div><div className="form-grid two-col">
          <Field label="リサーチ名" required><TextInput value={form.name} onChange={(value) => change('name', value)} placeholder="例：夏のInstagram集客テーマ" /></Field>
          <Field label="起点キーワード" required hint="検索候補の生成に使います。実測検索データではありません。"><TextInput value={form.seed} onChange={(value) => change('seed', value)} placeholder="例：Threads 集客" /></Field>
        </div></div>
        <div className="form-section"><div className="form-section-title"><span className="step-number">02</span><div><strong>媒体と調査目的</strong><small>必要な媒体を選択してください</small></div></div><Field label="調査対象媒体"><div className="platform-toggle-list">{PLATFORMS.map((platform) => <ToggleChip key={platform.id} checked={form.platforms.includes(platform.id)} onChange={() => togglePlatform(platform.id)}><span className="platform-dot" style={{ background: platform.color }} />{platform.label}</ToggleChip>)}</div></Field><div className="form-grid two-col"><Field label="調査目的"><SelectInput value={form.goal} onChange={(value) => change('goal', value)} options={PURPOSES} /></Field><Field label="CTAの目的"><SelectInput value={form.ctaGoal} onChange={(value) => change('ctaGoal', value)} options={['LINE登録', '問い合わせ', '商品購入', '資料請求', 'フォロー・保存', '記事回遊', '認知・反応', 'その他']} /></Field></div></div>
        <div className="form-section"><div className="form-section-title"><span className="step-number">03</span><div><strong>読者と条件</strong><small>分析仮説の精度を上げるコンテキスト</small></div></div><div className="form-grid two-col"><Field label="対象読者"><TextInput value={form.audience} onChange={(value) => change('audience', value)} placeholder="例：一人でSNSを運用する個人事業主" /></Field><Field label="商品・サービス"><TextInput value={form.product} onChange={(value) => change('product', value)} placeholder="任意。支援できる悩みを分析します" /></Field><Field label="言語"><SelectInput value={form.language} onChange={(value) => change('language', value)} options={['日本語', '英語', 'その他']} /></Field><Field label="地域"><SelectInput value={form.region} onChange={(value) => change('region', value)} options={['日本', '米国', '英国', 'カナダ', 'オーストラリア', 'その他']} /></Field></div></div>
        <div className="form-section"><div className="form-section-title"><span className="step-number">04</span><div><strong>調査範囲</strong><small>媒体APIを使わない場合は候補生成設定として記録されます</small></div></div><div className="form-grid three-col"><Field label="公開期間"><SelectInput value={form.period} onChange={(value) => change('period', value)} options={['期間指定なし', '直近30日', '直近90日', '直近12か月（設定のみ）']} /></Field><Field label="取得・候補件数"><SelectInput value={form.resultCount} onChange={(value) => change('resultCount', value)} options={['5', '10', '20', '50']} /></Field><Field label="検索意図の重点"><SelectInput value={form.intentFocus} onChange={(value) => change('intentFocus', value)} options={['指定なし', '情報収集', '比較・検討', '課題解決', '比較・購入検討']} /></Field><Field label="悩みの深さ"><SelectInput value={form.painDepth} onChange={(value) => change('painDepth', value)} options={['探索', '表面的な課題', '具体的な障壁', '購入に近い課題']} /></Field></div></div>
        {error && <div className="inline-error">{error}</div>}
        <div className="form-footer"><span><CircleHelp size={15} /> API未接続でも候補生成・編集・保存・分析ができます。</span><Button variant="primary" type="submit" icon={ArrowRight}>リサーチを作成</Button></div>
      </form>
      <aside className="research-aside"><div className="aside-callout"><div className="aside-callout-icon"><Sparkles size={19} /></div><h3>実測と仮説を分ける</h3><p>ローカルで作成した候補は「派生候補」と表示します。APIから取得した値や手入力データと混同しません。</p><div className="aside-separator" /><div className="source-legend"><DataOrigin origin="official_api" /><span>公式API実測</span></div><div className="source-legend"><DataOrigin origin="manual" /><span>手入力・一次情報</span></div><div className="source-legend"><DataOrigin origin="derived" /><span>ローカル生成・派生候補</span></div></div>
        <Card title="最近のプロジェクト" subtitle="ローカルに保存された調査">{projects.length ? <div className="mini-project-list">{projects.slice(0, 5).map((project) => <button key={project.id} onClick={() => onOpenProject(project.id)}><span className="project-initial">{project.name.slice(0, 1)}</span><span><strong>{project.name}</strong><small>{project.seedKeyword || '起点語なし'}</small></span><ChevronRight size={15} /></button>)}</div> : <p className="muted-copy">まだプロジェクトはありません。</p>}</Card>
      </aside>
    </div>
  </div>;
}

function KeywordModal({ open, onClose, keyword, projectId, onSave, onDelete }) {
  const [form, setForm] = useState({ text: '', note: '', intent: '', categories: [], origin: 'manual', searchVolume: '', volumeSource: '', ...keyword });
  useEffect(() => { setForm({ text: '', note: '', intent: '', categories: [], origin: 'manual', searchVolume: '', volumeSource: '', ...keyword }); }, [keyword, open]);
  if (!open) return null;
  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleCategory = (id) => patch('categories', form.categories.includes(id) ? form.categories.filter((item) => item !== id) : [...form.categories.filter((item) => item !== 'review'), id]);
  return <Modal open={open} onClose={onClose} title={keyword ? 'キーワードを編集' : 'キーワードを追加'} subtitle="未取得の検索ボリュームを推測値で埋めることはありません。" footer={<><Button variant="quiet" onClick={onClose}>キャンセル</Button>{keyword && <Button variant="danger-quiet" icon={Trash2} onClick={() => onDelete(keyword.id)}>削除</Button>}<Button variant="primary" icon={Check} onClick={() => onSave({ ...form, projectId, id: form.id })}>保存</Button></>}>
    <div className="form-grid two-col"><Field label="キーワード" required><TextInput value={form.text} onChange={(value) => patch('text', value)} placeholder="関連語・質問・ロングテール" autoFocus /></Field><Field label="検索意図"><SelectInput value={form.intent || inferIntent(form.text)} onChange={(value) => patch('intent', value)} options={['情報収集', '課題解決', '比較・検討', '比較・購入検討', '案内・指名', '要確認']} /></Field></div>
    <Field label="悩みの分類" hint="複数選択できます。曖昧な場合は要確認を残してください。"><div className="category-chip-list">{PAIN_CATEGORIES.map((item) => <ToggleChip key={item.id} checked={form.categories.includes(item.id)} onChange={() => toggleCategory(item.id)}>{item.label}</ToggleChip>)}<ToggleChip checked={form.categories.includes('review') || !form.categories.length} onChange={() => patch('categories', ['review'])}>要確認</ToggleChip></div></Field>
    {form.origin === 'official_api' && <div className="form-grid two-col"><Field label="月間平均検索数"><TextInput type="number" min="0" value={form.searchVolume ?? ''} onChange={(value) => patch('searchVolume', value === '' ? null : Number(value))} placeholder="取得した値のみ" /></Field><Field label="出典・対象地域"><TextInput value={form.volumeSource || ''} onChange={(value) => patch('volumeSource', value)} placeholder="API・地域・言語" /></Field></div>}
    <Field label="メモ・分類根拠"><TextArea value={form.note} onChange={(value) => patch('note', value)} placeholder="分類の根拠、調査メモ、一次情報など" rows={3} /></Field>
    <div className="form-grid two-col"><Field label="データの出所"><SelectInput value={form.origin || 'manual'} onChange={(value) => patch('origin', value)} options={[{ value: 'manual', label: '手入力' }, { value: 'official_api', label: '公式API実測' }, { value: 'imported', label: 'インポート' }, { value: 'derived', label: 'ローカル生成・派生' }, { value: 'ai_generated', label: 'AI生成（外部AIでは未実装）' }, { value: 'ai_estimated', label: 'AI推定（外部AIでは未実装）' }]} /></Field><Field label="検索需要"><div className="unavailable-value">{form.searchVolume != null && form.searchVolume !== '' ? `${formatNumber(form.searchVolume)} / 月 · ${form.volumeSource || '取得元を記録してください'}` : '未取得'}</div></Field></div>
  </Modal>;
}

export function KeywordsPage({ store, setStore, activeProject, setSelectedKeywordId, selectedKeywordId, globalSearch, notify, navigate, refreshApiStatus }) {
  const [query, setQuery] = useState(globalSearch || '');
  const [filterOrigin, setFilterOrigin] = useState('all');
  const [filterIntent, setFilterIntent] = useState('all');
  const [editKeyword, setEditKeyword] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [candidateSelection, setCandidateSelection] = useState([]);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [candidateSeed, setCandidateSeed] = useState('');
  const [candidateProject, setCandidateProject] = useState(activeProject?.id || '');
  const [seedKeywordId, setSeedKeywordId] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState('');
  useEffect(() => { setQuery(globalSearch || ''); }, [globalSearch]);
  useEffect(() => { setCandidateProject(activeProject?.id || ''); }, [activeProject?.id]);
  const project = store.projects.find((item) => item.id === candidateProject) || activeProject || store.projects[0] || null;
  const allKeywords = store.keywords.filter((item) => !project || item.projectId === project.id);
  const searchMetricMap = new Map();
  for (const metric of [...(store.searchMetrics || [])].filter((item) => !project || item.projectId === project.id).sort((a, b) => (b.collectedAt || '').localeCompare(a.collectedAt || ''))) {
    if (!searchMetricMap.has(metric.keywordId)) searchMetricMap.set(metric.keywordId, metric);
  }
  const visibleKeywords = allKeywords.filter((item) => {
    const normalizedQuery = query.trim().toLowerCase();
    return (!normalizedQuery || `${item.text} ${item.note || ''} ${item.intent || ''}`.toLowerCase().includes(normalizedQuery))
      && (filterOrigin === 'all' || item.origin === filterOrigin)
      && (filterIntent === 'all' || (item.intent || inferIntent(item.text)) === filterIntent);
  });
  const selectedKeyword = store.keywords.find((item) => item.id === selectedKeywordId && (!project || item.projectId === project.id)) || visibleKeywords[0] || null;
  const weights = SCORE_FIELDS.map((item) => ({ ...item, weight: store.settings.weights?.[item.id] ?? item.weight }));
  const score = selectedKeyword ? calculateScore(selectedKeyword.scores || {}, weights) : { score: null, missing: [] };
  const selectedMetric = selectedKeyword ? searchMetricMap.get(selectedKeyword.id) : null;
  const selectedVolume = selectedMetric?.value ?? selectedKeyword?.searchVolume;
  const openNew = () => { setEditKeyword(null); setModalOpen(true); };
  const persistKeyword = (value) => {
    if (!value.text?.trim()) return notify('キーワードを入力してください。', 'error');
    const at = nowIso();
    const data = { ...value, text: value.text.trim(), id: value.id || makeId('keyword'), projectId: value.projectId || project?.id || null, intent: value.intent || inferIntent(value.text), categories: value.categories?.length ? value.categories : classifyKeyword(value.text), createdAt: value.createdAt || at, updatedAt: at, scores: value.scores || {} };
    setStore((current) => ({ ...current, keywords: value.id ? current.keywords.map((item) => item.id === value.id ? data : item) : [data, ...current.keywords] }));
    setSelectedKeywordId(data.id); setModalOpen(false); setEditKeyword(null); notify(value.id ? 'キーワードを更新しました。' : 'キーワードを保存しました。');
  };
  const deleteKeyword = (id) => {
    setStore((current) => ({ ...current, keywords: current.keywords.filter((item) => item.id !== id), keywordRelations: current.keywordRelations.filter((item) => item.from !== id && item.to !== id), analysisNodes: current.analysisNodes.filter((item) => item.keywordId !== id), analysisEdges: current.analysisEdges.filter((edge) => !current.analysisNodes.some((node) => node.keywordId === id && (edge.source === node.id || edge.target === node.id))) }));
    setModalOpen(false); setEditKeyword(null); if (selectedKeywordId === id) setSelectedKeywordId(''); notify('キーワードを削除しました。');
  };
  const openGenerator = () => {
    if (!project) return notify('先にリサーチを作成してください。', 'error');
    const seed = allKeywords.find((item) => item.isSeed)?.text || allKeywords[0]?.text || project.seedKeyword || '';
    setCandidateSeed(seed); setSeedKeywordId(allKeywords.find((item) => item.text === seed)?.id || '');
    const generated = generateKeywordSuggestions(seed, 18).filter((candidate) => !allKeywords.some((item) => item.text.toLowerCase() === candidate.text.toLowerCase()));
    setCandidates(generated); setCandidateSelection(generated.map((item) => item.id)); setCandidateOpen(true);
  };
  const addCandidates = () => {
    const selected = candidates.filter((candidate) => candidateSelection.includes(candidate.id));
    const at = nowIso();
    const newItems = selected.map((item) => ({ id: makeId('keyword'), text: item.text, note: item.note, intent: item.intent, categories: item.categories, origin: 'derived', retrievalStatus: 'local-generated', searchVolume: null, projectId: project?.id, parentId: seedKeywordId || null, scores: {}, createdAt: at, updatedAt: at }));
    setStore((current) => ({ ...current, keywords: [...newItems, ...current.keywords], keywordRelations: [...current.keywordRelations, ...newItems.map((item) => ({ id: makeId('relation'), from: seedKeywordId, to: item.id, type: item.kind || 'related', createdAt: at }))] }));
    setCandidateOpen(false); if (newItems[0]) setSelectedKeywordId(newItems[0].id); notify(`${newItems.length}件の候補を保存しました。実検索データではありません。`);
  };
  const searchGoogleAds = async () => {
    const sourceKeyword = selectedKeyword || allKeywords.find((item) => item.isSeed) || null;
    const seed = sourceKeyword?.text || project?.seedKeyword;
    const sourceKeywordId = sourceKeyword?.id || '';
    if (!seed) return notify('起点キーワードがありません。', 'error');
    const regionIds = { '日本': '2392', '米国': '2840', '英国': '2826', 'カナダ': '2124', 'オーストラリア': '2036' };
    const regionId = regionIds[project?.region || '日本'];
    const languageIds = { '日本語': '1005', '英語': '1000' };
    const languageId = languageIds[project?.language || '日本語'];
    if (!regionId) return setGoogleError('選択した地域のGoogle Ads geoTarget IDはこの画面では未設定です。日本・米国・英国・カナダ・オーストラリアを選択してください。');
    if (!languageId) return setGoogleError('Google Ads APIの言語IDは日本語・英語のみ対応しています。リサーチ設定を変更してください。');
    setGoogleBusy(true); setGoogleError('');
    try {
      const response = await fetch('/api/google-ads/keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed, languageId, geoTargetId: regionId, limit: Number(project?.settings?.resultCount || 50) }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || 'Google Ads APIに接続できませんでした。');
      if (!result.items?.length) { setGoogleError(result.message || '候補は0件でした。'); return; }
      const at = result.collectedAt || nowIso();
      setStore((current) => {
        const projectKeywords = current.keywords.filter((item) => item.projectId === project?.id);
        const keywordByText = new Map(projectKeywords.map((item) => [item.text.trim().toLowerCase(), item]));
        const addedKeywords = [];
        const newMetrics = [];
        const newRelations = [];
        for (const metric of result.items) {
          const normalized = metric.text.trim().toLowerCase();
          if (!normalized) continue;
          let keyword = keywordByText.get(normalized);
          if (!keyword) {
            keyword = { id: makeId('keyword'), projectId: project?.id || null, text: metric.text, isSeed: false, intent: inferIntent(metric.text), categories: classifyKeyword(metric.text), origin: 'official_api', retrievalStatus: 'success', searchVolume: metric.avg_monthly_searches, volumeSource: 'Google Ads Keyword Planning API', scores: {}, createdAt: at, updatedAt: at };
            keywordByText.set(normalized, keyword); addedKeywords.push(keyword);
          }
          newMetrics.push({ id: makeId('search-metric'), keywordId: keyword.id, projectId: project?.id || null, platform: 'google', sourceType: metric.source_type, sourceUrl: metric.source_url, keyword: metric.text, metricName: 'avg_monthly_searches', value: metric.avg_monthly_searches, monthlyValues: metric.monthly_search_volumes, competition: metric.competition, competitionIndex: metric.competition_index, lowTopOfPageBidMicros: metric.low_top_of_page_bid_micros, highTopOfPageBidMicros: metric.high_top_of_page_bid_micros, language: project?.language || '日本語', region: project?.region || '日本', collectedAt: metric.collected_at || at, retrievalStatus: metric.retrieval_status, dataOrigin: 'official_api', confidence: 'measured', note: metric.note });
          if (sourceKeywordId && keyword.id !== sourceKeywordId && !current.keywordRelations.some((relation) => relation.from === sourceKeywordId && relation.to === keyword.id)) newRelations.push({ id: makeId('relation'), from: sourceKeywordId, to: keyword.id, type: 'google_ads_keyword_idea', createdAt: at });
        }
        return { ...current, keywords: [...addedKeywords, ...current.keywords], searchMetrics: [...newMetrics, ...(current.searchMetrics || [])], keywordRelations: [...newRelations, ...current.keywordRelations], apiEvents: [{ id: makeId('api-event'), platform: 'google', action: 'keyword_ideas', status: 'success', count: newMetrics.length, message: `${newMetrics.length}件の指標を取得`, createdAt: at }, ...(current.apiEvents || [])].slice(0, 100) };
      });
      await refreshApiStatus?.();
      notify(`${result.items.length}件の候補をGoogle Ads APIから取得しました。検索数はGoogle検索の指標です。`);
    } catch (error) {
      const message = error.message || 'Google Ads APIの取得に失敗しました。設定を確認して再試行してください。';
      setGoogleError(message);
      setStore((current) => ({ ...current, apiEvents: [{ id: makeId('api-event'), platform: 'google', action: 'keyword_ideas', status: 'error', count: 0, message, createdAt: nowIso() }, ...(current.apiEvents || [])].slice(0, 100) }));
    } finally { setGoogleBusy(false); }
  };
  const saveScore = (field, value) => {
    if (!selectedKeyword) return;
    const scores = { ...(selectedKeyword.scores || {}), [field]: value === '' ? null : Number(value) };
    setStore((current) => ({ ...current, keywords: current.keywords.map((item) => item.id === selectedKeyword.id ? { ...item, scores, updatedAt: nowIso() } : item) }));
  };
  const exportKeywords = () => {
    const rows = visibleKeywords.map((item) => { const metric = searchMetricMap.get(item.id); return { keyword: item.text, intent: item.intent || inferIntent(item.text), pain_categories: (item.categories || []).map((id) => PAIN_CATEGORIES.find((cat) => cat.id === id)?.label || '要確認').join('|'), monthly_searches: metric?.value ?? item.searchVolume ?? '', metric_origin: metric?.dataOrigin || item.origin || 'manual', metric_source: metric?.sourceType || item.volumeSource || '', google_ad_competition: metric?.competition || '', google_competition_index: metric?.competitionIndex ?? '', region: metric?.region || project?.region || '', language: metric?.language || project?.language || '', retrieval_status: metric?.retrievalStatus || item.retrievalStatus || '', keyword_source: item.origin || 'manual', project: project?.name || '', note: item.note || '', collected_at: metric?.collectedAt || item.collectedAt || '', created_at: item.createdAt || '' }; });
    downloadBlob('layer-keywords.csv', toCsv(rows), 'text/csv;charset=utf-8'); notify(`${rows.length}件のキーワードをCSV出力しました。`);
  };
  const makeGraph = () => { setSelectedKeywordId(selectedKeyword?.id || ''); navigate('analysis'); };
  const briefing = selectedKeyword ? makeBrief(selectedKeyword, project || {}) : null;
  return <div className="page-content">
    <PageHeader eyebrow="KEYWORD DISCOVERY" title="キーワード探索" description="検索実績・手入力・ローカル生成候補を分けて、読者の意図と悩みを整理します。" icon={Hash} actions={<><Button variant="secondary" icon={ArrowDownToLine} onClick={exportKeywords}>CSV出力</Button><Button variant="secondary" icon={googleBusy ? Activity : Globe2} disabled={googleBusy || !project} onClick={searchGoogleAds}>{googleBusy ? 'Google Ads取得中...' : 'Google Ads API'}</Button><Button variant="secondary" icon={Sparkles} onClick={openGenerator}>ローカル候補</Button><Button variant="primary" icon={Plus} onClick={openNew}>キーワード追加</Button></>} />
    {!project && <div className="setup-empty"><EmptyState icon={Hash} title="まずリサーチを作成してください" description="プロジェクトと起点キーワードを作成すると、関連候補を保存できます。" action={<Button variant="primary" icon={Plus} onClick={() => navigate('research')}>新規リサーチ</Button>} /></div>}
    {project && <>
      <div className="keyword-toolbar card"><div className="toolbar-search"><Search size={16} /><input placeholder="キーワード・メモを検索" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>/</kbd></div><div className="toolbar-filters"><span className="filter-label"><Filter size={14} />絞り込み</span><SelectInput aria-label="データ出所" value={filterOrigin} onChange={setFilterOrigin} options={[{ value: 'all', label: 'すべての出所' }, { value: 'official_api', label: '公式API実測' }, { value: 'manual', label: '手入力' }, { value: 'imported', label: 'インポート' }, { value: 'derived', label: 'ローカル生成' }]} /><SelectInput aria-label="検索意図" value={filterIntent} onChange={setFilterIntent} options={[{ value: 'all', label: 'すべての意図' }, '情報収集', '課題解決', '比較・検討', '比較・購入検討', '案内・指名', '要確認']} /></div><div className="toolbar-count"><strong>{visibleKeywords.length}</strong> 件 <span>·</span> {project.name}</div></div>
      {googleError && <div className="google-keyword-error"><AlertCircle size={15} /><span>{googleError}</span><Button size="sm" variant="quiet" onClick={searchGoogleAds} disabled={googleBusy}>再試行</Button></div>}
      <div className="keywords-layout"><Card title="保存したキーワード" subtitle="各候補の取得元と検索ボリュームを確認できます。" className="keyword-table-card" padding="none"><div className="table-scroll"><table className="data-table keyword-table"><thead><tr><th>キーワード</th><th>検索意図</th><th>悩み分類</th><th>出所</th><th className="num-align">月間検索数</th><th>優先度</th><th /></tr></thead><tbody>{visibleKeywords.map((item) => { const itemScore = calculateScore(item.scores || {}, weights); const metric = searchMetricMap.get(item.id); const volume = metric?.value ?? item.searchVolume; return <tr key={item.id} className={selectedKeyword?.id === item.id ? 'selected-row' : ''} onClick={() => setSelectedKeywordId(item.id)}><td><button className="keyword-row-title" onClick={(event) => { event.stopPropagation(); setSelectedKeywordId(item.id); }}>{item.text}{item.isSeed && <Pill tone="blue">起点</Pill>}</button><small>{item.note || item.kind || ''}</small></td><td><span className="intent-cell">{item.intent || inferIntent(item.text)}</span></td><td><div className="table-category-list">{(item.categories || classifyKeyword(item.text)).slice(0, 2).map((id) => <Pill key={id} tone={id === 'review' ? 'neutral' : PAIN_CATEGORIES.find((cat) => cat.id === id)?.color || 'neutral'}>{PAIN_CATEGORIES.find((cat) => cat.id === id)?.label || '要確認'}</Pill>)}</div></td><td><DataOrigin origin={metric ? 'official_api' : item.origin || 'manual'} status={metric ? 'Google Ads' : ''} /></td><td className="num-align">{volume != null && volume !== '' ? <strong title={metric ? `Google Ads API · ${metric.region || '地域未設定'} · ${metric.language || '言語未設定'}` : item.volumeSource || '取得元未記録'}>{formatNumber(volume)}</strong> : <span className="not-collected">未取得</span>}</td><td>{itemScore.score === null ? <span className="not-collected">未評価</span> : <span className="score-small">{itemScore.score}<small>/100</small></span>}</td><td><button className="icon-button row-edit" title="編集" onClick={(event) => { event.stopPropagation(); setEditKeyword(item); setModalOpen(true); }}><Settings2 size={15} /></button></td></tr>; })}</tbody></table></div>{!visibleKeywords.length && <EmptyState icon={Search} title={query ? '一致するキーワードがありません' : 'キーワードはまだありません'} description={query ? '検索語や絞り込みを変更してください。' : '候補を生成するか、調査した語句を手入力してください。'} action={!query && <Button variant="secondary" size="sm" icon={Sparkles} onClick={openGenerator}>関連候補を生成</Button>} />}</Card>
      <aside className="keyword-inspector">
        {selectedKeyword ? <>
          <Card className="inspector-card"><div className="inspector-top"><div className="inspector-eyebrow">KEYWORD BRIEF <span>#{String(allKeywords.findIndex((item) => item.id === selectedKeyword.id) + 1).padStart(2, '0')}</span></div><button className="icon-button" title="編集" onClick={() => { setEditKeyword(selectedKeyword); setModalOpen(true); }}><Settings2 size={15} /></button></div><h2 className="inspector-title">{selectedKeyword.text}</h2><div className="inspector-tags"><Pill tone="blue">{selectedKeyword.intent || inferIntent(selectedKeyword.text)}</Pill>{(selectedKeyword.categories || classifyKeyword(selectedKeyword.text)).map((id) => <Pill key={id} tone={id === 'review' ? 'neutral' : PAIN_CATEGORIES.find((cat) => cat.id === id)?.color || 'neutral'}>{PAIN_CATEGORIES.find((cat) => cat.id === id)?.label || '要確認'}</Pill>)}</div><div className="inspector-source"><DataOrigin origin={selectedMetric ? 'official_api' : selectedKeyword.origin || 'manual'} status={selectedMetric ? 'Google Ads API' : selectedKeyword.retrievalStatus === 'local-generated' ? '検索実績ではありません' : ''} /><span>Google検索数：{selectedVolume != null ? `${formatNumber(selectedVolume)} / 月` : '未取得'}</span></div>{selectedMetric && <div className="google-metric-box"><strong>Google Ads Keyword Planning</strong><span>広告競合度：{selectedMetric.competition || '未取得'}{selectedMetric.competitionIndex != null ? ` · ${selectedMetric.competitionIndex}/100` : ''}</span><small>地域：{selectedMetric.region || '—'} · 言語：{selectedMetric.language || '—'} · 取得：{new Date(selectedMetric.collectedAt).toLocaleDateString('ja-JP')}</small><p>広告競合度は自然検索SEO難易度ではありません。</p></div>}<div className="brief-box"><span>分類根拠</span><p>{briefing.reason}</p></div>
            <div className="brief-detail-list"><div><span>見つけたい語句の例（実測ではありません）</span><div className="brief-mini-tags">{briefing.keywordExamples.slice(0, 8).map((item) => <span key={item}>{item}</span>)}</div></div><div><span>関連する質問</span><ul>{briefing.questions.map((item) => <li key={item}>{item}</li>)}</ul></div><div><span>具体的な悩み</span><p>{briefing.pain}</p></div><div><span>読者の状況</span><p>{briefing.situation}</p></div><div><span>想定される原因</span><p>{briefing.cause}</p></div><div><span>読者が望む状態</span><p>{briefing.desired}</p></div><div><span>試した解決策・機能しない理由</span><p>{briefing.tried} {briefing.notWork}</p></div><div><span>競合の主張・未解決論点</span><p>{briefing.competitor} {briefing.gap}</p></div><div><span>反論・不安／商品との関連</span><p>{briefing.concern} {briefing.productFit}</p></div><div><span>投稿方向性</span><ul>{briefing.directions.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="brief-prompt"><strong>フック案・主張案</strong><p>{briefing.hook}</p><p>{briefing.claim}</p></div><div><span>具体策</span><p>{briefing.specific}</p></div><div><span>CTA・検証指標</span><p>{briefing.cta}<br />{briefing.metrics}</p></div></div>
            <div className="inspector-actions"><Button variant="primary" size="sm" icon={Target} onClick={makeGraph}>立体分析を開く</Button><Button size="sm" icon={Lightbulb} onClick={() => { navigate('ideas'); }}>投稿企画へ</Button></div>
          </Card>
          <Card title="優先度スコア" subtitle="6項目を評価すると加重スコアを算出します。" className="score-card"><div className="score-summary"><div className={`score-dial ${score.score === null ? 'score-dial-empty' : ''}`}><strong>{score.score ?? '—'}</strong><span>{score.score === null ? '未評価' : '/ 100'}</span></div><p>{score.score === null ? `必須項目が未評価です：${score.missing.join('、')}` : '全項目入力済み。評価根拠もメモに記録してください。'}</p></div><div className="score-inputs">{weights.map((field) => <Field key={field.id} label={`${field.label} · ${field.weight}%`} hint={field.help}><SelectInput value={selectedKeyword.scores?.[field.id] ?? ''} onChange={(value) => saveScore(field.id, value)} options={[{ value: '', label: '未評価' }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` }))]} /></Field>)}</div><div className="score-note"><CircleHelp size={14} />データ不足の項目を自動採点しません。評価基準・重みはデータ管理から変更できます。</div></Card>
        </> : <div className="inspector-placeholder"><Lightbulb size={21} /><strong>キーワードを選択</strong><p>一覧の候補を選ぶと、分類・悩み・評価を確認できます。</p></div>}
      </aside></div>
    </>}
    <KeywordModal open={modalOpen} onClose={() => { setModalOpen(false); setEditKeyword(null); }} keyword={editKeyword} projectId={project?.id} onSave={persistKeyword} onDelete={deleteKeyword} />
    <Modal open={candidateOpen} onClose={() => setCandidateOpen(false)} title="関連キーワード候補" subtitle={`起点：「${candidateSeed}」 · ローカルテンプレートで生成。検索サジェスト・実検索データではありません。`} wide footer={<><span className="modal-footnote">{candidateSelection.length} / {candidates.length} 件を選択</span><Button variant="quiet" onClick={() => setCandidateOpen(false)}>キャンセル</Button><Button variant="primary" disabled={!candidateSelection.length} icon={Check} onClick={addCandidates}>選択した候補を保存</Button></>}>
      <div className="candidate-toolbar"><label className="check-row"><input type="checkbox" checked={candidateSelection.length === candidates.length && candidates.length > 0} onChange={(event) => setCandidateSelection(event.target.checked ? candidates.map((item) => item.id) : [])} />すべて選択</label><span>候補 {candidates.length} 件 <i>·</i> 検索数は未取得</span></div><div className="candidate-grid">{candidates.map((item) => <label className={`candidate-item ${candidateSelection.includes(item.id) ? 'candidate-selected' : ''}`} key={item.id}><input type="checkbox" checked={candidateSelection.includes(item.id)} onChange={(event) => setCandidateSelection((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span className="candidate-copy"><strong>{item.text}</strong><small>{item.note}</small><span className="candidate-meta"><Pill tone="teal">派生候補</Pill><Pill>{item.intent}</Pill></span></span><span className="candidate-volume">未取得</span></label>)}</div>
    </Modal>
  </div>;
}

export default function App() {
  const [store, setStore] = useState(loadStore);
  const [page, setPage] = useState('dashboard');
  const [selectedKeywordId, setSelectedKeywordId] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const activeProject = store.projects.find((item) => item.id === store.settings.activeProjectId) || null;
  const notify = useCallback((message, type = 'success') => setToast({ message, type, id: Date.now() }), []);
  const updateStore = useCallback((updater) => setStore((current) => typeof updater === 'function' ? updater(current) : { ...current, ...updater }), []);
  useEffect(() => {
    const result = saveStore(store);
    if (!result.ok) {
      const message = result.reason === 'quota' ? 'ブラウザの保存容量を超えました。バックアップ後、不要なデータを削除してください。' : 'データをブラウザに保存できませんでした。';
      setSaveError(message);
    } else if (saveError) setSaveError('');
  }, [store]);
  const refreshApiStatus = useCallback(() => fetch('/api/status').then((response) => response.json()).then((data) => { setApiStatus(data); return data; }).catch(() => { const unavailable = { ok: false, offline: true, platforms: {} }; setApiStatus(unavailable); return unavailable; }), []);
  useEffect(() => { refreshApiStatus(); }, [refreshApiStatus]);
  useEffect(() => {
    if (!store.settings.activeProjectId && store.projects[0]) updateStore((current) => ({ ...current, settings: { ...current.settings, activeProjectId: current.projects[0].id } }));
  }, [store.projects, store.settings.activeProjectId, updateStore]);
  const changeProject = (id) => updateStore((current) => ({ ...current, settings: { ...current.settings, activeProjectId: id } }));
  const handleSearch = () => { setPage('keywords'); };
  const startResearch = (form) => {
    const projectId = makeId('project');
    const keywordId = makeId('keyword');
    const createdAt = nowIso();
    const project = { id: projectId, name: form.name.trim(), seedKeyword: form.seed.trim(), platforms: form.platforms, audience: form.audience.trim(), product: form.product.trim(), goal: form.goal, ctaGoal: form.ctaGoal, language: form.language, region: form.region, settings: { period: form.period, resultCount: Number(form.resultCount), intentFocus: form.intentFocus, painDepth: form.painDepth }, createdAt, updatedAt: createdAt };
    const seed = { id: keywordId, projectId, text: form.seed.trim(), isSeed: true, intent: inferIntent(form.seed), categories: classifyKeyword(form.seed), origin: 'manual', retrievalStatus: 'manual', searchVolume: null, scores: {}, createdAt, updatedAt: createdAt };
    const candidates = generateKeywordSuggestions(form.seed, 8).map((item) => ({ id: makeId('keyword'), projectId, text: item.text, note: item.note, intent: item.intent, categories: item.categories, origin: 'derived', retrievalStatus: 'local-generated', searchVolume: null, parentId: keywordId, scores: {}, createdAt, updatedAt: createdAt }));
    const session = { id: makeId('session'), projectId, seedKeywordId: keywordId, name: form.name.trim(), platforms: form.platforms, goal: form.goal, audience: form.audience, product: form.product, language: form.language, region: form.region, settings: project.settings, createdAt };
    updateStore((current) => ({ ...current, projects: [project, ...current.projects], researchSessions: [session, ...current.researchSessions], keywords: [seed, ...candidates, ...current.keywords], keywordRelations: [...current.keywordRelations, ...candidates.map((item) => ({ id: makeId('relation'), from: keywordId, to: item.id, type: 'related', createdAt }))], settings: { ...current.settings, activeProjectId: projectId } }));
    setSelectedKeywordId(keywordId); setPage('keywords'); notify(`「${project.name}」を作成しました。関連候補はローカル生成です。`);
  };
  const openProject = (id) => { changeProject(id); const seed = store.keywords.find((item) => item.projectId === id && item.isSeed); if (seed) setSelectedKeywordId(seed.id); setPage('keywords'); };
  const activeNav = NAV.find((item) => item.id === page);
  const renderPage = () => {
    const common = { store, setStore: updateStore, activeProject, notify, navigate: setPage, setSelectedKeywordId, selectedKeywordId, refreshApiStatus };
    switch (page) {
      case 'dashboard': return <Dashboard store={store} activeProject={activeProject} apiStatus={apiStatus} onNavigate={setPage} onCreateResearch={() => setPage('research')} setSelectedKeywordId={setSelectedKeywordId} />;
      case 'research': return <ResearchPage onStartResearch={startResearch} projects={store.projects} sessions={store.researchSessions} onOpenProject={openProject} />;
      case 'keywords': return <KeywordsPage {...common} globalSearch={globalSearch} />;
      case 'analysis': return <AnalysisPage {...common} apiStatus={apiStatus} />;
      case 'competitors': return <CompetitorPage {...common} apiStatus={apiStatus} />;
      case 'ideas': return <IdeasPage {...common} />;
      case 'calendar': return <CalendarPage {...common} />;
      case 'metrics': return <MetricsPage {...common} />;
      case 'connections': return <ConnectionsPage {...common} apiStatus={apiStatus} refreshApiStatus={() => fetch('/api/status').then((response) => response.json()).then(setApiStatus).catch(() => {})} />;
      case 'data': return <DataPage {...common} onReset={() => { setStore(EMPTY_STORE); setSelectedKeywordId(''); notify('このブラウザのLayerデータを初期化しました。'); }} />;
      default: return <Dashboard store={store} activeProject={activeProject} apiStatus={apiStatus} onNavigate={setPage} onCreateResearch={() => setPage('research')} setSelectedKeywordId={setSelectedKeywordId} />;
    }
  };
  return <div className="app-shell">
    <Sidebar page={page} setPage={setPage} projects={store.projects} activeProject={activeProject} store={store} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
    <div className="app-main"><Topbar activeProject={activeProject} projects={store.projects} setActiveProject={changeProject} globalSearch={globalSearch} setGlobalSearch={setGlobalSearch} onSearch={handleSearch} setMobileOpen={setMobileOpen} />
      <div className="main-scroll"><div className="workspace-topline"><span>{activeNav?.group || 'Workspace'}</span><ChevronRight size={13} /><strong>{activeNav?.label || 'ダッシュボード'}</strong><span className="topline-spacer" />{saveError ? <span className="save-indicator save-error"><span />保存エラー</span> : <span className="save-indicator"><span />自動保存</span>}</div>{renderPage()}</div>
    </div>
    <Toast item={toast} onClose={() => setToast(null)} />
  </div>;
}
