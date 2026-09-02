# ADR-0014: Daymarkを製品別JSONで非破壊復元する

日付: 2026-09-01
状態: 採用（D1への書き込み分割はPhase 24の[ADR-0015](0015-free-tier-release-gates.md)で改訂）

## Context

Tech Inboxのschema version 1/2 exportは記事、URL alias、タグ、タグ付けだけを対象にしている。Daymarkを同じD1へ追加しても、この既存JSONをDB全体のbackupへ変更すると旧file・旧clientとの互換性を壊し、製品間の誤操作範囲も広がる。

Daymarkは習慣、適用日付き設定履歴、日次記録の参照関係を持つ。全面置換や既存値の更新は現在の記録を失う可能性があり、長期の記録を1行1 statementで復元するとD1 query数とbatch規模が記録件数に比例する。

## Decision

- `product: "daymark"`とschema version 1を持つDaymark専用JSONを作り、習慣、全設定履歴、日次記録を含める。Tech Inbox JSONとの相互受け入れは行わない。
- import前にIDの一意性、習慣への参照、種類、作成日・適用日・記録日の関係を検証する。
- 既存データは更新・削除しない。互換な同一習慣を対応付け、ID衝突は再割り当てする。同じ習慣と日付の設定履歴・記録は同値なら一致、異値なら現在値を残して競合skipする。
- previewと確定は同じmerge計画を使う。確定時は最新snapshotから再計算し、同じbackupの再実行をno-opにする。
- D1への追加はtableごとのJSON配列を`json_each`で展開し、単一batchへ渡す。Phase 23時点ではtableごとに最大3 statementとしていたが、D1の1 string/BLOB 2,000,000 bytes制限をPhase 24で確認したため、1,000,000 bytes以下の複数statementへ分割する。失敗時に部分retryしない。
- 初期上限は習慣200、設定履歴2,000、日次記録20,000、pretty JSON 4 MiBとする。書き出し・読み込みを同じfile上限にし、超過や不整合は切り捨てず明示errorで停止する。
- 認証情報、Cloudflare設定、Tech Inboxのデータは含めない。responseとlogには習慣名、実績値、backup本文を含めない。

## Consequences

- 製品ごとにbackupを取得・復元でき、片方の操作がもう片方のtableを変更しないことを自動testできる。
- 代表的な10習慣では1年3,650記録が1.12 MiB、3年10,950記録が3.36 MiB、4 MiB境界が約13,046記録だった。利用状況によっては上限へ早く達するため、画面の停止messageと運用文書を維持する。
- 初期版に期間分割exportはない。Phase 24で実際のquery/CPU・無料枠を再確認し、4 MiBを超える長期利用が現実化した場合はschema互換を保った期間分割を別phaseで設計する。
- 同じIDの習慣が互換な種類・作成日なら現在の習慣へ対応付けるため、古いbackupで現在名を巻き戻さない。異なる設定値や記録値も自動上書きしないため、必要な変更は通常画面で明示的に行う。
