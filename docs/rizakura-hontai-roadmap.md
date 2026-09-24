# rizakura-hontai / Daymark フェーズ計画

最終更新: 2026-09-24

Phase 17までのTech Inboxは完了済み。以下は所有者と合意した次期計画であり、未実装の機能を本番提供済みとは扱わない。詳細は[設計書](rizakura-hontai-design.md)、実行結果は[Progress](progress.md)へ記録する。

2026-08-31に基盤名をrizakura-meからrizakura-hontaiへ変更した。以下は現行名で表記し、過去の実行記録・ADRには当時の名前を残す。既存の別repository `Rizakura0110/rizakura-me`は移行対象ではない。

## 一覧

| Phase | 状態 | 内容 | 完了条件 |
|---|---|---|---|
| 18 | 完了 | 共通基盤・命名・連携境界の設計 | 入口＋2つのPWA、2 repository、1 app Worker/DB、互換移行と後続の確認gateを記録する。習慣機能/UIは確定しない |
| 19 | 完了（Phase 25で反映済み） | 共通基盤の整理とrizakura-hontaiの入口 | 既存記事を保ちながら認証・共通UI・製品別routingを分離。入口からTech Inboxへ進め、旧URLも動作する |
| 20 | 完了 | Daymark repositoryとpackage連携の準備 | 公開範囲・配布方式を確認し、非機密の接続確認用stubをcommit SHA固定で取り込む。業務DB/API・機能UIは作らない |
| 21 | 完了（Phase 25で反映済み） | 習慣の機能/UI設計、その後にデータ・API | 所有者と機能・UIを合意し、DB/APIをlocal D1・実HTTPで検証。既存記事への影響がない |
| 22 | 完了（Phase 25で反映済み） | 合意した習慣画面と独立PWA | Phase 21で合意した機能UI、入口との往復、Daymark専用manifestが動作する |
| 23 | 完了（Phase 25で反映済み） | 製品別backup・復元 | 記事v1/v2を維持し、Daymarkを参照整合・競合表示付きで復元できる。他製品を変更しない |
| 24 | 完了（Phase 25で反映済み） | 統合品質・互換性・無料枠内設計の検証 | 各repositoryと組み合わせのgate、旧記事・既存PWA移行、2 manifest、認証、migration、容量の検証が通る |
| 25 | 完了 | 承認後のproduction反映と実機確認 | backup後のDB更新・deploy、Access、記事/習慣、iPhoneの2 PWAを確認し、運用と移行結果を記録する |
| 26 | 完了（Phase 28で反映済み） | Tech Inbox既読活動の集計API | 現在の既読状態を日本時間の日別に集計し、365日・全期間・今月・連続日数を保護APIで返す。DB migrationは行わない |
| 27 | 完了（Phase 28で反映済み） | Tech Inbox活動画面 | `/tech-inbox/activity`に年間gridと要約を追加し、desktop/mobile・キーボード・読み上げで確認できる |
| 28 | 完了（PC確認済み・iPhoneは所有者判断でスキップ） | 統合確認とproduction反映 | 既存機能の回帰確認後、承認を得てdeployし、Access・CPUとPCの既読・未読操作を確認。iPhoneは成功扱いにせず後日確認へ延期する |
| 29 | 完了 | Cloudflare名称移行の準備 | 読み取りinventory、非公開backupのlocal復元・全値照合、全自動gate、費用/停止/切り戻し手順を確認。remote変更なし |
| 30 | 完了（旧DBは削除せず保持） | 共用D1をrizakura-hontaiへ移行 | 全値copy・binding切替・全自動gate・所有者の表示/保存確認が成功。URL/認証は維持し、旧DB接続なし |
| 31 | 完了（PC・2 PWA確認済み） | Worker・Access表示名・URL・PWA切替 | 本人限定認証を維持し、新originと2 PWAを確認 |
| 32 | ローカル完了（本番未反映・後続CIの補修は33） | Tech Inboxと基盤の依存整理 | 同じrepository内の製品packageを単体検証し、既存の機能・API・DBと統合gateを維持 |
| 33 | 完了（本番未反映） | Tech Inboxの別repository化 | 承認済みpublic repositoryを固定commitで統合。全品質gate・clean checkout・両repositoryのcommit/pushとCIが成功 |
| 34 | 完了（本番・PC・iPhone両PWA確認済み） | 分離構成の本番反映 | 両製品・草・タグ・metadata・backup・PWAの回帰確認 |

## Phase 35以降: 第3製品Toki

時間計測・アプリ内カレンダーの第3製品は、既存2製品と異なり別repository・別Worker・別D1として開発する。基盤は入口リンクのみを担当する。Phase 35〜43の目的と完了条件は[専用フェーズ計画](toki-roadmap.md)、計測・復帰・編集・認証の仕様は[設計書](toki-design.md)を参照する。Phase 35は文書化と全品質gateまで完了し、新resourceや本番変更は行っていない。Cloudflare側の作成・deployには別途明示承認が必要。

Phase 36では所有者が`Toki`とPublic `Rizakura0110/toki`を確認し、独立repository・単体CI・local-only Worker/D1接続を整えた。基盤へのsubmodule/workspace統合は行わず、GitHub repository作成・通常push以外のremote変更はない。Cloudflare本番resourceは未作成。

## Phase 46: Daymarkの習慣削除

状態: 2026-09-24、実装・検証・所有者承認後の本番反映済み。

- 習慣管理→編集から、名称・履歴消去の説明付き確認画面を経て完全削除する。休止/アーカイブも維持する。
- 保護された削除APIと既存D1のcascadeを使い、日/週/月集計・exportから除外する。DB migrationは追加しない。
- Daymark 75 tests、基盤618 tests、実local D1での3年分履歴削除・他の習慣/記事の保持、desktop/mobile E2E 39 pass/1対象外skipと全品質gateを検証済み。週表示の既存mobile横幅不具合も修正した。
- Daymark `c5afa87`→基盤`e45dcff`の順でpushし、両CI success後に所有者承認を得て既存基盤Workerだけへdeployした。本番version `5c6f6360-6937-4c27-9cf2-28d2b0889289`は100%配信。DB schema/Access/他Workerは不変で、認証済みの削除確認→キャンセルまで検証済み。本番削除確定・所有者のPC/iPhone操作は未確認。Toki Phase 45の実機確認待ちは別件として維持する。

## 共通ルール

- 1フェーズずつ進める。各段階で既存Tech Inboxの機能・data・認証を維持する。
- 習慣管理の機能・UIは実装直前に所有者と設計する。Phase 20までに業務table・API DTO・入力フォーム・達成判定・集計を先行実装しない。
- 必要なformat、lint、生成型、TypeScript、test、coverage、local DB/API、build、artifact budget、E2E、auditを通す。Phase 24までtestを先送りしない。
- Tech Inbox・Daymarkの独立gateと基盤側の統合gateを分け、package単体成功だけで組み合わせを承認しない。
- 完了したphaseの差分・ignore・秘密情報を確認し、対象repositoryへcommit・pushする。新repositoryのremoteや公開範囲は勝手に決めない。
- Git push、package publish、production deploy、remote migrationは別操作。通常のphase-end pushで後者を暗黙実行しない。
- Phase 18〜29ではCloudflareの新規resourceを作成しない。Phase 30だけ承認後の移行用D1を一時追加し、最終1 DBへ戻す。有料product、独自domain、課金枠の拡張は含めない。

## Phase 29〜34: 名称整理とTech Inbox分離

所有者と合意した順序はCloudflare整理→コード境界整理→別repository化→結合版反映。詳細・現状snapshot・backup予行・書込停止と切り戻し条件は[実行手順](foundation-migration.md)に記録する。Phase 29では後続のDB作成/移行・Worker改名・deploy・新repository作成を実行しない。

### Phase 33の完了結果

- 所有者がpublic `Rizakura0110/tech-inbox`を明示承認し、repositoryを作成した。製品は`modules/tech-inbox`へ移し、Daymarkと同じ固定commitのGit submodule＋workspace方式で統合した。npm公開はしない。
- 移動したsource/test 74ファイルはPhase 32と同一。独立lockfile・CI・auditを用意し、基盤側のtest/coverage/CSS/boundary検査も移動先へ追従させる。
- Phase 32のpush後CIはclient JSが500,577 bytesとなり、500,000 bytesのbudgetで失敗した。独立install間のZod等の重複解決を修正し、local/clean buildは422.9 KiBへ戻った。budgetを緩和せず、両製品を独立installした状態とLinux CIで再現性を検証した。
- Tech Inbox単体260 tests、Daymark69 tests、基盤609 tests、E2E37 passed/意図的skip1を含む全品質gateが作業コピーとclean checkoutで成功。製品`f749b0d`、基盤`a389ee9`をpushし、両GitHub CIもsuccessを確認した。
- 製品のtest/review/commit/push→基盤gitlinkへ固定SHAを記録→統合・clean checkout gate→基盤commit/pushの順を守る。本番はPhase 31のままで、Cloudflare操作・DB変更・deployはPhase 33へ含めない。

## Phase 18: 共通基盤・命名・連携境界の設計

- 今回のscopeは設計書・ADR・計画・README・進捗・作業規約の更新。runtimeや本番名称は変更しない。
- 既存のAPI認証path列挙、article専用backup、PWAの`id/scope/start_url`、固定dependency policyとの整合を確認する。
- Daymarkの機能・UIに関する初回draftの既定値を取り消し、実装直前の設計gateへ移す。仕様を未確定のまま保てる基盤の境界だけを定める。
- public/private・具体的な配布方式・namespace・認証はPhase 20の外部操作前に確認する。Phase 18/19の完了条件には含めない。

## Phase 19: 共通基盤と入口

- APIの共通保護・error・log・request validationを製品のroute実装から分ける。Daymarkがまだなくても、仮のprivate routeで認証漏れがないことをtestする。
- `/`を本人限定のrizakura-hontai入口にする。Tech Inboxの画面を`/tech-inbox/`配下に整理し、`/articles`と`/settings`の互換動線を残す。
- 入口にmanifestを付けず、記事画面には従来のTech Inbox identityを持つmanifestを返す。旧installed PWAの実機移行確認はproduction反映時に行う。
- Daymark未提供中は準備中と明示し、壊れたリンクや架空の利用可能状態を表示しない。
- 共通コード・表示名をrizakura-hontaiへ変更し、記事専用名は維持。GitHub repository改名はPhase 20の外部操作前に対象を確認し、ローカルdirectory移動やCloudflare名変更と一括実行しない。

## Phase 20: 別repositoryと取り込み

- public repository `Rizakura0110/daymark`とGit submodule連携は所有者承認済み。npm公開案は取り下げ、npmログイン・scope取得は不要とする。基盤GitHubの旧webclipはrizakura-hontaiへ改名済み。
- owner、repository名`daymark`、public設定、clone先`modules/daymark`、権限を確認して作成する。別Git履歴・gitlink・ignore境界を維持する。
- 本番secret不要の独立test環境とCIを用意し、現行toolchain・供給網policyへ揃える。
- browser/server/contracts/schemaのentrypoint境界とcommit SHA固定のworkspace取り込みを非機密の接続確認用stubで証明する。業務contractやtableは未作成とし、HTTP越しの独立production serviceにはしない。
- repository公開物をreviewし、production credentialを渡さない。CIはcontents readだけで独立gateを実行し、基盤CIは固定submoduleを取得して統合gateを通す。
- registryの第三者依存には従来の7日gateを維持する。Daymark自体はGit review/testによるsource管理とし、npmへ公開しない。
- Daymarkを先にcommit/pushし、基盤の参照を更新する。clean checkoutで記録されたcommitの取得・frozen install・build・統合testを確認する。

## Phase 21〜23: 機能実装

- Phase 21: 所有者と日次のチェック/数値習慣、JST、未入力、設定履歴、休止、月曜始まりの週、月カレンダー、PC画面案を合意した。
- Phase 21: 要件から契約・domain service・`daymark_`tableのschema・migration `0002`を実装した。migration履歴は基盤側だけで管理し、既存記事入りのlocal D1で検証した。
- Phase 21: 習慣作成・名称/設定変更・記録作成/修正/削除・日/週/月取得を共通認証とRate Limit配下へ組み込み、実HTTPで検証した。production migration/deployは行っていない。
- Phase 22: 同じDB/APIを使う日・週・月・習慣管理のresponsive画面を組み込み、専用icon・HTML・manifest・scopeを配信した。入口からの往復、製品metadataの分離、記録・追加・編集をcomponent testとdesktop/mobile E2Eで確認した。production deployは行っていない。
- Phase 23: Daymark専用schema v1のexport/import、参照整合、非破壊merge、競合skip、ID再割り当て、冪等性を実装した。旧Tech Inbox JSON v1/v2は維持し、両製品のimportが相手のtableを変更しないことをtestした。
- Phase 23: 代表的な10習慣の記録では1年3,650件が1.12 MiB、3年10,950件が3.36 MiB、4 MiB境界が約13,046件だった。初期版は習慣200、設定履歴2,000、記録20,000とpretty JSON 4 MiBを上限にし、超過時は黙って分割・切り捨てず書き出しを停止する。当時のD1適用はJSON配列を3 SQL statementへまとめていたが、Phase 24でD1 bound value上限に合わせた分割へ改訂した。

## Phase 24〜25: リリース

- Phase 24: 両機能・入口のdesktop/mobile E2E、deep link、未知path/asset、2 manifest、直接API、旧URL、旧backup、Daymarkの保存・修正を検証する。
- Phase 24: query数、DB scan範囲、client/Worker bundle、CPUリスク、無料枠・CI利用条件を再確認する。未確認の本番値をlocal testの成功で代替しない。
- Phase 24: 3年分10,950記録のDaymark preview・確定・再preview no-opを実HTTPで検証した。D1への各JSON bound valueを1,000,000 bytes以下、write最大47 statementへ分割し、snapshot取得と合わせて50 query/invocation以内にした。
- Phase 24: Cloudflare FreeのWorker/D1/Queue数、request/message、D1 read/write/query/value、2つのPWA identity、未採用bindingを静的budget testへ固定した。最大Daymark復元はtable/index込み88,600 rows writtenと見積もり、同じUTC日の大容量復元を重ねない。DB容量は本番値をPhase 25で確認し、400 MBを停止閾値にする。
- Phase 24: localの処理時間を本番CPUとみなさない。3年fixtureのpreview-only本番CPU観測と、Error 1102・`exceededCpu`・反復超過の停止判定をPhase 25へ残した。
- Phase 25: remote migration/deployの対象とbackupを提示し、明示承認後に実行する。DBのrename/recreationをmigrationに紛れ込ませない。
- Phase 25: migration `0002`と統合版初回deployは完了した。3年previewはstatus 200・例外なし・DB変更なしだったがCPU 139/197 msで停止条件に達したため、最大400記録のrequest分割へ改訂した。改善版は29 requestすべて成功し、コールド最大約12.3 ms、ウォーム後P99約9.1 msでCPU gateを通過した。
- Phase 25: WorkerやURLのrenameは別の移行gateとしてAccess・origin・既存PWAへの影響を確認する。必要なら名称移行を切り離し、legacy識別子の残存を報告する。
- Phase 25: ownerがiPhone Safariで入口から各機能へ進み、2つのPWAを別々に直接起動し、記事表示とDaymarkの日・週・月への記録反映を確認した。既存Tech Inboxの追加し直しは不要だった。Android実機はowner判断でスキップした。

## Phase 26〜28: Tech Inbox既読活動

- Phase 26: 現在`read`の各記事を`read_at`の日本時間日付で数える。未読へ戻すと除外し、再び既読にすると新しい日へ移し、削除した記事も除外する。永続event tableは作らない。
- Phase 26: 今日を含む365日を0件の日も含めて返し、全期間の現在既読数、今月の既読数、連続日数を同じresponseへ含める。詳細は[ADR-0017](decisions/0017-current-read-activity.md)に記録する。
- Phase 27: Tech Inboxの製品内navigationへ「活動」を追加し、年間grid、日別件数、全期間・今月・連続日数を実装・検証した。日付選択、1 tab stopの矢印操作、日付と件数の読み上げ用label/live regionを備え、320px幅と200%文字拡大でもchart内の横scrollへ収める。読み上げ用属性は自動testで検証し、実screen readerでの音声確認は未実施。
- Phase 28: 自動品質gateと既存記事・タグ・backup・Daymarkの回帰を確認する。本番deployはGit pushと分けて所有者承認後に行う。PCとiPhoneの既読、未読へ戻す、再既読の確認を計画したが、最新の所有者指示でiPhoneを今回はスキップへ変更した。
- Phase 28: 2026-09-14に全自動gateと反映前後のAccess検査を通し、既存app Workerだけを反映した。所有者のbrowserで草と件数の表示・更新、PCの主要操作は成功。更新後とPC操作時間帯の後続CPUは通常基準内で継続超過なし。skip指示後の全自動gate再実行も成功し、iPhoneを後日確認として区別してphase-end commit/pushする。
- Cloudflare resourceの名称移行はこの機能へ混ぜず、Phase 28完了後の別計画として扱う。

## 所有者に必要な確認

- Phase 33のpublic `Rizakura0110/tech-inbox`作成・固定submodule統合、Phase 34の明示承認後の本番deployと所有者確認は完了。

- Phase 20ではnpmアカウント操作は不要。Daymarkのpublic作成とGit submodule連携は承認済みで、繰り返し確認しない。
- 基盤GitHubの改名先はrizakura-hontaiで確定・改名済み。ローカル作業directoryは移動しない。新repositoryの対象・衝突は作成直前に確認する。
- Phase 21の機能・PC画面設計は合意済み。Phase 22の画面とPhase 23のbackupはlocal自動検証済みで、所有者の実画面確認はproduction反映後に行う。
- Phase 25の所有者確認は完了した。今後の追加resource・有料product・本番migration・deployは、その変更scopeごとに改めて承認を得る。

そのほかの実装・自動検証はagent側で行う。新しい月額契約や追加の課金設定は前提にしない。
