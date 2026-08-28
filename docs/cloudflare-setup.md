# Cloudflare setup

## Phase 0 cost baseline

確認日: 2026-08-26

この時点ではCloudflareアカウントへのログイン、リソース作成、設定変更、課金プラン変更、デプロイを行っていない。

| 製品・機能 | Freeプランの確認結果 | 初期版での扱い | 公式情報 |
|---|---|---|---|
| Workers | 100,000 requests/day、10 ms CPU/invocation | 2 Worker構成で使用 | [Pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Static Assets | Workers Freeの制限内で利用可能 | React SPAをapp Workerと同一originで配信 | [Limits](https://developers.cloudflare.com/workers/platform/limits/) |
| D1 | 5 million rows read/day、100,000 rows written/day | 1人用記事DBとして使用 | [Pricing](https://developers.cloudflare.com/workers/platform/pricing/#d1) |
| Queues | 10,000 operations/day、Freeのretentionは24時間 | metadata処理とDLQに使用 | [Pricing](https://developers.cloudflare.com/queues/platform/pricing/) |
| Cloudflare Access | Freeは50 usersまで | 許可メールアドレス1件だけ | [Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/) |
| Service Bindings | Worker間呼び出しとして公式サポート。subrequestに算入 | fetcherを非公開で呼ぶ | [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) |
| Worker Rate Limiting API | Wrangler 4.36.0以上が必要。独立した有料SKUの記載は確認されなかった | Phase 6でlocal設定し、Phase 9直前にアカウント上の追加課金有無を再確認 | [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) |

## Cost gate

- Workers Paid、独自ドメイン、その他の有料製品は有効化しない。
- Free枠超過時はmetadata頻度、再試行、polling、取得項目を先に削減する。
- Rate Limiting Bindingを含め、リモート設定前に料金ページとCloudflare dashboard表示を再確認する。
- 課金同意画面または有料プラン必須表示が出た場合は処理を中止し、`docs/decision-needed.md`へ記録する。

## Phase 9 pre-deploy gate

確認日: 2026-08-27

デプロイ直前に公式情報を再確認し、初期版の想定利用量は引き続きFreeプラン内に収まると判断した。

| 製品・機能 | Freeプランの再確認結果 | Phase 9の停止条件 | 公式情報 |
|---|---|---|---|
| Workers | 100,000 requests/day、10 ms CPU/invocation、128 MB memory、3 MB Worker size。まれな超過にはbuilt-in flexibilityあり | Paidへの変更、有料利用への同意、Error 1102、`exceededCpu`、または10 ms超過の継続 | [Pricing](https://developers.cloudflare.com/workers/platform/pricing/)、[Limits](https://developers.cloudflare.com/workers/platform/limits/)、[ADR-0004](decisions/0004-workers-free-cpu-gate.md) |
| D1 | 5 million rows read/day、100,000 rows written/day、合計5 GB。Free上限超過時は追加課金ではなく処理失敗 | Paidへの変更、想定外の既存database、migration対象の不一致 | [Pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Queues | 10,000 operations/day、retention 24時間 | Paidへの変更、retention延長を求める課金表示 | [Pricing](https://developers.cloudflare.com/queues/platform/pricing/)、[Limits](https://developers.cloudflare.com/queues/platform/limits/) |
| Access | 所有者のemail 1件だけを許可する | Everyone、domain全体、bypass、想定外のidentity providerを必要とする構成 | [Workers向けAccess](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)、[Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/) |
| Worker Rate Limiting API | 現行のWorkers bindingとして公式サポートされ、Wrangler 4.36.0以上が必要。本repositoryは4.124.0 | dashboardまたはdeploy時に追加料金・Paid必須の表示 | [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) |

### Remote authorization prerequisites

`wrangler login`は使用しない。Cloudflareの値はrepository内のファイル、command引数、issue、commit、logへ保存せず、実行プロセスへ次の環境変数として渡す。

- `CLOUDFLARE_API_TOKEN`: Phase 9だけに使う短期のcustom API token
- `CLOUDFLARE_ACCOUNT_ID`: 配置先を一意にする32文字のaccount ID
- `TECH_INBOX_ALLOWED_EMAIL`: Accessで許可する所有者email 1件

tokenは対象account 1件だけへ限定し、有効期限をPhase 9の作業期間に絞る。必要権限は次のとおりで、Billing、zone DNS、Workers KV、R2等は付与しない。

- Account Settings: Read
- Workers Scripts: Edit
- Workers Tail: Read
- D1: Edit
- Queues: Edit
- Access: Apps and Policies: Edit
- Access: Organizations, Identity Providers, and Groups: Read

リモート操作前にtoken、account、Zero Trust organizationを読み取り専用で検証し、既存の同名D1、Queue、Worker、Access applicationを列挙する。既存リソースがある場合は内容を確認せず上書きしない。Zero Trust organizationが未作成なら、team domainをユーザーが選ぶdashboard onboardingで一旦停止する。

remote migrationの直前には`tech-inbox`とproduction対象であることを表示する。app WorkerはAccess applicationとemail完全一致policyの作成後まで本番データを入れず、保護前のURLを文書へ残さない。課金同意画面またはPaid必須表示が出た場合は、その場でPhase 9を停止する。

## Phase 9 production deployment

実施日: 2026-08-27

- D1 `tech-inbox`をAPACへ作成し、`0000_cloudy_karen_page.sql`をremote production databaseへ適用した。
- Queue `tech-inbox-metadata`とDLQ `tech-inbox-metadata-dlq`を作成し、Freeのretention 24時間を設定した。
- `tech-inbox-metadata-fetcher`を`workers_dev: false`、preview URL false、public routeなしでdeployした。D1、Queue、Secrets bindingは持たない。
- `tech-inbox-app`へD1、Queue、Service Binding、5種類のRate Limiting binding、production originを設定してdeployした。
- app WorkerのAll trafficをWorker-level Access applicationで保護した。Allow policyは所有者email 1件への完全一致だけで、session durationは7日、preview URLは無効、app launcher表示も無効とした。
- `TEAM_DOMAIN`、`POLICY_AUD`、`ALLOWED_EMAIL`をWorker Secretsとして登録した。実値はrepository、command引数、logへ保存していない。
- 未認証のrootと記事APIがともにAccess loginへ302となることを確認した。
- 許可された所有者がCloudflare loginから入り、一覧表示、URL登録、pendingからready、検索、既読化とundo、title編集、JSON export、削除をdesktop Chromeで確認した。
- final deploymentはガイド指定の`jose`でAccess JWTを再検証する。最終版の再読み込みと認証付き一覧表示を所有者が確認した。
- 2026-08-28に未読専用画面を削除したUIを既存app Workerへ再deployした。新規resourceは作成せず、`/`は全記事画面へredirectし、未読・既読filterは維持した。deployment versionは`e1c03d86-0314-42c2-9676-4109e0c8c2c1`である。
- 2026-08-28にタグ機能用migration `0001_swift_rockslide.sql`を同じremote D1へ適用し、タグUI・export schema version 2・canonical重複時のタグ統合を含むapp Workerをdeployした。deployment versionは`44b7011a-e46e-4f2b-b040-1c675925a560`である。適用直後のremote D1は記事0件、タグ0件、関連0件で、未認証root/APIのAccess 302とownerの認証済み表示を確認した。
- 2026-08-28にownerの明示許可を得て、URL保存フォームでの既存タグ選択・新規タグ作成と記事への同時割り当てを既存app Workerへdeployした。DB migrationと新規resource作成はなく、既存bindingを維持した。deployment versionは`948efd5a-da7e-4cc3-9409-197418317d25`で、未認証root/APIはいずれもAccessへ302となった。
- 2026-08-28に設定画面で1件保存した際に別タグの未保存名が戻る問題を修正したcommit `a47add2`を既存app Workerへdeployした。DB migrationと新規resource作成はなく、既存bindingを維持した。deployment versionは`3e3a02bf-d6b0-40ea-9dec-8fb37b1f0e3a`で、未認証root/APIはいずれもAccessへ302となった。ownerの認証済み画面確認は後続deploymentへ引き継いだ。
- 2026-08-28に設定画面のタグ管理から新規タグを追加できるcommit `aa9dc59`を既存app Workerへdeployした。DB migrationと新規resource作成はなく、既存bindingを維持した。deployment versionは`ce9014c2-9cd4-4a73-b59c-2fceb1a4a30f`で、未認証root/APIはいずれもAccessへ302となった。ownerが認証済み設定画面で「新しいタグ名」と「追加」フォームの表示を確認した。
- Workers Logsでappのwarm requestは2〜7 ms、metadata-fetcherは最大4 ms、認証を伴うcold requestは14〜21 msだった。すべて`outcome: ok`で、Error 1102、`exceededCpu`、例外はなかった。判定基準は[ADR-0004](decisions/0004-workers-free-cpu-gate.md)に記録した。
- Phase 9ではWorkers Paidやその他の有料製品を新たに有効化していない。API tokenにBilling Readを与えていないため、accountに以前から存在するsubscriptionの有無はrepositoryから断定せず、ownerがdashboardのBilling画面で確認する。

## Phase 1 local configuration

- `apps/web`はCloudflare Vite pluginでReact SPAとHono Workerを同時にbuildする。
- Static Assetsは`not_found_handling: "single-page-application"`を使用し、`/api/*`だけを`run_worker_first`でWorkerへ送る。
- `/api/v1/health`は`Cache-Control: no-store`、JSON body、request IDを返す。
- Binding型は`wrangler types --env-interface CloudflareBindings`で`worker-configuration.d.ts`へ生成し、`--check`を品質ゲートへ含める。`@cloudflare/workers-types`をdirect dependencyにはしない。
- `compatibility_date`は同梱workerdに合わせて`2026-08-15`へ固定した。詳細は[ADR-0002](decisions/0002-cloudflare-compatibility-date.md)を参照する。
- `vite preview`で`/`、SPA fallback、health API、未知APIの応答を確認した。
- Cloudflareアカウントへのログイン、リソース変更、デプロイは行っていない。

## Phase 2 local D1 configuration

- `apps/web/wrangler.jsonc`へ`DB` bindingを追加し、local database名を`tech-inbox`とした。
- migration directoryは`packages/db/migrations`へ固定した。
- Phase 2では`database_id`を設定せず、bindingの`remote`も`false`としている。
- `pnpm db:migrate:local`は、Vite devと共有する無視対象の`apps/web/.wrangler/state`へlocal D1状態を永続化する。
- `pnpm db:verify:local`は、`.tmp`配下のfreshな一時状態へmigrationを適用し、履歴、table、index、CHECK、一意制約、外部キー、cascade、再適用を検証後に一時状態を削除する。
- D1設定から`CloudflareBindings`を再生成し、`DB: D1Database`が含まれることを確認した。
- Cloudflareアカウントへのログイン、remote D1作成、remote migration、デプロイは行っていない。

## Phase 3 local API verification

- 通常のlocal開発では`apps/web/.dev.vars.example`を`apps/web/.dev.vars`へコピーし、実際にブラウザで開くoriginへ`APP_ORIGIN`を合わせる。`.dev.vars`自体はcommitしない。
- `pnpm api:verify:local`はprojectの`.tmp`配下だけにfreshなD1永続領域と一時Wrangler設定を作成する。
- 一時設定はassetsを含めず、現在の`apps/web/src/worker/index.ts`を直接起動する。これによりVite build後のredirected deploy configや古い`dist`へ依存せず、編集対象のWorkerを検証する。
- local起動時だけ`ENVIRONMENT=local`と一時HTTP originを`APP_ORIGIN`として渡す。個人情報やsecretは作成しない。
- migration適用後にCRUD、同時重複、pagination、search/filter/sort、入力防御を実HTTPとD1で検証し、終了時はWorkerを停止して一時領域を削除する。
- 通常の`apps/web/wrangler.jsonc`、local D1共有状態、remote resource、`database_id`は変更しない。

## Phase 5 local Queue and metadata fetcher configuration

- app Workerは`METADATA_QUEUE` producerと同じQueueのconsumerを持ち、consumerはbatch size 1、最大3回のnative retry、固定5秒delay、`tech-inbox-metadata-dlq`を設定している。
- app Workerの`METADATA_FETCHER` Service Bindingは`tech-inbox-metadata-fetcher`を参照する。
- metadata fetcherは`workers_dev: false`、`preview_urls: false`で、D1、Queue、Secrets bindingを持たない。
- Viteは`workers/metadata-fetcher/wrangler.jsonc`をauxiliary Workerとして読み込み、local開発とbuildでService Binding先を同時に構成する。
- `pnpm build`はViteのmulti-Worker build後、fetcher単体の`wrangler deploy --dry-run`を実行する。これは構成検証だけでありdeployしない。
- Queue、DLQ、remote WorkerはPhase 9まで作成しない。現在の名前は将来のremote設定用で、local開発ではWranglerのlocal simulationを使用する。

## Phase 6 Access and security configuration

### Repository implementation

- 記事APIは`ENVIRONMENT=local`の完全一致に加え、`APP_ORIGIN`とrequest originが一致するHTTP loopback originの場合だけlocal principalへ迂回する。それ以外の環境名、未設定、大小文字違い、公開originでは必ずCloudflare Access JWT検証へ進む。
- `Cf-Access-Jwt-Assertion`を`jose`で検証し、RS256署名、`iss`、`aud`、`exp`、任意の`nbf`、`sub`、許可emailの完全一致を必須にした。JWKSは`TEAM_DOMAIN/cdn-cgi/access/certs`から取得し、issuer単位でmodule scopeに再利用する。
- `TEAM_DOMAIN`はHTTPSの`*.cloudflareaccess.com` originだけ、`POLICY_AUD`と`ALLOWED_EMAIL`は空でない値だけを受け付ける。非localで設定不足の場合はfail closedとする。
- business serviceへJWT payloadを渡さず、検証済みの`AuthPrincipal`へ変換して認証方式との依存をmiddleware内に閉じ込めた。
- Worker Rate Limiting bindingはcreate 30/min、metadata retry 10/min、update/delete 60/min、list/get 120/minに分離した。keyはAccess subjectとemailをSHA-256化した値と固定route categoryだけで、生の識別子をbindingやlogへ渡さない。
- binding欠落はlocalだけ許容し、非localでは503でfail closedとする。Rate Limiting APIはlocationごとのeventually consistentな仕組みなので、認証や厳密なglobal quotaの代替にはしない。
- Static Assetsには`public/_headers`、Worker APIにはmiddlewareで同じCSP、frame、MIME sniffing、referrer、permissions、cross-origin isolation、HSTS、robots用headerを設定した。Static Assetsの`_headers`はWorker responseへ適用されないため、両方を別に設定している。
- `public/robots.txt`は全crawlerを拒否する。metadata-fetcherは引き続き`workers_dev: false`、`preview_urls: false`で、公開routeを持たない。
- Cloudflare accountへのlogin、Access application作成、secret設定、remote binding変更、deployは行っていない。

公式資料:

- [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Protect a Worker with Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Static Assets custom headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Preview URLs and Access](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)

### Phase 9 remote setup checklist

次の操作はdeploy許可を受けたPhase 9で行う。実値をcommit、issue、logへ残さない。

1. Zero Trustでapp Worker用のAccess applicationを作成し、production custom domain、`workers.dev`、preview URLを含む`All traffic`を保護する。previewを使用しない場合は無効のままにする。
2. Allow policyは所有者のemailアドレス1件への完全一致だけにする。Everyone、email domain全体、任意OTP利用者、bypass policyは追加しない。認証元accountのMFAを有効にし、session durationはguide指定の7日とする。
3. Access applicationのAudience tagとteam domainを控え、`TEAM_DOMAIN`、`POLICY_AUD`、`ALLOWED_EMAIL`をWorker Secretsとして登録する。例は`pnpm --dir apps/web exec wrangler secret put TEAM_DOMAIN`で、値は対話入力する。
4. `ENVIRONMENT=production`と、scheme・host・portを含む公開origin完全値を`APP_ORIGIN`へ設定する。previewを別originで変更APIまで検証する場合は、preview専用environmentでそのoriginを明示する。
5. Rate Limiting bindingの追加料金表示がないことを料金ページとdashboardで再確認する。有料プランや課金同意が必要なら設定を止め、`docs/decision-needed.md`へ記録する。
6. deploy前にmetadata-fetcherのpublic route、`workers.dev`、preview URLが無効であることを再確認する。
7. deploy後、未認証、audience不一致、許可email不一致、期限切れJWTが拒否され、許可emailだけがproductionと使用対象previewへ入れることを確認する。変更APIは不正Origin、JSON以外、custom header欠落が拒否されることも確認する。

## Phase 7 local export configuration

- `GET /api/v1/export`は記事APIと同じAccess JWT再検証を通し、export専用Rate Limiting bindingを5 requests/minuteで設定した。binding keyはPhase 6と同じくAccess principalのhashと固定route categoryだけを使用する。
- exportはD1から全記事、全URL alias、全タグ、記事とタグの関連を同一batchで読み、`schemaVersion: 2`のJSONとして返す。clientは既存の`schemaVersion: 1`も検証できる。API responseは`no-store`で、UTC日付を含むASCII filenameの`Content-Disposition: attachment`を付ける。
- 設定画面は検証済みexport responseから保存記事数と未読記事数を表示する。同じresponseをBlobへ変換してdownloadするため、画面表示とdownloadでRate Limiting枠を二重消費しない。
- export contractは公開用の記事DTO、URL alias、タグ、記事とタグの関連だけを許可し、JWT、email、Worker設定、内部errorを受け入れないstrict schemaとした。
- remote Rate Limiting bindingの変更、deploy、Cloudflare accountへのloginは行っていない。Phase 9で既存4 bindingと合わせてexport bindingの料金表示を再確認する。

## Phase 10 operations references

- 現在のproduction構成、Access保護、secret、fetcher分離、残余リスクは[Security](security.md)を正とする。
- release、migration、rollback、D1 Time Travel、Queue、DLQ、Workers Logs、定期確認は[Operations](operations.md)に集約した。
- remote migration、deploy、rollback、restore、Queue pause・purgeは品質ゲートへ含めず、対象と影響を確認した明示的な運用操作としてだけ実行する。
- Access保護前のURL、production URL、secret実値、個人email allowlistはREADMEや運用文書へ記録しない。
