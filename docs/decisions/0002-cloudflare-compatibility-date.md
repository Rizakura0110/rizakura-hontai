# ADR-0002: Cloudflare compatibility dateを2026-08-15へ固定する

- Status: Accepted
- Date: 2026-08-26

## Context

Cloudflare Workersの`compatibility_date`は、Workerが利用するruntime挙動を固定する。開発日である2026-08-26を指定すると、現在固定しているWrangler 4.124.0とCloudflare Vite plugin 1.53.0に同梱されたworkerd 1.20260815.1より新しいruntime日付になり、ローカル実行環境が対応できない。

## Decision

Web Workerとmetadata fetcherの`compatibility_date`を、固定済みworkerdが対応する`2026-08-15`へ揃える。WranglerまたはCloudflare Vite pluginを更新するときに、同梱workerdと公式release情報を確認して日付を更新する。

## Consequences

- ローカル開発、テスト、ビルドで同じruntime互換挙動を再現できる。
- 開発日そのものではなく、採用runtimeが確実に対応する日付を使う。
- 新しいcompatibility flagやruntime挙動は、依存更新時の検証を経るまで有効にならない。

## References

- [Cloudflare compatibility dates](https://developers.cloudflare.com/workers/configuration/compatibility-dates/)
- [Wrangler 4.124.0 release](https://github.com/cloudflare/workers-sdk/releases/tag/wrangler%404.124.0)
- [Cloudflare Vite plugin 1.53.0 release](https://github.com/cloudflare/workers-sdk/releases/tag/%40cloudflare%2Fvite-plugin%401.53.0)
