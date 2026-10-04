# Toki実装フェーズ

日付: 2026-10-05
状態: Phase 35〜44を完了（2026-09-23）。Phase 45はToki専用D1のバックアップ・migrationとToki Workerへの反映、既存データの全項目照合、認証済みブラウザでの追加機能確認まで完了。所有者自身のPC/iPhone実機確認待ち。基盤と既存2製品の本番構成は変更していない。Phase 47は短時間のカレンダー記録の表示修正を実装・検証し、所有者承認後に本番反映済み（2026-09-26）。
仕様: [Toki設計](toki-design.md)、分離理由: [ADR-0021](decisions/0021-toki-independent-product.md)、運用: [Toki本番前確認](toki-operations.md)

Phase 48: 分単位の手動入力と内容の任意化を実装・検証・本番反映済み（2026-09-27）。

Phase 49〜56: 所有者の2026-10-04の指示で、独立構成を維持した技術スタック統一を計画。Phase 50は完了し、現行動作の比較テストと合成fixture、依存確認、開発用Undiciの限定修正をローカル全gateとGitHub CIで検証した。新スタックへの置換・Cloudflare操作はまだ行っていない。次はPhase 51。

| Phase | 目的 | 完了条件と境界 |
|---|---|---|
| 35 | 仕様・設計の確定 | 計測/復帰/期限/未保存、PC/スマホ/集中表示、日時・編集、独立構成とFree gateを文書化。文書差分・全品質gate・commit/push。本番/resource変更なし |
| 36 | 別repositoryと開発土台 | 確認済みの`Rizakura0110/toki` Publicへ、独立lockfile、供給網policy、単体test/CI、ローカルWorker/D1、基盤との境界を整える。本番resourceは作らない |
| 37 | 認証・DB・API | 本人限定Access JWTのWorker側検証、session/record schema、開始/終了/期限/保存/破棄/編集・日/週取得をlocal実装。二重開始・冪等・時刻境界・競合・認証のテスト |
| 38 | 計測画面 | ストップウォッチ/タイマー、内容入力、閉じた後の復帰、通信失敗表示、PC/スマホの時間だけ表示を実装。毎秒のbackend通信なし |
| 39 | アプリ内カレンダー | PC週/日、スマホ日タイムライン、保存済み記録の表示と日時・内容の編集、日またぎ・移動・空状態を検証 |
| 40 | モバイル・独立PWA | responsive操作、PWA identity/manifest/icon、キーボード・読み上げ・文字拡大・モバイルE2Eをローカル検証。iPhone実機はPhase 43で確認。既存2 PWAは不変 |
| 41 | rizakura-hontai入口との往復 | 入口に第三のメニューを追加しTokiへ、Tokiから入口へ戻る。リンクのみで、基盤DBやWorkerへToki業務処理を移さない。別repositoryの差分と統合gateを確認 |
| 42 | 統合品質・運用準備 | 全format/lint/型/test/build/audit、E2E、時刻・競合・認証回帰、usage/Free境界、backup・切り戻し・運用手順を確認。production変更なし |
| 43 | 承認後の本番提供 | 対象・費用・認証・データ保護を再確認し、明示承認後にToki用Access/Worker/D1を作成・deploy。Toki URLの保護と動作を先に確認してから基盤入口のリンクを反映し、リンク切れを避ける。本人のPC/iPhoneで計測→保存→編集→再起動とPWA、入口往復を確認 |
| 44 | カレンダーの手動登録・削除 | `manual`記録の新規作成、編集画面からの確認付き完全削除、重複送信・版数競合・日時・内容の検証、PC/スマホE2E。既存D1の行と計測フローを保つmigrationをローカルで検証し、品質gate後にToki repositoryをcommit/push。本番DB・Workerは変更しない |
| 45 | 追加機能の本番反映 | 別途対象を明示して承認を得てから、Toki専用D1のバックアップ・migrationとToki Workerのdeployを順に行う。認証と既存記録の保持、手動登録・削除を本人のPC/iPhoneで確認する。既存2製品と基盤Workerは変更しない |
| 47 | 短時間のカレンダー記録の可読性 | 1時間120px・記録枠の最低高さ44px・内容を先頭の1行に表示。短い記録の隣接/重複/日境界を単体・PC日/週・スマホE2Eで検証し、品質gate後にcommit/push。保存時刻・API・DBは変更しない。本番反映は別途承認後 |
| 48 | 手動登録の分単位入力・内容の任意化 | 手動新規登録フォームを秒00の分単位へ変更。手動/計測後/編集で空欄を受け付け、保存時に「無題」で補完。単体・PC/スマホE2Eで保存/再読込/編集/再送・既存の秒精度保持を確認し、品質gate後にcommit/push。DB migration不要、本番反映は別途承認後 |

Phase 46はDaymarkの習慣削除に割り当て済み。Phase 47はローカル実装・検証後、別途承認を得てToki Workerだけを本番更新した。DB migration・データ更新・Access/料金設定変更はない。Phase 45の所有者自身の追加機能実機確認待ちとは別に扱う。

共通ルール: 1フェーズずつ進め、完了時には対象repositoryの差分・ignore・秘密情報を確認し、必要な品質gateが成功した場合だけcommit/pushする。Git pushはCloudflareの作成・migration・deployを許可しない。Toki側のcommitを先に公開し、基盤側に変更があるフェーズでは結合検証後に基盤をcommit/pushする。既存のTech Inbox/Daymarkとその本番データ・認証・PWAを保つ。

Phase 37で確定した詳細: タイマー1秒〜24時間、当初の内容1〜500文字、記録と取得期間の上限366日、保存済み記録の時間重複を許可、未完了計測は1件まで。Phase 48では内容を0〜500文字に変更し、空欄は保存時に「無題」で補完する（2026-09-27本番反映済み）。編集は`version`で競合を検出し`409`を返す。後続画面では再読込・再編集を案内する。

Phase 41の入口はTokiを「公開準備中」で表示し、保護されたToki originの稼働をPhase 43で確認してから、ビルド時の`VITE_TOKI_URL`でリンクを有効にする計画とした。基盤Workerの本番再deployはPhase 43の別承認を得て実施した。Toki画面の通常ヘッダーには現行のrizakura-hontai originへの戻りリンクを置き、時間だけ表示中はヘッダーごと非表示にする。

## Phase 49以降の技術スタック統一

目的は保守する技術を基盤・Tech Inbox・Daymarkと揃えることであり、機能追加や画面の再デザインではない。Tokiの独立repository・Worker・D1・Access application、現在のURLと基盤へのリンクを維持する。基盤へsubmodule統合せず、Tech Inbox/DaymarkのruntimeやDBには触れない。

### 統一する技術

| 対象 | 移行元 | 移行先 |
|---|---|---|
| 画面 | HTMLと素のJavaScriptによるDOM操作 | TypeScript、React/React DOM、React Router |
| スタイルとビルド | 手書きCSS、publicの直接配信、WranglerによるWorker build | Tailwind CSS、Vite、React/Tailwind/Cloudflare plugins、Wrangler |
| API | TypeScriptの独自router | Hono。既存のZod契約・jose認証を維持 |
| DB操作 | D1の直接SQL | Drizzle ORM/D1と既存物理schemaに対応する型付き定義。必要な特殊SQLはレビュー済みのparameterized SQLとして保持 |
| 品質管理 | Biome、TypeScript、Vitest、Playwright、GitHub Actions | 現行gateを維持しReact画面のTesting Library/jsdom検証を追加 |

共通依存の版は[基盤の依存基準](dependency-baseline.md)と実際のpackage/lockfileを基準に完全固定する。Phase 50で安全性と互換性を再確認し、統一の名目で既知の脆弱性を受け入れたり、7日gate・integrity・install script制限を緩めたりしない。変更が必要なら理由と影響を説明し、依存更新の範囲を先に確定する。今後の新製品もこの標準を用い、異なる技術の採用・標準層の省略には事前承認を必要とする。

### 作業の順序

| Phase | 作業 | 完了条件と本番境界 |
|---|---|---|
| 49 | 統一方針と移行計画を記録する | 今回はAGENTSと既存設計/計画/進捗だけを更新し、文書検査・差分/秘密情報検査後にcommit/push。実装・install・Cloudflare操作は行わない |
| 50 | 現行動作の固定と依存確認 | 現行Tokiの全品質gateを実行し、不足する回帰テストと合成fixtureを追加。API/HTTP error・DB制約・認証・PWA・PC/スマホの画面と操作を比較基準にする。依存の完全versionと移行中の段階構成を確定。実データをfixtureへ含めない |
| 51 | ViteとReact/Tailwindの開発基盤を導入 | browser/Workerの型・entrypointを分離し、現行画面が動く状態でbuild/CI/生成型を整える。ハッシュ付きassetsの配信、認証、CSP、直接URL、未知path/assetの404を検証。既存の本番設定生成/検査も新成果物に対応させるがdeployしない |
| 52 | APIのrouterをHonoへ移行 | 現行のDB処理を使い、URL・method・JSON・status/error・認証/Origin/client header・上限を保持してroutingとmiddlewareを置換。未認証のHTML/assets/APIと失敗時の応答を回帰検証 |
| 53 | DBアクセスをDrizzleへ移行 | 既存table/column/index/CHECK/trigger・migration履歴に合わせてschemaとrepositoryを定義。ローカルD1で旧版と新版の結果、原子性、query範囲、記録/未完了計測を照合。DB再作成や本番migrationを前提にせず、物理変更が必要なら停止して別計画を提示 |
| 54 | 画面をReact/TypeScript/Tailwindへ移行 | 計測画面→カレンダーの順にcomponent化し、React Routerへ揃える。既存URL・見た目・操作を保ち、計測/復帰/集中表示、日/週、手動登録/編集/削除、空欄の無題、分入力と既存秒精度を検証。新画面の同等性を確認してから不要な旧DOM操作・CSSを除く |
| 55 | 全体回帰と本番反映準備 | clean checkoutの全gateとPC/スマホE2E、旧clientと新API/新clientと旧APIの互換、PWA、bundle/CPU/queryの予算を検証。厳密な設定dry-runとprivate backup・復元予行・旧Workerへの切り戻し手順を用意。本番read-only確認/backupが必要なら対象と権限を明示してから実施し、まだdeployしない |
| 56 | 承認後の本番反映と実機確認 | 所有者の明示承認後、既存Toki Workerだけを更新。直前の復元点と認証・DB/他Workerの設定を照合し、PC/iPhone PWAで表示・保存・再起動を確認。計測中の状態は勝手に終了しない。DB/Access/料金プラン/基盤Worker変更は含めず、失敗時は確認済み手順で切り戻す |

Phase 50以降は別途着手指示を受けてから1段階ずつ進める。実装フェーズごとにformat・lint・生成型・TypeScript・単体/統合/関連ブラウザtest・build・auditを通し、差分・ignore・秘密情報を確認してcommit/pushする。テストは最後にまとめて追加せず、各置換と同時に保つ。通常のpushで本番を自動更新するCIには変更しない。

### Phase 50で固定した比較基準

実データを使わず、Toki repositoryの合成fixtureと既存テストを移行前後の比較に使う。外部契約を変えずに内部の呼び出し先を新実装へ切り替え、SQLite検証だけでD1固有の動作を保証したことにはしない。

| 対象 | 比較するもの | 主なテスト |
|---|---|---|
| API | response全フィールド・null・ミリ秒・時刻順、method/path/query、4KiB入力上限、200/201/400/404/405/409とerror code、再試行・削除後の再送拒否 | `src/api/compatibility.test.ts`、既存router/contract test |
| DB | stopwatch/timerの計測中・内容入力待ち、保存済み/破棄/manual、全列・部分unique/index・trigger・CHECK、既存migrationの行保持 | `tests/fixtures/`、`src/data/migration-baseline.test.ts`、既存records test、local D1 |
| 認証と配信 | Access JWT・Origin/client header・local限定bypass、HTMLから参照するassetの保護、未知URLは404 | 既存security/worker test、新しいmigration E2E |
| PCとスマホ | 既存URLで戻る/進む/再読込後も同じ計測を維持、通常/集中表示で毎秒通信なし、既存保存/編集/削除/無題/時刻精度/短時間表示 | `tests/e2e/migration-baseline.spec.ts`と既存2 E2E suites |
| PWA | id/start_url/scope・icon・manifest認証、Service Workerなし | 既存pwa testとE2E |

### 段階移行の依存と実行構成

固定版は[Phase 50依存確認](dependency-baseline.md#phase-50のtoki移行向け再確認)を使う。基盤の既存lockfileを無変更で複製しない。新たに判明したHono/Undiciの指摘を除いた隔離候補graphを検証したが、実際のTokiへの導入・build互換性は各フェーズで改めて確認する。

- Phase 51ではVite・React・React Router・Tailwindとplugins、React型/Testing Library/jsdomを導入する。ブラウザとWorkerのentrypoint/型検査を分離し、既存のHTML/DOM画面をVite経由でも動かす。Hono/Drizzleの機能置換はまだ行わない。入口URLと認証を維持し、本番設定生成を新buildへ対応させる。
- Phase 52ではHono `4.13.7`で外側のroutingを置換し、既存データ層とZod/joseをそのまま使う。旧browserは引き続き同じHTTP契約へ接続する。
- Phase 53ではDrizzle ORM `0.45.2`で既存schemaへのアクセスを置換する。Drizzle Kit `0.31.10`は開発専用で、既存のmoderate指摘・deprecated推移依存を記録する。公開開発サーバーには使わず、生成migrationを自動適用しない。
- Phase 54で初めて画面をReactへ置換し、旧DOM実装を同等性確認後に除く。Phase 55で旧新の組合せとclean checkoutを検証し、Phase 56は別承認後に既存Toki Workerへ反映する。

基盤自体にも開発用依存のhighが残っていることを今回の読み取り監査で確認した。Phase 50では基盤の実装・lockfile・他製品を変更しておらず、基盤の依存修正は別対応として残す。本番での悪用や侵害を確認したという意味ではない。

### 変えないものと確認事項

- APIのURL、method、JSON、status/error、クライアントヘッダーを維持する。`/`、`/index.html`、`/calendar.html`の直接アクセス・再読込・戻る/進むと、manifestのid/start_url/scopeを保つ。新しいService Worker、オフライン保存、通知は追加しない。
- 時刻はUTC epoch milliseconds、日本時間表示、月曜始まり、最大366日、重複許可、未完了計測1件、再送の冪等性、version競合、削除の確認と再送による復活防止を維持する。Reactの再mountやEffectの再実行が計測開始/停止/保存の重複要求を起こさないことを検証する。
- Drizzleの導入はDBの移設ではない。既存の`0001_initial.sql`と`0002_manual_records.sql`を変更/再適用せず、Drizzle Kitの生成結果を無検証で本番へ適用しない。部分unique index、削除trigger、CHECKなどを含めてlocal D1で一致を確認する。必要なraw SQLを残す場合も理由・parameter binding・テストを明記する。
- Viteの新しいasset pathを既存の固定allowlistへ無条件に追加するのではなく、成果物と対応する配信境界をテストする。APIや欠落assetをHTMLへfallbackさせず、Workerの認証を迂回する配信や本番へのlocal bypass混入を許さない。
- ユーザー操作なしで行える実装・自動検証はagent側で進める。本番反映の許可と、最後のPC/iPhone PWAの実機操作は所有者へ依頼する。既存データの再登録やPWAの削除/追加し直しは計画上不要だが、検証前に無条件保証はしない。
- 新しい有料サービスやCloudflare resourceの追加は計画に含めない。採用技術を揃えるだけで無料運用や性能を保証せず、本番前にプラン/利用量と成果物の予算を再確認する。認証エラーの際は既定の資格情報切り分け手順を守る。
