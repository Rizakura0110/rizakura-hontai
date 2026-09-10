# ADR-0017: 現在の既読状態からTech Inboxの活動量を集計する

- Status: Accepted
- Date: 2026-09-11

## Context

Tech Inboxで記事を既読にした量を、GitHubのcontribution graphのような日別表示で振り返りたい。既存の`articles` tableは現在の既読状態と`read_at`を保持し、未読へ戻すと`read_at`を`NULL`へ戻す。永続的な読了eventを追加すると、現在状態と履歴のどちらを正とするか、再読を何回数えるか、記事削除後に履歴を残すかという別のdomainが必要になる。

所有者は、未読へ戻した場合は元の日の件数を減らし、再度既読にした場合は新しい既読日へ移す方式を選択した。

## Decision

- 活動量は`status = 'read'`かつ`read_at IS NOT NULL`の現在の記事だけから算出する。記事ごとに最大1件として数える。
- 未読へ戻す操作は活動量から除外し、再度既読にすると新しい`read_at`の日へ移す。既読記事を削除した場合も除外する。
- 日本時間の今日を終端とする365日を返す。日付が存在しない日も0件として含め、UIが固定長のgridを構築できる契約にする。
- 全期間の現在既読数、今月の既読数、現在の連続日数を返す。今日が0件の場合は昨日までの連続を当日中は維持し、昨日も0件なら0日とする。365日より前へ続く連続日数は初期版では365日を上限とする。
- `GET /api/v1/activity`を既存のAccess認証、read Rate Limit、`Cache-Control: no-store`配下へ追加する。記事URL・title・tagや所有者情報は返さない。
- D1では既存の`articles_status_read_at_id_idx`を利用できるUTC範囲で絞り、日本時間へ変換して日別集計する。全期間件数と365日集計を1回のD1 batchで読む。
- 新しいtable・migration・Queue・Cloudflare resourceは追加しない。Tech InboxのJSON backup形式も変更しない。

## Consequences

- 既存の既読記事をそのまま過去の活動として表示でき、DB migrationと履歴の二重管理が不要になる。
- 表示は不変の読書履歴ではなく、現在のライブラリ状態を表す。未読化・削除によって過去の件数が減ることを画面上でも誤解なく示す必要がある。
- 365件固定のresponseは小さく、記事件数が増えても日別の返却件数は増えない。一方、永続的な初読履歴や再読回数が必要になった場合は、別要件としてevent modelを設計する。
