export const PLATFORMS = [
  { id: 'google', label: 'Google', short: 'G', color: '#4285f4' },
  { id: 'youtube', label: 'YouTube', short: '▶', color: '#ef4444' },
  { id: 'instagram', label: 'Instagram', short: '◎', color: '#cf4c9b' },
  { id: 'threads', label: 'Threads', short: '@', color: '#1f2937' },
];

export const PURPOSES = [
  '投稿ネタの発掘', 'SEOキーワード調査', '競合分析', '商品販売につながる悩みの発掘',
  'YouTube企画', 'Instagram企画', 'Threads投稿企画', 'Google検索流入の改善', 'コンテンツ全体の戦略設計',
];

export const PAIN_CATEGORIES = [
  { id: 'problem', label: '課題・問題', color: 'rose', direction: '問題の原因を指摘し、誤った認識や解決できない理由をほどく' },
  { id: 'method', label: '方法・手順', color: 'blue', direction: 'ステップ解説、実行チェックリスト、初心者向けの手順や実践例' },
  { id: 'compare', label: '比較・選択', color: 'violet', direction: '比較表、選択基準、条件別の推奨方法' },
  { id: 'cause', label: '原因・分析', color: 'amber', direction: '原因分析、仮説と検証、数字を用いた説明' },
  { id: 'barrier', label: '不安・障壁', color: 'orange', direction: '不安の分解、障壁を下げる手順、リスクと対処法' },
  { id: 'failure', label: '失敗・最悪の未来', color: 'red', direction: '根拠を示したうえで、失敗する構造や早期に見直す指標を解説' },
  { id: 'purchase', label: '購入・比較検討', color: 'green', direction: '導入判断の基準、費用と効果の比較、選択肢の利点と注意点' },
  { id: 'desire', label: '願望・理想状態', color: 'teal', direction: '目標達成までの道筋、成功条件、具体的な実行手順' },
];

export const SCORE_FIELDS = [
  { id: 'painDepth', label: '悩みの深さ', weight: 20, help: '読者の時間・費用・心理的負担の具体性' },
  { id: 'intentClarity', label: '検索意図の明確さ', weight: 15, help: '検索語から読者の知りたいことを特定できる度合い' },
  { id: 'demand', label: '需要の裏付け', weight: 15, help: '公式データや記録など、需要を裏付ける根拠' },
  { id: 'productFit', label: '自分の商品との関連性', weight: 20, help: '自分の商品・サービスで具体的に支援できる度合い' },
  { id: 'originality', label: '独自性', weight: 15, help: '一次情報・経験・独自の検証を加えられる余地' },
  { id: 'convertibility', label: '投稿への変換しやすさ', weight: 15, help: '具体的な企画・手順・CTAに展開できる度合い' },
];

export const PLATFORM_FIELDS = {
  threads: [
    ['purpose', '投稿目的'], ['reader', '対象読者'], ['pain', '読者の悩み'], ['hook', 'フック'], ['claim', '主張'],
    ['evidence', '根拠・一次情報'], ['steps', '具体策'], ['cta', 'CTA'], ['objection', '想定される反論'], ['response', '反論への回答'], ['format', '投稿形式'],
  ],
  youtube: [
    ['purpose', '動画の目的'], ['intent', '検索意図'], ['title', '動画タイトル案'], ['thumbnail', 'サムネイルの訴求案'],
    ['pain', '視聴者の悩み'], ['outline', '動画構成・各章の要点'], ['steps', '視聴者に提供する具体策'], ['cta', 'CTA'],
    ['path', 'LINE登録などへの導線'], ['metrics', '公開後の検証項目'],
  ],
  instagram: [
    ['purpose', '投稿目的'], ['format', '投稿形式'], ['opening', '冒頭の訴求'], ['slides', '各スライドの内容'],
    ['caption', 'キャプション案'], ['hashtags', '関連ハッシュタグ候補'], ['cta', 'CTA'], ['metrics', '検証指標'],
  ],
  google: [
    ['keyword', '対象キーワード'], ['intent', '検索意図'], ['reader', '想定読者'], ['title', 'タイトル案'],
    ['outline', '見出し構成'], ['questions', '読者の疑問'], ['related', '関連キーワード'], ['faq', 'FAQ候補'],
    ['internalLinks', '内部リンク案'], ['meta', 'メタディスクリプション案'], ['metrics', '検証指標'],
  ],
};

export const PLATFORM_CONTENT_TYPE = {
  threads: '短文投稿', youtube: '動画企画', instagram: 'カルーセル', google: 'SEO記事',
};

export function classifyKeyword(text = '') {
  const value = text.toLowerCase().trim();
  const found = [];
  const tests = [
    ['method', /方法|やり方|手順|始め方|作り方|増やす|伸ばす|改善|コツ|対策|使い方/],
    ['compare', /比較|違い|どっち|どちら|vs\.?|選び方|ランキング/],
    ['cause', /なぜ|どうして|原因|理由|なぜなら|伸びない理由|売れない理由/],
    ['barrier', /難しい|不安|怖い|こわい|時間がない|続かない|継続できない|初心者|できない|苦手/],
    ['failure', /失敗|リスク|損する|避ける|やめるべき|危険|売れない|伸びない/],
    ['purchase', /料金|費用|価格|おすすめ|ツール|外注|導入|サービス|購入|契約|比較検討/],
    ['desire', /したい|たい$|目指す|安定|効率|理想|獲得したい|増やしたい|売上アップ/],
    ['problem', /集客|増えない|伸びない|売れない|反応ない|問い合わせがない|流入がない|困る|できない/],
  ];
  for (const [id, regex] of tests) if (regex.test(value)) found.push(id);
  const unique = [...new Set(found)];
  return unique.length ? unique : ['review'];
}

export function categoryLabel(id) {
  if (id === 'review') return '要確認';
  return PAIN_CATEGORIES.find((item) => item.id === id)?.label || '要確認';
}

export function inferIntent(text = '') {
  if (/料金|費用|価格|購入|契約|申し込み|導入|ツール|おすすめ/.test(text)) return '比較・購入検討';
  if (/ログイン|公式|サイト|アプリ|アカウント/.test(text)) return '案内・指名';
  if (/比較|違い|どっち|選び方/.test(text)) return '比較・検討';
  if (/方法|やり方|手順|始め方|作り方|とは|なぜ|原因|どうして|コツ/.test(text)) return '情報収集';
  if (/伸びない|増えない|売れない|困る|できない/.test(text)) return '課題解決';
  return '要確認';
}

export function generateKeywordSuggestions(seed, limit = 18) {
  const base = seed.trim();
  if (!base) return [];
  const suffixes = [
    ['方法', '方法を調べる人の具体的な手順ニーズ'],
    ['やり方 初心者', '初学者向けの開始手順を知りたいニーズ'],
    ['始め方', '最初の一歩と準備を知りたいニーズ'],
    ['うまくいかない 原因', '結果が出ない理由を特定したいニーズ'],
    ['伸びない 改善', '改善箇所を探している可能性'],
    ['失敗例', '避けたい失敗や注意点を知りたいニーズ'],
    ['成功事例', '具体的な実践例を探すニーズ（事例の存在は未確認）'],
    ['比較', '選択肢の違いを判断したいニーズ'],
    ['おすすめ 選び方', '選定基準を知りたいニーズ'],
    ['費用', '費用感を確認したいニーズ（価格データは未取得）'],
    ['時間がない', '時間的な障壁があるかを確かめる仮説'],
    ['初心者 できない', '初学者のつまずきを確かめる仮説'],
    ['とは', '基本定義を調べるニーズ'],
    ['メリット デメリット', '導入判断の利点・注意点を比べたいニーズ'],
    ['チェックリスト', '実行前の確認項目を求めるニーズ'],
    ['事例 個人', '個人での実践可能性を調べるニーズ（事例は未確認）'],
    ['問い合わせ 増やす', 'コンバージョン改善の仮説'],
    ['よくある質問', '実務上の疑問を解消したいニーズ'],
  ];
  const questions = [
    `${base}は何から始めればよい？`,
    `${base}で成果が出ない原因は？`,
    `${base}を続けるために必要なことは？`,
    `${base}の方法を選ぶ基準は？`,
    `${base}にかかる費用や時間は？`,
    `${base}で最初に確認すべき指標は？`,
  ];
  const generated = [
    ...suffixes.slice(0, 12).map(([suffix, note]) => ({ text: `${base} ${suffix}`, note, kind: '関連語' })),
    ...questions.map((text) => ({ text, note: '質問形式の候補。実検索での出現は未確認。', kind: '質問' })),
    ...suffixes.slice(12).map(([suffix, note]) => ({ text: `${base} ${suffix}`, note, kind: '関連語' })),
  ];
  return generated.slice(0, limit).map((item, index) => ({
    id: `candidate-${index}-${slugify(item.text)}`,
    text: item.text,
    note: item.note,
    kind: item.kind,
    intent: inferIntent(item.text),
    categories: classifyKeyword(item.text),
    origin: 'derived',
    retrievalStatus: 'local-generated',
  }));
}

export function makeBrief(keyword, project = {}) {
  const categories = keyword.categories?.length ? keyword.categories : classifyKeyword(keyword.text || '');
  const primary = categories[0] === 'review' ? 'problem' : categories[0];
  const cat = PAIN_CATEGORIES.find((item) => item.id === primary) || PAIN_CATEGORIES[0];
  const term = keyword.text || 'キーワード';
  const goalLine = project.goal || '投稿ネタの発掘';
  const hasContext = Boolean(project.audience || project.product);
  const questions = [
    `${term}で、最初に何を確認すべき？`,
    `${term}がうまくいかない場合、どこから見直せる？`,
    `${term}の方法を選ぶとき、何を基準にすればよい？`,
  ];
  const angles = [
    `${term}で見落としやすい前提を分解する`,
    `${term}を始める前後で確認するチェックリスト`,
    `${term}の結果を、反応数だけで判断しない検証方法`,
    `${term}に関するよくある選択肢を条件別に整理する`,
    `自分の実例・計測結果を添えて「${term}」の手順を検証する`,
  ];
  return {
    category: cat.label,
    categories: categories.map(categoryLabel),
    reason: categories[0] === 'review' ? '語句だけでは悩みの種類を特定しきれません。意図・対象読者を確認してください。' : `語句に含まれる表現から「${cat.label}」の可能性を抽出しました。ルールによる仮分類です。`,
    keywordExamples: generateKeywordSuggestions(term, 12).slice(0, 8).map((item) => item.text),
    questions,
    situation: hasContext
      ? `想定読者「${project.audience || '未設定'}」が「${term}」に取り組む場面を、インタビュー・検索結果・自分の記録で具体化してください。`
      : `読者像が未設定です。「${term}」を検索する人の役割・経験・利用場面を記録すると具体化できます。`,
    pain: `悩みの仮説：${term}について、期待した結果と現状の差がある可能性。実際の読者の声で確認してください。`,
    cause: '原因候補：手順・前提条件・導線・計測方法のどこにギャップがあるかは未検証です。',
    desired: '望む結果：読者が次に取る行動と、達成を確認できる指標を明記してください。',
    tried: '試した解決策：読者の経験をまだ取得していません。インタビューや公開投稿を追加してください。',
    notWork: '機能しない理由：根拠となる事例が未登録です。仮説のまま扱い、一次情報で検証してください。',
    competitor: '競合データ未登録。公式API取得または手動追加後に、登録したサンプル内だけを比較します。',
    gap: '独自の切り口候補：自分の実験・顧客の質問・失敗例など、一次情報を追加して差分を作ってください。',
    concern: '反論・不安の候補：費用、時間、再現性、必要な経験などが該当するか確認してください。',
    productFit: project.product ? `登録商品「${project.product}」との適合性は未評価。支援できる範囲とできない範囲を記録してください。` : '商品・サービスが未設定のため、購入関連性は未評価です。',
    directions: angles,
    hook: `「${term}」で悩んだら、まず結果ではなく、前提と確認指標を切り分けてみてください。`,
    claim: `「${term}」を一つの指標だけで判断せず、条件・導線・結果を分けて検証する。`,
    specific: '①現状の数値を記録 ②仮説を一つ選ぶ ③変更点を限定 ④同じ期間・条件で再計測。実例や数値を追記してください。',
    cta: `「${term}」について、現状・変更点・結果を記録するシートを作り、次の検証を一つ決める。`,
    metrics: ['表示数・再生数', 'プロフィール遷移数', 'リンククリック数', 'LINE登録数', '問い合わせ・成約数'].join('、'),
    sourceLabel: 'ローカルルールで作成した仮説。検索実績・読者の声ではありません。',
    goal: goalLine,
  };
}

export function makeAnalysisNodes(keyword, project = {}) {
  const brief = makeBrief(keyword, project);
  const term = keyword.text || '起点キーワード';
  const definitions = [
    ['keyword', 'キーワード', term, 0],
    ['intent', '検索意図', keyword.intent || inferIntent(term), 1],
    ['pain', '読者の悩み', brief.pain, 1],
    ['situation', '発生する状況', brief.situation, 1],
    ['cause', '根本原因', brief.cause, 1],
    ['desired', '望む状態', brief.desired, 1],
    ['tried', '試した解決策', brief.tried, 1],
    ['failure', '機能しない理由', brief.notWork, 1],
    ['competitor', '競合の主張', brief.competitor, 2],
    ['gap', '未解決の論点', brief.gap, 2],
    ['concern', '反論・不安', brief.concern, 2],
    ['product', '商品との関連性', brief.productFit, 2],
    ['angle', 'コンテンツの切り口', brief.directions[0], 3],
    ['format', '投稿形式', '投稿形式を選択（例：短文、比較、手順、動画、記事）。まだ未選択。', 3],
    ['cta', 'CTA', brief.cta, 3],
    ['metric', '検証指標', brief.metrics, 3],
  ];
  const nodes = definitions.map(([type, label, content, layer], index) => ({
    id: `${keyword.id}-${type}`,
    keywordId: keyword.id,
    projectId: keyword.projectId,
    type,
    label,
    content,
    layer,
    source: 'derived',
    confidence: 'low',
    x: 105 + layer * 245,
    y: 90 + (index % 4) * 126,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  const edges = [];
  const byType = Object.fromEntries(nodes.map((node) => [node.type, node.id]));
  const links = [
    ['keyword', 'intent'], ['keyword', 'pain'], ['pain', 'situation'], ['situation', 'cause'],
    ['cause', 'desired'], ['pain', 'tried'], ['tried', 'failure'], ['cause', 'competitor'],
    ['competitor', 'gap'], ['gap', 'angle'], ['concern', 'angle'], ['product', 'cta'],
    ['desired', 'metric'], ['angle', 'format'], ['format', 'cta'], ['cta', 'metric'],
  ];
  for (const [from, to] of links) edges.push({ id: `${byType[from]}-${byType[to]}`, source: byType[from], target: byType[to] });
  return { nodes, edges };
}

export function makeDraft(platform, keyword, project = {}) {
  const brief = makeBrief(keyword, project);
  const base = keyword.text || '起点キーワード';
  const shared = {
    purpose: project.goal || '読者の悩みを具体化し、次の行動につなげる',
    reader: project.audience || '対象読者を追記してください',
    pain: brief.pain,
    cta: brief.cta,
    metrics: brief.metrics,
  };
  const templates = {
    threads: {
      format: '問題提起 → 主張 → 具体策（短文）',
      hook: brief.hook,
      claim: brief.claim,
      evidence: '一次情報・自分の実例を追記（未入力／未検証）',
      steps: '1. 現状と期間を記録\n2. 変える要素を一つに絞る\n3. 同じ条件で再計測する',
      objection: '「状況が違うので、その方法が自分にも当てはまるか分からない」',
      response: '条件・対象・期間を併記し、当てはまらないケースも説明する。',
    },
    youtube: {
      intent: keyword.intent || inferIntent(base),
      title: `${base}の見直し方｜最初に確認するポイント`,
      thumbnail: `「${base}」で見直す3つのポイント（数字・条件は実測後に追加）`,
      outline: `00:00 誰のどんな悩みを扱うか\n01:00 現状を把握する指標\n03:00 原因の候補を切り分ける\n06:00 実践ステップと注意点\n08:00 振り返りと次の行動`,
      steps: '画面や実例を使って、変更前・変更後の条件を見せる。実績・数値を掲載する際は出典と期間を明記。',
      path: '動画内で関連資料の価値を説明 → 概要欄のリンク → 登録後の案内（各リンク先を確認）',
    },
    instagram: {
      format: 'カルーセル（6枚）',
      opening: `1枚目：${base}で迷ったら、最初にここを確認`,
      slides: `1. 読者の状況・対象\n2. よくあるつまずき（仮説。事例を追加）\n3. 原因を切り分ける視点\n4. 実践チェックリスト\n5. 数値の記録方法\n6. 次の行動とCTA`,
      caption: `${brief.hook}\n\n対象・条件・一次情報を追記したうえで公開してください。\n\n${brief.cta}`,
      hashtags: `#${base.replace(/[\s　#]/g, '')} #コンテンツ運用（候補。利用前に媒体の仕様と関連性を確認）`,
    },
    google: {
      keyword: base,
      intent: keyword.intent || inferIntent(base),
      title: `${base}の考え方と実践手順｜確認すべきポイント`,
      outline: `H1: ${base}の考え方と実践手順\nH2: ${base}とは（定義・前提）\nH2: 取り組む前に確認すること\nH2: 実践のステップ\nH2: 失敗しやすい点と検証方法\nH2: よくある質問`,
      questions: brief.questions.join('\n'),
      related: brief.keywordExamples.join('\n'),
      faq: `Q. ${base}は何から始めればよい？\nQ. 成果が出ないとき、どこを見直す？\nQ. 方法を選ぶ際の注意点は？`,
      internalLinks: '関連する既存記事のURL・アンカーテキストを追記（自動検索は未実装）',
      meta: `${base}の前提、実践ステップ、検証方法を解説。対象読者や一次情報を加えて、内容を具体化してください。`,
    },
  };
  const fields = { ...shared, ...templates[platform] };
  return {
    id: makeId(),
    projectId: keyword.projectId,
    keywordId: keyword.id,
    platform,
    format: fields.format || (platform === 'google' ? 'SEO記事' : '企画'),
    title: fields.title || `${base}｜投稿企画`,
    status: 'idea',
    fields,
    source: 'ローカルテンプレート',
    scheduledDate: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function calculateScore(scores, weights = SCORE_FIELDS) {
  const fields = weights.map((field) => ({ ...field, value: Number(scores?.[field.id]) }));
  if (fields.some((field) => !Number.isFinite(field.value) || field.value < 1 || field.value > 5)) {
    return { score: null, missing: fields.filter((field) => !Number.isFinite(field.value) || field.value < 1 || field.value > 5).map((field) => field.label) };
  }
  const totalWeight = fields.reduce((sum, field) => sum + Number(field.weight || 0), 0);
  if (!totalWeight) return { score: null, missing: ['重みを設定してください'] };
  const score = fields.reduce((sum, field) => sum + (((field.value - 1) / 4) * 100 * Number(field.weight || 0)), 0) / totalWeight;
  return { score: Math.round(score), missing: [] };
}

export const METRIC_DEFINITIONS = [
  ['反応率', '(いいね + コメント + 保存 + シェア) ÷ 表示数 × 100', '表示数と反応数が必要'],
  ['プロフィール遷移率', 'プロフィール遷移数 ÷ 表示数 × 100', '表示数とプロフィール遷移数が必要'],
  ['リンククリック率', 'リンククリック数 ÷ プロフィール遷移数 × 100', 'プロフィール遷移数とリンククリック数が必要'],
  ['LINE登録率', 'LINE登録数 ÷ リンククリック数 × 100', 'リンククリック数とLINE登録数が必要'],
  ['問い合わせ率', '問い合わせ数 ÷ リンククリック数 × 100', 'リンククリック数と問い合わせ数が必要'],
  ['成約率', '成約数 ÷ 問い合わせ数 × 100', '問い合わせ数と成約数が必要'],
];

export function calculatePerformance(metrics = {}) {
  const sum = (keys) => keys.reduce((total, key) => total + (Number(metrics[key]) || 0), 0);
  const ratio = (numerator, denominator) => {
    const numeratorValue = metrics[numerator];
    const denominatorValue = metrics[denominator];
    if (numeratorValue === null || numeratorValue === undefined || numeratorValue === '' || denominatorValue === null || denominatorValue === undefined || denominatorValue === '') return null;
    const n = Number(numeratorValue);
    const d = Number(denominatorValue);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
    return (n / d) * 100;
  };
  const reactions = ['likes', 'comments', 'saves', 'shares'];
  const reactionValues = reactions.map((key) => metrics[key]);
  const reactionRate = Number.isFinite(Number(metrics.impressions)) && Number(metrics.impressions) > 0 && reactionValues.every((value) => value !== '' && value !== null && value !== undefined)
    ? (sum(reactions) / Number(metrics.impressions)) * 100
    : null;
  return {
    reactionRate,
    profileVisitRate: ratio('profileVisits', 'impressions'),
    linkClickRate: ratio('linkClicks', 'profileVisits'),
    lineRegistrationRate: ratio('lineRegistrations', 'linkClicks'),
    inquiryRate: ratio('inquiries', 'linkClicks'),
    conversionRate: ratio('conversions', 'inquiries'),
    revenue: metrics.revenue === null || metrics.revenue === undefined || metrics.revenue === '' ? null : (Number.isFinite(Number(metrics.revenue)) ? Number(metrics.revenue) : null),
  };
}

export function extractCompetitorInsights(contents = []) {
  const words = new Map();
  const sourceText = contents.map((item) => `${item.title || ''} ${item.text || ''} ${item.description || ''}`).join(' ');
  const stop = new Set(['する', 'ある', 'いる', 'なる', 'こと', 'もの', 'ため', 'これ', 'それ', 'こちら', 'よう', 'です', 'ます', 'した', 'して', 'から', 'まで', '今回', '方法', '紹介', '解説']);
  try {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    for (const part of segmenter.segment(sourceText)) {
      const word = part.segment.trim();
      if (part.isWordLike && word.length >= 2 && !stop.has(word)) words.set(word, (words.get(word) || 0) + 1);
    }
  } catch {
    for (const word of sourceText.match(/[\p{Script=Han}]{2,}|[ァ-ヶー]{2,}|[a-zA-Z]{3,}/gu) || []) {
      if (!stop.has(word)) words.set(word, (words.get(word) || 0) + 1);
    }
  }
  const frequent = [...words].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word, count]) => ({ word, count }));
  const patterns = [
    ['question', /なぜ|どうして|原因|理由/],
    ['howto', /方法|やり方|手順|ステップ|始め方/],
    ['list', /\d+選|\d+つ|ランキング|チェックリスト/],
    ['warning', /失敗|注意|危険|やめて|NG/],
    ['comparison', /比較|違い|選び方|おすすめ/],
  ].map(([label, regex]) => ({ label, count: contents.filter((item) => regex.test(`${item.title || ''} ${item.text || ''}`)).length })).filter((item) => item.count > 0);
  return { sampleSize: contents.length, frequent, patterns, warning: '登録されたサンプル内の語句・形式のみを集計。人気・検索需要・市場全体を示す指標ではありません。' };
}

export function buildSlug(text = '') {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 50) || 'item';
}

export function slugify(text) { return buildSlug(text); }

export function makeId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso() { return new Date().toISOString(); }
