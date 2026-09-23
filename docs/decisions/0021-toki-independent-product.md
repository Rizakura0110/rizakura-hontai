# ADR-0021: 第3製品Tokiを独立WorkerとD1に分ける

日付: 2026-09-23
状態: 採用（Phase 36でPublic repositoryを作成。Cloudflare本番resourceと本番提供は未実施）

## 背景

Tech InboxとDaymarkは別repositoryの固定commitから`rizakura-hontai`へ統合され、同じapp Worker・D1・Access applicationで動く。所有者は第3製品以降、基盤以外の製品を`rizakura-hontai`から切り離したい。第3製品はストップウォッチ/タイマーとアプリ内カレンダーを持ち、スマートフォンでは独立PWAとする。無料運用は継続したい。

## 決定

- Tokiは所有者が確認したPublic `Rizakura0110/toki`で開発し、UIとAPIを同一のToki Workerへ配置する。基盤へ製品submoduleとして取り込まない。
- Toki専用D1を使用する。既存`rizakura-hontai` D1へ新しい業務tableを足さず、既存データの移行も行わない。2026-09-23時点で旧`tech-inbox` DBを保持しているため、Tokiを加えたDB個数・容量とアカウント合算のFree使用量は本番作成前に確認する。
- Toki用の本人限定Access applicationを作り、Workerでもそのapplication固有のJWT issuer/audience/本人emailを検証する。基盤入口とTokiは通常のリンクで往復し、cross-originの業務APIや共有session/DBを前提にしない。
- タイマーの毎秒表示は端末内。状態変更、画面復帰時の未完了状態取得、期間指定カレンダー取得にWorker/D1を使う。端末を閉じた間は保存した時刻・期限・状態から復帰し、通知や定期実行の到達を前提にしない。
- Tokiの正式名称とrepository公開範囲はPhase 36開始時に所有者が確認した。Cloudflare識別子は作成前に確定し、本番のAccess/Worker/D1作成・migration/deployはPhase 43の明示承認に分ける。

## 理由と影響

Worker/D1を分けることで、Tokiのschema、障害、deploy、PWAを既存2製品の変更から独立させられる。一方でCloudflare FreeのWorker request/CPUとD1個数・容量・行数の利用枠はアカウント単位で共有し、別DBにしただけでは増えない。認証applicationも増えるため、本人限定policyとWorker側検証を新製品で独立に監査する。コード共有が必要になっても、既存Workerへの実行時依存や製品DBの直結を暗黙に導入しない。

既存2製品の結合構成はこの決定では変更しない。将来それらをさらに分離する場合は、データ移行・認証・URL・PWAの独立計画と承認が必要。
