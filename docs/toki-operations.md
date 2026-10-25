# Tokiの本番前確認・運用手順

最終更新: 2026-10-25。Phase 62の開始前内容・固定タグと所有者PC/iPhone確認後、Phase 63で記録枠の7色化を本番反映・自動確認した。新配色の所有者本番表示確認は未報告。以後のdeployやDB復元も、対象を明示した所有者の承認範囲に限る。

## Phase 63: タグ別の記録枠配色

所有者は6タグ＋タグなしの7色を記録枠全体に付ける変更と、既存Tokiだけの本番反映を明示承認した。全gateと[CI 40194858014](https://github.com/Rizakura0110/toki/actions/runs/40194858014)・commit/push後、source `20224c34c86c763ef9d31a49b0b6158604ca6106`を新version `ffe8c4b2-2378-48fb-9bc0-32a98e6f488d`へ100%反映した。直前version `00243292-232c-474c-aeda-f4641b04d3cf`を保持する。

差分はclient表示・test・READMEだけで、API/DB/auth/package/migration sourceとWorker本体hashは直前本番から完全一致。143ファイルの集合/内容とstrict dry-runを固定し、provision/auto-createを明示無効にした。通常deployの既存設定再同期はあるため「設定API書込ゼロ」ではなく、全settings/runtime/bindings/handlersの**設定値不変**を前後照合したと記録する。

2026-10-25 12:54:39 UTCの最終確認で、workers.dev有効・preview無効・custom domains 0、14経路の同じAccess issuer/audienceへのredirectを維持した。DB操作は0件で、今回の表示変更ではDB全値の取得やbackup/migration/復元を再実施していない。他Worker・Access policy/secret・料金設定は変更しない。証跡はToki `.tmp/phase63-toki-release-TtzsJ5/`へ私有保存。新配色の所有者確認は未報告で、確認済みのPhase 62の機能とは区別する。

## Phase 62: 開始前の内容・固定タグの反映手順

所有者は2026-10-25に、全gateとcommit/push完了後のToki専用D1の私有バックアップ・既存データを保持する`0003_session_details.sql`・既存Toki Worker更新を明示承認した。基盤/metadata-fetcherの依存修正反映も別対象として承認されたが、TokiのDB/Workerと混ぜて実行しない。新resource・Access/secret・料金設定変更、DB削除・本番復元は含まない。

1. 全品質gateと検証済みcommit/成果物を確定する。既存の0001/0002と固定旧source/PWAのhash不変、新migrationの追加3列だけという差分を確認する。
2. 直近成功したWrangler keyring OAuth経路を最初に確認する。現在のactive version・Toki D1接続先・適用済みmigration・本人限定Access・公開経路・secret名・料金/利用量を読み取り確認する。別XDG環境や古い継承tokenの失敗から期限切れと推測せず、この文書の認証手順を守る。
3. 所有者へTokiの操作を控える時間を案内する。計測中の記録を勝手に停止/破棄しない。読取によるタイマー満了更新にも留意し、SQL export前後のsnapshotを照合する。ログ/SQLはmode 700 directory、600 fileのGit無視領域へ保持する。
4. 空の隔離ローカルD1へバックアップを復元し、全行・全旧列・削除履歴・migration/index/trigger・整合性を照合してから0003を予行する。旧列の全値が不変、追加3列がNULL、既存constraint/triggerの動作が保持されることを確認する。
5. 直前状態の不変とpendingが0003だけであることを確認してToki D1へ適用する。新Workerを先に配信しない。反映直後に旧列と既存記録・未完了状態を照合し、3列/履歴/整合性を検証する。
6. 検証済み成果物を既存Toki Workerへdeployし、binding/secret名/preview/認証設定の不変と未認証のHTML・実asset・API拒否を確認する。新resource・DB再作成・記録の再登録は不要。
7. 所有者がPC/iPhoneで開始前の内容とタグ→計測→終了時修正→保存、カレンダーでタグ変更/解除、再起動後の保持を確認する。元の記録を検証目的で勝手に変更せず、実際に残す活動を利用する。

追加schemaで旧sourceの既存操作をローカル検証し、旧実装の編集が新列を保持することを確認する。ただし旧画面は初期内容/タグを表示・編集できないため、切り戻し後に新機能が使えるとは扱わない。新APIに旧clientが接続した場合はタグ省略で現在値を保持する。新画面で新項目を入力して旧APIへ送ったときは明示エラーとし、値を黙って落とさない。切り戻しで追加列を削除しない。DB全体の巻き戻し/復元は別承認が必要。

### Phase 62の反映結果

- source `64df8c6f5cb5d186c20f24a2c123e6dc6dbb5280`、[CI 40193748795成功](https://github.com/Rizakura0110/toki/actions/runs/40193748795)。新version `00243292-232c-474c-aeda-f4641b04d3cf`が100%、旧versionは`b4701d8a-3f2b-4cc4-9145-b4f504050427`で保持する。旧sourceは新3列を保持して動作するが、初期内容/タグのUIは提供しない。
- 私有backup・復元・0003予行・直前照合後に、Toki D1へ0003だけを適用。保存175/破棄4/未完了0の全179行、削除履歴2件の旧全値を保持し、新3列は全NULL。index/trigger/旧migration履歴・quick_check/FKも一致。新機能の検証用として本番記録を作成・編集・削除していない。
- 反映前後でDB/ASSETS/3 secret名・script runtime/compatibility・公開設定を照合。workers.dev有効、preview無効、custom domains 0、匿名の画面・実assets・API14経路でAccess保護を確認した。本人限定policy/Free/$0/追加routeなしは同日Phase 56の所有者確認を引き継ぎ、今回のOAuthによる最新取得とは区別する。
- 最終自動照合は2026-10-25 12:41:12 UTC。証跡とSQLはTokiの`.tmp/phase62-toki-release-YDTtY8/`に700 directory/600 fileで保持する。操作再開を案内済みで、それ以降の利用による変更をこのsnapshotとの不一致やデータ損失と誤認しない。
- 所有者のPC/iPhone確認は依頼後「確認できた」と報告を受領した。後日問題があれば保存操作を止めて状況を確認し、必要なら保持した旧versionへの切り戻しを別途判断する。DB復元や追加列削除を自動実行しない。

## 分離と安全な公開順序

Tokiは独立したPublic repository、Worker、D1、Cloudflare Access applicationを使う。`rizakura-hontai`とは通常のリンクだけで行き来し、既存のTech Inbox/DaymarkのDB、Queue、Worker、Access policy、PWA identityを変更しない。TokiのGitHub CIにもCloudflare資格情報やdeploy権限は渡さない。

1. 所有者とTokiのWorker名・D1名・Access application名・originを確定する。現行`products/toki/wrangler.jsonc`は`workers_dev:false`、`toki-local`、remote IDなしの**ローカル専用設定**であり、そのまま本番deployしない。作成する本番用設定と生成成果物は追跡対象外に置き、差分・binding・秘密情報・preview無効をレビューする。
2. Cloudflare管理画面で実際のWorkers/Zero TrustプランがFreeであること、現在のWorker数、D1のDB数・容量・当日の読み書き行数、Access application数・seat数、Workersのrequest/CPU使用量を確認する。基盤用`pnpm cloudflare:preflight`は既存構成だけを検査し、Free契約やTokiの新規構成までは保証しない。
3. 専用D1を作成し、空DBへのmigrationとschema/index/整合性を確認する。Toki以外のD1へ接続しない。本番用Worker設定は確定済みD1 IDを`DB`へ1件だけbindingし、静的assetのWorker先行認証を維持する。`workers_dev:false`、`preview_urls:false`、route/custom domainなしの**非公開Worker**として先にdeployし、subdomainが無効であることとWorkerの不変IDを確認する。ローカル用`LOCAL_AUTH_BYPASS`/`LOCAL_STUB_MODE`を本番設定に含めない。
4. そのWorker IDに対して、所有者だけを許可するToki専用のWorker単位Access applicationを設定する。公開前にWorkerのroute/custom domainがないことをCloudflare APIまたはWorkerの「Domains and routes」画面で確認する。API tokenにZoneの`Workers Routes Read`権限がなく403となる場合は、対象Worker名・workers.dev URL・「No URLs enabled」・Custom domainsなし・Routesなしを所有者の画面で確認し、初回設定時だけ`TOKI_ROUTES_DASHBOARD_VERIFIED=toki`を使う。他のAPI失敗や実際のrouteは迂回しない。policyの対象email、session、launcher、application audience、team domainを確認する。認証値はWorker secretとして設定し、Git・shell引数・ログへ書かない。WorkerはAccess JWTのissuer/audience/emailを独立して再検証する。Access保護とsecretの照合後に限り、承認済みの単一`workers.dev` originを有効化する。
5. 未認証で`/`、`/calendar.html`、manifest、アイコン、JS/CSS、`/api/v1/session`、`/api/v1/records`が画面・データを返さないことを確かめる。本人ログイン後、計測→停止またはタイマー満了→内容保存→カレンダー→日時/内容編集→再読込を確認する。失敗・認証漏れ・無料枠逸脱なら、Toki専用Workerを検証済みの非公開`stage`設定（`workers_dev:false`）で再deployしてsubdomain無効を確認し、基盤入口のリンクを有効にしない。AccessとD1は削除せず残す。
6. Toki originが保護下で稼働してからのみ、基盤のビルドに検証済み`VITE_TOKI_URL`を設定し、別途承認を得て既存の基盤Workerを更新する。基盤入口からToki、Tokiから基盤への往復を確認する。Tokiが不調なら基盤リンクを再び「公開準備中」にする。基盤とTokiのdeploy/rollbackは別々に判断する。

## バックアップと復旧の境界

Toki初期版には**アプリ内JSON書き出し・復元はない**。Tech InboxとDaymarkのJSONバックアップにはTokiデータは入らない。Tokiの保存済み記録は専用D1の`time_sessions`にあり、schema変更や大量の編集前には、本番設定のDB名・IDとCloudflare上の対象DBを再照合してから、Toki repositoryで`pnpm exec wrangler d1 export DB --remote --config .tmp/toki-production-live.jsonc --output <非追跡のprivate SQL path>`を実行してSQLを取得する。出力は個人の行動履歴なので`.tmp/`配下など追跡されない私有領域に保存し、Gitへ追加しない。exportは実データを読み取る操作であり、所有者の本番作業承認後だけ実行する。

[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)はFreeでは過去7日までの**DB全体**の時点復旧で、個別の記録だけを戻す機能ではない。復旧時刻以降の正しい記録まで巻き戻す可能性があるため、書き込み停止、直前export、対象時点と影響件数の確認、所有者の別途承認なしにrestoreしない。Workerの旧versionへの切り戻しは、現在のDB schemaとの互換性を確認してから行う。初回公開で互換性のある旧versionがなければ、Access保護を残したままToki origin/入口導線を閉じ、データを削除せず原因を調べる。SQL exportからのimportも自動では行わず、空のローカルDBで再現と照合を終えてから別途判断する。

## Phase 45: 記録管理拡張の本番更新

Phase 44の手動登録・完全削除は、ローカルでmigrationとWorkerを検証しても本番には自動反映しない。所有者はToki専用D1の非公開バックアップ・migrationとToki Workerの再デプロイに限って承認した。作業前に料金プラン・使用量、DB名/IDとbinding、既存の本人限定Accessを読み取り確認する。既存2製品・基盤Workerは触れない。

承認後は作業中のToki保存・編集を一時停止し、Toki D1の個人データを非追跡の私有領域へSQL exportして、既存行を保持できることとローカルmigrationの結果を確認する。Toki D1だけに新migrationを適用し、既存記録・未完了計測・索引・整合性を読み取り検証してからToki Workerをdeployする。反映後は未認証の画面/API拒否と、所有者による既存記録表示・手動登録・編集・確認付き削除を検証する。削除の確認には消してよい新規記録だけを用い、確認後に保存・編集を再開する。

手動記録が1件でも保存された後は、手動モードを理解しないPhase 43の旧Workerへそのまま戻さない。旧カレンダーが新記録を解釈できず読み込みに失敗するため、問題時はAccess保護を保って更新を止め、互換性のある修正版を優先する。D1全体の時点復旧は正しい後続記録も巻き戻すため、別の影響確認と承認なしに実行しない。

2026-09-23に承認範囲内の更新を実施した。非追跡のmode 700ディレクトリへmode 600のSQLバックアップを保存し、実データのローカル復元・migration後の全値一致を確認した。remoteは`0002_manual_records.sql`だけを適用し、既存5行の全12列、3索引、migration履歴、削除済みrequest IDテーブルとtrigger、`PRAGMA quick_check`・`PRAGMA foreign_key_check`を検証した。続いて固定commitのToki Workerだけをdeployし、DB binding・3 secret・Access application/policy・preview無効・resource数の不変を確認した。プランは同日所有者確認のWorkers Free・Usage cost $0を根拠とし、subscription APIの取得不可を無料契約の自動確認成功とは扱っていない。課金設定の操作はない。

認証済みブラウザで翌日の手動記録1件を追加し、日時と内容の編集・再読み込み後の保持・削除キャンセル・確定削除・削除後の再読み込みを確認した。この検証用記録だけを完全削除し、元の全5行（計測中1件を含む）の全項目一致を再確認した。削除済みrequest IDが1件残るのは再送による復活防止の仕様。未認証の画面・実際の静的asset・API計9経路はAccessへの302だった。通常の保存・編集を再開可能。所有者自身のPC/iPhoneでの追加機能確認は未実施で、Phase全体の完了と区別する。

## Phase 55と56の技術スタック移行

### ローカルで固定する比較基準

移行前の比較基準となるPhase 48のsource commitは`bab03ef5084b980c481b8126fd34b18604c84249`。Tokiの`tests/fixtures/phase48/`に旧画面・API・DB処理・認証の14ファイルを固定し、元commitのSHA-256を検査する。既存2 migrationとmanifest・6アイコンの9ファイルも元commitと照合する。旧依存を再導入せず、現行の検証済みtoolchainで旧sourceを実行する検証であり、過去の配信binaryそのものを再現する検証ではない。

`pnpm check`に旧画面＋新API、新画面＋旧API、旧画面＋旧APIの切り戻し構成を加える。各構成のPC 1280px・スマホ320pxで実際のローカルD1を使い、計測/集中表示/再読込、タイマー満了/破棄、空欄保存、分入力/秒精度、競合・削除確認・再送拒否、PWA identityを検証する。test専用Workerはloopback HTTPと明示flag以外を拒否し、production bundleに含めない。

合成データのSQL exportをmode 700の一時directory・mode 600のファイルに保存し、空の隔離ローカルD1へ復元する。保存済み/破棄済みと未完了4状態それぞれについて、全12列・削除済みrequest ID・migration履歴・table/index/triggerを照合し、quick_check/foreign_key_checkを通す。新実装で編集した後も旧DB処理で計測を継続・保存・削除でき、再送で削除記録が復活しないことを確認する。予行用SQLとDBは終了時に削除し、実データをfixtureやGitへ含めない。

### 成果物と処理負荷の予算

以下はCloudflareの上限とは別に設けるプロジェクトの回帰予算。`pnpm release:local`でbuild済み成果物を検査し、stage/live両設定を合成D1 IDで厳密に生成して`deploy --dry-run`だけを行う。実際の本番設定ファイルは上書きしない。

| 対象 | 非圧縮の合計上限 | gzipの合計上限 |
|---|---:|---:|
| Worker JS | 512 KiB | 128 KiB |
| browser JS | 320 KiB | 110 KiB |
| browser CSS | 32 KiB | 10 KiB |

APIのquery数は通常取得2、開始5/同一再送3、停止/保存4、手動登録/編集2、削除成功1/競合2、一覧取得1を上限として検査する。削除済み開始requestの拒否は最大7。triggerの内部処理はAPIから発行するquery数と区別し、D1の課金対象rows read/writtenがこの件数と同じとは扱わない。

1万件の合成履歴で旧/新API各300 requestを実行し、Node+SQLite・認証bypassの平均CPU時間を比較する。新版5ms未満かつ旧版の3倍+1ms未満をローカル回帰条件とする。この値はCloudflareのCPU使用量、JWT検証を含む本番性能、実データの走査行数を保証しない。本番ではPhase 56の確認範囲でCPU/error/1102・D1行数を確認し、毎秒通信や追加の有料監視を導入しない。

2026-10-17確認の[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)ではFreeのCPUは10ms/request、Workerサイズは非圧縮64MiBでgzip上限はない。[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)はFreeで50 queries/invocation。上記の独自予算はこれらと分けて扱い、現在の契約や無料枠の残量は反映直前に確認する。

### Phase 56の実行条件と順序

1. 対象を既存`Toki Worker`の更新、Toki専用D1のprivate exportとローカル復元確認、関連設定/利用量の読み取り、必要時の同Worker切り戻しに限定して明示承認を得る。DB migration・本番DBの復元/削除、Access/secret/料金変更、新resource、基盤と他製品のdeployは含めない。計測を勝手に終了・破棄しない。
2. この文書の認証切り分けに従い、最新の資格情報とaccountを値を表示せず検証する。現在のWorker不変ID・active version ID・D1 binding/ID・3 secret名・Access application/policy・workers.dev/preview/routesを私有記録に保存し、既存の保護と一致するか確認する。記録のcommitと現行versionの対応が確認できなければ停止する。プラン・使用量が確認できなければ推測で無料と判定しない。
3. 正常な旧version IDを明示して切り戻せるか事前確認する。ローカル全gateとclean checkoutが成功したcommit、lockfile、build hashを固定する。新旧でschema/migrationとD1 bindingが同じことを照合する。相違があれば移行せず別計画にする。
4. 所有者に一時的にTokiの保存・編集を控えてもらい、直前のToki専用D1をmode 700/600の私有領域へexportする。署名URLを含む可能性のある標準出力/エラーも私有ログへ捕捉する。定期的な画面の読取でもタイマー満了がDBに確定されるため、export前後の未完了状態の変化を区別し、比較中のアプリ操作を止める。バックアップのhashと取得時刻を記録し、空のローカルD1で全列・履歴・制約/索引/trigger・整合性を照合する。SQLや行内容は公開ログへ出さない。DB全体を本番へimportしない。
5. 実際の検証済みD1 IDでlive設定を生成し、build済みWorker/assetsへの固定・Worker先行認証・preview無効・余計なroute/binding/変数なしをdry-runで再確認する。既存Toki Workerだけを反映する。DB migrationやsecretの再登録は不要。
6. 未認証の画面・実際のhash付きJS/CSS・manifest/icons・APIがデータを返さないこと、D1/secret/Access/他Workerの不変を照合する。本人のPCとiPhone PWAで既存記録・未完了計測・カレンダー、通常の活動の保存/編集/再起動を確認する。不要な記録を勝手に作成/削除しない。同じURL/id/scopeなのでPWAの追加し直しは予定しない。
7. 認証漏れ、既存記録/計測の不整合、継続的なCPU上限超過/1102や保存失敗なら反映を成功扱いにせず、承認範囲内で確認済み旧versionへ切り戻す。所有者に操作停止を伝え、`wrangler rollback <確認済み旧VERSION_ID> --config .tmp/toki-production-live.jsonc --message "Toki Phase 56 rollback"`を使う。version IDを省略して推測の直前版へ戻さない。戻した後も認証/既存記録/未完了状態・設定を再確認する。

[Worker versionはcode・assets・binding・互換設定を持つ](https://developers.cloudflare.com/workers/versions-and-deployments/)が、D1内のデータを巻き戻さない。[rollbackは直近100 versionが対象](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)でresourceの変更にも制約があるため、使える旧version IDを反映前に確定する。Phase 48の互換sourceをローカルで動かせても、Cloudflare上の切り戻し成功まで実証したことにはならない。旧versionを利用できない場合は、旧sourceの再build/deployを独断で代用せず停止して方針を確認する。

Phase 55では合成データによる復元と設定dry-runを用意し、本番のprivate backupと稼働version・契約の確認はPhase 56で実施した。次回の反映でも過去の確認値を使い回さず、対象と直前状態を確認する。

### Phase 56の本番反映結果

2026-10-25、所有者のTerminalから固定source `0f84b72a8c67c229888d20a03616fc69ad4747dd`を既存Toki Workerへ手動deployした。配信前のbuild・本番設定・lockfileをhash固定し、`--strict --no-autoconfig`付きdry-runを通した同じ成果物を使った。

- 反映前version: `7864244a-b11f-4470-b774-5415fa45427c`（Phase 48）。詳細取得によりDB接続先と互換設定を確認した切り戻し候補であり、切り戻し自体は実行していない。
- 反映後version: `b4701d8a-3f2b-4cc4-9145-b4f504050427`。2026-10-25 11:56 UTCに100%へ切り替わり、deployログと現在の配信状態が一致した。
- 私有SQLと前後snapshotを取得し、空の隔離ローカルD1へ復元して全行・全列、削除済みrequest ID、migration履歴、table/index/trigger、`quick_check`・`foreign_key_check`を照合した。バックアップ・復元DB・詳細ログはmode 700/600のGit無視領域へ保持し、公開fixtureやrepositoryへ含めない。
- 更新前後のD1 binding・ASSETS・3 secret名・互換設定は一致した。本番データの差分は、バックアップ後かつdeploy前の所有者による保存・追加と確認した。既存記録の削除やschema変更はなく、データを古いバックアップで上書きしていない。
- 所有者がWorkers Free・現在のUsage cost $0・本人限定Accessを確認した。Domains画面でproduction URLのAccess保護、preview無効、custom domain/routeなしを確認した。反映後の画面・実hash付きJS/CSS・manifest・6 icons・API計14経路はすべて未認証ではAccessへ302となった。
- 所有者はPCでの表示・保存・編集・再読み込みと、iPhoneの既存PWAでの表示・再起動後の記録保持に問題がないと報告した。PWAの追加し直しは不要で、通常利用を再開できる。
- 同じOAuth経路のGraphQL読み取りで、2026-10-25 11:56:24〜12:07:16 UTCのToki集計は8 requests、errors 0、statusはすべて`success`だった。CPUはP50 1.765ms・P99 35.087ms（APIスキーマのmicrosecondsを換算）。短期間・少数の集計であり、将来の上限内動作の保証ではない。P99はFreeの10msより高いが、`exceededCpu`/`exceededMemory`や1102相当の実行失敗は観測されていない。[公式のCPU制限](https://developers.cloudflare.com/workers/platform/limits/#cpu-time)は散発的な超過に余裕を持たせ、継続的な超過時に実行を停止する。今回の値を「すべて10ms以内」と扱わず、継続的な超過・保存失敗なら上記の切り戻し条件に従う。原因をcold start等と断定しない。
- D1情報取得時の当該DBは102,400 bytes、直前24時間のrows read 463・rows written 108だった。反映後だけの利用量やアカウント全体の合計とは区別する。契約変更や有料監視の追加は行っていない。

DB migration・本番DB復元/削除、新resource作成、Access/secret/料金設定、基盤と既存2製品のdeployは行っていない。

## API認証エラーの切り分け（再ローテーション前）

2026-09-23の更新では、当日設定されたtokenは有効だった。実行プロセスの継承環境には古いtokenと制御文字を含むAccount IDが残っており、さらにsandbox内の`launchctl getenv`は値が空で返った。これを設定消失・token期限切れと扱った前の診断は誤りだった。許可されたsandbox外の読み取りでは最新設定を取得でき、tokenの`active`、Account IDとの一致、既知のWorker subdomainをCloudflare APIで確認できた。再ローテーションや再起動なしで更新を完了した。

- 401だけで期限切れと断定せず、当日の成功ログと使用した資格情報の取得元を確認する。継承環境、別Terminalの`export`、OSに保存した設定は同じ値とは限らない。
- sandbox内の`launchctl`が空でも、OS上の未設定とは断定しない。必要な権限のある実行環境で取得し、値を表示せずに存在・形式・一致だけを検査する。Account IDは32桁の16進数として厳密に検査し、不正な値を推測で補正しない。
- 検証済みの値をWrangler子プロセスの環境へ明示的に渡す。tokenや本人emailを引数、Git、チャット、標準出力へ出さない。SQL exportの出力には署名付きdownload URLが含まれ得るため、標準出力とエラーも私有ログへ捕捉する。
- 最新の取得元でAPI検証が失敗したときだけ、失効・期限・権限・対象アカウントを調べて必要な対応を案内する。値が見えないこととtokenが無効であることを区別する。

### 手動デプロイで成功したブラウザ認証経路

2026-10-25は、所有者がCloudflare画面でAPIトークン一覧が0件と確認した。消失原因や期限切れとは断定せず、独自APIトークンの再発行・受け渡しではなく、固定Wranglerの`login --use-keyring --scopes account:read user:read workers_scripts:write d1:write`によるブラウザ認証へ切り替えた。所有者のTerminalでログイン・`whoami`・本番情報取得・backup・deployが成功した。

この経路ではToki repositoryを作業directoryとし、`XDG_CONFIG_HOME=$PWD/.config`、`XDG_CACHE_HOME=$PWD/.cache`、`XDG_DATA_HOME=$PWD/.local/share`を明示した。古いAPI token/key/email/account IDと`CF_*`の対応する認証変数は、その実行環境から解除してOAuthより優先されないようにした。APIトークンの値をチャットやアプリへ渡したり、Codexを再起動したりする必要はなかった。

反映後のagentによる読み取りも、同じworkspace設定とWranglerの認証処理を使い、許可された実行環境から成功した。次回はこの直近成功経路を先に確認する。keyringの秘密値を直接表示・コピーせず、固定CLIに認証を任せる。今回のGraphQL読み取りでは公式CLIの認証出力をメモリ内だけでCloudflareへ渡し、資格情報を出力するCLIログは破棄先へ向け、値を表示・ファイル保存しなかった。`pnpm exec`の供給網検査がJSONの前に案内を出す場合は、資格情報を含まない取得結果を私有保存したまま実際のJSON部分を検証する。JSON解析エラーを認証失敗と混同しない。OAuthの権限にないAccess policyや請求情報は、所有者の管理画面確認と区別する。

## Free枠と監視

2026-09-23時点の公式資料では、Workers Freeは1アカウント100,000 dynamic requests/日・10 ms CPU/request・100 Workers、D1 Freeは1アカウント10 DB、1 DB 500 MB、合計5 GB、5,000,000 rows read/日・100,000 rows written/日。AccessのFree seat・application数もアカウント単位で確認する。これらは既存製品とTokiで共有される。参照: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)、[Cloudflare One account limits](https://developers.cloudflare.com/cloudflare-one/account-limits/)。資料の数値は変更され得るため、作成直前に再照合する。

計測の秒表示は端末内で更新し、毎秒Worker/D1へ送らない。起動/復帰時、開始/終了/保存/編集、日/週カレンダー取得だけが通信を使う。ただし静的assetも認証のためWorkerを通るため、HTML・JS・CSS・アイコンの取得にもrequest/CPU枠を使う。Toki公開後はWorkersのrequest/error/CPU（特にFreeの10 ms上限と1102エラー）、D1のrows read/written/容量を管理画面で確認する。既存基盤のメトリクスと合算して評価し、Free枠の超過を有料プランへの自動移行で解決しない。無料枠の上限に達した場合は処理失敗の可能性があるため、ユーザーへ状況を示し、読み込み/保存の再試行や原因調査を行う。請求額0円をコードや事前見積りだけで保証しない。

## 検証責任の分担

- Phase 42: Toki単体のformat/lint/生成型/TypeScript/test/coverage/local D1/Worker dry-run/auditと、独立したローカルブラウザE2E。基盤側の全`pnpm check`も通し、既存2製品への回帰がないことを確認する。
- Phase 43: Cloudflareの実際のプラン・利用量・resource数を再確認し、新しいToki Access/DB/Workerに限定したread-only preflightと、本人のPC/iPhone・PWA起動/再起動を確認する。ローカル認証バイパスの試験は本番Accessの代替にならない。
