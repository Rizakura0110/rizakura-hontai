# rizakura-hontai / Daymark フェーズ計画

最終更新: 2026-09-01

Phase 17までのTech Inboxは完了済み。以下は所有者と合意した次期計画であり、未実装の機能を本番提供済みとは扱わない。詳細は[設計書](rizakura-hontai-design.md)、実行結果は[Progress](progress.md)へ記録する。

2026-08-31に基盤名をrizakura-meからrizakura-hontaiへ変更した。以下は現行名で表記し、過去の実行記録・ADRには当時の名前を残す。既存の別repository `Rizakura0110/rizakura-me`は移行対象ではない。

## 一覧

| Phase | 状態 | 内容 | 完了条件 |
|---|---|---|---|
| 18 | 完了 | 共通基盤・命名・連携境界の設計 | 入口＋2つのPWA、2 repository、1 app Worker/DB、互換移行と後続の確認gateを記録する。習慣機能/UIは確定しない |
| 19 | 完了（未デプロイ） | 共通基盤の整理とrizakura-hontaiの入口 | 既存記事を保ちながら認証・共通UI・製品別routingを分離。入口からTech Inboxへ進め、旧URLも動作する |
| 20 | 完了 | Daymark repositoryとpackage連携の準備 | 公開範囲・配布方式を確認し、非機密の接続確認用stubをcommit SHA固定で取り込む。業務DB/API・機能UIは作らない |
| 21 | 完了（未デプロイ） | 習慣の機能/UI設計、その後にデータ・API | 所有者と機能・UIを合意し、DB/APIをlocal D1・実HTTPで検証。既存記事への影響がない |
| 22 | 完了（未デプロイ） | 合意した習慣画面と独立PWA | Phase 21で合意した機能UI、入口との往復、Daymark専用manifestが動作する |
| 23 | 完了（未デプロイ） | 製品別backup・復元 | 記事v1/v2を維持し、Daymarkを参照整合・競合表示付きで復元できる。他製品を変更しない |
| 24 | 完了（未デプロイ） | 統合品質・互換性・無料枠内設計の検証 | 各repositoryと組み合わせのgate、旧記事・既存PWA移行、2 manifest、認証、migration、容量の検証が通る |
| 25 | 未着手 | 承認後のproduction反映と実機確認 | backup後のDB更新・deploy、Access、記事/習慣、iPhoneの2 PWAを確認し、運用と移行結果を記録する |

## 共通ルール

- 1フェーズずつ進める。各段階で既存Tech Inboxの機能・data・認証を維持する。
- 習慣管理の機能・UIは実装直前に所有者と設計する。Phase 20までに業務table・API DTO・入力フォーム・達成判定・集計を先行実装しない。
- 必要なformat、lint、生成型、TypeScript、test、coverage、local DB/API、build、artifact budget、E2E、auditを通す。Phase 24までtestを先送りしない。
- Daymark独立gateと基盤側の統合gateを分け、package単体成功だけで組み合わせを承認しない。
- 完了したphaseの差分・ignore・秘密情報を確認し、対象repositoryへcommit・pushする。新repositoryのremoteや公開範囲は勝手に決めない。
- Git push、package publish、production deploy、remote migrationは別操作。通常のphase-end pushで後者を暗黙実行しない。
- Cloudflareの新規resource、有料product、独自domain、課金枠の拡張は本計画に含めない。

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
- Phase 25: WorkerやURLのrenameは別の移行gateとしてAccess・origin・既存PWAへの影響を確認する。必要なら名称移行を切り離し、legacy識別子の残存を報告する。
- Phase 25: ownerがiPhone Safariで入口から各機能へ進み、2つのPWAを別々に追加・直接起動し、login、記録、記事機能を確認する。既存Tech Inboxの追加し直しが必要かも確認する。Android実機は引き続きowner判断でスキップする。

## 所有者に必要な確認

- Phase 20ではnpmアカウント操作は不要。Daymarkのpublic作成とGit submodule連携は承認済みで、繰り返し確認しない。
- 基盤GitHubの改名先はrizakura-hontaiで確定・改名済み。ローカル作業directoryは移動しない。新repositoryの対象・衝突は作成直前に確認する。
- Phase 21の機能・PC画面設計は合意済み。Phase 22の画面とPhase 23のbackupはlocal自動検証済みで、所有者の実画面確認はproduction反映後に行う。
- Phase 25: 本番DB更新・deploy・必要な名称移行の承認と、iPhoneの2 PWA実機確認。

そのほかの実装・自動検証はagent側で行う。新しい月額契約や追加の課金設定は前提にしない。
