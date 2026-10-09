import React, { useState } from 'react';
import { AlertCircle, ArrowUpRight, CheckCircle2, CircleHelp, ExternalLink, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { Button, Card, DateLabel, LinkButton, PageHeader, Pill, PlatformBadge } from '../ui.jsx';

const CONNECTORS = [
  {
    id: 'google', title: 'Google Ads Keyword Planning', api: 'Google Ads API', mode: 'サーバーOAuth 2.0 + Developer Token',
    docs: 'https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas', setup: 'https://ads.google.com/aw/keywordplanner/home',
    variables: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_ADS_LOGIN_CUSTOMER_ID（任意）', 'GOOGLE_ADS_API_VERSION（任意・既定 v23）'],
    capabilities: ['キーワード候補・平均月間検索数・月別検索数（APIが返す場合）', '広告競合度・入札レンジ（返却される場合）'],
    caveat: 'Developer Tokenのアクセス水準や顧客アカウント権限が必要です。広告競合度は自然検索SEO難易度ではありません。月間検索数はGoogle検索の指標です。',
    testPath: '/api/google-ads/test', supported: true,
  },
  {
    id: 'youtube', title: 'YouTube Data API v3', api: 'YouTube Data API v3', mode: 'サーバーAPIキー',
    docs: 'https://developers.google.com/youtube/v3/docs', setup: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
    variables: ['YOUTUBE_API_KEY'],
    capabilities: ['search.listで公開動画検索', 'videos.listで公開統計を取得（返却可能な項目のみ）'],
    caveat: '検索リクエストは通常100 units、詳細リクエストは1 unitの概算。日次クォータとAPIキー制限を確認してください。再生数・いいね数は検索ボリュームではありません。',
    testPath: '/api/youtube/test', supported: true,
  },
  {
    id: 'instagram', title: 'Instagram Graph API', api: 'Meta Instagram API', mode: 'Business / Creator + Facebook User Access Token（サーバー設定）',
    docs: 'https://developers.facebook.com/docs/instagram-api/guides/hashtag-search/', setup: 'https://developers.facebook.com/apps/',
    variables: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_USER_ID', 'META_GRAPH_API_VERSION（任意）'],
    capabilities: ['公式ハッシュタグ検索 → top_media / recent_media の公開メディア（1ページ最大50件）', 'APIが返すキャプション・公開日時・反応指標（未返却の場合は未取得）'],
    caveat: 'Business/Creatorアカウントと instagram_basic・Instagram Public Content Access、アプリ審査等が必要です。Pageタスクの付与方式によりpages_read_engagement等が追加で必要です。Meta公式のrecently_searched_hashtagsで30種類 / rolling 7日の枠を確認し、新しい31個目を止めます。recent_mediaは直近24時間のみ。一般キーワード検索・個人アカウントの全投稿検索ではありません。OAuth同意画面は別途用意し、長期トークンをサーバー環境変数へ設定してください。',
    testPath: '/api/instagram/test', supported: true,
  },
  {
    id: 'threads', title: 'Threads API', api: 'Meta Threads API', mode: 'Threads User Access Token（サーバー設定）',
    docs: 'https://developers.facebook.com/docs/threads/keyword-search/', setup: 'https://developers.facebook.com/apps/',
    variables: ['THREADS_ACCESS_TOKEN'],
    capabilities: ['threads_keyword_search による公開投稿のキーワード／トピックタグ検索', 'TOP / RECENT、公開日時、本文、URL、許可される投稿者情報、ページネーション'],
    caveat: 'threads_basic と threads_keyword_search 権限が必要です。未承認アプリでは自分の投稿だけが対象になる場合があります。最大100件/ページ、ユーザーあたり2,200クエリ / rolling 24時間（同語再検索も計上）。公式の最近の検索履歴で枠を照会し、満枠時は停止します。OAuth同意画面・トークン発行は別途必要です。',
    testPath: '/api/threads/test', supported: true,
  },
];

function displayStatus(platform, server) {
  if (!platform.supported) return { label: '未実装 · 手動調査', tone: 'neutral', dot: false };
  if (!server) return { label: 'サーバー状態を確認できません', tone: 'red', dot: true };
  if (!server.configured) return { label: '未設定', tone: 'amber', dot: true };
  if (server.status === 'connected') return { label: '接続済み · テスト成功', tone: 'success', dot: true };
  if (server.status === 'permission') return { label: '権限不足', tone: 'red', dot: true };
  if (server.status === 'quota' || server.status === 'rate_limited') return { label: '利用上限・頻度制限', tone: 'red', dot: true };
  if (server.status === 'reauth_required') return { label: '再認証が必要', tone: 'amber', dot: true };
  if (['error', 'auth_error', 'temporary_error', 'network', 'timeout', 'not_found'].includes(server.status)) return { label: '接続エラー', tone: 'red', dot: true };
  return { label: '設定済み · 未テスト', tone: 'amber', dot: true };
}

export function ConnectionsPage({ apiStatus, refreshApiStatus, notify }) {
  const [testing, setTesting] = useState('');
  const [testResults, setTestResults] = useState({});
  const [testError, setTestError] = useState({});
  const runTest = async (connector) => {
    setTesting(connector.id); setTestError((current) => ({ ...current, [connector.id]: '' }));
    try {
      const response = await fetch(connector.testPath, { method: 'POST' });
      const result = await response.json();
      setTestResults((current) => ({ ...current, [connector.id]: result }));
      await refreshApiStatus?.();
      if (result.ok) notify(result.message || '接続テストに成功しました。');
      else setTestError((current) => ({ ...current, [connector.id]: result.message || '接続テストに失敗しました。' }));
    } catch {
      setTestError((current) => ({ ...current, [connector.id]: 'APIゲートウェイに接続できません。開発サーバーを再起動して再試行してください。' }));
    } finally { setTesting(''); }
  };
  return <div className="page-content">
    <PageHeader eyebrow="API & SOURCES" title="API接続設定" description="公式APIの接続状態は実テスト結果に基づいて表示します。キーはサーバー環境変数で保持し、ブラウザには入力・表示しません。" icon={ShieldCheck} actions={<Pill tone={apiStatus?.ok ? 'success' : 'amber'} dot>{apiStatus?.ok ? 'APIゲートウェイ稼働中' : 'APIゲートウェイ未確認'}</Pill>} />
    <div className="security-banner"><ShieldCheck size={18} /><div><strong>認証情報を安全に取り扱う</strong><p>APIキー、Developer Token、OAuthシークレットはプロジェクトのサーバー環境変数にのみ設定します。フロントエンドやブラウザのlocalStorageには保存しません。</p></div></div>
    <div className="connector-list">{CONNECTORS.map((connector) => {
      const server = apiStatus?.platforms?.[connector.id]; const status = displayStatus(connector, server); const result = testResults[connector.id];
      return <Card className={`connector-card connector-${connector.id}`} key={connector.id}><div className="connector-head"><div className="connector-title"><PlatformBadge platform={connector.id} /><div><h2>{connector.title}</h2><small>{connector.api} <i>·</i> {connector.mode}</small></div></div><Pill tone={status.tone} dot={status.dot}>{status.label}</Pill></div><div className="connector-body"><div className="connector-description"><strong>取得・利用できる情報</strong><ul>{connector.capabilities.map((item) => <li key={item}>{item}</li>)}</ul><div className="connector-caveat"><CircleHelp size={14} /><span>{connector.caveat}</span></div></div><div className="connector-setup"><strong>設定・参考情報</strong><div className="connector-links"><LinkButton href={connector.docs}>公式ドキュメント</LinkButton><LinkButton href={connector.setup}>設定ページ</LinkButton></div>{connector.supported ? <><div className="env-title">サーバー環境変数</div><div className="env-chips">{connector.variables.map((name) => <code key={name}>{name}</code>)}</div><p className="env-hint">値は設定画面に入力しません。リポジトリ直下の .env（Git管理外）か、ホスティング先のSecret管理へ設定してください。</p><Button variant={server?.status === 'connected' ? 'secondary' : 'primary'} size="sm" icon={testing === connector.id ? RefreshCw : server?.status === 'connected' ? CheckCircle2 : RefreshCw} disabled={testing === connector.id} onClick={() => runTest(connector)}>{testing === connector.id ? '接続確認中...' : '接続テスト'}</Button>{server?.testedAt && <small className="last-tested">最終テスト：<DateLabel date={server.testedAt} /></small>}</> : <div className="manual-only-box"><Pill tone="neutral">API取得は未実装</Pill><p>公式検索画面で調査し、競合分析から公開コンテンツを手入力してください。非公式スクレイピングは行いません。</p><div className="connector-links"><LinkButton href={connector.id === 'threads' ? 'https://www.threads.com/search' : 'https://www.instagram.com/explore/'}>公式検索を開く</LinkButton></div></div>}</div></div>
      {(testError[connector.id] || (result && !result.ok)) && <div className="connection-error"><AlertCircle size={15} /><span>{testError[connector.id] || result?.message || server?.message}</span><Button size="sm" variant="quiet" disabled={testing === connector.id} onClick={() => runTest(connector)}>再試行</Button></div>}
      {result?.ok && <div className="connection-success"><CheckCircle2 size={15} />{result.message}</div>}
      <div className="connector-foot"><span>接続前でも手入力・ローカル分析・保存機能は利用できます。</span>{server?.missing?.length > 0 && <span>未設定：{server.missing.join('、')}</span>}</div>
      </Card>;
    })}</div>
    <Card title="共通のデータ取得方針" subtitle="取得元・日時を保持し、実測値と候補を分離"><div className="api-policy-grid"><div><Pill tone="blue">official_api</Pill><strong>公式API実測</strong><p>API応答と収集条件、取得日時を保存。指標が返らなければ「未取得」。</p></div><div><Pill>manual / imported</Pill><strong>手入力・インポート</strong><p>利用者が入力した公開情報・実績を出所と日時とともに保存。</p></div><div><Pill tone="teal">derived</Pill><strong>ローカル生成・派生</strong><p>テンプレート候補や計算値。APIデータ・検索数ではありません。</p></div></div></Card>
  </div>;
}
