import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, Check, FileText, GitBranch, Hash, LayoutList, Plus, Printer, Sparkles, Target, Trash2 } from 'lucide-react';
import { makeAnalysisNodes, makeBrief, makeId, nowIso } from '../domain.js';
import { Button, Card, DataOrigin, EmptyState, Field, Modal, PageHeader, Pill, SelectInput, TextArea, TextInput } from '../ui.jsx';

const LAYERS = ['起点', '読者の理解', '競合・機会', 'コンテンツ実行'];
const LAYER_COLORS = ['#2867e8', '#8549d8', '#de8c24', '#11a37f'];

function AnalysisGraph({ nodes, edges, selectedId, onSelect }) {
  const positioned = useMemo(() => {
    const byLayer = [0, 1, 2, 3].map((layer) => nodes.filter((item) => Number(item.layer) === layer));
    const positions = new Map();
    byLayer.forEach((items, layer) => items.forEach((node, index) => {
      positions.set(node.id, { ...node, x: 112 + layer * 273, y: 90 + ((index + 1) * 454) / (items.length + 1) });
    }));
    return positions;
  }, [nodes]);
  if (!nodes.length) return null;
  return <div className="graph-scroll"><svg className="analysis-svg" viewBox="0 0 1125 570" role="img" aria-label="キーワード・悩み・競合・投稿企画の関係グラフ">
    {[0, 1, 2, 3].map((layer) => <g key={layer}><rect x={layer * 273 + 12} y="22" width="250" height="526" rx="15" className={`graph-stage stage-${layer}`} /><text x={layer * 273 + 28} y="48" className="graph-stage-label">0{layer + 1}　{LAYERS[layer]}</text></g>)}
    {edges.map((edge) => {
      const from = positioned.get(edge.source); const to = positioned.get(edge.target);
      if (!from || !to) return null;
      const active = selectedId && (edge.source === selectedId || edge.target === selectedId);
      return <path key={edge.id} d={`M ${from.x + 104} ${from.y} C ${from.x + 166} ${from.y}, ${to.x - 164} ${to.y}, ${to.x - 103} ${to.y}`} className={`graph-edge ${active ? 'graph-edge-active' : ''}`} />;
    })}
    {[...positioned.values()].map((node) => {
      const color = LAYER_COLORS[Math.min(3, Math.max(0, Number(node.layer) || 0))];
      const text = String(node.content || '内容未入力');
      const firstLine = text.length > 24 ? `${text.slice(0, 23)}…` : text;
      const selected = selectedId === node.id;
      return <g key={node.id} className={`graph-node ${selected ? 'graph-node-selected' : ''}`} onClick={() => onSelect(node.id)} role="button" tabIndex="0" onKeyDown={(event) => event.key === 'Enter' && onSelect(node.id)}>
        <rect x={node.x - 102} y={node.y - 32} width="207" height="64" rx="11" className="graph-node-card" style={{ '--node-color': color }} />
        <circle cx={node.x - 88} cy={node.y - 15} r="3.5" fill={color} />
        <text x={node.x - 78} y={node.y - 11} className="graph-node-title">{node.label.length > 13 ? `${node.label.slice(0, 12)}…` : node.label}</text>
        <text x={node.x - 88} y={node.y + 12} className="graph-node-text">{firstLine}</text>
        <text x={node.x + 82} y={node.y + 22} textAnchor="end" className="graph-node-source">{node.source === 'manual' ? '手入力' : '仮説'}</text>
      </g>;
    })}
  </svg></div>;
}

function NodeEditor({ node, nodes, edges, onSave, onDelete, onRelations }) {
  const [content, setContent] = useState(node?.content || '');
  const [label, setLabel] = useState(node?.label || '');
  const [relations, setRelations] = useState([]);
  React.useEffect(() => {
    setContent(node?.content || ''); setLabel(node?.label || '');
    const related = edges.filter((edge) => edge.source === node?.id || edge.target === node?.id).flatMap((edge) => edge.source === node?.id ? [edge.target] : [edge.source]);
    setRelations(related);
  }, [node?.id, node?.content, node?.label, edges]);
  if (!node) return <div className="node-editor-empty"><GitBranch size={20} /><strong>ノードを選択</strong><p>グラフまたは一覧からノードを選ぶと、内容や関係を編集できます。</p></div>;
  const toggle = (other) => setRelations((current) => current.includes(other.id) ? current.filter((id) => id !== other.id) : [...current, other.id]);
  return <div className="node-editor">
    <div className="node-editor-tag"><span className={`node-stage-dot stage-dot-${node.layer}`} />{LAYERS[node.layer] || 'カスタムノード'}<Pill tone={node.source === 'manual' ? 'neutral' : 'amber'}>{node.source === 'manual' ? '手入力' : '仮説・要確認'}</Pill></div>
    <Field label="ノード名"><TextInput value={label} onChange={setLabel} /></Field>
    <Field label="内容・根拠"><TextArea value={content} onChange={setContent} rows={6} placeholder="根拠が未確認の場合は仮説と明記してください。" /></Field>
    <div className="node-source-note"><DataOrigin origin={node.source === 'manual' ? 'manual' : 'derived'} /><span>信頼度：{node.confidence === 'high' ? '高' : node.confidence === 'medium' ? '中' : '低・未検証'}</span></div>
    <div className="relation-editor"><strong>関連ノード</strong><small>接続するノードを選択。保存時に関係を更新します。</small><div className="relation-options">{nodes.filter((item) => item.id !== node.id).map((item) => <label key={item.id}><input type="checkbox" checked={relations.includes(item.id)} onChange={() => toggle(item)} />{item.label}</label>)}</div></div>
    <div className="node-editor-actions"><Button variant="danger-quiet" size="sm" icon={Trash2} onClick={() => onDelete(node.id)}>削除</Button><Button variant="primary" size="sm" icon={Check} onClick={() => onSave(node.id, label, content, relations)}>変更を保存</Button></div>
  </div>;
}

export function AnalysisPage({ store, setStore, activeProject, selectedKeywordId, setSelectedKeywordId, notify, navigate }) {
  const project = activeProject || store.projects[0] || null;
  const keywords = store.keywords.filter((item) => !project || item.projectId === project.id);
  const [keywordId, setKeywordId] = useState(selectedKeywordId || keywords.find((item) => item.isSeed)?.id || keywords[0]?.id || '');
  const [view, setView] = useState('graph');
  const [newOpen, setNewOpen] = useState(false);
  const [newNode, setNewNode] = useState({ label: '', content: '', layer: '1' });
  const [selectedId, setSelectedId] = useState('');
  React.useEffect(() => { if (selectedKeywordId && keywords.some((item) => item.id === selectedKeywordId)) setKeywordId(selectedKeywordId); else if (!keywords.some((item) => item.id === keywordId)) setKeywordId(keywords.find((item) => item.isSeed)?.id || keywords[0]?.id || ''); }, [selectedKeywordId, project?.id, keywords.map((item) => item.id).join('|')]);
  const keyword = keywords.find((item) => item.id === keywordId) || null;
  const nodes = useMemo(() => store.analysisNodes.filter((item) => item.keywordId === keywordId), [store.analysisNodes, keywordId]);
  const nodeIds = useMemo(() => new Set(nodes.map((item) => item.id)), [nodes]);
  const edges = useMemo(() => store.analysisEdges.filter((item) => nodeIds.has(item.source) && nodeIds.has(item.target)), [store.analysisEdges, nodeIds]);
  const selectedNode = nodes.find((item) => item.id === selectedId) || null;
  const brief = keyword ? makeBrief(keyword, project || {}) : null;
  const createGraph = () => {
    if (!keyword) return;
    const graph = makeAnalysisNodes(keyword, project || {});
    const collected = store.collectedContents.filter((item) => item.projectId === keyword.projectId && (item.keyword || '').toLowerCase().includes(keyword.text.toLowerCase()));
    const enrichedNodes = graph.nodes.map((node) => node.type === 'competitor' && collected.length ? { ...node, content: `${collected.length}件の登録コンテンツ（この調査語に関連）あり。主張は下の競合分析サンプルを参照。` } : node);
    setStore((current) => ({ ...current, analysisNodes: [...current.analysisNodes.filter((item) => item.keywordId !== keyword.id), ...enrichedNodes], analysisEdges: [...current.analysisEdges.filter((item) => !graph.nodes.some((node) => node.id === item.source || node.id === item.target)), ...graph.edges] }));
    setSelectedId(graph.nodes[0]?.id || ''); notify('立体分析の仮説マップを作成しました。根拠を確認・追記してください。');
  };
  const saveNode = (id, label, content, relatedIds) => {
    const at = nowIso();
    const existingEdges = store.analysisEdges.filter((edge) => edge.source !== id && edge.target !== id);
    const newEdges = relatedIds.map((other) => ({ id: makeId('edge'), source: id, target: other }));
    setStore((current) => ({ ...current, analysisNodes: current.analysisNodes.map((item) => item.id === id ? { ...item, label: label.trim() || item.label, content, source: 'manual', confidence: 'medium', updatedAt: at } : item), analysisEdges: [...existingEdges, ...newEdges] }));
    notify('ノードと関連付けを保存しました。');
  };
  const deleteNode = (id) => {
    setStore((current) => ({ ...current, analysisNodes: current.analysisNodes.filter((item) => item.id !== id), analysisEdges: current.analysisEdges.filter((item) => item.source !== id && item.target !== id) }));
    setSelectedId(''); notify('ノードを削除しました。');
  };
  const addNode = (event) => {
    event.preventDefault(); if (!keyword || !newNode.label.trim() || !newNode.content.trim()) return;
    const at = nowIso(); const id = makeId('node');
    const node = { id, keywordId, projectId: keyword.projectId, type: 'custom', label: newNode.label.trim(), content: newNode.content.trim(), layer: Number(newNode.layer), source: 'manual', confidence: 'medium', createdAt: at, updatedAt: at };
    setStore((current) => ({ ...current, analysisNodes: [...current.analysisNodes, node] })); setSelectedId(id); setNewNode({ label: '', content: '', layer: '1' }); setNewOpen(false); notify('手入力ノードを追加しました。');
  };
  const exportReport = () => {
    const report = { project, keyword, generatedAt: nowIso(), disclaimer: 'ローカルルールの仮説を含みます。実測値・競合情報は登録データのみ。', brief, nodes, edges };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `layer-analysis-${(keyword?.text || 'report').replace(/\s+/g, '-')}.json`; anchor.click(); URL.revokeObjectURL(url);
  };
  const printReport = () => window.print();
  return <div className="page-content analysis-page">
    <PageHeader eyebrow="MULTI-DIMENSIONAL MAP" title="立体分析" description="キーワードから読者の状況・未解決の論点・投稿企画までを、編集可能な関係図にまとめます。" icon={GitBranch} actions={<><Button icon={Printer} onClick={printReport}>レポート印刷</Button><Button icon={ArrowDownToLine} onClick={exportReport} disabled={!keyword}>JSON出力</Button><Button variant="primary" icon={Plus} onClick={() => { if (!nodes.length) createGraph(); else setNewOpen(true); }} disabled={!keyword}>{nodes.length ? 'ノード追加' : '仮説マップを作成'}</Button></>} />
    {!project || !keyword ? <div className="setup-empty"><EmptyState icon={GitBranch} title="分析するキーワードがありません" description="リサーチを作成し、起点キーワードを追加してください。" action={<Button variant="primary" onClick={() => navigate('research')}>新規リサーチ</Button>} /></div> : <>
      <div className="analysis-toolbar card"><div className="analysis-focus"><span className="analysis-focus-icon"><Target size={16} /></span><div><small>分析対象キーワード</small><SelectInput value={keywordId} onChange={(value) => { setKeywordId(value); setSelectedKeywordId(value); setSelectedId(''); }} options={keywords.map((item) => ({ value: item.id, label: `${item.isSeed ? '◆ ' : ''}${item.text}` }))} /></div></div><div className="analysis-toolbar-meta"><Pill tone="blue">{project.name}</Pill><span className="analysis-hypothesis-note">仮説は未検証として表示</span><div className="view-toggle"><button className={view === 'graph' ? 'is-active' : ''} onClick={() => setView('graph')}><GitBranch size={15} />関係図</button><button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}><LayoutList size={15} />一覧</button></div></div></div>
      {!nodes.length ? <div className="graph-empty"><EmptyState icon={GitBranch} title="このキーワードの分析マップは未作成です" description="保存済みキーワードから、編集可能な分析仮説を作成します。検索結果や読者の声は自動取得しません。" action={<Button variant="primary" icon={Sparkles} onClick={createGraph}>ローカル仮説マップを作成</Button>} /></div> : <>
        <div className="analysis-workspace"><Card title="リサーチ関係図" subtitle={`${nodes.length}ノード · ${edges.length}関係 · ノードを選択して編集`} className="analysis-graph-card"><div className="graph-legend">{LAYERS.map((layer, index) => <span key={layer}><i style={{ background: LAYER_COLORS[index] }} />{layer}</span>)}</div>{view === 'graph' ? <AnalysisGraph nodes={nodes} edges={edges} selectedId={selectedId} onSelect={setSelectedId} /> : <div className="analysis-list-view">{nodes.map((node) => <button key={node.id} className={`analysis-list-row ${selectedId === node.id ? 'analysis-list-selected' : ''}`} onClick={() => setSelectedId(node.id)}><span className={`node-stage-dot stage-dot-${node.layer}`} /><span><strong>{node.label}</strong><small>{node.content}</small></span><Pill tone={node.source === 'manual' ? 'neutral' : 'amber'}>{node.source === 'manual' ? '手入力' : '仮説'}</Pill></button>)}</div>}<div className="graph-caption"><span><i className="caption-line" />編集可能な関係</span><span><i className="caption-hypothesis" />ローカルルールの仮説（低信頼度）</span><span>競合・読者データは未登録</span></div></Card><Card className="node-editor-card"><div className="node-editor-head"><div><h2>ノード詳細</h2><p>内容の編集と関連付け</p></div>{selectedNode && <Pill tone="blue">{LAYERS[selectedNode.layer] || 'カスタム'}</Pill>}</div><NodeEditor node={selectedNode} nodes={nodes} edges={edges} onSave={saveNode} onDelete={deleteNode} /></Card></div>
        <div className="analysis-output-grid"><Card title="投稿方向性" subtitle="起点キーワードから作成した編集可能な仮説" action={<Button variant="quiet" size="sm" onClick={() => navigate('ideas')}>企画に変換 <ArrowDownToLine size={14} /></Button>}><div className="direction-list">{brief.directions.map((item, index) => <div className="direction-item" key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></div>)}</div><div className="output-mini"><strong>CTA案</strong><p>{brief.cta}</p><strong>検証する数値</strong><p>{brief.metrics}</p></div></Card><Card title="見つけたい語句の例" subtitle="サジェストではなく、手動調査用にローカル生成した語句"><div className="example-keyword-list">{brief.keywordExamples.map((item) => <span key={item}><Hash size={12} />{item}</span>)}</div><div className="small-disclaimer">この候補の検索実績・検索回数は未取得。各媒体の検索画面や公式APIで確認してください。</div></Card></div>
      </>}
    </>}
    <Modal open={newOpen} onClose={() => setNewOpen(false)} title="分析ノードを追加" subtitle="新しい根拠や読者の発言を手入力してください。" footer={<><Button onClick={() => setNewOpen(false)}>キャンセル</Button><Button variant="primary" onClick={addNode} icon={Plus}>ノードを追加</Button></>}><form onSubmit={addNode} className="form-stack"><Field label="ノード名" required><TextInput value={newNode.label} onChange={(value) => setNewNode((current) => ({ ...current, label: value }))} placeholder="例：読者の反論" /></Field><Field label="配置レイヤー"><SelectInput value={newNode.layer} onChange={(value) => setNewNode((current) => ({ ...current, layer: value }))} options={LAYERS.map((item, index) => ({ value: String(index), label: item }))} /></Field><Field label="内容・根拠" required><TextArea value={newNode.content} onChange={(value) => setNewNode((current) => ({ ...current, content: value }))} rows={4} placeholder="出典・日時・観察条件を記録。未確認は仮説と明記。" /></Field></form></Modal>
  </div>;
}
