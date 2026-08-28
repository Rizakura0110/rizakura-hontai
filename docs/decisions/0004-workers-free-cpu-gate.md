# ADR-0004: Workers FreeのCPUゲートを実行結果ベースにする

- Status: Accepted
- Date: 2026-08-27

## Context

実装ガイドはCloudflare Access JWTをapp Worker内で再検証し、公式例と互換のある`jose`を使うよう要求している。Phase 9のproduction計測では、JWKSと検証keyがwarmな通常リクエストは2〜7 msだった一方、新しいisolateで公開鍵取得とJWT検証を行うコールドリクエストは14〜21 msだった。いずれも`outcome: ok`で、Error 1102、`exceededCpu`、例外は発生していない。

CloudflareのWorkers Free上限は10 ms/invocationである。ただし現行の公式limitsは、認証等の処理が通常10〜20 msを使用し得ることと、まれな超過にはisolate単位のbuilt-in flexibilityがあることも明記している。

Static Assetsを持つWorkerでは、Accessが認証した`ctx.access`を内部routerがuser Workerへ渡さない。JWT署名検証を省略するとガイドとCloudflareのセキュリティ推奨に反し、Static AssetsとAPIの分割は初期版の同一origin構成を大きく変える。Workers Paidは最低月額5 USDで、無料運用方針に反する。

## Decision

Freeプラン、`jose`によるJWT再検証、同一originのStatic Assets構成を維持する。production CPUゲートは、宣言上限だけでなくCloudflareが実際に返す実行結果と継続性を含めて次のように判定する。

- Error 1102、`exceededCpu`、CPU起因の例外が1件でもあれば不合格とする。
- JWKSがwarmなlist、export、metadata処理は10 ms以下を基準とする。
- 新しいisolateでの認証を伴うコールドリクエストは、まれな発生に限り25 ms以下かつ`outcome: ok`を許容する。
- 10 ms超過が連続3リクエスト以上続く場合、または通常処理で反復する場合は不合格とする。
- bundle budgetとWorkers LogsのCPU timeをphase完了時および依存更新時に再確認する。

25 msは通常目標ではなく、公式に示された認証処理の10〜20 msという範囲と実測21 msの計測粒度を含めるコールド時の停止境界である。

## Consequences

- 無料運用とJWT署名検証を維持できる。
- まれな正常コールド起動を理由に、セキュリティを弱めたり有料プランへ変更したりしない。
- 10 ms超過が継続する場合の失敗可能性は残るため、Error 1102とCPU timeを監視する。
- Static AssetsまたはAccessの仕様が変わり`ctx.access`を安全に利用できるようになった場合は、この判断を再検討する。

## References

- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Validate Cloudflare Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
