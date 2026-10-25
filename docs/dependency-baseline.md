# Dependency baseline

確認日: 2026-09-11
構成追記: 2026-09-23（Phase 32〜33のworkspace・固定submodule整理。下記の第三者version選定を更新するものではない）
対象環境: macOS arm64 / Cloudflare Workers / Node.js 24 LTS / pnpm 11

2026-10-05追記: [Phase 50の再確認](#phase-50のtoki移行向け再確認)で新しいadvisoryを検出した後、所有者指示による[基盤と両製品の依存修正](#基盤と両製品の依存修正)を実施した。修正後の基盤はhigh/critical 0、従来の開発専用moderate 1。Tech Inbox・Daymarkは各独立監査も指摘0件。本番は未反映。

2026-10-09追記: [Phase 52](#phase-52のtokiへの導入と依存修正)の再監査でSharp/source-map-jsに新しいhigh 2件を確認し、Tokiを修正版へ更新した。現在のTokiは監査指摘0件。共通基盤の同日監査はhigh 2・既存moderate 1で、追随修正が残っている。

2026-10-17追記: [基盤側の追随修正](#2026-10-17の基盤と両製品の依存修正)で、基盤のhigh 2件とDaymark/Tech Inbox各high 1件を解消した。現在の基盤は既存moderate 1件のみ、両製品の独立監査は指摘0件。本番は未反映。

同日の[Phase 53](#phase-53のtokiへのdrizzle導入)でTokiへDrizzle ORM/Kitを導入した。Tokiのhigh/criticalは0件、Kit由来の開発専用moderate 1件を基盤と同じ制約付きで扱う。本番は未反映。

2026-10-25追記: [Phase 56の直前監査](#2026-10-25のtoki本番反映前の依存修正)でTokiに新たな指摘を確認し、対象依存を更新した。修正後のTokiは既知moderate 1件のみ。同日、検証済み実装をToki Workerへ本番反映し、PC/iPhone確認を完了した。基盤・Daymark・Tech Inboxの本番反映を含むものではない。過去の日付の監査結果は、その時点の結果である。

## 2026-10-25 Phase 57: 基盤・両製品への追随修正

所有者の依頼により、Tokiで検証済みの修正版を再審査して基盤・Tech Inbox・Daymarkへ適用する。Hono `4.13.11`、Zod `4.6.6`、Vite `8.2.4`、Vitest/coverage `4.1.12`、Miniflare配下Undici `7.30.1`、jsdom配下Undici `8.12.2`を完全固定した。Hono/Miniflareは基盤だけが使用し、製品へ不要な依存を追加しない。

公式npmの14配布物を再取得してSHA-512を照合し、公開後9〜26日・非deprecated・Node 24/peer互換を確認した。Vitestの必須Vite peerを満たすため、基盤root・Daymark・Tech Inboxにも既に利用しているViteの修正版をdevDependencyとして明示する。Zodの公開型が参照するWeb標準URLのため、contractsの型検査にDOM libraryを追加する。実行環境や本番配信をブラウザへ変更するものではなく、`skipLibCheck`で問題を隠さない。

| 監査対象 | 修正前 low / moderate / high / critical | 修正後 low / moderate / high / critical | 修正後runtime |
|---|---|---|---|
| 基盤 | 1 / 12 / 4 / 0 | 0 / 1 / 0 / 0 | 0件 |
| Daymark独立 | 1 / 8 / 3 / 0 | 0 / 0 / 0 / 0 | 0件 |
| Tech Inbox独立 | 1 / 8 / 3 / 0 | 0 / 0 / 0 / 0 | 0件 |

基盤のHonoは`serveStatic`を使わない。一方、Zodの配列検証はバックアップ/タグAPI等で使用するため、未使用と扱わない。既存の本人認証・入力サイズ・Origin等の保護を保ったうえで修正版へ更新する。実際の侵害を検出したという意味ではない。

lockfileは基盤395 entries中14件、Daymark176中12件、Tech Inbox210中12件だけを置換した。その他381/164/198 entriesの内容・integrityは不変。7日gate・strict peer・親version限定override・build script許可を維持し、既存の補助依存も互換範囲を満たす固定版に留めた。

Drizzle Kitの最新stable `0.31.11`も`@esbuild-kit/esm-loader 2.6.5`→`core-utils 3.3.2`→esbuild `~0.18.20`を保持しており、互換更新では既知moderateを解消できない。Kitは`0.31.10`に据え置き、該当するHTTPサーバーを起動せず本番bundleにも含めない。互換範囲外overrideやRC移行で監査値だけを消さない。

本番反映はPhase 58の別承認後。基盤側の過去の未反映修正を含む累積差分と実際のWorker成果物を確認する。品質gate・commitは[Progress](progress.md)に記録する。

## 2026-10-25のToki本番反映前の依存修正

Phase 56の再監査はlow 1・moderate 12・high 4・critical 0だった。high 4件はVite、Zod、Undiciの7系と8系に対する指摘で、侵害を検知した件数ではない。新たなmoderate/lowも同じ依存の修正とHono/Vitestの更新で解消する。

| 対象 | 更新 | 公式npm公開日 UTC |
|---|---|---|
| Hono | `4.13.7 → 4.13.11` | 2026-09-29 |
| Vite | `8.2.1 → 8.2.4` | 2026-10-06 |
| Zod | `4.4.3 → 4.6.6` | 2026-10-11 |
| Vitest / coverageと内部package | `4.1.11 → 4.1.12` | 2026-10-15 |
| Miniflare配下Undici | `7.29.1 → 7.30.1` | 2026-10-15 |
| jsdom配下Undici | `8.10.2 → 8.12.2` | 2026-10-15 |

Zodは巨大なコレクションの検証によるメモリ消費、Undiciは不正な応答によるプロセス停止など、Vite/Vitestは開発サーバーの処理が対象。[Honoの静的配信の経路検証](https://github.com/honojs/hono/security/advisories/GHSA-5r4p-p66f-jhc7)、[Undiciの不正応答処理](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c)、[Vitestのmock登録](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8)、[Zodのadvisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)、[Viteのadvisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm)を参照する。

TokiはHonoの`serveStatic`を使わず、認証後に許可済みpathだけをASSETSへ渡す。Zodの現行API契約に配列/Map/Set等のコレクション型はなく、更新本文にも4,096 bytesの制限がある。Undici/Vite/Vitestは開発依存である。これらの到達条件とは別に、high gateを維持したまま修正版へ更新した。

採用14 tarballは公式npmのSHA-512と一致し、非deprecated・公開7日・Node `24.19.0`とpeerの互換性を確認した。ZodとUndiciは同一major内のminor更新を必要とする。ViteのPostCSS下限は既存`8.5.28`で満たし、Rolldown等の既存固定は維持する。lockfileは368 entriesのまま、対象14件だけを置換し、残り354件の内容とintegrityは完全一致。snapshotの接続も対象版への参照置換だけである。

frozen installと全品質gateが成功し、監査はlow/high/critical 0・moderate 1となった。残るDrizzle Kit配下esbuildの扱い、7日gate、strict peer、integrity、親限定override、install script制限は不変。基盤・Daymark・Tech Inboxの依存は今回変更していないため、このTokiの監査結果を他repositoryの現在の結果へ転用しない。検証と公開commitは[Progress](progress.md)へ記録する。

## 2026-10-17の基盤と両製品の依存修正

所有者の指示により、基盤のMiniflare配下Sharpを`0.35.4 → 0.35.5`（対応する`@img/sharp`とlibvips `1.3.3 → 1.3.4`）、基盤・Daymark・Tech Inboxのsource-map-jsを`1.2.1 → 1.2.2`へ限定更新した。直接依存の完全version、7日gate、strict peer、既存Undici/Rolldown対策、install script許可は維持する。

[Sharpのlibrsvg advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)は特定のglibc/Linux条件で不正SVGを扱う場合のメモリ脆弱性、[source-map-jsの修正版](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2)は細工された索引付きsource mapによる処理停止に対応する。いずれも開発依存で、今回アプリの業務処理・DB・認証・PWAは変更しない。

公式npmでSharp `0.35.5`の2026-09-27公開、source-map-js `1.2.2`の2026-09-30公開、非deprecated・Node互換を再確認した。2 tarballのSHA-512は公式integrityと先行するToki lockfileに一致し、新しいplatform packageのintegrityもTokiの検証済み値と一致した。

lockfileのpackage entriesは基盤395・Daymark176・Tech Inbox210のまま。基盤の置換28件はSharp本体・platform/libvipsとsource-map-jsだけ、両製品はsource-map-js各1件だけで、その他のresolution/integrity・依存の接続は不変。Tech Inboxの再解決時に除去された対象外のoptional peer群は従来の固定値へ戻し、frozen再installを通過した。

| 監査対象 | 修正前 moderate / high / critical | 修正後 moderate / high / critical |
|---|---|---|
| 基盤 | 1 / 2 / 0 | 1 / 0 / 0 |
| Daymark独立 | 0 / 1 / 0 | 0 / 0 / 0 |
| Tech Inbox独立 | 0 / 1 / 0 | 0 / 0 / 0 |

残るDrizzle Kit配下esbuild `0.18.20`のmoderateは従来の扱いを継続し、該当HTTP開発サーバーを起動しない。互換範囲外の強制overrideは行わず、runtime bundleに含めない。検証と公開commitは[Progress](progress.md)へ記録する。

## 基盤と両製品の依存修正

2026-10-05、変更前に脆弱性の内容と適用条件を所有者へ説明し、基盤とその必須品質gateに含まれるTech Inbox・Daymarkの開発依存を限定更新した。基盤のHonoも同時に修正したが、画面・業務処理・DB・Access/Secrets・Cloudflare設定は変更していない。通常のcommit/pushのみで、本番deployは行わない。

| 対象 | 更新 | 理由 |
|---|---|---|
| 基盤のMiniflare配下 | Undici `7.29.0 → 7.29.1`、親version限定override | WebSocket応答によるDoS、BalancedPoolの独自TLS検証脱落など |
| 基盤・Tech Inbox・Daymarkのjsdom配下 | Undici `8.10.0 → 8.10.2`、親version限定override | 上記に加えて、特定cache interceptorのorigin混同など |
| 基盤app | Hono `4.13.5 → 4.13.7`、direct完全固定 | 未使用のHono JSX SSR機能にある文字列escape不足を修正 |

high 5という監査値は3種類のadvisoryをUndiciの7/8系で数えたもの（2+3）で、5種類の侵害を検知した意味ではない。攻撃条件はそれぞれ[WebSocketの不正応答](https://github.com/nodejs/undici/security/advisories/GHSA-rfgv-xxqx-mfg5)、[BalancedPoolと独自TLS検証関数の併用](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3)、[複数origin間のcache/deduplicate状態共有](https://github.com/nodejs/undici/security/advisories/GHSA-vp8m-p9jh-q5pm)。[Honoの指摘](https://github.com/honojs/hono/security/advisories/GHSA-hxh3-vqpv-xpqv)は特定のJSX SSR位置へ未信頼文字列を直接渡す場合に適用される。

Undiciの該当経路はすべて開発依存。自作コードにUndici/WebSocket/BalancedPoolの直接利用はなく、HonoはHTTP routingに使い、HTMLはassets配信、画面はReactのclient renderingである。修正後のbuild成果物にもUndiciやHono JSX SSRは検出されなかった。これらは到達性を判断する根拠であり、侵害調査や本番安全性の無条件保証ではない。

公式npmで修正3版の2026-09-04公開・stable/非deprecated・Node互換とtarball SHA-512一致を再確認した。root lockfileは3版だけ、両製品の独立lockfileは各Undici 8系だけが変わった。7日gate、strict peer、integrity、既存override、install script許可は維持する。

| 監査対象 | 修正前 low/moderate/high/critical | 修正後 low/moderate/high/critical |
|---|---|---|
| 基盤 | 6 / 12 / 5 / 0 | 0 / 1 / 0 / 0 |
| Tech Inbox独立 | 3 / 5 / 3 / 0 | 0 / 0 / 0 / 0 |
| Daymark独立 | 3 / 5 / 3 / 0 | 0 / 0 / 0 / 0 |

全品質gateと認証/DB/PC/スマホ回帰の結果は[Progress](progress.md)を参照。残るmoderate 1は従来のDrizzle Kit → esbuild `0.18.20`で、今回新たに導入した問題ではない。該当esbuildのHTTP開発サーバー機能は起動しない。localhost限定でも悪意あるWebページから応答を読まれ得るため、loopback限定をこの脆弱性の対策とみなさない。現行の利用は`@esbuild-kit/core-utils`のtransform処理のみで、runtime bundleには含めない。上流互換版による解消を再確認し、互換範囲外の強制overrideはしない。[esbuild公式advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99)

## Phase 50のToki移行向け再確認

基盤のdirect dependency 26種とpnpmを公式npm metadataで再確認した。選定版はいずれも公開7日以上・非deprecatedで、Node.js `24.19.0`のengineと必須peerを満たす。26種のregistry integrityは基盤lockfileと一致した。これはtarballをインストールした新スタック全体の動作保証ではない。

現行graphの再監査ではTokiがhigh 2、基盤がhigh 5（いずれも開発用Undici経由）だった。また基盤のHono `4.13.5`にJSX SSRのmoderate指摘がある。対象sourceで`hono/jsx`によるSSR利用は見つからず、この監査だけで本番の悪用可能性や侵害を断定しない。ただし新規導入時に既知の指摘を持つ版を無条件で踏襲しない。

| 対象 | Phase 50で採用する修正方針 | 適用範囲 |
|---|---|---|
| MiniflareのUndici | `miniflare@5.20260815.0-alpha>undici: 7.29.1` | Tokiへ今回適用。親が固定する`7.29.0`から互換patchだけ更新 |
| jsdomのUndici | `jsdom@30.0.1>undici: 8.10.2` | 後続のTesting Library/jsdom導入時。`^8.9.0`の互換範囲内 |
| Hono | `4.13.7`を完全固定 | Phase 52導入時。基盤の`4.13.5`はコピーしない |

修正3版は2026-09-04公開で、7日gate・Node互換を満たし、配布tarballのSHA-512も公式registry integrityと一致した。根拠は[UndiciのWebSocket advisory](https://github.com/nodejs/undici/security/advisories/GHSA-rfgv-xxqx-mfg5)、[UndiciのTLS advisory](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3)、[HonoのJSX advisory](https://github.com/honojs/hono/security/advisories/GHSA-hxh3-vqpv-xpqv)と公式npm metadata。既存のRolldown/Sharp override、7日gate、strict peer、integrity、install script許可は緩めない。

### Tokiへ段階導入する固定版

| 分類 | 固定版 |
|---|---|
| runtime | React/React DOM `19.2.8`、React Router `8.3.0`、Hono `4.13.7`、Drizzle ORM `0.45.2`、Zod `4.4.3`、jose `6.2.9` |
| build | Vite `8.2.1`、React plugin `6.0.5`、Cloudflare Vite plugin `1.53.0`、Tailwind CSS/Tailwind Vite plugin `4.3.3`、Wrangler `4.124.0` |
| testと開発 | TypeScript `7.0.2`、Vitest/coverage-v8 `4.1.11`、Playwright `1.62.1`、Biome `2.5.9`、Drizzle Kit `0.31.10`、Testing Library DOM `10.4.1`/React `16.3.2`/user-event `14.6.5`、jsdom `30.0.1` |
| 型と実行環境 | React型 `19.2.18`、React DOM型 `19.2.4`、Node型 `24.13.3`、Node.js `24.19.0`、pnpm `11.22.0` |

Git無視対象の隔離directoryで、基盤commit `b5f1e76`の解決済みgraphを使い上記3版だけ置き換えた候補lockfileを作成した。26 direct dependencyをまとめ、既存395 package entriesの供給網検証を`--lockfile-only --frozen-lockfile --ignore-scripts`で通過し、候補監査はhigh/critical/low 0、moderate 1だった。node_modulesの導入・新スタックの実buildはまだ行っていない。導入フェーズごとに必要な部分だけ解決し直し、差分・audit・全品質gateを確認する。

残るmoderate 1は従来の開発専用Drizzle Kit → esbuild `0.18.20`。Drizzle Kit自体の非deprecated確認と、推移依存`@esbuild-kit/core-utils`・`@esbuild-kit/esm-loader`のdeprecated警告は区別する。新しいstable `0.31.11`でもこの経路は残るため、今回この理由だけで更新しない。該当esbuildのHTTP開発サーバーを起動せず、runtime bundleに含めず、導入時と後続更新で上流の解消を再確認する。

Phase 50のToki作業時点では基盤は文書更新のみで、上記候補を基盤のpackage/lockfileへ適用しなかった。その後、同日の所有者指示で[基盤と両製品の依存修正](#基盤と両製品の依存修正)を実施した。Toki側はUndiciの限定更新後に独立lockfileから再install・全品質gateを通過し、監査は指摘0件となった。

## Phase 51のTokiへの導入結果

2026-10-05、上記固定版からReact/React DOM・React Router、Viteと3 plugins、Tailwind CSS、Testing Library3種・jsdom・React型2種の14 direct dependencyを導入した。公式npm metadataでstable/非deprecated、公開48日以上、Node/必須peer互換を再確認し、14 tarballのSHA-512は公式integrityと基盤lockfileに一致した。jsdom配下Undiciは`8.10.2`へ親限定overrideし、Miniflare配下の`7.29.1`と既存Sharp/Rolldown対策を維持する。

Toki独立lockfileは211→306 entries。追加113はすべて基盤の検証済みentryと一致し、既存entryのintegrity変更・基盤外の新version導入はない。従来のVitest経由Vite `8.3.0`/Rolldown `1.2.8`など18 entriesは、標準のdirect Vite `8.2.1`/既存override `1.2.4`へ統合して除去した。既存のdirect依存・7日gate・strict peer・install script許可は変更しない。

installとfrozen再install、Vite/Worker build・全品質gate、依存監査が成功。Tokiは全severityで指摘0件。HonoとDrizzle/Drizzle Kitは後続フェーズで、今回まだ導入していない。基盤・Tech Inbox・Daymarkのpackage/lockfileは変更せず、本番も未反映。

## Phase 52のTokiへの導入と依存修正

2026-10-06にHono `4.13.7`を完全固定で導入。公式npmの公開7日以上・非deprecated・Node互換、tarball SHA-512と基盤lockfileの一致を確認した。追加peer/推移依存はなく、Tokiのpackage entriesは306→307。

2026-10-09の全gateで、開発依存の新しいhigh 2件が検出された。Honoの指摘ではなく、[Sharpのlibrsvg](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)と[source-map-jsの索引付きsource map](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)である。Sharpは特定のglibc/Linux条件で不正SVGを処理した場合のメモリ脆弱性、source-map-jsは異常なsection offsetで長時間処理が止まる問題を修正する。

| 対象 | Tokiの限定更新 | 公式npm公開日 |
|---|---|---|
| Miniflare `5.20260815.0-alpha`配下 | Sharp `0.35.4 → 0.35.5`、対応する`@img/sharp`とlibvips `1.3.3 → 1.3.4` | Sharpは2026-09-27 |
| 既存source-map-js `1.2.1`のconsumer | `1.2.1 → 1.2.2` | 2026-09-30 |

修正2版の7日gate・Node互換・非deprecatedとtarball SHA-512を確認し、親/version限定overrideを適用した。lockfileのresolution変更はHonoと上記patch群だけで、他packageのversion/integrityは不変。既存のRolldown/Undici override・strict peer・install script許可を維持した。frozen再install・build・全品質gateが成功し、Toki監査は指摘0件。

共通基盤の読み取り監査は同日high 2・既存moderate 1だった。基盤とTech Inbox/Daymarkの依存修正はTokiのPhase 52には含めず、追随作業として残す。本番deploy・Cloudflare設定・データの変更は行わない。

## Phase 53のTokiへのDrizzle導入

2026-10-17、Drizzle ORM `0.45.2`をruntime、Drizzle Kit `0.31.10`を開発専用として完全固定で導入した。公式npmで公開日（ORM 2026-03-27、Kit 2026-03-17）・非deprecated・必須peerとNode互換を再確認し、2 tarballのSHA-512が公式integrityと基盤lockfileに一致した。新しいORM安定版へ無関係に更新せず、共通の検証済み版を使う。

Kitの補助依存tsxは、基盤と同じ`4.23.12`（2026-08-10公開、tarballのSHA-512一致）へconvergence overrideした。初回に自動解決された`4.23.15`は採用せず、KitとViteの任意peerで同じ版を使用する。既存esbuild `0.28.1`は維持する。Tokiのpackage entriesは307→368、追加61 entriesのversion/integrityはすべて基盤と一致し、既存entryのresolution/integrity変更・削除は0件。既存Viteのpeer metadataだけはtsx overrideで完全版へ絞られる。その他のoverride・7日gate・strict peer・install script許可は不変で、frozen再installに成功した。

監査はhigh/critical/low 0、moderate 1。Kitの最新stable `0.31.11`も`@esbuild-kit/esm-loader`を保持しており、既知のesbuild `0.18.20`の[開発サーバーadvisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99)は未解消だった。導入前に説明し、基盤と同様に該当HTTPサーバーを起動せず、互換範囲外の強制overrideを行わない。deprecated警告はKit自身ではなく推移依存のcore-utils/esm-loader各固定版による。Kitのschema生成APIは合成データのメモリ内比較だけに使い、本番Workerへ含めない検査とその回帰テストを追加した。

Drizzle schemaは既存物理DBへの型付きmappingであり、既存migrationを置き換えない。Kitはinline UNIQUEを名前付きindexとして生成し、削除triggerも表現しないため、生成DDLを既存DBへ適用しない。`drizzle.config.ts`の出力はGit無視対象`.tmp/drizzle-review`だけで、remote driver・資格情報・自動push/migrateのscriptは持たない。D1 driverとSQL bindingの利用は[Drizzle公式D1資料](https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1)と固定版の実装で確認した。品質検証と公開commitは[Progress](progress.md)へ記録する。

## 選定ルール

- StableまたはLTSだけを採用し、RC、Beta、Canary、Nightly、Git URL、直接tarball指定は採用しない。
- 通常リリースは公開から7日（10,080分）以上経過した完全バージョンだけを採用する。
- direct dependencyは完全固定し、pnpm lockfileをPhase 1で生成する。
- npm公式レジストリの`dist-tags`、公開日時、`engines`、`peerDependencies`、`deprecated`を確認した。
- 2026-08-26時点で、選定したdirect dependencyにdeprecated指定はない。
- 高・重大脆弱性の最終判定は、Phase 1で実際の推移依存を固定した後に`pnpm audit --audit-level high`で行う。該当があればPhase 1を完了扱いにしない。

## Runtimeとパッケージマネージャー

| 対象 | 採用版 | 公開日 | 状態・選定理由 | 公式情報 |
|---|---:|---:|---|---|
| Node.js | 24.19.0 | 2026-08-03 | Krypton LTS。24系の最新LTSで7日以上経過 | [Node.js archive](https://nodejs.org/en/download/archive/v24) |
| pnpm | 11.22.0 | 2026-08-15 | v11 Stable。11.23.0と11.24.0は7日未満のため不採用 | [npm metadata](https://registry.npmjs.org/pnpm/11.22.0) |

Node.js公式アーカイブ`node-v24.19.0-darwin-arm64.tar.xz`は、公式`SHASUMS256.txt`のSHA-256
`3f1cf157479c1480352083105e13faf9d008ede98e7e157746b6df940d197b94`と一致した。

pnpm公式npm tarballは、npm metadataのintegrity
`sha512-H/hwxMYTPf2I+yr8Rt0T1H8JyXlLQ4xv20fKmMrzvBY4HuC+k6CRuOOCTPAfiJ9G19niCRD7C+GrD7W6qA3WIQ==`と一致した。

## Runtime dependencies

| パッケージ | 採用版 | 公開日 | 状態・選定理由 | 公式情報 |
|---|---:|---:|---|---|
| react | 19.2.8 | 2026-07-21 | 19.2系Stable | [npm metadata](https://registry.npmjs.org/react/19.2.8) |
| react-dom | 19.2.8 | 2026-07-21 | Reactと同一パッチ。peer `react ^19.2.8`を満たす | [npm metadata](https://registry.npmjs.org/react-dom/19.2.8) |
| react-router | 8.3.0 | 2026-07-22 | v8 Stable。React 19.2.8とNode 24がpeer/engineを満たす | [npm metadata](https://registry.npmjs.org/react-router/8.3.0) |
| hono | 4.13.11 | 2026-09-29 | Workers対応Stable。Phase 57で静的配信の指摘に対応 | [npm metadata](https://registry.npmjs.org/hono/4.13.11) |
| zod | 4.6.6 | 2026-10-11 | v4 Stable。コレクション検証の指摘に対応 | [npm metadata](https://registry.npmjs.org/zod/4.6.6) |
| drizzle-orm | 0.45.2 | 2026-03-27 | D1 peerを持つStable。1.0はRCのため不採用 | [npm metadata](https://registry.npmjs.org/drizzle-orm/0.45.2) |
| jose | 6.2.9 | 2026-08-15 | Web API/Workers互換Stable。6.2.10は7日未満 | [npm metadata](https://registry.npmjs.org/jose/6.2.9) |

## Development dependencies

| パッケージ | 採用版 | 公開日 | 状態・選定理由 | 公式情報 |
|---|---:|---:|---|---|
| typescript | 7.0.2 | 2026-07-08 | npm stable tag。Nightlyを除外 | [npm metadata](https://registry.npmjs.org/typescript/7.0.2) |
| vite | 8.2.4 | 2026-10-06 | v8 Stable。開発サーバーの指摘に対応 | [npm metadata](https://registry.npmjs.org/vite/8.2.4) |
| @vitejs/plugin-react | 6.0.5 | 2026-07-30 | Vite 8をpeerで正式サポート。6.1.0は7日未満 | [npm metadata](https://registry.npmjs.org/%40vitejs%2Fplugin-react/6.0.5) |
| @cloudflare/vite-plugin | 1.53.0 | 2026-08-18 | Vite 8とWrangler 4.124.0をpeerで許可 | [npm metadata](https://registry.npmjs.org/%40cloudflare%2Fvite-plugin/1.53.0) |
| wrangler | 4.124.0 | 2026-08-18 | v4 Stable。Vite plugin 1.53.0と整合 | [npm metadata](https://registry.npmjs.org/wrangler/4.124.0) |
| drizzle-kit | 0.31.10 | 2026-03-17 | Stable。1.0はRCのため不採用 | [npm metadata](https://registry.npmjs.org/drizzle-kit/0.31.10) |
| tailwindcss | 4.3.3 | 2026-07-16 | Stable。Vite 8互換のためガイド記載4.1系から更新 | [npm metadata](https://registry.npmjs.org/tailwindcss/4.3.3) |
| @tailwindcss/vite | 4.3.3 | 2026-07-16 | peerでVite 8を正式サポート | [npm metadata](https://registry.npmjs.org/%40tailwindcss%2Fvite/4.3.3) |
| vitest | 4.1.12 | 2026-10-15 | サポート対象4.1系。Vite必須peerを明示固定して充足 | [npm metadata](https://registry.npmjs.org/vitest/4.1.12) |
| @vitest/coverage-v8 | 4.1.12 | 2026-10-15 | Vitestと同一パッチ | [npm metadata](https://registry.npmjs.org/%40vitest%2Fcoverage-v8/4.1.12) |
| @testing-library/react | 16.3.2 | 2026-01-19 | React 19をpeerで許可 | [npm metadata](https://registry.npmjs.org/%40testing-library%2Freact/16.3.2) |
| @testing-library/dom | 10.4.1 | 2025-07-27 | Testing Libraryの必須peerを明示固定 | [npm metadata](https://registry.npmjs.org/%40testing-library%2Fdom/10.4.1) |
| @testing-library/user-event | 14.6.5 | 2026-08-18 | 14.6.6は7日未満 | [npm metadata](https://registry.npmjs.org/%40testing-library%2Fuser-event/14.6.5) |
| jsdom | 30.0.1 | 2026-07-29 | Node 24.15以上を正式サポート | [npm metadata](https://registry.npmjs.org/jsdom/30.0.1) |
| @playwright/test | 1.62.1 | 2026-07-30 | Stable。1.63 alphaを除外 | [npm metadata](https://registry.npmjs.org/%40playwright%2Ftest/1.62.1) |
| @types/react | 19.2.18 | 2026-07-30 | React 19.2系 | [npm metadata](https://registry.npmjs.org/%40types%2Freact/19.2.18) |
| @types/react-dom | 19.2.4 | 2026-07-30 | 19.2.5は7日未満 | [npm metadata](https://registry.npmjs.org/%40types%2Freact-dom/19.2.4) |
| @types/node | 24.13.3 | 2026-07-08 | 実行環境と同じNode 24系を固定 | [npm metadata](https://registry.npmjs.org/%40types%2Fnode/24.13.3) |
| @biomejs/biome | 2.5.9 | 2026-08-17 | Stable。2.5.10は7日未満 | [npm metadata](https://registry.npmjs.org/%40biomejs%2Fbiome/2.5.9) |

## 互換性の要点

- React Router 8.3.0はNode `>=22.22.0`、React/React DOM `>=19.2.7`を要求し、選定値は満たす。
- Vite 8.2.4とReact plugin 6.0.5はNode `^20.19.0 || >=22.12.0`を要求し、Node 24.19.0は満たす。
- Cloudflare Vite plugin 1.53.0はVite 8とWrangler `^4.124.0`を許可する。
- Vitest 4.1.12はVite 8とNode 24を許可し、coverage packageも同一パッチで揃える。
- jsdom 30.0.1はNode `^24.15.0`を許可する。
- `@tailwindcss/vite 4.1.18`はVite 8をpeerで許可しないため不採用。判断は[ADR-0001](decisions/0001-tailwind-vite-8-compatibility.md)に記録した。
- `autoInstallPeers: false`と`strictPeerDependencies: true`を設定し、暗黙のpeer追加を避ける。
- Vite 8.2.1が許可する`rolldown ~1.2.1`は、初回解決時に一部platform bindingが7日未満となる1.2.5を選択した。7日ルールを緩和せず、同じ互換範囲で2026-08-12公開の1.2.4へconvergence overrideした。
- Wrangler 4.124.0とCloudflare Vite plugin 1.53.0が使用するworkerdは`1.20260815.1`である。`compatibility_date`は対応日である`2026-08-15`へ固定し、判断を[ADR-0002](decisions/0002-cloudflare-compatibility-date.md)へ記録した。
- Miniflare 5.20260815.0-alphaが固定するSharpは、同一minorの修正版`0.35.5`へ親version限定でoverrideする。2026-10-17に追加advisoryへ対応し、従来の`0.35.4`から更新した。7日gateとintegrityを維持し、判断は[ADR-0018](decisions/0018-security-patch-transitive-sharp.md)へ記録した。

## pnpm供給網設定

公式pnpm v11の設定名に合わせ、`pnpm-workspace.yaml`で次を強制する。

- `minimumReleaseAge: 10080`
- `minimumReleaseAgeIgnoreMissingTime: false`
- `minimumReleaseAgeStrict: true`
- `blockExoticSubdeps: true`
- `trustPolicy: no-downgrade`
- `trustLockfile: false`
- `strictDepBuilds: true`
- `dangerouslyAllowAllBuilds: false`
- 空の`allowBuilds`から開始し、必要なbuild scriptだけをPhase 1で個別審査する。
- pnpm v11では一般設定を`.npmrc`ではなく`pnpm-workspace.yaml`に置く。
- ガイド例の`saveExact`ではなく、現行公式設定の`savePrefix: ''`で完全固定する。

Phase 1の初回installで報告されたbuild scriptを確認し、次だけを許可した。

- `esbuild@0.18.20 || 0.25.12 || 0.28.1 || 0.28.2`: 各consumerが使うesbuildのplatform binary選択・検証に必要。
- `workerd@1.20260815.1`: WranglerとCloudflare Vite pluginが使うworkerdのplatform binary選択・検証に必要。

許可は完全バージョンに限定し、将来別バージョンが追加された場合はinstallを失敗させて再審査する。

## Lockfileと監査結果

- Phase 33は完了（本番未反映）。所有者承認済みpublic `Rizakura0110/tech-inbox`を作成し、`modules/tech-inbox`のgitlinkで製品commit `f749b0d32bf1351bdaf0cd846152096690b07ecf`を固定、`workspace:0.0.0`で統合した。package名と`private: true`を維持し、npm公開やGit URLのpackage dependencyは使わない。Daymarkと同様、製品自身のworkspace・lockfile・CI・auditと、基盤側の結合lockfile・全gateを分ける。
- Tech Inboxの独立lockfileはPhase 32の解決済みgraphから必要な210 package resolution・210 snapshotを抽出したもので、各entryのversion・integrity・依存関係は元の内容と一致する。新規の推移依存versionを解決せず、基盤の第三者`packages`・`snapshots`もPhase 32から変更しない。直接依存の完全固定、7日gate、integrity、peer検査、review済みinstall script制限を維持する。
- Phase 32後続CIのclient bundle上限超過を受け、Phase 33で独立install間の共有runtimeをdedupeして修正した。基盤rootのdevDependenciesへ既存versionのReact 19.2.8、React DOM 19.2.8、React Router 8.3.0、Zod 4.4.3、Drizzle ORM 0.45.2を明示し、appにも既存Zod 4.4.3を明示した。ViteとVitestの共有解決先を安定させるためのimporter変更であり、第三者versionの更新や供給網policyの緩和ではない。Testing Libraryも基盤の既存固定依存へ解決を統一し、既存size budgetを維持したままCIまで成功した。
- 作業コピー・clean checkoutの全品質gate、製品CI `35817744911`と基盤CI `35818210557`が成功した。基盤609 tests・Tech Inbox260 tests・Daymark69 tests・E2E37 passed/意図的skip1を確認した。独立auditは両製品とも既知脆弱性0、基盤auditはhigh/critical0・既存dev-only moderate1。詳細は[Progress](progress.md)へ記録し、本番反映はPhase 34で別途承認後に行う。
- Phase 32ではTech Inboxの製品コードを同一repositoryの`packages/tech-inbox`へ集約し、`@rizakura-hontai/tech-inbox`を`workspace:0.0.0`で参照する。旧`@tech-inbox/core`と記事専用contractsはこのpackageへ移し、共通`@rizakura-hontai/contracts`はHTTP契約だけを保持する。製品packageは`private: true`で、npm公開・Git URL dependency・新repository・新submoduleを追加しない。
- この整理のlockfile変更はworkspace importerと参照の配置変更だけで、第三者packageの完全version・integrity、7日gate、peer検査、install script許可、override、pnpm供給網設定を維持する。製品のReact 19.2.8/React Router 8.3.0 peerと単体test用依存も既存baselineの固定versionを使い、新しい第三者versionを導入しない。製品単体gateは`pnpm tech-inbox:check`、依存監査を含む結合gateは基盤の`pnpm check`で行う。
- 2026-09-11のPhase 26監査で、Miniflareが固定する`sharp 0.35.2`にhigh advisory [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)が検出された。親version限定overrideで修正版`sharp 0.35.4`へ更新し、同時にruntime direct dependencyのHonoを既知moderate advisory修正版`4.13.5`へ更新した。更新後はhigh 0・critical 0で、既知の開発用推移依存moderate 1件だけを継続する。
- 2026-09-01のPhase 23最終監査でも`pnpm audit --audit-level high`は成功し、高0件・重大0件だった。Phase 23では第三者dependencyとlockfileを変更していない。既知の開発専用・中程度1件は下記baselineから不変。
- Phase 22のDaymark画面は基盤と同じReact 19.2.8をpeerとして使用し、単体component testへ既存baselineのReact DOM、Testing Library、jsdom、React型定義を追加した。新しいversion・install script例外・runtime network依存は導入せず、Daymark単体と基盤のlockfileで同じ完全versionを固定した。

- Phase 20のDaymarkは所有者承認の[Git submodule方式](decisions/0012-daymark-git-submodule.md)に変更した。`workspace:0.0.0`参照と完全commit SHAで自作sourceを固定し、npmへは公開しない。Git URLをpackage dependencyに指定する方式ではない。第三者の完全version・7日gate・integrity・install script制限は両repositoryで維持する。Daymark単体lockfileと基盤lockfileを分け、独立CIと統合CIの両方を通す。

- 2026-08-31のPhase 20命名移行では所有者指示により、基盤の内部workspaceを`rizakura-hontai`、`@rizakura-hontai/web`、`@rizakura-hontai/contracts`、`@rizakura-hontai/db`へ変更した。第三者version・integrity・供給網設定は変更せず、`pnpm install --frozen-lockfile`で395 entriesのpolicy検証と再リンクを確認した。これはnpm packageの公開ではない。

- 2026-08-31のPhase 19では内部workspace名だけを`rizakura-me`、`@rizakura-me/web`、`@rizakura-me/contracts`、`@rizakura-me/db`へ整理した。`@tech-inbox/core`とmetadata-fetcherは記事専用として維持する。lockfileはworkspace参照名だけの変更で、第三者packageのversion・integrity・供給網設定を変更せず、`pnpm install --frozen-lockfile`で395 entriesのpolicy検証と再リンクを確認した。

- Phase 1で`pnpm-lock.yaml`を生成し、`pnpm install --frozen-lockfile`の再現実行に成功した。
- 2026-08-28のPhase 10最終監査でも`pnpm audit --audit-level high`は成功し、高0件・重大0件だった。direct dependencyとlockfileの変更はない。
- 中程度が1件ある。`drizzle-kit 0.31.10`の開発時だけ使われる推移依存`@esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild 0.18.20`が[GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99)に該当する。これはesbuild開発サーバーのアクセス制御に関する問題で、本アプリのruntime bundleには含まれない。該当HTTP開発サーバー機能を起動しない。上流が`~0.18.20`を要求しており、修正には互換範囲を越える変更が必要なため強制overrideは行わない。
- install時に`@esbuild-kit/core-utils 3.3.2`と`@esbuild-kit/esm-loader 2.6.5`のdeprecated警告がある。どちらも採用した`drizzle-kit 0.31.10`から到達する推移依存で、direct dependencyではない。Phase 2以降の依存更新時に上流解消を再確認する。
- StableのWranglerとCloudflare Vite pluginが内部で固定する`miniflare 5.20260815.0-alpha`、`unenv 2.0.0-rc.24`、`youch 4.1.0-beta.10`がlockfileに含まれる。直接採用やruntime API利用はせず、互換性を壊す強制overrideも行わない。例外条件と更新方針は[ADR-0003](decisions/0003-toolchain-transitive-prereleases.md)へ記録した。

## 公式ドキュメント

- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [pnpm 11 release](https://pnpm.io/blog/releases/11.0)
- [pnpm settings](https://pnpm.io/settings)
- [pnpm supply-chain security](https://pnpm.io/supply-chain-security)
- [React versions](https://react.dev/versions)
- [React Router](https://reactrouter.com/)
- [Vite releases](https://vite.dev/releases)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Hono on Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)
- [Drizzle with D1](https://orm.drizzle.team/docs/connect-cloudflare-d1)
- [Vitest releases](https://vitest.dev/releases.html)
- [Playwright](https://playwright.dev/docs/intro)
