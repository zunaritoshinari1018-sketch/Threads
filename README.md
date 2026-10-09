# Layer — Research Studio

Google・YouTube・Instagram・Threadsのリサーチを、キーワード → 読者の悩み → 競合サンプル → 投稿企画 → 公開後の数値までつなげて管理する、日本語の個人向けリサーチアプリです。

> **実測と仮説を分離しています。** 外部AIは接続していません。キーワード候補、悩みの切り口、投稿案はローカルルール／テンプレートによる下書きで、実際の検索語・読者の声・成果を表すものではありません。検索数などは公式APIが返した場合のみ表示します。

## 起動

必要環境：Node.js 20.19+ または 22.12+。

```bash
npm install
cp .env.example .env     # APIを使わない場合は省略可能
npm run dev
```

開発サーバーは `http://localhost:5173`。APIゲートウェイはViteの同一プロセス内で動作します。

本番ビルド／起動：

```bash
npm run build
npm start                 # 0.0.0.0:4173（PORTで変更可）
```

APIキーはサーバー側の `.env` またはホスティング環境のSecret設定に置きます。`.env` はGit管理対象外です。`VITE_` 接頭辞を付けた秘密情報は使用しないでください。

## Renderでの公開デプロイ

リポジトリ直下に `render.yaml` を用意しています。Render側の [Dashboard](https://dashboard.render.com/) で **New → Blueprint** を選び、この公開リポジトリの `arena/03dabfb5-threads` ブランチを指定すると、Nodeサービスを作成できます。RenderのBlueprint作成時に `APP_USERNAME` と `APP_PASSWORD` を求められるので、他サービスと使い回さない強い値をRenderのSecret欄に設定してください。値をGitHubやチャットへ貼らないでください。

RenderのBuild Commandは `npm ci --include=dev && npm run build` です。`NODE_ENV=production` がビルド時にも適用される場合、通常の `npm ci` だと開発依存のViteが省略されるため、明示的に含めます。

アプリ本体と `/api/*` はHTTP Basic認証で保護し、`/healthz` だけをホスティングの稼働確認用に公開します。APIキーは初期デプロイ設定に含めていません。必要なら、認証保護を確認した後に、RenderのEnvironment画面へ `.env.example` の必要なAPI環境変数だけをSecretとして追加してください。Renderのサービス作成・認証情報設定が完了すると、Renderが公開URLを発行します。

データベース／ユーザー別アカウントはなく、各利用者のブラウザー内 `localStorage` に保存します。Basic認証は共有パスワードであり、個別ユーザー管理ではありません。サービスを作成する前のコード準備段階では、まだ公開URLは発行されていません。

## 実装済み

- 10画面：ダッシュボード、新規リサーチ、キーワード探索、立体分析、競合分析、投稿企画、投稿カレンダー、成果計測、API接続、データ管理。
- リサーチ／キーワード／関係グラフ／投稿下書き／公開予定／手入力実績を編集・保存。
- 日本語の意図・悩み分類（8分類、複数選択、曖昧語は「要確認」）。
- 検索実績とは別枠のローカル候補生成、質問語句、分類根拠、悩み・原因・CTA・検証指標の仮説出力。
- Google Ads API Keyword Planning の候補取得アダプター（必要なサーバー設定がある場合のみ）。取得した平均月間検索数、広告競合度、入札指標、月別検索数を保存。広告競合度をSEO難易度としては扱いません。
- YouTube Data API v3 の `search.list` と `videos.list` による動画・公開統計取得。検索結果件数を検索需要とは扱いません。
- Threads Keyword Search API と Instagram Graph APIのハッシュタグ検索アダプター（適切なMeta User Access Token・アカウント・審査済み権限がサーバーに設定された場合のみ）。
- 公式検索画面への導線、公開情報の手入力、サンプル範囲内のテキスト頻出語・投稿形式分析。
- Google／YouTube向けSEO企画と、Threads／Instagram向け投稿テンプレートの区別。
- 表示・反応・プロフィール遷移・クリック・LINE登録・問い合わせ・成約・売上の手入力と計算式の表示。必要データなし／分母0は「算出不可」。
- UTF-8 BOM付きCSV、完全JSONバックアップ／復元、ブラウザー印刷。
- API接続テストは実際のAPI要求が成功するまで「接続済み」と表示しない設計。

## 保存方式

本バージョンは、個人利用とCode Arenaの空のリポジトリ環境に合わせ、ブラウザーの `localStorage` を永続ストアとして使用します。API認証情報はブラウザーへ保存しません。端末・ブラウザーをまたぐ同期はありません。ブラウザーデータ消去に備え、**データ管理から定期的にJSONバックアップ**してください。

ストアはプロジェクト、調査セッション、キーワード、キーワード関係、検索指標、取得コンテンツ、分析ノード／関係、投稿企画（原稿を内包）、公開投稿、パフォーマンス指標、APIイベント、ユーザー設定を分けて保持します。プロジェクトの全データはJSONで復元できます。

## API設定

`.env.example` を `.env` にコピーし、利用するAPIだけ設定してください。値そのものは画面やログに表示しません。

### YouTube Data API v3

1. [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com) で YouTube Data API v3 を有効化。
2. APIキーを作成し、API制限を YouTube Data API v3 に設定。
3. サーバー環境に `YOUTUBE_API_KEY` を設定。
4. アプリの「API接続設定」で接続テスト。

動画検索は `search.list`、公開統計は `videos.list` を使用します。通常 `search.list` は100 units、`videos.list` は1 unitの概算として画面に表示します。YouTubeの既定クォータ／キー制限はGoogle Cloud Consoleで確認してください。コメント本文とチャンネル統計は取得していません。非公開・非表示指標は「未取得」です。

### Google Ads API Keyword Planning

1. Google Ads API [Developer Token](https://ads.google.com/aw/apicenter) と、対象顧客アカウントへのAPIアクセスを準備。
2. OAuthクライアントを作成し、`https://www.googleapis.com/auth/adwords` scope の**offline refresh token**を用意。アプリ内でトークンを入力するOAuth同意画面は本バージョンでは実装していません。
3. `.env` に以下を設定。
   - `GOOGLE_ADS_DEVELOPER_TOKEN`
   - `GOOGLE_ADS_CLIENT_ID`
   - `GOOGLE_ADS_CLIENT_SECRET`
   - `GOOGLE_ADS_REFRESH_TOKEN`
   - `GOOGLE_ADS_CUSTOMER_ID`（ハイフン有無どちらも可）
   - 必要に応じて `GOOGLE_ADS_LOGIN_CUSTOMER_ID`
   - 任意で `GOOGLE_ADS_API_VERSION`（既定 `v23`）
4. アプリで接続テスト後、キーワード探索の「Google Ads API」から候補取得。

初期ロケーションは日本（geo target 2392）、言語は日本語（language constant 1005）。リサーチ設定の対象地域・言語を参照し、日本・米国・英国・カナダ・オーストラリアと英語／日本語の組み合わせを送信します。その他の地域ID・言語IDはアダプター未設定です。Developer Tokenのアクセス水準・顧客権限・APIバージョンにより拒否されることがあります。エラー時は接続状態を成功扱いにしません。

公式資料：[Keyword Planning](https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas) · [Google Ads API](https://developers.google.com/google-ads/api/docs/start)

### Instagram Graph API（ハッシュタグ検索）

このアダプターはInstagramの一般キーワード検索ではなく、**ハッシュタグ検索**だけを行います。個人アカウント全体・すべての投稿の検索機能ではありません。

1. Instagram **BusinessまたはCreator**アカウントとMeta Developer Appを準備し、必要なFacebook User Access TokenをMetaのOAuth／開発者ツールで発行。
2. `instagram_basic` とInstagram Public Content AccessのApp Reviewを完了。PageタスクがBusiness Manager経由で付与されたユーザーでは、エンドポイントに応じ `pages_read_engagement`、`business_management`、`ads_management` 等の追加permissionが必要な場合があります（現在の公式要件を確認）。
3. `.env` に `INSTAGRAM_ACCESS_TOKEN`、`INSTAGRAM_USER_ID` を設定。必要なら `META_GRAPH_API_VERSION`（既定 `v23.0`）を指定。
4. 接続テストは `recently_searched_hashtags` を読むため、新しいハッシュタグ検索枠を消費しません。Competitorページでハッシュタグを検索し、top/recentの1ページ（最大50件）を保存します。

アカウントあたりユニークハッシュタグ30件／rolling 7日の上限があります。各検索前に公式 `recently_searched_hashtags` edgeで現在のMetaアカウント枠を照会し、新しい31個目は送信前に停止します。ブラウザー内の履歴表示は参考値で、Meta側の判定が優先されます。`recent_media` は直近24時間に公開されたメディアのみ、`top_media` は人気順の公開メディアを返します。どちらも1ページ最大50件、ページ結果は網羅データではありません。

公式資料：[Instagram Hashtag Search](https://developers.facebook.com/docs/instagram-api/guides/hashtag-search/) · [Recently Searched Hashtags](https://developers.facebook.com/docs/instagram-api/reference/ig-user/recently_searched_hashtags)

### Threads API Keyword Search

1. Meta Developer AppでThreadsのUser Access Tokenを発行し、`threads_basic` と `threads_keyword_search` 権限を付与。
2. 公開投稿検索に必要なApp Review／アクセス承認を確認。未承認の場合、自分の投稿だけが検索されることがあります。
3. `.env` に `THREADS_ACCESS_TOKEN` を設定し、API接続設定から接続テスト。接続テストは `/me` への読み取りで、検索クエリ枠を消費しません。検索権限は実検索時に別途確認します。
4. Competitorページでキーワード検索を実行。TOP／RECENT、公開期間、ページ数を選択できます。APIの次ページカーソルを使用し、返ってきた投稿本文・URL・許可される投稿者情報を保存します。

1ページ最大100件。Metaはユーザーあたり直近24時間で最大2,200クエリに制限し、同一語の再検索も計上します（結果0件は計上されません）。各検索前に `/me?fields=recently_searched_keywords` で現在の枠を確認し、満枠または照会失敗時は検索を停止します。検索結果は権限・検索条件のサンプルで、投稿網羅性・検索需要を表しません。キーワード候補のローカル生成とは別機能です。

公式資料：[Threads Keyword Search](https://developers.facebook.com/docs/threads/keyword-search/) · [Threads API](https://developers.facebook.com/docs/threads/)

## テスト・品質確認

```bash
npm test
npm run build
npm audit
```

ドメインロジック（分類、候補の出所、立体分析、スコア、成果率、競合サンプル集計）と、未設定APIの応答・未登録ルートをNodeの組み込みテストで確認します。外部APIの成功テストは、利用者の認証情報が未設定のため実行していません。API接続画面で設定後に実測の接続テストを実行してください。

## 制限・セキュリティ上の注意

- AIサービスは未接続です。ローカルルールが作る悩み・原因・コンテンツ企画は**要検証の仮説**です。実データを装いません。
- Google Search Console、Google Trends、Meta OAuth同意画面／トークン更新、Instagramの一般キーワード検索・自分のアカウントインサイト、YouTubeコメント本文・チャンネル統計、競合アカウント規模補正、サーバーDB／ユーザー認証、端末間同期は未実装です。Metaトークンは利用者が別途発行しサーバー環境変数へ設定します。
- Google Adsの月間検索数は広告プランニング指標で、自然検索順位・SEO難易度・SNSの検索数ではありません。
- YouTube検索結果はAPI応答のサンプルです。検索順位・取得件数は検索ボリュームではありません。
- 競合頻出語は利用者が登録したサンプルだけを集計し、市場全体の人気とは断定しません。
- Render BlueprintではBasic認証を必須化し、未設定ならアプリとAPIを503で閉じます。別のホストへ公開する場合も同等のアクセス制限を必ず有効にしてください。単独利用向けであり、無認証公開には設計されていません。
- 公開コンテンツは信頼できないテキストとして保存・表示し、AIに実行指示として渡す機能はありません。
