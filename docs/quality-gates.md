# Quality gates

最終更新: 2026-08-28

## 標準ゲート

`pnpm check`はformat、lint、Cloudflare生成型、TypeScript、unit/component/integration test、coverage、fresh local D1、実HTTP API、production build、artifact budget、desktop/mobile Chrome E2E、dependency auditを順に実行する。

2026-08-28のPhase 11最終実行では、Vitest 30 files・325 tests、Playwright desktop/mobile合計18 testsが成功した。

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
- Node.jsは`.node-version`、pnpmは`packageManager`で固定する
- external actionは公式`actions/*`だけを使い、release tagではなく完全なcommit SHAへ固定する
- 公式Node.js tarballのSHA-256を照合してNode.jsをGitHub workspace配下へ展開する
- 公式npm tarballのSHA-512 integrityをbaselineと照合してpnpmをGitHub workspace配下へ展開する
- Node.js、pnpm store、Playwright browser、XDG data、temporary fileをGitHub workspace配下へ置く
- 同じbranch/refの古いrunはcancelし、jobを25分で停止する

## Coverage policy

V8 coverageはstatements、branches、functions、linesの全指標に80%の最低値を設定する。さらにURL正規化、metadata-fetcherのSSRF URL判定、契約schemaはbranch coverage 90%以上を必須にする。

2026-08-28時点の実測値:

| 対象 | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| テスト可能コード全体 | 86.05% | 81.33% | 86.13% | 87.89% |
| URL正規化 | 100% | 96.15% | 100% | 100% |
| SSRF URL判定 | 100% | 96.00% | 100% | 100% |
| 契約schema | 100% | 100% | 100% | 100% |

V8 unit coverageから次だけを除外する。

- `apps/web/src/worker/repositories/d1-article-repository.ts`: fake DBではなく、`pnpm api:verify:local`でfreshな実D1と実HTTPを検証する。
- `apps/web/src/worker/d1-article-repository.integration-fixture.ts`: 上記adapterをlocal Workerから実行するtest専用entrypointとして、`pnpm api:verify:local`で検証する。
- app Workerとmetadata-fetcherの`index.ts`: runtime composition entrypointとして、生成型、typecheck、production dry-run build、統合テストで検証する。
- client `main.tsx`: browser boot entrypointとしてproduction buildとPlaywrightで検証する。

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
| unauthorized API拒否 | mockを通らないWorker APIの403 |
| タグの全操作 | 作成、複数付与、絞り込み、解除、名前変更、削除後の記事保持 |

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

localのwall-clock時間はCloudflareのCPU timeと同一ではないため、実測済みのCPU timeとは記録しない。Phase 9の限定deploy許可後、Workers LogsまたはCloudflare dashboardでapp Workerとmetadata-fetcherのCPU timeを確認する。

通常処理はFreeプランの10 ms/invocation以下を基準とする。`jose`のJWKS取得とJWT検証を初めて行うコールドリクエストだけは、Cloudflare公式のbuilt-in flexibilityを踏まえ、まれな発生、25 ms以下、`outcome: ok`、Error 1102と`exceededCpu`なしの場合に限り許容する。10 ms超過が3リクエスト以上連続する場合、通常処理で反復する場合、またはCPU起因の失敗が1件でもあればPhase 9を完了扱いにしない。詳細は[ADR-0004](decisions/0004-workers-free-cpu-gate.md)を参照する。

list 100件、101件以上のJSON export、export version 2のタグ参照整合性、canonical重複統合のタグ上限はservice・contract・実D1 testで決定的に検証する。1 MiB超過HTMLのstream中断とredirect 3回許可・4回拒否はmetadata-fetcher testで検証する。productionでは代表的な成功処理と安全な失敗・再試行をWorkers Logsで確認し、第三者endpoint固有のnetwork failureを境界処理の成功とは記録しない。
