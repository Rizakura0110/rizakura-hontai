# ADR-0016: Daymark復元をCPU制約に合わせて小分けにする

日付: 2026-09-02
状態: 採用

## Context

Phase 25で統合版を本番へ反映し、書き込みを行わない3年分10,950記録の復元previewをWorkers Logsで観測した。requestはどちらもstatus 200、`outcome: ok`、例外なしだったが、CPU timeは139 msと197 msだった。通常処理の10 ms超過が反復したため、ADR-0015の停止条件に従って復元確定とPhase完了を止めた。preview後もDaymark 3 tableは0件、Tech Inboxの既存件数と外部キー整合は不変だった。

1 requestで最大4 MiBのJSONをparse・Zod検証・sortし、D1から全日次記録をsnapshotとして読む構成は、データ量に比例して1 invocationへCPUを集中させる。追加resourceやWorkers Paidへの変更は所有者の要件に合わない。

## Decision

- 利用者が選ぶschema v1のJSON file、4 MiB、習慣200、設定履歴2,000、日次記録20,000という上限は変更しない。
- browser clientは復元を、metadata 1 batchと最大400日次記録ごとのrecord batchへ分けて順番に送る。record batchには参照する習慣と各習慣の初期設定だけを含め、batch単体でも既存schemaの参照整合を満たす。
- APIは1 restore requestの日次記録を最大400件に制限し、直接APIから大きいrequestを送ってCPU制約を迂回できないようにする。
- preview結果はmetadataの変更件数を1回だけ、各record batchの日次記録件数を合計し、元file全体の1つのsummaryとして表示する。previewは引き続き書き込まない。
- D1 snapshotは習慣と設定履歴を読み、日次記録はrequest内の自然keyまたは衝突確認が必要なIDに一致する行だけをindex経由で読む。exportだけは従来どおり全件を読む。
- 復元確定はmetadataからrecord batchの順に行い、各request内ではD1 batchを維持する。途中で失敗した場合は同じfileを再実行し、既に入った行を一致として扱って残りを冪等に続行する。
- 最大fileはmetadataを含め51 requestになる。previewはread Rate Limit 120/min、確定はmutate Rate Limit 60/minへ分離し、現行上限内に収める。新しいWorker、DB、Queue、課金設定は追加しない。

## Consequences

- parse・検証・merge・D1 record読取が最大400件単位になり、1 invocationへのCPU集中を抑えられる。本番で同じpreview-only fixtureを再計測するまではPhase 25を完了しない。
- 1 file全体の単一transactionではなく、batch単位のtransactionになる。途中失敗時に一部が追加済みとなり得るが、既存値を上書きしないmergeと再実行時の一致判定により重複せず再開できる。この挙動を画面と運用手順に明示する。
- request数は増える。20,000記録時の51 requestをRate Limit testへ固定し、D1 rows readの保守見積り304,400はFreeの5,000,000/day以内とする。最大新規復元のrows written見積り88,600と「同じUTC日に大容量復元を重ねない」運用は変わらない。
- previewと確定の間、または確定batch間の並行変更は各requestの最新D1状態に対して再計算される。画面のpreview件数と最終結果が変わり得る点は従来と同じである。

## 本番再計測

改善版をapp Workerへ再deployし、同じ10,950記録fileのpreviewだけを実行した。Live Tailで想定どおり29 requestを確認し、全件status 200、`outcome: ok`、例外0だった。Workers Analyticsの同時間帯集計は、開始直後のコールド側が最大約12.3 ms、ウォーム後のP99が約9.1 msだった。ADR-0004のコールド25 ms以内と通常10 ms以内を満たすためCPU gateを合格とした。preview後もDaymark 3 tableは0件、外部キー違反0、D1書き込み0だった。
