# Operations

最終更新: 2026-08-29

## 運用原則

- productionの変更は所有者の明示許可、対象resource、target branch、credential、費用gateを確認してから行う
- API token、Access設定値、個人email、JWT、cookieをfile、command引数、logへ残さない
- remote migration、restore、Queue purge、rollbackは通常の`pnpm check`へ含めない
- migrationとdeploy前にGit diff、生成物のignore、secret候補、backupまたは復元手段を確認する
- Workers Paidや新しい有料productを勝手に有効化しない
- metadata取得失敗は記事全体の障害とせず、URLを保持する

## 日常運用

### Backup

設定画面の「JSONを書き出す」から、少なくとも重要な変更前と定期的にbackupを取得します。exportには記事、URL alias、タグ、タグ付けが含まれ、認証情報やCloudflare設定は含まれません。download後はprivate dataとして安全な場所へ保存し、不要になった古いcopyを適切に削除してください。

最低限、次の前に新しいexportを取得します。

- production migration
- 大量の編集・削除
- D1 Time Travel restore
- schemaまたはcanonical統合ruleの変更

### JSON backupの復元

設定画面の「JSONバックアップから復元」では、Tech Inboxのschema version 1または2のJSONを最大1 MiBまで読み込めます。「復元内容を確認」で追加・一致・スキップ件数を確認し、確認checkboxを選んでから「安全に復元する」を実行します。

- 既存の記事、URL alias、タグ、タグ付けは更新・削除しない
- 同じoriginal URLの記事と同じ正規化名のタグは既存recordへ対応付ける
- 既存recordと異なる記事を指すURL alias、100タグ上限、1記事10タグ上限を超える関連はスキップし、件数を表示する
- IDまたはタグ色が既存値と衝突する新規recordは、server側で未使用値へ割り当て直す
- `pending`だった復元記事はQueueへ暗黙に再投入せず、URLを保持した`failed`へ変更する。必要な記事だけカードの再取得を実行する
- 確定時に最新D1状態から計画を再計算し、すべての追加をD1の単一batchで適用する。予期しないconstraint conflictではbatch全体を失敗させる

復元前にも現在のJSON exportを別名で保存します。preview後に別操作でデータが変わると確定結果の件数が変わり得るため、完了messageと更新後の件数を確認してください。同じbackupを再実行しても一致扱いとなり、重複recordは作成されません。JSONには記事情報が含まれるため、第三者へ送信したり公開場所へ置いたりしません。

### Queueとmetadata

Cloudflare dashboardのQueuesで次を確認します。

- `tech-inbox-metadata`: idle時のbacklogが解消すること
- consumer errorとretryが継続していないこと
- `tech-inbox-metadata-dlq`: messageが増えていないこと

Queuesのdashboard metricsではbacklog messages、backlog bytes、message operationを確認できます。DLQ messageは所有データ由来の可能性があるため、由来を確認せずpurgeしません。個別記事のmetadata失敗は画面の再取得を使用し、URLやtitleの手動利用を継続できます。

API tokenとaccount IDをprocess environmentへ設定した運用端末では、[Cloudflare Queues metrics API](https://developers.cloudflare.com/queues/observability/metrics/)とWorkers Analyticsの集計値だけを使う読み取り専用checkを実行できます。

```bash
pnpm cloudflare:health
```

このcommandは現在の通常Queue backlogと、直近24時間の新しいDLQ/fail、app Workerとmetadata-fetcherのerror・non-success invocationを失敗条件にします。以前から保持されているDLQ backlogは件数とbytesだけを警告し、message本文のpull、ack、retry、purgeは行いません。出力にはcredential、account詳細、記事情報、所有者情報を含めません。trafficがないWorkerは0件のまま正常とし、実行のたびに過去24時間を評価します。

読み取り専用のresource確認には次を使用できます。

```bash
pnpm --dir apps/web exec wrangler queues info tech-inbox-metadata
pnpm --dir apps/web exec wrangler queues info tech-inbox-metadata-dlq
```

delivery停止や`wrangler queues purge`はremote stateを変更します。incident対応として必要な場合だけ、対象Queueと影響を確認し、所有者の明示許可後に実行します。

### Logs

Cloudflare dashboardのWorkers & Pagesから、`tech-inbox-app`と`tech-inbox-metadata-fetcher`のObservabilityを確認します。見る項目はstatus、outcome、exception、CPU time、Queue eventです。

短時間のlive確認例:

```bash
pnpm --dir apps/web exec wrangler tail tech-inbox-app --format json --sampling-rate 0.999
pnpm --dir apps/web exec wrangler tail tech-inbox-metadata-fetcher --format json --sampling-rate 0.999 --config ../../workers/metadata-fetcher/wrangler.jsonc
```

通常requestは10 ms CPU以下を基準とします。JWKS取得を伴うまれなcold requestだけは、25 ms以下、`outcome: ok`、Error 1102・`exceededCpu`・例外なしの場合に許容します。通常処理で10 ms超過が反復する場合は、polling、metadata再試行、Queue投入、取得項目を先に削減します。

logへURL、query/body、JWT、email、secretを追加しません。調査結果を共有する前にもredactを確認します。

## Release手順

### 1. Preflight

```bash
git status --short
git branch --show-current
git remote -v
pnpm check
pnpm cloudflare:preflight
```

`pnpm cloudflare:preflight`はCloudflare APIへGETだけを送り、credential値を表示しません。対象accountのD1、Queue、Worker、Access applicationの存在に加え、Accessがapp Workerだけを対象にし、所有者email 1件だけを許可し、7日session、launcher非表示であることを検査します。app Workerは`workers.dev`有効・preview無効、metadata-fetcherは`workers.dev`・previewとも無効であることも検査します。

- `main`と個人remoteが意図した対象であること
- working treeに無関係な変更がないこと
- high/critical advisoryが0件であること
- CloudflareのD1、Queue、Worker、Access applicationと上記の認証・公開境界が一致すること
- 課金同意やPaid必須表示がないこと
- API tokenが対象accountと必要権限に限定されていること

### 2. Migration

新しいmigrationがない場合は実行しません。ある場合はSQL、対象database名`tech-inbox`、productionであることを表示し、JSON exportまたはTime Travel bookmarkを取得してから実行します。

```bash
pnpm db:verify:local
pnpm api:verify:local
pnpm --dir apps/web exec wrangler d1 time-travel info tech-inbox
pnpm --dir apps/web exec wrangler d1 migrations list tech-inbox --remote
pnpm --dir apps/web exec wrangler d1 migrations apply tech-inbox --remote
```

destructive migrationは1回で削除せず、column/table追加、移行、検証、後続releaseで削除の段階へ分けます。remote migration後はmigration履歴と必要な件数だけをread-only queryで確認し、記事URLやtitleをterminalへ出しません。

### 3. Deploy

metadata-fetcherに変更がある場合だけ先にdeployします。

```bash
pnpm --dir apps/web exec wrangler deploy --config ../../workers/metadata-fetcher/wrangler.jsonc
pnpm --dir apps/web exec wrangler deploy
```

app deploy outputで既存のD1、Queue、Service Binding、Rate Limiting、production変数が維持されていることを確認します。deployment version IDを控えます。新規resource作成、remote migration、billing変更はdeploy許可へ暗黙に含めません。

### 4. Smoke test

1. 未認証のrootと記事APIがCloudflare Accessへredirectする。
2. 所有者がCloudflare login後に全記事画面と設定画面を表示できる。
3. 変更した機能だけを最小限操作し、既存データを不用意に変更しない。
4. metadata変更時は安全な記事1件でpendingからreadyまたは安全なfailedへ進む。
5. Workers LogsでError 1102、`exceededCpu`、exception、継続する5xxがない。
6. 一時データを作った場合は削除し、件数だけで残存がないことを確認する。
7. version、binding維持、Access結果、smoke結果を`docs/progress.md`へ記録する。

## Worker rollback

rollbackは即時にproduction trafficを過去versionへ切り替えるremote変更です。所有者の明示許可と、戻すversion IDの確認後だけ実行します。

```bash
pnpm --dir apps/web exec wrangler deployments list
pnpm --dir apps/web exec wrangler deployments status
pnpm --dir apps/web exec wrangler rollback VERSION_ID --message "reason without secrets"
```

version IDを省略すると直前versionが選ばれるため、事故防止のため明示します。rollbackはlocal sourceやGitを戻さず、D1 migrationも戻しません。rollback後はAccess、API、認証済み画面、binding、logsを再確認し、Git側には原因修正または明示的なrevert commitを作成します。

公式手順: [Wrangler rollback](https://developers.cloudflare.com/workers/wrangler/commands/workers/#rollback)

## D1 backupとTime Travel

Cloudflare D1 Time Travelは自動で有効になり、production backendのdatabaseをpoint-in-time restoreできます。2026-08-28確認時点でWorkers Freeの保持期間は7日、Paidは30日です。保持期間外に備える長期backupはアプリのJSON exportを使用します。

bookmark確認:

```bash
pnpm --dir apps/web exec wrangler d1 time-travel info tech-inbox
pnpm --dir apps/web exec wrangler d1 time-travel info tech-inbox --timestamp="RFC3339_UTC_TIMESTAMP"
```

restoreはdatabaseをその場で上書きし、実行中queryを中断する破壊的操作です。通常運用では実行しません。必要な場合は次をすべて満たしてから、表示される確認promptを読んで実行します。

1. incidentの時刻と影響を特定する。
2. 現在のbookmarkとJSON exportを保存する。
3. 対象がproductionの`tech-inbox`であることを再確認する。
4. restore先のtimestampまたはbookmarkをread-onlyの`info`で確認する。
5. 所有者の明示許可を得る。

```bash
pnpm --dir apps/web exec wrangler d1 time-travel restore tech-inbox --bookmark=CONFIRMED_BOOKMARK
```

restore結果が返すprevious bookmarkを保存すると、必要に応じてrestore自体を戻せます。復旧後はmigration履歴、記事・alias・タグ・関連の参照整合、アプリ表示を確認します。

公式手順: [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)

## 障害切り分け

| 症状 | 最初に確認するもの | 安全な対処 |
|---|---|---|
| 未認証でアプリが見える | Access applicationとAll traffic policy | data操作を止め、Accessを復旧してから再確認 |
| login後も401/403 | Access session、Audience、team domain、email完全一致、Worker Secrets | 実値を出力せず設定を再登録し、appだけ再deploy |
| APIが503 | binding欠落、D1、Rate Limiting、設定不足、Workers Logs | fail closedを維持し、binding差分を修正 |
| 記事保存が失敗 | safe error code、D1、request Origin、Rate Limit | retry前に重複登録や429を確認 |
| metadataだけ失敗 | articleのerror code、Queue backlog、DLQ、fetcher logs | URLを保持し、画面から再取得またはtitle手動編集 |
| Queue backlogが減らない | consumer deployment、exception、retry、delivery pause | 原因を直し、purgeせずdeliveryを再開 |
| deploy後に画面が壊れた | current version、Static Assets、browser console、CSP | 既知versionへrollbackし、Gitで修正 |
| 誤削除・誤更新 | incident時刻、JSON export、Time Travel bookmark | 書き込みを止め、restore前に影響を確認 |
| CPU errorまたは継続超過 | route、cold/warm、Queue event、HTML size | 頻度・再試行・取得項目を削減し、Paidへ自動移行しない |

## 定期確認

月1回または大きなrelease前に次を確認します。

- `pnpm audit --audit-level high`と既知moderate advisoryの上流状況
- Workers、D1、Queues、Access、Rate LimitingのFreeプラン条件
- Workers request、CPU、D1 rows read/write、Queue operationが無料枠内であること
- Queue backlog、DLQ、Worker exception
- Access policyが所有者email 1件だけで、bypassがないこと
- API tokenと不要sessionの失効
- JSON exportの取得日と復元可能性

参照:

- [Cloudflare setup](cloudflare-setup.md)
- [Security](security.md)
- [Queue metrics](https://developers.cloudflare.com/queues/observability/metrics/)
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
