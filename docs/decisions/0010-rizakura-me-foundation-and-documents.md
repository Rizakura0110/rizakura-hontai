# ADR-0010: rizakura-meの共通APIと製品別HTMLを分離する

- Status: Accepted
- Date: 2026-08-31
- Scope: Phase 19のlocal実装。production deploy・resource改名は含まない

## Context

Phase 18の設計に従い、既存Tech Inboxを維持して共通入口を追加する。習慣機能/UIは実装直前まで設計しない。従来の単一HTMLと記事pathの認証列挙では、入口のPWA metadataや将来のAPI保護を製品追加ごとに修正する必要があった。

## Decision

- Viteの入口HTMLと記事HTMLを別々にbuildし、入口は記事moduleも記事APIも読み込まない。共通React/CSS chunkを共有する。
- Static Assetsの全体SPA fallbackを無効化する。既知の記事画面だけをASSETS binding経由で記事HTMLへ対応付け、未知path・欠落assetは404とする。既存assetを使うbinding追加だけで新しいCloudflare resourceは作らない。
- 旧記事・設定pathは固定の同一origin pathへ302し、queryを維持する。入口と記事の往復には通常のanchorを使い、metadataを含むdocumentごと切り替える。
- Tech InboxのPWA idとmanifest URL、iconは維持し、start_url/scopeだけを記事配下にする。入口専用manifestやDaymarkの仮manifestは作らない。
- 共通の認証・変更request検証・Rate Limit・error/log・security headersをworkerのplatform moduleへ置く。API全体を保護し、正確なhealth GET/HEADだけを例外にする。記事APIは業務moduleから共通API内へ登録する。
- 製品固有のRate Limit分類は記事moduleに残す。未分類routeにもread/mutateの既定制限を掛け、HEADはGETと同じ制限を使う。
- 新旧client headerのどちらかで旧clientを受け入れ、不正・競合値は拒否する。新clientはserver rollbackとの互換性のため移行中は両headerを送る。
- 共通UI、HTTP client、HTTP契約を業務moduleから分離する。共通HTTP契約のentrypointは記事domainをimportしない。static ESM importの境界をtestする。
- root/web/contracts/dbの内部packageをrizakura-me名へ整理する。記事domainのcore、metadata-fetcher、実際のremote resource名、filesystem path、過去の記録は改名しない。第三者依存は増やさない。

## Consequences

- 新しい製品のhandlerは共通APIの登録口へ追加する。認証pathの追加忘れだけで公開APIにならず、既定のRate Limitも適用される。
- 入口と記事のHTML配信は独立するが、同じAccess・origin・Worker・DBを使う。製品間の強いsecurity isolationではない。
- HTML配信にWorkerを使う記事pathはWorker request/CPUの対象になる。入口ではDB/API取得を追加せず、通常assetをWorker経由へ一括変更しない。
- installed PWAのOS側metadata更新はlocal E2Eでは保証できない。本番反映後のiPhone確認を残し、必要な場合だけ追加し直す。
- Daymark repository作成・配布方式はPhase 20、業務仕様/UI設計はPhase 21冒頭へ残す。

## References

- [共通基盤設計](../rizakura-me-design.md)
- [Cloudflare Vite Static Assets](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/)
- [Static Assets binding](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Vite Multi-Page App](https://vite.dev/guide/build#multi-page-app)
