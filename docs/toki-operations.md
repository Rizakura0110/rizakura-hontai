# Tokiの本番前確認・運用手順

最終更新: 2026-09-23。Phase 42では手順の準備とローカル検証だけを行った。Phase 43では所有者がToki専用のAccess application・D1・Workerの作成、初期migration、Tokiの本番deployを明示承認した。その承認には基盤Workerのdeployは含まれなかったが、後に基盤入口の更新について別途承認を得て実施した。料金プラン変更と既存DBのmigration・復元は承認範囲に含まない。

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

## API認証エラーの切り分け（再ローテーション前）

2026-09-23の更新では、当日設定されたtokenは有効だった。実行プロセスの継承環境には古いtokenと制御文字を含むAccount IDが残っており、さらにsandbox内の`launchctl getenv`は値が空で返った。これを設定消失・token期限切れと扱った前の診断は誤りだった。許可されたsandbox外の読み取りでは最新設定を取得でき、tokenの`active`、Account IDとの一致、既知のWorker subdomainをCloudflare APIで確認できた。再ローテーションや再起動なしで更新を完了した。

- 401だけで期限切れと断定せず、当日の成功ログと使用した資格情報の取得元を確認する。継承環境、別Terminalの`export`、OSに保存した設定は同じ値とは限らない。
- sandbox内の`launchctl`が空でも、OS上の未設定とは断定しない。必要な権限のある実行環境で取得し、値を表示せずに存在・形式・一致だけを検査する。Account IDは32桁の16進数として厳密に検査し、不正な値を推測で補正しない。
- 検証済みの値をWrangler子プロセスの環境へ明示的に渡す。tokenや本人emailを引数、Git、チャット、標準出力へ出さない。SQL exportの出力には署名付きdownload URLが含まれ得るため、標準出力とエラーも私有ログへ捕捉する。
- 最新の取得元でAPI検証が失敗したときだけ、失効・期限・権限・対象アカウントを調べて必要な対応を案内する。値が見えないこととtokenが無効であることを区別する。

## Free枠と監視

2026-09-23時点の公式資料では、Workers Freeは1アカウント100,000 dynamic requests/日・10 ms CPU/request・100 Workers、D1 Freeは1アカウント10 DB、1 DB 500 MB、合計5 GB、5,000,000 rows read/日・100,000 rows written/日。AccessのFree seat・application数もアカウント単位で確認する。これらは既存製品とTokiで共有される。参照: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)、[Cloudflare One account limits](https://developers.cloudflare.com/cloudflare-one/account-limits/)。資料の数値は変更され得るため、作成直前に再照合する。

計測の秒表示は端末内で更新し、毎秒Worker/D1へ送らない。起動/復帰時、開始/終了/保存/編集、日/週カレンダー取得だけが通信を使う。ただし静的assetも認証のためWorkerを通るため、HTML・JS・CSS・アイコンの取得にもrequest/CPU枠を使う。Toki公開後はWorkersのrequest/error/CPU（特にFreeの10 ms上限と1102エラー）、D1のrows read/written/容量を管理画面で確認する。既存基盤のメトリクスと合算して評価し、Free枠の超過を有料プランへの自動移行で解決しない。無料枠の上限に達した場合は処理失敗の可能性があるため、ユーザーへ状況を示し、読み込み/保存の再試行や原因調査を行う。請求額0円をコードや事前見積りだけで保証しない。

## 検証責任の分担

- Phase 42: Toki単体のformat/lint/生成型/TypeScript/test/coverage/local D1/Worker dry-run/auditと、独立したローカルブラウザE2E。基盤側の全`pnpm check`も通し、既存2製品への回帰がないことを確認する。
- Phase 43: Cloudflareの実際のプラン・利用量・resource数を再確認し、新しいToki Access/DB/Workerに限定したread-only preflightと、本人のPC/iPhone・PWA起動/再起動を確認する。ローカル認証バイパスの試験は本番Accessの代替にならない。
