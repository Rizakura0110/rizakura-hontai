# Tech Inbox

Tech Inboxは、あとで読む技術記事のURLを個人で保存・整理するためのWebアプリです。Cloudflare Accessで所有者1人だけに公開し、URL登録後のメタデータ取得は非同期で行います。取得に失敗してもURLは失わず、タイトルを手動編集できます。

## 主な機能

- URLの登録、重複防止、canonical URL重複時の安全な統合
- 未読・既読の切り替え、検索、状態・タグによる絞り込み、並べ替え
- タイトル・URLの編集、記事の削除
- 1記事10件までの複数タグ、タグごとの自動色、タグの追加・名前変更・削除
- 記事、URL alias、タグ、タグ付けを含むJSON exportと、既存データを上書きしない復元
- Queue経由の非同期メタデータ取得と安全な再試行

## 技術構成

```text
Chrome
  │
  ▼
Cloudflare Access
  │
  ▼
tech-inbox-app Worker
  ├─ React / React Router / Tailwind CSS
  ├─ Hono JSON API
  ├─ Access JWT再検証
  ├─ D1
  ├─ Queue producer / consumer
  └─ Rate Limiting bindings
            │
            ▼ Service Binding
tech-inbox-metadata-fetcher Worker
  └─ URL検証、外部HTML取得、メタデータ解析
```

アプリWorkerがStatic Assets、API、D1、Queueを担当します。metadata-fetcherは公開URL、D1、Queue、Secretsを持たず、Service Binding経由でのみ呼び出されます。

主要バージョンと採用理由は[Dependency baseline](docs/dependency-baseline.md)を参照してください。

## 対応環境

- 開発: macOS arm64、Node.js 24.19.0、pnpm 11.22.0
- 自動E2E: Desktop Chrome 1280 × 800、Mobile Chrome 320 × 700
- 実機確認: iPhone Chrome
- Android Chrome: 手順は用意済みですが、所有者判断で実機確認をスキップしています
- Safari、Firefox、Edgeは正式な動作保証対象外です

## Local setup

ツール、cache、設定、一時ファイルはrepository内へ置きます。現在の所有者用working copyでは、検証済みのNode.jsとpnpmを無視対象の`.tools/`へ配置しています。新しいcloneでは[Dependency baseline](docs/dependency-baseline.md)に記録したバージョンとchecksumを確認してから同じ場所へ用意してください。

```bash
export PROJECT_ROOT="/absolute/path/to/webclip"
export PATH="$PROJECT_ROOT/.tools/node/bin:$PROJECT_ROOT/.tools/pnpm/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export XDG_CONFIG_HOME="$PROJECT_ROOT/.config"
export XDG_CACHE_HOME="$PROJECT_ROOT/.cache"
export XDG_DATA_HOME="$PROJECT_ROOT/.local/share"
export TMPDIR="$PROJECT_ROOT/.tmp"
export PNPM_HOME="$PROJECT_ROOT/.tools/pnpm"
export COREPACK_HOME="$PROJECT_ROOT/.tools/corepack"
export PLAYWRIGHT_BROWSERS_PATH="$PROJECT_ROOT/.cache/ms-playwright"
export PNPM_CONFIG_NPMRC_AUTH_FILE="$PROJECT_ROOT/.config/pnpm-auth-empty"
cd "$PROJECT_ROOT"
pnpm install --frozen-lockfile
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm db:migrate:local
pnpm dev
```

`apps/web/.dev.vars`はlocal用の`ENVIRONMENT=local`とloopbackの`APP_ORIGIN`だけを使用し、commitしません。通常は`http://localhost:5173`を開きます。local D1は`apps/web/.wrangler/state`へ保存されます。

## Test and quality gates

標準の完了判定は次の1コマンドです。

```bash
pnpm check
```

format、lint、Cloudflare生成型、TypeScript、Vitest、coverage、fresh local D1、実HTTP API、production build、artifact budget、desktop/mobile Playwright、依存監査を順番に実行します。個別コマンドと基準は[Quality gates](docs/quality-gates.md)を参照してください。

同じ`pnpm check`はGitHub Actionsでも`main`へのpushとpull request時に実行します。CIはCloudflare credentialやproduction secretを受け取らず、本番へ接続しません。Markdownと`docs/`だけの変更では実行しません。

## Database migration

schema変更後はlocalでmigrationを生成・検証します。

```bash
pnpm db:generate
pnpm db:verify:local
pnpm api:verify:local
```

生成SQLとsnapshotをreviewし、既存データを壊さないことを確認してください。remote migrationは`pnpm check`へ含まれず、対象database、backupまたはTime Travel bookmark、所有者の明示許可を確認した場合だけ実行します。詳細は[Operations](docs/operations.md)を参照してください。

## Deploy

Cloudflareへのdeploy、remote migration、resource作成は自動の品質ゲートへ含めません。最小権限の短期API tokenをprocess environmentとして渡し、次の順序を守ります。

1. `pnpm check`
2. `pnpm cloudflare:preflight`
3. 必要な場合だけremote migration
4. 変更対象のWorkerだけをdeploy
5. Access保護、API、認証済み画面、Workers Logsを確認
6. deployment versionを`docs/progress.md`へ記録

実コマンド、停止条件、rollbackは[Cloudflare setup](docs/cloudflare-setup.md)と[Operations](docs/operations.md)に記載しています。Access保護前のURLは文書化しません。

## Secrets

productionでは次の値をWorker Secretsとして登録します。実値はファイル、command引数、issue、commit、logへ残しません。

- `TEAM_DOMAIN`
- `POLICY_AUD`
- `ALLOWED_EMAIL`

Cloudflare API tokenもrepositoryへ保存せず、対象account・必要権限・短い有効期限に限定します。`.dev.vars`、`.env`、token、個人email allowlistはcommit禁止です。詳細は[Security](docs/security.md)を参照してください。

## Cost policy

初期版はCloudflare Freeプラン内、月額0円を方針とします。Workers Paid、独自ドメイン、R2、Workers AI、Browser Rendering、有料monitoringなどを所有者の合意なしに有効化しません。Free枠が不足する場合は、課金より先にpolling、再試行、Queue投入、取得項目を減らします。確認日と上限は[Cloudflare setup](docs/cloudflare-setup.md)に記録しています。

## 初期版で対応しないもの

- PWA、Service Worker、offline、Web Push、ホーム画面install
- RSS、自動AI要約、AIタグ付け
- 記事本文・画像の保存
- メモ、お気に入り、優先度、共有、コメント
- 複数ユーザー、組織、招待、権限管理
- React Native、Share Extension、Android共有、native通知
- R2、KV、Durable Objects、Vectorize、Workers AI、Browser Rendering
- ダークモードとChrome以外の正式保証

## Troubleshooting

### Node.jsまたはpnpmのversion error

`.tools/node/bin/node --version`と`.tools/node/bin/node .tools/pnpm/bin/pnpm.cjs --version`がbaselineと一致するか確認します。systemのNodeやpnpmが先に解決されていないか`PATH`も確認してください。

### LocalでAPIが403になる

`apps/web/.dev.vars`の`ENVIRONMENT`が完全一致で`local`、`APP_ORIGIN`が実際に開いているHTTP loopback originと一致するか確認します。公開originや不一致設定ではlocal認証迂回を行いません。

### Cloudflare生成型が古い

bindingを変更した場合は`pnpm cf:typegen`を実行し、生成差分をreviewしてから`pnpm cf:typecheck`を実行します。

### メタデータを取得できない

記事はURLだけで残ります。画面の再取得操作を試し、必要ならタイトルを手動編集してください。継続する場合はQueue、DLQ、metadata-fetcher logsを[Operations](docs/operations.md)の手順で確認します。

### E2E browserが見つからない

Playwright browserを`PLAYWRIGHT_BROWSERS_PATH`で指定したrepository内cacheへ導入してから`pnpm e2e`を再実行します。systemやhome directoryへtest browserを置きません。

### ProductionでAccess loginへ戻る

未認証時のredirectは正常です。認証後も戻る場合はAccess application、完全一致email policy、session、`TEAM_DOMAIN`、`POLICY_AUD`、`ALLOWED_EMAIL`を確認します。実値をterminal outputや文書へ貼り付けないでください。

## Documentation

- [Security](docs/security.md)
- [Operations](docs/operations.md)
- [Cloudflare setup](docs/cloudflare-setup.md)
- [Quality gates](docs/quality-gates.md)
- [Manual device test](docs/manual-device-test.md)
- [Progress](docs/progress.md)
- [Architecture decisions](docs/decisions/)
