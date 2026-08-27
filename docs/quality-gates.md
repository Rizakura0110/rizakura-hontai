# Quality gates

最終更新: 2026-08-27

## 標準ゲート

`pnpm check`はformat、lint、Cloudflare生成型、TypeScript、unit/component/integration test、coverage、fresh local D1、実HTTP API、production build、artifact budget、desktop/mobile Chrome E2E、dependency auditを順に実行する。

個別確認には次を使う。

```bash
pnpm test:coverage
pnpm api:verify:local
pnpm build
pnpm quality:artifacts
pnpm e2e
pnpm audit --audit-level high
```

## Coverage policy

V8 coverageはstatements、branches、functions、linesの全指標に80%の最低値を設定する。さらにURL正規化、metadata-fetcherのSSRF URL判定、契約schemaはbranch coverage 90%以上を必須にする。

2026-08-27時点の実測値:

| 対象 | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| テスト可能コード全体 | 89.50% | 85.62% | 89.49% | 90.82% |
| URL正規化 | 100% | 96.15% | 100% | 100% |
| SSRF URL判定 | 100% | 96.00% | 100% | 100% |
| 契約schema | 100% | 100% | 100% | 100% |

V8 unit coverageから次だけを除外する。

- `apps/web/src/worker/repositories/d1-article-repository.ts`: fake DBではなく、`pnpm api:verify:local`でfreshな実D1と実HTTPを検証する。
- app Workerとmetadata-fetcherの`index.ts`: runtime composition entrypointとして、生成型、typecheck、production dry-run build、統合テストで検証する。
- client `main.tsx`: browser boot entrypointとしてproduction buildとPlaywrightで検証する。

除外は未検証を意味しない。対応する統合ゲートを`pnpm check`から外さない。

## Required E2E coverage

各シナリオをdesktop Chrome 1280 × 800とmobile Chrome 320 × 700の両方で実行する。

| 必須フロー | 自動検証 |
|---|---|
| URL登録、duplicate登録 | Playwright状態付きAPI mockと画面通知 |
| pendingからready、metadata失敗 | 画面polling後のterminal表示 |
| 既読化、undo、未読へ戻す | 未読一覧と既読filterの更新 |
| 検索、filter | query結果とstatus radio |
| title編集 | 編集dialogと更新後card |
| URL編集と競合 | 409 safe errorと元URL保持 |
| 削除 | 確認dialogと一覧からの削除 |
| JSON export | 実downloadファイル名、schema、内容 |
| unauthorized API拒否 | mockを通らないWorker APIの403 |

Playwrightのmobile viewport成功は実機確認の代替にしない。手順と結果は`docs/manual-device-test.md`へ残す。

## Artifact size budgets

`pnpm quality:artifacts`はproduction build後に次のraw上限を検査し、gzip参考値も表示する。

| 成果物 | Raw上限 |
|---|---:|
| app Worker | 1,000,000 bytes |
| metadata-fetcher Worker | 1,000,000 bytes |
| client JavaScript合計 | 500,000 bytes |
| client CSS合計 | 100,000 bytes |

これはプラットフォーム上限ぎりぎりまで使う基準ではなく、意図しないbundle増加をPhaseごとに検出する内部budgetである。

2026-08-27のproduction build実測値:

| 成果物 | Raw | Gzip |
|---|---:|---:|
| app Worker | 409.1 KiB | 89.2 KiB |
| metadata-fetcher Worker | 571.9 KiB | 86.2 KiB |
| client JavaScript合計 | 327.8 KiB | 98.4 KiB |
| client CSS合計 | 27.1 KiB | 6.1 KiB |

## Worker CPU review

デプロイ前のCPUリスクは次の境界で抑える。

- listは1 request最大100件、request bodyは16 KiB、metadata responseは1 MiB、redirectは3回、外部fetchは8秒で打ち切る。
- metadata HTML解析はCloudflare `HTMLRewriter`のstream処理を使う。
- D1 adapterはN+1 queryを避け、exportも記事とaliasを1回のD1 batchで取得する。
- production bundle sizeは上記budgetで継続監視する。

localのwall-clock時間はCloudflareのCPU timeと同一ではないため、実測済みのCPU timeとは記録しない。Phase 9の限定deploy許可後、Workers LogsまたはCloudflare dashboardでapp Workerとmetadata-fetcherのCPU timeを確認し、Freeプランの10 ms/invocation基準を超えるrequestがあればPhase 9を完了扱いにしない。特にlist 100件、JSON export、1 MiB HTML、redirect 3回を確認対象にする。
