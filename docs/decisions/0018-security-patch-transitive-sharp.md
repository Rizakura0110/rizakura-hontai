# ADR-0018: Miniflare配下のsharpへ修正版を限定適用する

- Status: Accepted
- Date: 2026-09-11

## Context

Phase 26の最終dependency auditで、Wrangler 4.124.0とCloudflare Vite plugin 1.53.0が固定する`miniflare 5.20260815.0-alpha`から、high severityの[GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)を含む`sharp 0.35.2`へ到達することが判明した。修正版は`sharp 0.35.4`以上である。

7日経過済みのCloudflare公式toolchain最新版は引き続き`sharp 0.35.2`を固定し、`sharp 0.35.4`を含む上流版は公開後7日未満だった。一方、`sharp 0.35.4`自体は2026-08-26公開のStableで、7日ルールを満たしている。

## Decision

direct dependencyのCloudflare toolchainは変更せず、`miniflare 5.20260815.0-alpha`の子dependency `sharp`だけを`0.35.4`へ置換する親version限定overrideを適用する。

この対応はhighまたはcritical advisoryの修正に限る。通常の推移依存更新へ一般化せず、完全version固定、公開後7日、registry integrity、install script制限、全品質gateを維持する。Cloudflare公式toolchainを将来更新して上流固定値が`0.35.4`以上になった時点でoverrideを削除する。

同じ監査で判明したHonoのmoderate advisoryは、公開後7日以上経過したdirect Stable修正版`4.13.5`へ通常更新して解消する。

## Consequences

- high severityの既知脆弱性を含む`sharp 0.35.2`をlockfileから除外できる。
- 親Miniflareのversionを限定するため、将来のCloudflare toolchain更新にoverrideを自動追従させない。
- Cloudflare公式が固定した組み合わせとの差分が生じるため、生成型、local D1、実HTTP、build、artifact budget、desktop/mobile E2Eを含む全gateで互換性を確認する。
- 新しいruntime resource、Cloudflare設定、本番migration、本番deployは発生しない。
