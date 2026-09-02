# Quality gates

最終更新: 2026-09-02

## 標準ゲート

`pnpm check`はformat、lint、Cloudflare生成型、TypeScript、unit/component/integration test、coverage、fresh local D1、実HTTP API、production build、artifact budget、desktop/mobile Chrome E2E、dependency auditを順に実行する。

2026-09-02のPhase 24最終実行では、Daymark単体8 files・64 tests、基盤Vitest 43 files・440 tests、Playwright desktop/mobile 31 testsが成功した。desktop専用sidebar testのmobile実行1件は意図どおりskipした。

個別確認には次を使う。

```bash
pnpm test:coverage
pnpm api:verify:local
pnpm build
pnpm quality:artifacts
pnpm e2e
pnpm audit --audit-level high
```

## GitHub Actions

`.github/workflows/quality.yml`は`main`へのpushとpull requestで`pnpm check`を実行する。Markdownと`docs/`だけの変更はcode・configurationへ影響しないため対象外とする。

- `permissions`は`contents: read`だけに限定する
- checkout後のcredentialを保持しない
- Cloudflare credential、Worker Secrets、production URLをworkflowへ渡さない
- Playwrightのlocal previewには`.invalid`を含む非機密のtest専用認証値だけを渡し、production値や有効な利用者emailは使わない
- E2E previewは外部interfaceへ公開せず、IPv4 loopbackの`127.0.0.1`だけで待ち受ける
- Node.jsは`.node-version`、pnpmは`packageManager`で固定する
- external actionは公式`actions/*`だけを使い、release tagではなく完全なcommit SHAへ固定する
- 公式Node.js tarballのSHA-256を照合してNode.jsをGitHub workspace配下へ展開する
- 公式npm tarballのSHA-512 integrityをbaselineと照合してpnpmをGitHub workspace配下へ展開する
- Node.js、pnpm store、Playwright browser、XDG data、temporary fileをGitHub workspace配下へ置く
- 同じbranch/refの古いrunはcancelし、jobを25分で停止する

## Daymark integration gate

`pnpm check`の先頭でDaymark独立gate（format、lint、TypeScript、coverage付きtest、宣言付きbuild、audit）を実行する。単独cloneのCIでも同じgateを実行し、Cloudflare credentialは不要。contracts/server/schema/date処理は全指標100% coverageを維持し、React画面は単体component testと基盤側desktop/mobile E2Eで検証する。

基盤の`pnpm daymark:boundaries`は実際のVite buildでbrowser/contractsの成功とserver/schemaのbrowser build失敗を検証する。package exportsだけでなく、Vite pluginで解決後sourceのclient混入を拒否する。通常のbuildにも同じpluginを適用し、client型検査にはbrowser条件を付ける。

`/api/v1/daymark/*`を共通保護配下へ組み込み、認証・Origin・JSON・client header・Rate Limit・安全なerror・no-storeをtestする。実HTTP gateでは習慣作成、一覧、日次記録、週/月集計、記録削除、Daymark export、preview、確定、再実行no-opと既存記事APIを同じ一時D1で確認する。Daymark復元前後でTech Inbox exportの内容が変わらないことも必須とする。

local D1 gateはmigration `0002`を空DBと既存記事/タグ入りDBへ適用し、次を必須とする。

- `daymark_habits`、`daymark_habit_versions`、`daymark_records`と必要なindexが作られる
- 種類・状態・チェック/数値shape・数値上限・名称/単位長・一意性・cascadeの制約が機能する
- 同じmigrationの再適用が無変更になり、既存の記事・URL alias・タグ・タグ付けが保持される

GitHub Actionsは`submodules: true`で基盤gitlinkの固定commitを取得する。Daymarkだけのpushで基盤参照や本番を更新しない。Phase完了時は新しい作業コピーで固定commit取得・frozen install・統合test/buildも確認する。

## Coverage policy

V8 coverageはstatements、branches、functions、linesの全指標に80%の最低値を設定する。さらにURL正規化、metadata-fetcherのSSRF URL判定、契約schemaはbranch coverage 90%以上を必須にする。

2026-08-28時点の実測値:

| 対象 | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| テスト可能コード全体 | 86.05% | 81.33% | 86.13% | 87.89% |
| URL正規化 | 100% | 96.15% | 100% | 100% |
| SSRF URL判定 | 100% | 96.00% | 100% | 100% |
| 契約schema | 100% | 100% | 100% | 100% |

Phase 24追加後の基盤全体はstatements 87.80%、branches 83.67%、functions 87.94%、lines 89.31%。Daymarkのdomain・契約・日付・backup処理は全指標100%で、最低値を変更していない。React画面はcomponent testとdesktop/mobile E2Eの操作・表示検証を必須とする。

V8 unit coverageから次だけを除外する。

- `modules/daymark/src/app.tsx`: Daymark単体component testと基盤側desktop/mobile E2Eで画面の操作・表示を検証する。domain・契約・日付処理は除外せず100%を維持する。
- `apps/web/src/worker/repositories/d1-article-repository.ts`: fake DBではなく、`pnpm api:verify:local`でfreshな実D1と実HTTPを検証する。
- `apps/web/src/worker/repositories/d1-daymark-repository.ts`: 同様に、migration `0002`適用後のfreshな実D1とDaymark実HTTPフローで検証する。
- `apps/web/src/worker/d1-article-repository.integration-fixture.ts`: 上記adapterをlocal Workerから実行するtest専用entrypointとして、`pnpm api:verify:local`で検証する。
- app Workerとmetadata-fetcherの`index.ts`: runtime composition entrypointとして、生成型、typecheck、production dry-run build、統合テストで検証する。
- client `main.tsx`・`portal.tsx`・`daymark.tsx`: browser boot entrypointとしてproduction buildとPlaywrightで検証する。

除外は未検証を意味しない。対応する統合ゲートを`pnpm check`から外さない。

## Required E2E coverage

各シナリオをdesktop Chrome 1280 × 800とmobile Chrome 320 × 700の両方で実行する。

| 必須フロー | 自動検証 |
|---|---|
| URL登録、duplicate登録 | Playwright状態付きAPI mockと画面通知 |
| URL保存時のタグ付け | 既存タグ選択、その場でのタグ作成、保存直後の複数チップ表示 |
| pendingからready、metadata失敗 | 画面polling後のterminal表示 |
| 既読化、undo、未読へ戻す | 全記事一覧の状態表示と未読・既読filterの更新 |
| 検索、filter | query結果とstatus radio |
| title編集 | 編集dialogと更新後card |
| URL編集と競合 | 409 safe errorと元URL保持 |
| 削除 | 確認dialogと一覧からの削除 |
| JSON export | 実downloadファイル名、schema、内容 |
| JSON restore | file検証、preview、明示確認、追加後の記事・タグ表示、再実行時の無変更 |
| unauthorized API拒否 | mockを通らないWorker APIの401。設定欠落時の403はWorker testで確認 |
| タグの全操作 | 作成、複数付与、絞り込み、解除、名前変更、削除後の記事保持 |
| PWA配信境界 | credential付きmanifest link、standalone設定、192/512/maskable/Apple icon、manifestだけを許可するCSP、Service Worker禁止 |
| rizakura-hontai入口 | 入口では製品APIを取得しない、Tech Inbox・Daymarkへのdocument navigation、320px幅 |
| Daymark日次記録 | チェックと数値の保存、達成率更新、desktop/mobile navigation |
| Daymark履歴 | 月曜始まりの週tableと暦月カレンダーの切り替え |
| Daymark習慣管理 | チェック習慣の追加、名称・状態変更、一覧の再取得 |
| Daymark backup | 専用JSON download、4 MiB file選択、preview、明示確認、非破壊復元結果 |
| Daymark PWA配信境界 | 専用HTML/metadata、credential付きmanifest、独立id/start/scope、専用4 icon |
| URLとHTML互換 | 旧記事・設定pathのquery維持、直接設定URLのHTML、入口にmanifestなし、記事の既存idと専用scope |
| fallback境界 | 未知document・欠落assetは404、将来のAPIも未認証で401・JSON |

共通API単体testでは、製品のpath登録なしで追加handlerがJWT・Origin・JSON・client header・Rate Limitを通ることを確認する。新旧client header、HEADを含む旧記事のRate Limit分類、安全なerror/logも維持する。`scripts/platform-boundaries.test.mjs`で共通client/server moduleのstatic ESM importが業務実装を参照せず、HTTP契約が記事domainに依存しないことを確認する。

タグ機能は、UI追加前の基盤フェーズから次の実D1・実HTTP検証を必須にする。

| 必須境界 | 自動検証 |
|---|---|
| タグ名と色相の一意性 | fresh local D1のUNIQUE/CHECK制約 |
| 複数タグの関連付け | 実HTTPで作成、記事への一括設定、一覧取得 |
| 名前変更 | 正規化名の競合拒否と色相維持 |
| タグ削除 | 関連だけをcascade削除し、記事本体を保持 |
| 不正な関連付け | 存在しないタグと上限超過を安全な4xxで拒否 |
| 記事作成時のタグ関連 | 新規記事・URL alias・関連の同時保存、duplicate記事へのタグ追加 |

タグUIと統合フェーズでは、次をcomponent test、Playwright、Codex内ブラウザsmokeで確認する。

| 必須UI | 自動・ブラウザ検証 |
|---|---|
| 記事カードの色付きタグチップ | component testでタグ名と保存済み色相を確認 |
| 既存タグの選択と解除 | dialog component testで上限と一括保存を確認 |
| dialog内での新規タグ作成 | component/page testで作成後の選択と記事への保存を確認 |
| タグ絞り込み | page/service/実HTTP testで条件とcursor文脈を確認 |
| 設定画面のタグ管理 | component/page testで追加、同名案内、複数行の未保存入力保持、名前変更、削除確認、記事保持の案内を確認 |
| タグ操作の一連の状態遷移 | desktop/mobile Playwrightで作成から削除、記事保持まで確認 |
| 320 × 700 layout | Playwright E2Eに加えCodex内ブラウザで横幅超過なしを確認 |

タグ統合の実D1・実HTTP gateでは、JSON export version 2の参照整合性と、canonical URL重複統合時のタグ移動を検証する。残存記事のタグ9件と重複記事のタグ3件を統合し、残存記事が10件、移せなかった関連が2件、重複記事だけが削除され、タグ定義はすべて保持されることを必須とする。

JSON restoreの実D1・実HTTP gateでは、version 2 backupのpreviewと確定結果が一致し、記事・URL alias・タグ・タグ付けが追加されること、既存IDと色の衝突が再割り当てされること、`pending`が再取得可能な`failed`になること、同じbackupの再実行が無変更になることを確認する。repository unit testでは全insertが1回のD1 batchへ渡され、batch失敗を部分retryしないことも確認する。

Daymark restoreは専用schema、参照整合、習慣・設定履歴・記録のID衝突、同値一致、異値競合skip、冪等性を単体testで確認する。1 fileをmetadataと最大400記録のrequestへ分け、各record batchも参照整合を満たし、APIが上限超過を拒否することを検証する。D1は対象自然keyまたはIDの日次記録だけを読み、request単位のbatchで追加する。10習慣・10設定履歴・10,950記録（3年分）のpreview、確定、再preview no-op、Tech Inbox export不変を実HTTPで確認する。代表fixtureの1年3,650記録が1.12 MiB、3年10,950記録が3.36 MiB、pretty JSON 4 MiB境界が約13,046記録であることを測定し、20,000記録のexportはfile上限で明示停止するtestを維持する。

## Phase 24 platform budget gate

`scripts/phase24-platform-budget.test.mjs`は2026-09-02に再確認したCloudflare Free境界と、repository内の構成・契約上限を決定的に照合する。

- app/metadataの2 Worker、共有D1 1個、metadata QueueとDLQ 2個だけであること
- D1を直接使うのはapp Workerだけで、local/通常testのD1 bindingは`remote: false`であること
- 採用していないR2、KV、AI、Browser、Vectorize、Durable Objects、Hyperdrive、Workflows bindingがないこと
- Queue batch 1、retry 3、最大契約messageが128 KB未満であること
- Tech InboxとDaymarkのPWA id/start/scopeが独立していること
- backup requestが100 MB未満、Daymarkのbound valueが2,000,000 bytes未満、各requestのsnapshot 3 query＋write最大47が50 query以内であること
- 最大20,000記録をmetadata込み51 requestで処理し、previewのread 120/minと確定のmutate 60/min以内であること
- 最大Daymark復元の保守的な304,400 rows read、table/index込み88,600 rows writtenが日次設計予算内であること
- D1は1 database 500 MBだが、Tech Inbox全体には件数上限がないため静的な最大容量を保証しない。Phase 25でproductionの現在値を確認し、400 MBを停止閾値にする

3年分の実HTTP local gateは互換性・DB適用を検証するが、Cloudflare CPU timeの代替にはしない。Phase 25初回の単一request previewはCPU 139/197 msで停止条件に達した。最大400記録へ分割した改善版は本番で29 requestすべてstatus 200・例外0、コールド最大約12.3 ms、ウォーム後P99約9.1 msとなりCPU gateを通過した。今後も通常処理の10 ms超過が反復する場合、Error 1102、`exceededCpu`、例外が1件でもある場合は停止する。[ADR-0015](decisions/0015-free-tier-release-gates.md)と[ADR-0016](decisions/0016-batched-daymark-restore.md)を参照する。

Playwrightのmobile viewport成功は実機確認の代替にしない。手順と結果は`docs/manual-device-test.md`へ残す。

## Production configuration gate

`pnpm cloudflare:preflight`は通常の`pnpm check`から分離し、Cloudflare credentialとnetworkを持つ運用時だけ実行する。Cloudflare APIへGETだけを送り、次を検査する。

- D1、Queue、app Worker、metadata-fetcher、Access applicationが期待どおり1件ずつ存在する
- Access applicationがapp Workerだけを対象にする
- allow policyが所有者email 1件だけで、追加policy、Everyone、exclude、requireがない
- sessionが7日、app launcherが非表示である
- app Workerの`workers.dev`は有効、preview URLは無効である
- metadata-fetcherの`workers.dev`とpreview URLがともに無効である

判定ロジックはsecretを使わないfixtureでVitestへ含め、credential、account詳細、team domain、所有者emailを出力しない。

`pnpm cloudflare:health`もcredentialとnetworkを持つ運用時だけ明示実行し、通常の`pnpm check`とGitHub Actionsには含めない。Cloudflareのread-only REST/GraphQL APIから次の集計値だけを確認する。

- 通常Queueの現在backlogが0件である
- 直近24時間に新しいDLQ deliveryまたはterminal failがない
- app Workerとmetadata-fetcherのerrorとnon-success invocationが0件である
- 既存DLQ backlogは件数とbytesだけを警告し、message本文を取得・変更しない

集計・失敗判定はsecretを使わないfixtureでVitestへ含め、API応答エラー時にもcredential、account詳細、message本文を表示しない。

## Artifact size budgets

`pnpm quality:artifacts`はproduction build後に次のraw上限を検査し、gzip参考値も表示する。

| 成果物 | Raw上限 |
|---|---:|
| app Worker | 1,000,000 bytes |
| metadata-fetcher Worker | 1,000,000 bytes |
| client JavaScript合計 | 500,000 bytes |
| client CSS合計 | 100,000 bytes |

これはプラットフォーム上限ぎりぎりまで使う基準ではなく、意図しないbundle増加をPhaseごとに検出する内部budgetである。

2026-08-28のproduction build実測値:

| 成果物 | Raw | Gzip |
|---|---:|---:|
| app Worker | 433.3 KiB | 93.5 KiB |
| metadata-fetcher Worker | 578.1 KiB | 87.3 KiB |
| client JavaScript合計 | 347.1 KiB | 101.9 KiB |
| client CSS合計 | 28.0 KiB | 6.2 KiB |

## Worker CPU review

デプロイ前のCPUリスクは次の境界で抑える。

- listは1 request最大100件、request bodyは16 KiB、metadata responseは1 MiB、redirectは3回、外部fetchは8秒で打ち切る。
- metadata HTML解析はCloudflare `HTMLRewriter`のstream処理を使う。
- D1 adapterはN+1 queryを避け、exportも記事、alias、タグ、タグ関連を1回のD1 batchで取得する。
- production bundle sizeは上記budgetで継続監視する。

localのwall-clock時間はCloudflareのCPU timeと同一ではないため、実測済みのCPU timeとは記録しない。Phase 19〜24の統合版はPhase 25で本番確認した。3年分Daymark backupの単一request previewでCPU 139/197 msを検出した後、最大400記録/requestへ分割し、改善版29 requestの成功・例外0・コールド最大約12.3 ms・ウォーム後P99約9.1 msをWorkers LogsとWorkers Analyticsで確認した。

通常処理はFreeプランの10 ms/invocation以下を基準とする。`jose`のJWKS取得とJWT検証を初めて行うコールドリクエストだけは、Cloudflare公式のbuilt-in flexibilityを踏まえ、まれな発生、25 ms以下、`outcome: ok`、Error 1102と`exceededCpu`なしの場合に限り許容する。10 ms超過が3リクエスト以上連続する場合、通常処理で反復する場合、またはCPU起因の失敗が1件でもあればPhase 9を完了扱いにしない。詳細は[ADR-0004](decisions/0004-workers-free-cpu-gate.md)を参照する。

list 100件、101件以上のJSON export、export version 2のタグ参照整合性、canonical重複統合のタグ上限はservice・contract・実D1 testで決定的に検証する。1 MiB超過HTMLのstream中断とredirect 3回許可・4回拒否はmetadata-fetcher testで検証する。productionでは代表的な成功処理と安全な失敗・再試行をWorkers Logsで確認し、第三者endpoint固有のnetwork failureを境界処理の成功とは記録しない。
