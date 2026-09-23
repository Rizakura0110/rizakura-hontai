# Cloudflare名称移行とTech Inbox分離

最終更新: 2026-09-23。Phase 29〜34完了。Phase 31は承認後の同一Worker改名・Access表示名・新origin反映が成功し、保存/Queue配送を再開済み。所有者のPC表示・保存と2 PWA確認も成功した。D1はPhase 30の新DBのままで、旧DBは接続せず保持し、削除は別途承認待ち。Phase 32のpackage整理、Phase 33の固定submodule化と後続CIの補修、Phase 34の既存2 Workerへの本番反映と所有者確認も完了した。

## 実行順と境界

| Phase | 作業 | 完了条件 |
|---|---|---|
| 29 | 読み取りinventory、非公開backup、local復元予行、切り戻し設計 | remote変更なしで復元・照合手順を検証 |
| 30 | 新D1 `rizakura-hontai`へ両製品をコピーし、DB bindingを切替 | 現在のURLで両製品が動作し、全データ・履歴を維持 |
| 31 | Worker/Access表示名・origin・PWA切替 | 本人限定認証、新URL、2つのPWAを確認 |
| 32 | 現repository内でTech Inboxと基盤の依存を整理 | 機能/API/DBを変えず、製品単体testが可能 |
| 33 | Tech Inboxを別repositoryへ移し、固定submoduleで統合 | 公開範囲を確認し、固定commitの組み合わせが全gate成功 |
| 34 | 分離後の構成を本番反映 | 両製品・草・タグ・metadata・backup・PWAの回帰確認 |

各phaseで品質gate、差分・ignore・secret review、commit/pushを行う。DB作成/移行、Worker改名/deploy、Queue pause/resume、旧DB削除は、対象と影響を提示して承認を得る。Phase 29開始やGit pushは後続の本番変更承認ではない。

基盤は`Rizakura0110/rizakura-hontai`の`main`。既存`Rizakura0110/rizakura-me`とローカルdirectoryは変更しない。Phase 33では名前の空きを確認し、所有者のPublic作成承認を受けて`Rizakura0110/tech-inbox`を作成した。配置は`modules/tech-inbox`とする。

## 名前と識別子

| 現在 | 変更後 | 方法 |
|---|---|---|
| 共用D1 `tech-inbox`（旧・保持のみ） | `rizakura-hontai`（接続切替済み） | 新IDへcopy・全値照合済み。旧DB削除は別途承認 |
| 公開Worker `tech-inbox-app`（旧名） | `rizakura-hontai`（改名済み） | immutable IDを保持して改名 |
| Access表示名 `tech-inbox-app`（旧名） | `rizakura-hontai`（変更済み） | app ID・audience・本人限定policy・Worker destinationを維持 |
| metadata-fetcher・Queue・DLQ | 維持 | 記事専用の`tech-inbox-…`名を残す |

D1のbinding名`DB`と物理DB名は別物。物理名はin-place renameできない。[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)。WorkerのUUIDベースの改名APIは公式でBetaとされているためPhase 31に対応状況を再確認し、失敗時に勝手に別Workerを作らない。[Workers API](https://developers.cloudflare.com/changelog/post/2025-09-03-new-workers-api/)

Worker改名ではworkers.dev hostnameも変わる。新originは既存account subdomainを維持し、先頭を`rizakura-hontai`にする。実URL・Access機密値は公開文書へ複写しない。[workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

## Phase 29の読み取り結果

2026-09-19時点のsnapshot。移行直前に再確認する。

- account全体: D1 1個、合計741,376 bytes、Worker 2個、Queue 2個。新DB/Workerの`rizakura-hontai`名は未使用。
- appはPhase 28のversion `42d201d4-a175-4800-9035-bcdc35132d62`を100%提供。DB接続と既存14 bindingの名前・型は維持。
- Accessは本人email 1件だけ・168h session・launcher非表示・appのみ公開・preview無効・fetcher非公開を確認。端末の検査用emailには既知の入力ミスが残っており、前回所有者が確認した値へ検査process内だけを補正した。remote policy/secretは変更していない。
- 通常Queue backlog 0。過去DLQ 7 messages / 851 bytesは維持。直近24hはapp 4 requests・errors 0、fetcher 0 requests、新規DLQ/fail 0。
- 最初の当日UTC analyticsはD1 read/writeとWorker request/errorが0。遅延を含むsnapshotで、後続照会や将来利用量を保証しない。
- Billing APIは権限不足。契約・請求額0円を断定せず、Phase 30直前に所有者のdashboard表示で確認する。権限追加やPaidへの切替はしない。

| テーブル | 行数 |
|---|---:|
| articles | 357 |
| article_urls | 366 |
| tags | 10 |
| article_tags | 286 |
| daymark_habits | 8 |
| daymark_habit_versions | 8 |
| daymark_records | 85 |
| d1_migrations | 3 |

## Backupと復元予行

製品別JSONのmerge復元はID再割当て・競合skip・pendingのfailed化等を行い、DB全体とmigration履歴の完全copyではない。今回の移行にはSQLを使う。

1. process environmentのcredentialでsource名・IDとWorker bindingを照合する。`.tmp/phase29-backup-*`のfresh directory（0700）へSQL・fingerprint・inventoryを0600で保存する。全てGit対象外。
2. `scripts/d1-backup-snapshot.mjs`の`snapshotDatabase(query)`へD1 APIのSELECT/読取PRAGMA実行関数を渡し、schema/indexと各tableの全列・全行をSHA-256化する。件数だけで一致と判定せず、値は表示しない。
3. `wrangler d1 export tech-inbox --remote --no-data`と`--no-schema`でschema/dataを別fileへ取得する。Wranglerはstdoutにsigned download URLを含めるため、運用では出力を捕捉し成功/失敗だけ報告する。sourceを変更しないがexport中はqueryが待たされる。取得前後のsource snapshotが一致しなければ取り直す。[D1 export/import](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
4. 空のlocal D1へ**schema.sql → data.sql**の順で取り込む。full dumpの直接importは子tableのINSERT時に親table未作成で`no such table`となった。SQL文字列を正規表現で並べ替えたり、foreign keyを無効にして成功扱いにしたりしない。
5. source snapshotとの全値・schema/index・migration履歴一致、`PRAGMA foreign_key_check`、D1対応の`PRAGMA quick_check`を確認する。[対応PRAGMA](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
6. 復元local DBを再exportし、第2の空local DBへ復元して指紋を再照合する。migration再適用後も不変であることを確認する。

合成fixtureの自動検証:

```sh
pnpm db:verify:backup
```

保存済みSQLを検証する例（directory部分を実際の`.tmp`内directoryへ置き換える）:

```sh
pnpm db:verify:backup --schema .tmp/<backup-directory>/schema.sql --data .tmp/<backup-directory>/data.sql --expected .tmp/<backup-directory>/source-snapshot.json
```

検証commandはcredentialを継承せず、`--local`・仮ID・専用config・fresh一時状態を固定する。通常local DBとremote DBへ書かず、失敗時もprivate SQLを表示しない。一時復元DBだけを終了時に削除し、指定backupは残す。通常`pnpm check`は合成fixtureだけを使う。

Phase 29ではschema 6,334 bytes・data 529,987 bytesを取得し、書出し前後のsource snapshot一致、local復元の全値一致、第2 DBへの往復、migration再適用no-opがすべて成功した。backupは予行用であり、Phase 30では更新停止後に新しく取得する。同じ端末上のbackupは端末故障まで防ぐものではない。

## Phase 30: DB切替

1. approval、source/target ID、Git revision、Access、当日usageを再確認。Freeは10 DB/account、500 MB/DB、合計5 GB、日次500万read/10万write。現行の400 MB停止閾値も守る。copyのtable/index書込・照合read・通常利用分に余裕がなければ延期する。[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
2. **更新停止手段を先に実装・検証する。** `MAINTENANCE_MODE`を共通middlewareとmetadata consumerで扱う。記事/習慣/復元/metadata再試行を含めて検証する。本人にタブを閉じてもらうだけを停止保証にしない。
3. 旧DB接続のまま更新停止し、処理中APIの終了を確認。通常Queueをdrainし、`queues pause-delivery tech-inbox-metadata`で配送停止後、実行中consumerの終了も確認する。DLQを再処理・purgeしない。pauseはretentionを延長しないので短時間で行い、長引く場合は中断・復旧する。[Queues pause](https://developers.cloudflare.com/queues/configuration/pause-purge/)
4. 停止後のschema/data backupとsnapshotを取得し、local復元・照合を通す。新しい空の`rizakura-hontai` DBを作成しIDを記録。既存同名resourceがあれば停止する。
5. targetへschema→親から順に各tableのdataをimport。migrationを先に適用してdumpを重ねない。下記のremote順序制約を守り、全値・index・履歴・外部キー・quick_checkをsourceと照合。部分import失敗時に無計画な再実行はしない。
6. 停止を維持してappのDB bindingを新IDへ切替。database_name、local migration command、検査script、型、運用文書を同期する。Worker名・originは維持し、旧設定のbuild成果物を誤deployしない。
7. Accessを維持した読取smokeで入口・両製品・草・タグ・backupを確認。その後新DB側で更新・Queue配送を再開し、所有者の保存操作を確認。旧DBへ書くconsumer/versionが残らないことを確認する。

### 更新停止の設定

| `MAINTENANCE_MODE` | API | metadata consumer |
|---|---|---|
| `off` | 通常動作 | 通常動作 |
| `read-only` | GET/HEAD/OPTIONS以外を503で拒否 | 既存処理をdrainできる |
| `frozen` | 同上 | DB/fetch/再送へ進まずnative retry（60秒） |

明示した不正値・空文字は`frozen`。未設定だけは過去のlocal fixture互換で`off`になるため、本番では必ず値を明示してdeployment後のbindingも照合する。HTTPの認証・Origin・Rate Limit検証は停止中も維持し、許可された変更要求へ`SERVICE_UNAVAILABLE`・`Retry-After: 60`・`no-store`を返す。previewもPOSTなので停止するが、両製品のGET exportは使える。時間経過で自動解除しない。

`read-only`を100%反映→旧APIの終了・通常Queue drain確認→配送pause→`frozen`を100%反映→旧consumer終了・データ不変確認→backup/copyの順とする。新bindingへ切替中も`frozen`を維持し、再開時だけ新DBの`off`版を100%反映して配送resumeする。native retryは回数制限があり、Queue配送pauseの代替ではない。pause中も24時間retentionは進む。DLQをack/purge/replayしない。

設定はdeployment versionに属する。migration中に通常の`off`設定や旧DB bindingの成果物を誤deployしない。実行前にbuild後のconfig、`--var` override、対象DB IDを照合し、実行後にWorker settings/deployment/Queueを再確認する。旧versionの実行中requestを強制停止する機能ではないため、停止前からの処理終了とsnapshotの安定を別途確認する。

2026-09-19に所有者の画面で`Workers Free`表示を確認し、更新停止・新DB作成/copy・既存appのbinding切替・Queue停止/再開を承認された。料金プラン・URL・認証は変更せず、旧DB削除は承認範囲に含めない。

### Remote importの順序制約（Phase 30で判明）

schema/dataを分けた全体exportはlocal予行を通過したが、remoteのdata取込では`FOREIGN KEY constraint failed`になった。dumpは`article_tags`等の子の行を親より先に挿入し、`defer_foreign_keys`があっても今回のremote importでは成功しなかった。内部のtransaction分割境界は直接観測していないため断定しない。失敗後は新DBの全8 tablesが0行、schemaのみ存在し、旧DBがbackupと全値一致することを読み取り確認した。

取り直しは公式`d1 export --table <table> --no-schema`を使い、SQL本文を正規表現で並べ替えない。元backupも保持する。順序は`articles → tags → article_urls → article_tags → daymark_habits → daymark_habit_versions → daymark_records → d1_migrations`。各tableの`PRAGMA foreign_key_list`で参照先が先に存在することを検査し、schema変更・循環参照があれば停止する。型・値・IDを変更せず、外部キーチェックも無効化しない。[D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)

`db:verify:backup`の再export/第2 DB復元も、このtable別の順序へ変更した。生成したnative exportを同順に連結した検証用data fileを、従来の`--data`と`--expected`で全値比較できる。remoteではtableごとに適用する。失敗時は全体を再適用せず、対象ID・適用済みtable・各値を再照合して続行可否を判断する。

### 切り戻し

| 状態 | 対応 |
|---|---|
| 新DB接続前 | sourceを維持。旧DB接続で停止とQueue pauseを解除 |
| 新DB接続後・更新再開前 | 停止中に旧bindingへ戻し、読取確認後に再開 |
| 新DBで更新/Queue処理を再開した後 | 単純な旧binding/versionへのrollbackは禁止。再停止し新DBの最新backupを確保、修正継続か逆移行を設計 |

旧DBは接続のない状態で短期保持。動作確認・最新backup・削除対象ID照合後に所有者承認を得て旧DBだけを削除する。新旧へ同時に書かず、sourceを先に削除しない。app version rollbackでもbindingが旧DBへ戻り得るので、Phase 30後にrollback候補を更新する。

## Phase 31: Worker・Access・PWA切替

- 改名前にWorker UUID・version・Access app ID/audience・policy・subdomain・binding・Queue consumerをprivateな運用記録へ控える。secret実値を取得・記録しない。
- Worker UUIDをdestinationにするAccess構成を維持。新hostnameのroot/両製品/API/manifestが未認証時にAccessへredirectされることを確認し、保護を外して検証しない。
- Wrangler name/APP_ORIGIN、preflight/health/Access設定script、budget test、deploy手順を同期。旧nameの別Workerを誤作成せず、Origin/CSRF/JWT audience検証を弱めない。
- Queue/DLQ/fetcherは改名せず、consumerが既存appの1つだけであることを確認。
- 新originで本人login、Tech Inbox/DaymarkのPWA追加し直し、直接起動・保存・再loginを確認。製品別id/scope/pathは維持するがorigin変更で別identityになる。[Manifest id](https://www.w3.org/TR/appmanifest/#id-member)
- 旧hostnameの自動redirectは前提にしない。初期案は新URLへのブックマーク/PWA切替。旧URL用Worker追加が必要なら別途確認し、旧API書込を新originへ自動転送しない。

### Phase 31の実施結果（PC・2 PWA確認済み）

- 2026-09-22に所有者が、Worker/Access改名・新URL・一時停止/再開・PWA再追加の範囲を承認した。global資格情報設定、料金、DB作成/移行/削除は変更していない。
- UUID・Access全設定・policy・Queue設定と復旧用configをGit対象外のprivate directoryへ控え、全deploy configを`workers_dev:false`にしたdry-runを通した。通常の`workers_dev:true`設定は切替途中に使用しない。
- 旧URLを閉じ、通常Queueをpauseし、同じ新DB接続の`frozen`版を反映した。処理中requestの終了を待ち、Time Travel復旧情報と全tableの指紋を取得した。本文・認証情報を公開logへ出さず、SQLによる変更は行っていない。
- UUID指定PATCHで既存Workerを改名した。同一Queue/consumer IDのまま新Worker名へ追従することを実測した。Accessは直前GETの全設定を維持してnameだけPUTし、app ID/audience/Worker destination/本人限定policy/IdP等を照合した。Cloudflareが更新したpolicyの`updated_at`だけは比較から除外し、他のpolicy fieldは完全一致を要求した。
- 新originの閉鎖`frozen`版を反映後、全table値・schema/index・migration履歴が停止時と一致した。閉鎖したまま通常版へ反映し、公開後の9経路のAccess redirect検査が成功してからQueueをresumeした。公開直後の初回検査が404だったため一度閉じ直し、状態照合後の再開では全経路の302を確認した。旧hostnameは404で、redirect用Workerは作成していない。
- 通常versionは`47e2955e-2a18-48d6-a2c9-df41617a9c6c`（100%、`off`）、新originの停止版は`8a3e6b26-e3f3-4412-8496-406d2e944d31`。read-only preflight/healthが成功し、Worker 2個・D1 2個・Queue 2個、preview無効・fetcher非公開を維持した。所有者のPC表示・保存・再読み込みに続き、2026-09-23に2 PWAの追加し直し・直接起動・login・表示・保存・再起動確認も成功した。

Phase 31の切り戻しでも新DBを維持する。Phase 30のversionは新DB接続でも旧APP_ORIGINを含むため、新Worker名のまま直接rollbackすると保存が403になり得る。改名も戻す場合は旧名の空き・同一UUID・Access・APP_ORIGINを一組で照合し、閉鎖/Queue pause中に行う。versionだけを戻す場合も現在のoriginと停止modeが一致するものを選び、通常動作版と停止版を取り違えない。

## Phase 32〜34: 切り出し境界

- Tech Inboxへ: 画面、記事/タグ/活動/backup/metadataの契約・業務処理・schema定義・単体test。
- 基盤へ残す: 認証/Origin/rate limit、入口、HTTP/UI接続、全schema集約・過去migration、D1 adapter、Cloudflare設定・fetcherの薄いentrypoint、結合test・deploy。初期adapter境界は既存Daymark実装に揃える。
- 記事serviceの基盤error参照と画面の直接HTTP/UI参照を注入方式へ整理。基盤DB→製品schema→基盤DBの循環を避け、記事contractを共通contractから分ける。
- 同じrepo内で分離を確認してから別repoへ移す。workspace/lockfile・CSS source・型/test/CI・browser/server境界を更新し、DB migration差分はゼロとする。
- Tech Inboxのtest/commit/pushを先に完了し、基盤が固定SHAを取り込み全gateを通す。npm公開・資格情報共有・moving branch追従・元履歴の書き換えはしない。
- Phase 34で結合版をdeployし、既存両製品を確認。分離のための追加production Worker/DBは不要。

### Phase 32の実施結果

- `packages/tech-inbox`を通常のworkspace packageとして作成し、製品側の画面・contracts/core・service/port・schema・metadataと単体testを集約。`modules/tech-inbox`や新Git repositoryはまだ作成していない。
- client/UIとmetadata取得/保存能力を注入し、製品から基盤/Daymarkのsource・generated type・資格情報への参照を排除。共通HTTP契約と製品契約を分離した。
- domain errorは基盤で既存のHTTP形式へ変換。metadata consumerの更新停止判定とQueue retry/ack、service bindingやHTMLRewriterの生成は基盤側に残した。
- 独立単体260 testsと型/declaration build、逆向きimport検査、browserへのserver/schema/metadata混入を拒否する実buildを確認。既存UI結合testは基盤側で維持し、全体598 tests・Daymark69 tests・E2E37 passed/desktop専用mobile skip1件を含む`pnpm check`が成功した。
- `pnpm db:generate`は`No schema changes`。local D1のmigration/制約、backup往復全値照合、実HTTPの両製品操作/復元/maintenanceも成功。migration・Daymark gitlink・Cloudflare設定・供給網policy・第三者versionは不変。
- 本番deploy/remote D1操作・旧DB削除・新repository作成は行っていない。本番のコードはPhase 31のまま維持する。

### Phase 33の実施記録

- 所有者がpublic `Rizakura0110/tech-inbox`の作成とpushを明示承認し、製品専用repositoryを作成した。Phase 32から移した74 source/test filesは内容不変で、元の基盤履歴も維持する。独立lockfile、CI、監査、作業規約、ignoreだけを製品側へ追加した。
- 製品の単体・基盤統合gate、公開物/credential検査後に、製品commit `f749b0d32bf1351bdaf0cd846152096690b07ecf`を先にpushした。製品GitHub Quality `35817744911`はsuccess。基盤は`modules/tech-inbox`のgitlinkで同じcommitを固定し、既存Daymarkの固定commitも維持する。
- Phase 32の後続CIはclient JS 500,577 bytesで500,000-byte budgetを超過した。独立install時の共有runtime重複を解決し、React/React DOM/React Router/Zod/Drizzleの共有先を明示。出力への別実体混入をbuild guardで拒否し、testではTesting Libraryも共有する。既存version・integrityとsize/coverage閾値は変更しない。
- 作業コピーとclean cloneの全`pnpm check`は成功（製品260・Daymark69・基盤609 tests、E2E37 pass/意図的skip1、audit high/critical0）。固定submoduleのremote取得・frozen install・全gateを再現し、基盤commit `a389ee9`のGitHub Quality `35818210557`もsuccessを確認してPhase 33を完了した。詳細は[Progress](progress.md)へ記録した。
- 本番Worker・Access・D1・Queue・PWA・料金設定は変更しない。Phase 34で分離構成を反映する場合も、現在のorigin・DBを維持して別途deploy承認と本番確認を行う。旧DB削除は別承認のまま。

### Phase 34の実施結果

- 所有者の既存2 Workerへの本番deploy明示承認後、非公開metadata-fetcher、次にapp Workerを更新した。D1 migration、新規resource、Access・料金設定変更は行っていない。
- 同じorigin・PWA identity・共用D1を維持し、所有者がPCの両製品表示/保存、iPhoneの両PWA、Tech Inboxのmetadata取得と記事JSON書き出しを確認した。更新後のAccess未認証9経路・Worker/Queue健全性もread-onlyで確認した。詳細は[Progress](progress.md)。
