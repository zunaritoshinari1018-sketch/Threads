import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Plus } from 'lucide-react';
import { makeId, nowIso, PLATFORMS } from '../domain.js';
import { Button, Card, EmptyState, Field, Modal, PageHeader, Pill, PlatformBadge, SelectInput, TextInput } from '../ui.jsx';
import { PUBLISH_STATUSES } from './IdeasPage.jsx';

function localIso(date) {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function getMonthCells(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}
const STATUS_TONES = { '投稿予定': 'blue', '投稿済み': 'success', '効果測定中': 'violet', '制作中': 'amber', '改善対象': 'red', '完了': 'success' };

export function CalendarPage({ store, setStore, activeProject, notify, navigate }) {
  const project = activeProject || store.projects[0] || null;
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(localIso(new Date()));
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [draft, setDraft] = useState({ ideaId: '', date: localIso(new Date()), status: '投稿予定' });
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const ideas = store.contentIdeas.filter((item) => !project || item.projectId === project.id);
  const scheduled = ideas.filter((item) => Boolean(item.scheduledDate) && (filterPlatform === 'all' || item.platform === filterPlatform) && (filterStatus === 'all' || item.status === filterStatus));
  const cells = getMonthCells(month);
  const monthLabel = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(month);
  const monthItems = scheduled.filter((item) => item.scheduledDate?.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`)).sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
  const selectedItems = scheduled.filter((item) => item.scheduledDate === selectedDate);
  const unscheduled = ideas.filter((item) => !item.scheduledDate);
  const today = localIso(new Date());
  const openAdd = (date = selectedDate) => { setDraft({ ideaId: unscheduled[0]?.id || '', date, status: '投稿予定' }); setScheduleOpen(true); };
  const addSchedule = (event) => {
    event.preventDefault();
    const item = ideas.find((idea) => idea.id === draft.ideaId);
    if (!item || !draft.date) return notify('企画と公開予定日を選択してください。', 'error');
    setStore((current) => ({ ...current, contentIdeas: current.contentIdeas.map((idea) => idea.id === item.id ? { ...idea, scheduledDate: draft.date, status: draft.status, updatedAt: nowIso() } : idea) }));
    setScheduleOpen(false); setSelectedDate(draft.date); setMonth(new Date(`${draft.date}T00:00:00`)); notify('投稿カレンダーに登録しました。');
  };
  const changeStatus = (id, status) => setStore((current) => ({ ...current, contentIdeas: current.contentIdeas.map((item) => item.id === id ? { ...item, status, updatedAt: nowIso() } : item) }));
  const unschedule = (id) => setStore((current) => ({ ...current, contentIdeas: current.contentIdeas.map((item) => item.id === id ? { ...item, scheduledDate: '', status: 'アイデア', updatedAt: nowIso() } : item) }));
  const openIdea = (id) => { navigate('ideas'); };
  return <div className="page-content">
    <PageHeader eyebrow="PUBLISHING WORKFLOW" title="投稿カレンダー" description="企画を公開予定日に紐づけ、制作・投稿・効果測定の状態を管理します。" icon={CalendarDays} actions={<Button variant="primary" icon={Plus} onClick={() => ideas.length ? openAdd() : navigate('ideas')}>{ideas.length ? '予定を追加' : '先に企画を作成'}</Button>} />
    {!project ? <div className="setup-empty"><EmptyState icon={CalendarDays} title="カレンダーはまだ空です" description="リサーチと投稿企画を作成すると、公開予定を登録できます。" action={<Button variant="primary" onClick={() => navigate('ideas')}>投稿企画を開く</Button>} /></div> : <>
    <div className="calendar-controls card"><div className="calendar-month-nav"><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="前の月"><ChevronLeft size={18} /></button><strong>{monthLabel}</strong><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="次の月"><ChevronRight size={18} /></button><button className="calendar-today" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(localIso(now)); }}>今日</button></div><div className="calendar-filter"><span><Filter size={14} />フィルター</span><SelectInput value={filterPlatform} onChange={setFilterPlatform} options={[{ value: 'all', label: 'すべての媒体' }, ...PLATFORMS.map((item) => ({ value: item.id, label: item.label }))]} /><SelectInput value={filterStatus} onChange={setFilterStatus} options={[{ value: 'all', label: 'すべての状態' }, ...PUBLISH_STATUSES.map((item) => ({ value: item, label: item }))]} /></div><div className="calendar-count">{monthItems.length}件 <small>今月の予定</small></div></div>
    <div className="calendar-layout"><Card className="calendar-grid-card" padding="none"><div className="calendar-weekdays">{['月', '火', '水', '木', '金', '土', '日'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((date, index) => { const iso = localIso(date); const dayItems = scheduled.filter((item) => item.scheduledDate === iso); const inMonth = date.getMonth() === month.getMonth(); return <button key={`${iso}-${index}`} className={`calendar-cell ${inMonth ? '' : 'calendar-outside'} ${iso === selectedDate ? 'calendar-selected' : ''} ${iso === today ? 'calendar-today' : ''}`} onClick={() => setSelectedDate(iso)} onDoubleClick={() => openAdd(iso)}><span className="calendar-day-num">{date.getDate()}</span>{dayItems.slice(0, 3).map((item) => <span key={item.id} className={`calendar-event event-${item.platform}`} onClick={(event) => { event.stopPropagation(); setSelectedDate(iso); }}><i />{item.title || '無題の企画'}</span>)}{dayItems.length > 3 && <span className="calendar-more">+{dayItems.length - 3}件</span>}<span className="calendar-cell-add" onClick={(event) => { event.stopPropagation(); openAdd(iso); }}><Plus size={13} /></span></button>; })}</div><div className="calendar-grid-footer"><span><i className="event-dot dot-threads" />Threads</span><span><i className="event-dot dot-youtube" />YouTube</span><span><i className="event-dot dot-instagram" />Instagram</span><span><i className="event-dot dot-google" />Google</span><small>日付をダブルクリック、または＋で予定を追加</small></div></Card>
      <aside className="calendar-side"><Card title={new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric' }).format(new Date(`${selectedDate}T00:00:00`))} subtitle={selectedDate === today ? '今日' : '選択中の日付'} action={<button className="icon-button" title="予定を追加" onClick={() => openAdd()}><Plus size={16} /></button>}>{selectedItems.length ? <div className="day-event-list">{selectedItems.map((item) => <div className="day-event-item" key={item.id}><div className="day-event-top"><PlatformBadge platform={item.platform} compact /><Pill tone={STATUS_TONES[item.status] || 'neutral'}>{item.status || 'アイデア'}</Pill></div><button className="day-event-title" onClick={() => openIdea(item.id)}>{item.title || '無題の企画'}</button><label className="status-select"><span>状態</span><SelectInput value={item.status || 'アイデア'} onChange={(value) => changeStatus(item.id, value)} options={PUBLISH_STATUSES} /></label><button className="unschedule-link" onClick={() => unschedule(item.id)}>予定から外す</button></div>)}</div> : <div className="calendar-day-empty"><CalendarDays size={21} /><strong>この日の予定はありません</strong><p>企画をカレンダーに登録するとここに表示されます。</p><Button size="sm" icon={Plus} onClick={() => ideas.length ? openAdd() : navigate('ideas')}>{ideas.length ? '予定を追加' : '企画を作成'}</Button></div>}</Card>
        <Card title="未スケジュール" subtitle={`${unscheduled.length}件の企画`} className="unscheduled-card"><div className="unscheduled-list">{unscheduled.slice(0, 5).map((item) => <button key={item.id} onClick={() => { setDraft({ ideaId: item.id, date: selectedDate, status: '投稿予定' }); setScheduleOpen(true); }}><PlatformBadge platform={item.platform} compact /><span>{item.title || '無題の企画'}</span><Plus size={13} /></button>)}{!unscheduled.length && <span className="muted-copy">未登録の企画はありません。</span>}{unscheduled.length > 5 && <button className="view-all-link" onClick={() => navigate('ideas')}>すべて表示</button>}</div></Card></aside>
    </div>
    <Card title="今月の投稿予定" subtitle="日付・媒体・企画を一覧で確認" className="month-schedule-card" padding="none">{monthItems.length ? <div className="month-schedule-list">{monthItems.map((item) => <div key={item.id} className="month-schedule-row"><div className="month-date"><strong>{Number(item.scheduledDate.slice(8, 10))}</strong><span>{new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(new Date(`${item.scheduledDate}T00:00:00`))}</span></div><PlatformBadge platform={item.platform} /><button className="month-title" onClick={() => openIdea(item.id)}>{item.title || '無題の企画'}</button><SelectInput value={item.status || 'アイデア'} onChange={(value) => changeStatus(item.id, value)} options={PUBLISH_STATUSES} /><span className="month-format">{item.format || '企画'}</span></div>)}</div> : <EmptyState icon={CalendarDays} title="今月の予定はありません" description="投稿企画の公開予定日を設定すると、ここで管理できます。" action={<Button size="sm" onClick={() => ideas.length ? openAdd() : navigate('ideas')}>{ideas.length ? '予定を追加' : '企画を作成'}</Button>} />}</Card>
    </>}
    <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="投稿予定を登録" subtitle="企画・予定日・運用状態を保存します。" footer={<><Button onClick={() => setScheduleOpen(false)}>キャンセル</Button><Button variant="primary" icon={CalendarDays} onClick={addSchedule}>カレンダーに登録</Button></>}><form className="form-stack" onSubmit={addSchedule}><Field label="投稿企画" required><SelectInput value={draft.ideaId} onChange={(value) => setDraft((current) => ({ ...current, ideaId: value }))} options={ideas.map((item) => ({ value: item.id, label: `${item.title || '無題'} · ${PLATFORMS.find((p) => p.id === item.platform)?.label || item.platform}${item.scheduledDate ? `（現在 ${item.scheduledDate}）` : ''}` }))} placeholder="企画を選択" /></Field><Field label="公開予定日" required><TextInput type="date" value={draft.date} onChange={(value) => setDraft((current) => ({ ...current, date: value }))} /></Field><Field label="運用ステータス"><SelectInput value={draft.status} onChange={(value) => setDraft((current) => ({ ...current, status: value }))} options={PUBLISH_STATUSES} /></Field></form></Modal>
  </div>;
}
