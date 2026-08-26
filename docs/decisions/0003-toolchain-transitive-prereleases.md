# ADR-0003: Stable toolchainが固定する推移pre-releaseを例外として受け入れる

- Status: Accepted
- Date: 2026-08-26

## Context

直接採用したWrangler 4.124.0、Cloudflare Vite plugin 1.53.0、Drizzle Kit 0.31.10は、公開後7日以上経過した公式Stableである。一方、これらが固定または要求する推移依存には次が含まれる。

- WranglerとCloudflare Vite pluginが固定する`miniflare 5.20260815.0-alpha`と`unenv 2.0.0-rc.24`
- Miniflareが固定する`youch 4.1.0-beta.10`
- Drizzle Kitが要求するdeprecatedな`@esbuild-kit/esm-loader 2.6.5`と`@esbuild-kit/core-utils 3.3.2`

これらはdirect dependencyとして選定したものではない。個別overrideは、公式Stable toolが検証した内部packageの組み合わせを崩し、Cloudflareのlocal runtime、build、deploy準備またはDrizzle CLIを壊す可能性がある。

## Decision

direct dependencyにはStableのみを完全固定する原則を維持する。公式Stable toolが直接固定・要求し、安全な互換版へ置換できない推移pre-releaseまたはdeprecated packageは、導入元、用途、監査結果を記録したうえで開発toolchain内に限って受け入れる。

強制overrideは行わない。direct dependencyを更新するときに到達経路を再確認し、上流で解消された時点でlockfileから除去する。highまたはcritical advisoryが検出された場合は、この例外を適用せず作業を停止して判断を求める。

## Consequences

- CloudflareとDrizzleの公式Stable toolchainが想定する組み合わせを維持できる。
- pre-release/deprecated packageをアプリのruntime dependencyとして直接利用しない。
- lockfile監査と`pnpm why`による到達経路確認を依存更新ごとに行う必要がある。
- 現在の監査結果はhigh 0、critical 0、moderate 1である。moderate 1件はDrizzle Kit配下の開発専用esbuildに限定される。
