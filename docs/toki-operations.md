# Tokiの本番前確認・運用手順

最終更新: 2026-09-23。Phase 42では手順の準備とローカル検証だけを行う。Cloudflareの作成・remote migration・deploy・復元・料金変更は、Phase 43で対象を示して所有者が明示承認するまで実行しない。

## 分離と安全な公開順序

Tokiは独立したPublic repository、Worker、D1、Cloudflare Access applicationを使う。`rizakura-hontai`とは通常のリンクだけで行き来し、既存のTech Inbox/DaymarkのDB、Queue、Worker、Access policy、PWA identityを変更しない。TokiのGitHub CIにもCloudflare資格情報やdeploy権限は渡さない。

1. 所有者とTokiのWorker名・D1名・Access application名・originを確定する。現行`products/toki/wrangler.jsonc`は`workers_dev:false`、`toki-local`、remote IDなしの**ローカル専用設定**であり、そのまま本番deployしない。作成する本番用設定と生成成果物は追跡対象外に置き、差分・binding・秘密情報・preview無効をレビューする。
2. Cloudflare管理画面で実際のWorkers/Zero TrustプランがFreeであること、現在のWorker数、D1のDB数・容量・当日の読み書き行数、Access application数・seat数、Workersのrequest/CPU使用量を確認する。基盤用`pnpm cloudflare:preflight`は既存構成だけを検査し、Free契約やTokiの新規構成までは保証しない。
3. 所有者だけを許可するToki専用Access applicationを、確定した**単一のToki origin**に先に設定する。policyの対象email、session、launcher、application audience、team domainを確認する。認証値はWorker secretとして設定し、Git・shell引数・ログへ書かない。WorkerはAccess JWTのissuer/audience/emailを独立して再検証する。ローカル用`LOCAL_AUTH_BYPASS`/`LOCAL_STUB_MODE`を本番設定に含めない。
4. 専用D1を作成し、空DBへのmigrationとschema/index/foreign keyを確認する。Toki以外のD1へ接続しない。本番用Worker設定は確定済みD1 IDを`DB`へ1件だけbindingし、`preview_urls:false`、静的assetのWorker先行認証を維持する。Workerのdry-runと静的/業務routeの保護確認後に、承認済みoriginだけを公開する。
5. 未認証で`/`、`/calendar.html`、manifest、アイコン、JS/CSS、`/api/v1/session`、`/api/v1/records`が画面・データを返さないことを確かめる。本人ログイン後、計測→停止またはタイマー満了→内容保存→カレンダー→日時/内容編集→再読込を確認する。失敗・認証漏れ・無料枠逸脱なら、基盤入口のリンクを有効にせず公開を止める。
6. Toki originが保護下で稼働してからのみ、基盤のビルドに検証済み`VITE_TOKI_URL`を設定し、別途承認を得て既存の基盤Workerを更新する。基盤入口からToki、Tokiから基盤への往復を確認する。Tokiが不調なら基盤リンクを再び「公開準備中」にする。基盤とTokiのdeploy/rollbackは別々に判断する。

## バックアップと復旧の境界

Toki初期版には**アプリ内JSON書き出し・復元はない**。Tech InboxとDaymarkのJSONバックアップにはTokiデータは入らない。Tokiの保存済み記録は専用D1の`time_sessions`にあり、schema変更や大量の編集前には、対象DB名・IDを照合してからCloudflareの`wrangler d1 export <確認済みToki DB名> --remote --output <非追跡のprivate SQL path>`でSQLを取得する。出力は個人の行動履歴なので`.tmp/`配下など追跡されない私有領域に保存し、Gitへ追加しない。exportは実データを読み取る操作であり、所有者の本番作業承認後だけ実行する。

[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)はFreeでは過去7日までの**DB全体**の時点復旧で、個別の記録だけを戻す機能ではない。復旧時刻以降の正しい記録まで巻き戻す可能性があるため、書き込み停止、直前export、対象時点と影響件数の確認、所有者の別途承認なしにrestoreしない。Workerの旧versionへの切り戻しは、現在のDB schemaとの互換性を確認してから行う。初回公開で互換性のある旧versionがなければ、Access保護を残したままToki origin/入口導線を閉じ、データを削除せず原因を調べる。SQL exportからのimportも自動では行わず、空のローカルDBで再現と照合を終えてから別途判断する。

## Free枠と監視

2026-09-23時点の公式資料では、Workers Freeは1アカウント100,000 dynamic requests/日・10 ms CPU/request・100 Workers、D1 Freeは1アカウント10 DB、1 DB 500 MB、合計5 GB、5,000,000 rows read/日・100,000 rows written/日。AccessのFree seat・application数もアカウント単位で確認する。これらは既存製品とTokiで共有される。参照: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)、[Cloudflare One account limits](https://developers.cloudflare.com/cloudflare-one/account-limits/)。資料の数値は変更され得るため、作成直前に再照合する。

計測の秒表示は端末内で更新し、毎秒Worker/D1へ送らない。起動/復帰時、開始/終了/保存/編集、日/週カレンダー取得だけが通信を使う。Toki公開後はWorkersのrequest/error/CPU、D1のrows read/written/容量を管理画面で確認する。既存基盤のメトリクスと合算して評価し、Free枠の超過を有料プランへの自動移行で解決しない。無料枠の上限に達した場合は処理失敗の可能性があるため、ユーザーへ状況を示し、読み込み/保存の再試行や原因調査を行う。請求額0円をコードや事前見積りだけで保証しない。

## 検証責任の分担

- Phase 42: Toki単体のformat/lint/生成型/TypeScript/test/coverage/local D1/Worker dry-run/auditと、独立したローカルブラウザE2E。基盤側の全`pnpm check`も通し、既存2製品への回帰がないことを確認する。
- Phase 43: Cloudflareの実際のプラン・利用量・resource数を再確認し、新しいToki Access/DB/Workerに限定したread-only preflightと、本人のPC/iPhone・PWA起動/再起動を確認する。ローカル認証バイパスの試験は本番Accessの代替にならない。
