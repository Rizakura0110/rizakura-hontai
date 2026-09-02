# ADR-0015: 統合版をCloudflare Free境界内で停止可能にする

日付: 2026-09-02
状態: 採用

## Context

rizakura-hontaiはTech InboxとDaymarkを同じapp Worker・D1・Access配下で動かす。Phase 23までの機能testは通っていたが、Daymark復元は最大4 MiBのJSON配列を1つのD1 bound stringへ渡していた。D1 Freeには1 Worker invocationあたり50 query、1 string/BLOB 2,000,000 bytes、100,000 rows written/dayなどの強制上限があり、機能上の件数上限だけでは本番成功を保証しない。

また、3年分の代表fixtureは10,950記録・3.36 MiBになる。local Nodeでの処理時間はCloudflare WorkersのCPU timeではないため、local成功をFreeの10 ms CPU基準の実測値として扱えない。

## Decision

- Daymark復元の各JSON bound valueをUTF-8で1,000,000 bytes以下に分割する。習慣、設定履歴、記録の順序を保った1回のD1 batchで確定し、部分retryしない。
- 確定requestはsnapshot取得3 queryを先に使うため、write statementを最大47に制限し、合計をD1の50 query/invocation以内にする。単一行が1,000,000 bytesを超える場合もbatch前に停止する。
- 最大Daymark復元はtable行とindex entryを含めて最大88,600 rows writtenと見積もる。100,000/dayに近いため、同じUTC日には別の大容量復元を行わず、D1 metricsを確認する。
- `scripts/phase24-platform-budget.test.mjs`でWorker/D1/Queue数、Queue batch・retry・message、2つのPWA identity、request body、D1 bound/query/write/readの設計予算を固定する。有料または未採用のbinding追加も検出する。
- 3年分10,950記録のpreview、確定、再preview no-opをfresh local D1の実HTTP gateで検証する。これは互換性・DB適用のgateであり、本番CPU測定の代替にはしない。
- Phase 25ではremote migration/deployの明示承認後、生成した3年fixtureを使って書き込みを行わないpreviewだけを本番で実施し、Workers LogsのCPUを確認する。Error 1102、`exceededCpu`、例外が1件でもある、通常処理で10 ms超過が反復する、または3回以上連続超過する場合は公開完了とせず停止する。まれなcold JWT requestの例外条件はADR-0004を維持する。
- Free枠超過を解決するためにPaidへ自動移行しない。期間分割、取得範囲、再試行、処理量の削減を先に設計する。

## Consequences

- 4 MiBのアプリ上限がD1の単一値上限を超えていても、安全な小さいbound valueで復元できる。
- 最大復元はFreeの日次書き込み枠内に収まるが余裕は11,400 rows written相当しかない。同日に大きなTech Inbox復元や大量更新を組み合わせない運用が必要になる。
- D1は1 database 500 MBだが、Tech InboxにはDB全体の件数上限がないため、sourceだけで将来容量を保証できない。Phase 25で現在値を確認し、以後80%の400 MBへ達したら新機能・大量importを停止して整理または期間分割を設計する。
- CPUだけはlocalで完了判定できない。Phase 24は未デプロイのまま完了できるが、Phase 25のpreview-only本番観測を省略して公開完了とはしない。

## Phase 25での改訂

本番previewでCPU time 139 msと197 msの反復超過を観測し、本ADRの停止条件を適用した。1 fileを1 invocationで扱う判断は[ADR-0016](0016-batched-daymark-restore.md)で最大400記録のrequest分割へ改訂する。Freeの費用境界、preview-onlyでの再計測、異常時に停止する原則は維持する。
