# Dependency baseline

確認日: 2026-08-28
対象環境: macOS arm64 / Cloudflare Workers / Node.js 24 LTS / pnpm 11

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
| hono | 4.13.3 | 2026-08-18 | Workers対応Stable。4.13.4以降は7日未満 | [npm metadata](https://registry.npmjs.org/hono/4.13.3) |
| zod | 4.4.3 | 2026-05-04 | v4 Stable | [npm metadata](https://registry.npmjs.org/zod/4.4.3) |
| drizzle-orm | 0.45.2 | 2026-03-27 | D1 peerを持つStable。1.0はRCのため不採用 | [npm metadata](https://registry.npmjs.org/drizzle-orm/0.45.2) |
| jose | 6.2.9 | 2026-08-15 | Web API/Workers互換Stable。6.2.10は7日未満 | [npm metadata](https://registry.npmjs.org/jose/6.2.9) |

## Development dependencies

| パッケージ | 採用版 | 公開日 | 状態・選定理由 | 公式情報 |
|---|---:|---:|---|---|
| typescript | 7.0.2 | 2026-07-08 | npm stable tag。Nightlyを除外 | [npm metadata](https://registry.npmjs.org/typescript/7.0.2) |
| vite | 8.2.1 | 2026-08-06 | v8 Stable。8.2.2は7日未満 | [npm metadata](https://registry.npmjs.org/vite/8.2.1) |
| @vitejs/plugin-react | 6.0.5 | 2026-07-30 | Vite 8をpeerで正式サポート。6.1.0は7日未満 | [npm metadata](https://registry.npmjs.org/%40vitejs%2Fplugin-react/6.0.5) |
| @cloudflare/vite-plugin | 1.53.0 | 2026-08-18 | Vite 8とWrangler 4.124.0をpeerで許可 | [npm metadata](https://registry.npmjs.org/%40cloudflare%2Fvite-plugin/1.53.0) |
| wrangler | 4.124.0 | 2026-08-18 | v4 Stable。Vite plugin 1.53.0と整合 | [npm metadata](https://registry.npmjs.org/wrangler/4.124.0) |
| drizzle-kit | 0.31.10 | 2026-03-17 | Stable。1.0はRCのため不採用 | [npm metadata](https://registry.npmjs.org/drizzle-kit/0.31.10) |
| tailwindcss | 4.3.3 | 2026-07-16 | Stable。Vite 8互換のためガイド記載4.1系から更新 | [npm metadata](https://registry.npmjs.org/tailwindcss/4.3.3) |
| @tailwindcss/vite | 4.3.3 | 2026-07-16 | peerでVite 8を正式サポート | [npm metadata](https://registry.npmjs.org/%40tailwindcss%2Fvite/4.3.3) |
| vitest | 4.1.11 | 2026-08-18 | サポート対象4.1系。Vite 8とNode 24をpeer/engineで許可 | [npm metadata](https://registry.npmjs.org/vitest/4.1.11) |
| @vitest/coverage-v8 | 4.1.11 | 2026-08-18 | Vitestと同一パッチ | [npm metadata](https://registry.npmjs.org/%40vitest%2Fcoverage-v8/4.1.11) |
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
- Vite 8.2.1とReact plugin 6.0.5はNode `^20.19.0 || >=22.12.0`を要求し、Node 24.19.0は満たす。
- Cloudflare Vite plugin 1.53.0はVite 8とWrangler `^4.124.0`を許可する。
- Vitest 4.1.11はVite 8とNode 24を許可し、coverage packageも同一パッチで揃える。
- jsdom 30.0.1はNode `^24.15.0`を許可する。
- `@tailwindcss/vite 4.1.18`はVite 8をpeerで許可しないため不採用。判断は[ADR-0001](decisions/0001-tailwind-vite-8-compatibility.md)に記録した。
- `autoInstallPeers: false`と`strictPeerDependencies: true`を設定し、暗黙のpeer追加を避ける。
- Vite 8.2.1が許可する`rolldown ~1.2.1`は、初回解決時に一部platform bindingが7日未満となる1.2.5を選択した。7日ルールを緩和せず、同じ互換範囲で2026-08-12公開の1.2.4へconvergence overrideした。
- Wrangler 4.124.0とCloudflare Vite plugin 1.53.0が使用するworkerdは`1.20260815.1`である。`compatibility_date`は対応日である`2026-08-15`へ固定し、判断を[ADR-0002](decisions/0002-cloudflare-compatibility-date.md)へ記録した。

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

- 2026-09-01のPhase 23最終監査でも`pnpm audit --audit-level high`は成功し、高0件・重大0件だった。Phase 23では第三者dependencyとlockfileを変更していない。既知の開発専用・中程度1件は下記baselineから不変。
- Phase 22のDaymark画面は基盤と同じReact 19.2.8をpeerとして使用し、単体component testへ既存baselineのReact DOM、Testing Library、jsdom、React型定義を追加した。新しいversion・install script例外・runtime network依存は導入せず、Daymark単体と基盤のlockfileで同じ完全versionを固定した。

- Phase 20のDaymarkは所有者承認の[Git submodule方式](decisions/0012-daymark-git-submodule.md)に変更した。`workspace:0.0.0`参照と完全commit SHAで自作sourceを固定し、npmへは公開しない。Git URLをpackage dependencyに指定する方式ではない。第三者の完全version・7日gate・integrity・install script制限は両repositoryで維持する。Daymark単体lockfileと基盤lockfileを分け、独立CIと統合CIの両方を通す。

- 2026-08-31のPhase 20命名移行では所有者指示により、基盤の内部workspaceを`rizakura-hontai`、`@rizakura-hontai/web`、`@rizakura-hontai/contracts`、`@rizakura-hontai/db`へ変更した。第三者version・integrity・供給網設定は変更せず、`pnpm install --frozen-lockfile`で395 entriesのpolicy検証と再リンクを確認した。これはnpm packageの公開ではない。

- 2026-08-31のPhase 19では内部workspace名だけを`rizakura-me`、`@rizakura-me/web`、`@rizakura-me/contracts`、`@rizakura-me/db`へ整理した。`@tech-inbox/core`とmetadata-fetcherは記事専用として維持する。lockfileはworkspace参照名だけの変更で、第三者packageのversion・integrity・供給網設定を変更せず、`pnpm install --frozen-lockfile`で395 entriesのpolicy検証と再リンクを確認した。

- Phase 1で`pnpm-lock.yaml`を生成し、`pnpm install --frozen-lockfile`の再現実行に成功した。
- 2026-08-28のPhase 10最終監査でも`pnpm audit --audit-level high`は成功し、高0件・重大0件だった。direct dependencyとlockfileの変更はない。
- 中程度が1件ある。`drizzle-kit 0.31.10`の開発時だけ使われる推移依存`@esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild 0.18.20`が[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)に該当する。これはesbuild開発サーバーのアクセス制御に関する問題で、本アプリのruntime bundleには含まれない。修正版はesbuild 0.24.3以上だが、上流が`~0.18.20`を要求しているため、互換範囲を越える強制overrideは行わない。
- install時に`@esbuild-kit/core-utils 3.3.2`と`@esbuild-kit/esm-loader 2.6.5`のdeprecated警告がある。どちらも最新Stableの`drizzle-kit 0.31.10`から到達する推移依存で、direct dependencyではない。Phase 2以降の依存更新時に上流解消を再確認する。
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
