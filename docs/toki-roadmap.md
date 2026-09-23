# Toki実装フェーズ

日付: 2026-09-23
状態: Phase 35〜38完了。Phase 39以降のカレンダー・PWA・本番提供は未着手。
仕様: [Toki設計](toki-design.md)、分離理由: [ADR-0021](decisions/0021-toki-independent-product.md)

| Phase | 目的 | 完了条件と境界 |
|---|---|---|
| 35 | 仕様・設計の確定 | 計測/復帰/期限/未保存、PC/スマホ/集中表示、日時・編集、独立構成とFree gateを文書化。文書差分・全品質gate・commit/push。本番/resource変更なし |
| 36 | 別repositoryと開発土台 | 確認済みの`Rizakura0110/toki` Publicへ、独立lockfile、供給網policy、単体test/CI、ローカルWorker/D1、基盤との境界を整える。本番resourceは作らない |
| 37 | 認証・DB・API | 本人限定Access JWTのWorker側検証、session/record schema、開始/終了/期限/保存/破棄/編集・日/週取得をlocal実装。二重開始・冪等・時刻境界・競合・認証のテスト |
| 38 | 計測画面 | ストップウォッチ/タイマー、内容入力、閉じた後の復帰、通信失敗表示、PC/スマホの時間だけ表示を実装。毎秒のbackend通信なし |
| 39 | アプリ内カレンダー | PC週/日、スマホ日タイムライン、保存済み記録の表示と日時・内容の編集、日またぎ・移動・空状態を検証 |
| 40 | モバイル・独立PWA | responsive操作、PWA identity/manifest/icon、キーボード・読み上げ・文字拡大・モバイルE2Eをローカル検証。iPhone実機はPhase 43で確認。既存2 PWAは不変 |
| 41 | rizakura-hontai入口との往復 | 入口に第三のメニューを追加しTokiへ、Tokiから入口へ戻る。リンクのみで、基盤DBやWorkerへToki業務処理を移さない。別repositoryの差分と統合gateを確認 |
| 42 | 統合品質・運用準備 | 全format/lint/型/test/build/audit、E2E、時刻・競合・認証回帰、usage/Free境界、backup・切り戻し・運用手順を確認。production変更なし |
| 43 | 承認後の本番提供 | 対象・費用・認証・データ保護を再確認し、明示承認後にToki用Access/Worker/D1を作成・deploy。Toki URLの保護と動作を先に確認してから基盤入口のリンクを反映し、リンク切れを避ける。本人のPC/iPhoneで計測→保存→編集→再起動とPWA、入口往復を確認 |

共通ルール: 1フェーズずつ進め、完了時には対象repositoryの差分・ignore・秘密情報を確認し、必要な品質gateが成功した場合だけcommit/pushする。Git pushはCloudflareの作成・migration・deployを許可しない。Toki側のcommitを先に公開し、基盤側に変更があるフェーズでは結合検証後に基盤をcommit/pushする。既存のTech Inbox/Daymarkとその本番データ・認証・PWAを保つ。

Phase 37で確定した詳細: タイマー1秒〜24時間、内容1〜500文字、記録と取得期間の上限366日、保存済み記録の時間重複を許可、未完了計測は1件まで。編集は`version`で競合を検出し`409`を返す。後続画面では再読込・再編集を案内する。
