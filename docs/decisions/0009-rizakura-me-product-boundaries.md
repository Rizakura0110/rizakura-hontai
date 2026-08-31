# ADR-0009: rizakura-meを共通入口にし、Daymarkを別repositoryから統合する

- Status: Accepted（共通基盤の境界のみ。習慣機能・UIは実装直前に設計）
- Date: 2026-08-31

## Context

所有者はTech Inboxに加えて日々の習慣・数値目標を管理したい。基盤をrizakura-meへ改名し、入口から記事・習慣へ遷移させる。習慣管理は最低限別repositoryとする一方、DB・認証・運用の重複を抑えたい。PWAは全体で1つにせず、Tech InboxとDaymarkを個別に追加・起動する。

現在のAccess verifierは独立fileだが、APIの保護path・Rate Limit分類・backup・共通layoutには記事専用の前提がある。PWAは`id: /`、`scope: /`、`start_url: /articles`で既に本番利用されている。また、dependencyは完全固定・公開後7日・Git URL/直接tarball禁止である。

## Decision

1. 当面2 repositoryとする。基盤＋Tech Inboxは現repositoryを継続し、DaymarkのUI/API/domain/schema/testは別repositoryへ置く。
2. Daymarkの固定version packageをbuild時に組み込み、productionは既存app Worker・D1・Accessを共有する。習慣用の独立production Workerや自動deployは追加しない。
3. `/`はrizakura-meの入口、`/tech-inbox/`と`/daymark/`は製品画面とし、製品別HTML・manifest・iconを配信する。
4. Tech InboxのPWA idは既存`/`を維持し、Daymarkは`/daymark/`を使用する。入口専用PWAは作らず、旧path・manifestからの移行を検証する。
5. private APIは共通認証を既定で通す。共通libraryは製品に依存せず、製品の業務処理・table操作は各製品が所有する。
6. DB migrationの生成・履歴・適用は基盤repositoryへ一元化する。Daymark tableはprefixで分け、Tech Inboxの既存table・API・backupとの互換性を維持する。
7. 基盤名をrizakura-meへ揃えるが、runtime名・URL・DBの変更は互換性と明示承認を確認する別工程とする。
8. public/privateとpackage配布先はPhase 20の外部操作前に確定する。未回答を基盤設計・整理の停止理由にせず、供給網policyを緩めたり公開権限が未確認のまま作成・公開したりしない。
9. 所有者の追加指示により、Daymarkの機能・UIはPhase 20完了後、Phase 21の業務実装直前に一緒に設計する。初回draftの具体的な業務仕様・table構成は採用しない。Phase 20までの連携検証は接続確認用stubに限る。

## Alternatives

- 全部を1 repositoryに置く: 運用は単純だが、Daymarkを別repositoryにする明示要件を満たさない。
- 最初から3 repository・独立Worker: 実現可能だが、共通package・連携・deployの管理が増えるため後続候補とする。
- Daymark専用DB: 今回の共有DB要件に反する。将来、利用者や障害隔離の必要性が変われば再検討する。
- Git URLやtarball dependency、手作業のsourceコピー: 現行供給網policyまたは単一の編集元を保つ方針に反するため採用しない。

## Consequences

- repositoryとPWAを分けても、公開入口・認証policy・DB・deployの管理は1つに保てる。
- Daymark単体のreleaseと基盤への取り込みは別工程となり、互換contractと組み合わせのtestが必要になる。
- 同じWorker・origin・DBを使うため、製品間の厳密なsecurity isolationにはならない。DB全体の復元や基盤障害は両製品へ影響する。
- 既存PWAのmetadata更新、browserと各PWAのsession、Worker改名によるorigin変更は、実機とdeployment時の確認が必要になる。
- registryを使う自作packageにも現行7日gateが適用され、公開当日の即時取り込みは前提にできない。
- 基盤と接続準備を先に進められる一方、機能・UIの合意前に習慣DB/APIやフォームを実装しない。基盤準備の完了と製品仕様の承認を分ける。

実施手順・未決事項は[設計書](../rizakura-me-design.md)と[フェーズ計画](../rizakura-me-roadmap.md)に記録する。
