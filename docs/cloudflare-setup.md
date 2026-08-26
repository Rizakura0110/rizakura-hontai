# Cloudflare setup

## Phase 0 cost baseline

確認日: 2026-08-26

この時点ではCloudflareアカウントへのログイン、リソース作成、設定変更、課金プラン変更、デプロイを行っていない。

| 製品・機能 | Freeプランの確認結果 | 初期版での扱い | 公式情報 |
|---|---|---|---|
| Workers | 100,000 requests/day、10 ms CPU/invocation | 2 Worker構成で使用 | [Pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Static Assets | Workers Freeの制限内で利用可能 | React SPAをapp Workerと同一originで配信 | [Limits](https://developers.cloudflare.com/workers/platform/limits/) |
| D1 | 5 million rows read/day、100,000 rows written/day | 1人用記事DBとして使用 | [Pricing](https://developers.cloudflare.com/workers/platform/pricing/#d1) |
| Queues | 10,000 operations/day、Freeのretentionは24時間 | metadata処理とDLQに使用 | [Pricing](https://developers.cloudflare.com/queues/platform/pricing/) |
| Cloudflare Access | Freeは50 usersまで | 許可メールアドレス1件だけ | [Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/) |
| Service Bindings | Worker間呼び出しとして公式サポート。subrequestに算入 | fetcherを非公開で呼ぶ | [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) |
| Worker Rate Limiting API | Wrangler 4.36.0以上が必要。独立した有料SKUの記載は確認されなかった | Phase 6でlocal設定し、Phase 9直前にアカウント上の追加課金有無を再確認 | [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) |

## Cost gate

- Workers Paid、独自ドメイン、その他の有料製品は有効化しない。
- Free枠超過時はmetadata頻度、再試行、polling、取得項目を先に削減する。
- Rate Limiting Bindingを含め、リモート設定前に料金ページとCloudflare dashboard表示を再確認する。
- 課金同意画面または有料プラン必須表示が出た場合は処理を中止し、`docs/decision-needed.md`へ記録する。

## Phase 1 local configuration

- `apps/web`はCloudflare Vite pluginでReact SPAとHono Workerを同時にbuildする。
- Static Assetsは`not_found_handling: "single-page-application"`を使用し、`/api/*`だけを`run_worker_first`でWorkerへ送る。
- `/api/v1/health`は`Cache-Control: no-store`、JSON body、request IDを返す。
- Binding型は`wrangler types --env-interface CloudflareBindings`で`worker-configuration.d.ts`へ生成し、`--check`を品質ゲートへ含める。`@cloudflare/workers-types`をdirect dependencyにはしない。
- `compatibility_date`は同梱workerdに合わせて`2026-08-15`へ固定した。詳細は[ADR-0002](decisions/0002-cloudflare-compatibility-date.md)を参照する。
- `vite preview`で`/`、SPA fallback、health API、未知APIの応答を確認した。
- Cloudflareアカウントへのログイン、リソース変更、デプロイは行っていない。

## Phase 2 local D1 configuration

- `apps/web/wrangler.jsonc`へ`DB` bindingを追加し、local database名を`tech-inbox`とした。
- migration directoryは`packages/db/migrations`へ固定した。
- Phase 2では`database_id`を設定せず、bindingの`remote`も`false`としている。
- `pnpm db:migrate:local`は、Vite devと共有する無視対象の`apps/web/.wrangler/state`へlocal D1状態を永続化する。
- `pnpm db:verify:local`は、`.tmp`配下のfreshな一時状態へmigrationを適用し、履歴、table、index、CHECK、一意制約、外部キー、cascade、再適用を検証後に一時状態を削除する。
- D1設定から`CloudflareBindings`を再生成し、`DB: D1Database`が含まれることを確認した。
- Cloudflareアカウントへのログイン、remote D1作成、remote migration、デプロイは行っていない。
