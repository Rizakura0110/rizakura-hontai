# rizakura-hontai

rizakura-hontaiは、本人限定のツールへの入口と共通基盤です。記事管理のTech Inboxは同じrepository内の独立workspace packageへ整理し、習慣管理のDaymarkは別repositoryから統合します。Daymarkの日次記録・設定履歴・日/週/月集計、保護API、responsive画面、独立PWA、製品別JSONバックアップを実装しました。Cloudflare Accessと既存のapp Worker・D1を共有し、Phase 25で本番反映と3年分データのFree CPU境界まで検証した構成です。

## 実装と本番の状態

Phase 19では共通基盤と入口をローカル実装しました。`/`から`/tech-inbox/`と`/daymark/`へ進み、各製品から入口へ戻れます。記事設定は`/tech-inbox/settings`です。旧`/articles`・`/settings`はqueryを維持して移動します。Daymarkでは日次入力、週/月履歴、習慣追加・名称/目標/状態変更を操作できます。

Phase 19〜24の統合変更とDaymark migration `0002`は、Phase 25で既存のapp Worker・D1へ反映済みです。基盤名をrizakura-hontaiへ変更し、GitHub repositoryは旧webclipから[Rizakura0110/rizakura-hontai](https://github.com/Rizakura0110/rizakura-hontai)へ改名済みです。既存の別repository `rizakura-me`には触れていません。Phase 25時点ではWorker・DB名・本番URLを維持しました。Daymarkは別public repositoryをcommit固定のGit submoduleとして取り込み、npmには公開しません。iPhone Safariで入口、Tech Inbox、Daymarkの独立PWAと日・週・月への記録反映まで確認済みです。[設計書](docs/rizakura-hontai-design.md)と[フェーズ計画](docs/rizakura-hontai-roadmap.md)を参照してください。

Phase 26〜27で実装・検証したTech Inboxの既読活動APIと`/tech-inbox/activity`画面は、2026-09-14にPhase 28で既存app Workerへ反映しました。直近365日の草、日別件数、全期間・今月の既読数と連続日数を表示します。現在の既読状態を数えるため、未読へ戻す・削除すると元の日から減り、再び既読にすると新しい日へ移ります。表示・更新とPCの主要操作、Access・CPU・全自動品質gateを確認してPhase 28を完了しました。iPhoneは所有者判断で今回はスキップし、後日確認へ延期しています。

Phase 30では共用D1を`tech-inbox`から新しい`rizakura-hontai`へコピーし、全データ・schema/index・migration履歴の一致を確認して接続先を切り替えました。保存とQueue配送を再開し、所有者の表示・保存確認まで完了しました。旧DBは接続せず保持しています。Phase 30時点ではWorker名・URL・Access・PWA・料金プランとローカルdirectoryを変更していません。以後、旧DBを指すversionへ直接rollbackしないでください。[移行手順](docs/foundation-migration.md)

Phase 31は完了しました。2026-09-22に既存WorkerとAccess表示名を`rizakura-hontai`へ改名し、APP_ORIGINを更新しました。Worker・AccessのID、audience、本人限定policy、D1接続先と全データを維持し、新originの未認証9経路がAccessへredirectされることを確認して、保存とQueue配送を再開しています。所有者からPCでの新URLログイン、記事・タグ・活動とDaymarkの日/週/月表示、両製品の保存・再読み込み反映の成功報告を受領しました。2026-09-23には新originからiPhone SafariでTech Inbox/DaymarkをそれぞれPWAへ追加し直し、新アイコンからの起動・ログイン・表示・保存・閉じて再起動まで成功報告を受領しています。現行originは`apps/web/wrangler.jsonc`を参照してください。

Phase 32ではTech Inboxの画面、記事・タグ・活動・backup・metadata処理、契約、schema定義、単体testを`packages/tech-inbox`へ集約しました。機能・URL・API・DB migrationを変えず、認証・HTTP/D1 adapter・共通UIは基盤に残し、基盤から製品へ必要なrepository・client・UIを注入します。この整理では本番へdeployせず、新repositoryやCloudflare resourceも作成しません。Phase 33の別repository・固定submodule化は公開範囲と対象を確認してから行い、本番反映はPhase 34で別途実施します。検証結果と完了状態は[Progress](docs/progress.md)を参照してください。

## DaymarkのPhase 21〜23機能

- 日次のチェック習慣と、単位・目標・以上/以下を持つ数値習慣
- JST基準で今日・過去の記録を保存・修正・未入力へ戻す。未来日は拒否
- 有効・休止・アーカイブと、今日以降に適用する目標/状態の履歴
- 未入力・明示的未達・達成を区別した日次表示用データ
- 月曜〜日曜の週集計と、日別達成率を返す月集計
- 共通認証、Origin/JSON/client header検証、read/mutate Rate Limitを通る`/api/v1/daymark/*`
- 日次のチェック・数値入力、過去日移動、未入力への戻し
- 月曜始まりの週tableと、暦月の達成カレンダー
- 習慣追加、名称変更、目標・単位・達成条件・状態の変更
- desktop sidebarとmobile bottom navigationを持つresponsive画面
- `/daymark/`を起動先・scope・idとするDaymark専用manifest/icon/PWA
- 習慣、設定履歴、日次記録を含むDaymark専用JSON schema v1の書き出し
- 追加・一致・競合・ID再割り当てをpreviewし、既存値を上書きしない復元
- 4 MiB・習慣200件・設定履歴2,000件・日次記録20,000件の明示上限。超過時は切り捨てず停止

## Tech Inboxの主な機能

あとで読む技術記事を保存・整理します。URL登録後のメタデータ取得は非同期で行い、取得に失敗してもURLを保持してタイトルを手動編集できます。

- URLの登録、重複防止、canonical URL重複時の安全な統合
- 未読・既読の切り替え、検索、状態・タグによる絞り込み、並べ替え
- 既読活動の365日gridと要約、日付選択（本番反映・PC確認済み、iPhone確認はスキップ）
- タイトル・URLの編集、記事の削除
- 1記事10件までの複数タグ、タグごとの自動色、タグの追加・名前変更・削除
- 記事、URL alias、タグ、タグ付けを含むJSON exportと、既存データを上書きしない復元
- Queue経由の非同期メタデータ取得と安全な再試行
- iPhoneのホーム画面からstandalone表示で起動できるPWA

## 技術構成

```text
Chrome
  │
  ▼
Cloudflare Access
  │
  ▼
rizakura-hontai Worker
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

共通の認証・request検証・Rate Limit・安全なlogは`apps/web/src/worker/platform/`、記事HTTP接続は`tech-inbox-api.ts`へ分離しています。共通layout・dialog・通知・HTTP clientは`apps/web/src/client/platform/`にあります。共用D1をPhase 30で、app Worker名とAccess表示名をPhase 31で`rizakura-hontai`へ切り替えました。記事専用Queue・metadata-fetcherのresource名は維持します。

| 配置 | 責務 |
|---|---|
| `packages/tech-inbox` (`@rizakura-hontai/tech-inbox`) | 製品画面、契約、domain/service、backup、metadata処理、記事schema、単体test |
| `modules/daymark` (`@rizakura-hontai/daymark`) | 固定commitで取り込むDaymark製品 |
| `packages/contracts` (`@rizakura-hontai/contracts`) | 製品に依存しない共通HTTP契約のみ |
| `packages/db` (`@rizakura-hontai/db`) | 両製品schemaの集約、既存migration履歴 |
| `apps/web` (`@rizakura-hontai/web`) | 入口、認証・HTTP/UI接続、D1 adapter、Queue/runtime接続、結合test |
| `workers/metadata-fetcher` | Cloudflare用の薄いentrypointと設定。取得・解析処理は製品packageへ委譲 |

旧`@tech-inbox/core`はPhase 32で製品packageの`core` entrypointへ統合しました。製品packageから基盤・Daymark・Cloudflare設定を参照せず、server/schema/metadataをbrowserへ混入させないsource検査とbuild検査を設けています。

主要バージョンと採用理由は[Dependency baseline](docs/dependency-baseline.md)を参照してください。

## 対応環境

- 開発: macOS arm64、Node.js 24.19.0、pnpm 11.22.0
- 自動E2E: Desktop Chrome 1280 × 800、Mobile Chrome 320 × 700
- 実機確認: iPhone Chrome
- PWAのインストール・standalone表示: iPhone Safari（2026-09-02に旧originで両製品の独立PWAを本番確認。2026-09-23にPhase 31の新originで再追加・起動・ログイン・表示・保存・再起動を確認）
- Android Chrome: 手順は用意済みですが、所有者判断で実機確認をスキップしています
- 通常の機能確認におけるSafari、Firefox、Edgeは正式な動作保証対象外です

## iPhone PWA

productionへログインした状態でiPhone Safariの共有メニューを開き、「ホーム画面に追加」から「Webアプリとして開く」を有効にします。追加後はホーム画面のTech Inboxアイコンから、URL barのないstandalone表示で起動できます。

PWAは現在のapp WorkerとCloudflare Accessをそのまま使用します。Service Workerとoffline cacheは登録しないため、利用時はnetwork接続が必要です。Access sessionの期限が切れた場合は再ログインします。

各製品画面から個別に追加します。入口にはmanifestを付けず、Tech Inboxの既存PWA id `/`を維持して起動先・scopeを`/tech-inbox/`へ分けています。Daymarkはid・起動先・scopeを`/daymark/`とする別PWAです。インストール済みTech Inboxの移行とDaymarkの追加・直接起動は、Phase 25でiPhone確認済みです。

Phase 31ではoriginが変わるため、id/scope/pathが同じでも既存のPWAから自動移行するとは扱いません。新originへSafariでログインし、`/tech-inbox/`と`/daymark/`をそれぞれホーム画面へ追加し直します。新しい各アイコンから直接起動・表示・保存できることを確認してから、旧アイコンを削除してください。旧hostnameの自動redirectは前提にしません。新originでの実機結果は[実機checklist](docs/manual-device-test.md)へ記録します。

2026-09-23に所有者から両PWAの再追加・起動・ログイン・表示・保存・閉じて再起動の成功報告を受領しました。OS/browserのversion、強制logout後の再ログイン、旧アイコン削除の個別報告は未提供です。旧アイコン削除は整理のための任意操作で、Phase 31の完了条件にはしません。

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
git submodule update --init -- modules/daymark
pnpm install --frozen-lockfile
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm db:migrate:local
pnpm dev
```

`apps/web/.dev.vars`はlocal用の`ENVIRONMENT=local`とloopbackの`APP_ORIGIN`だけを使用し、commitしません。通常は`http://localhost:5173`を開きます。local D1は`apps/web/.wrangler/state`へ保存されます。

## Daymarkの取り込み・更新

`modules/daymark`は[別repository](https://github.com/Rizakura0110/daymark)のGit submoduleです。初回は上記の初期化command、または`git clone --recurse-submodules`で取得します。npmログインは不要です。

Daymarkの変更を単体test・reviewしてcommit/pushした後、基盤側で組み合わせを検証します。

```bash
pnpm --dir modules/daymark check
pnpm check
git add modules/daymark
# 基盤の他のin-scope変更と参照commitをreview・commit・pushする
```

`git -C modules/daymark status`で別repositoryの変更を確認できます。基盤へ記録するのはDaymarkのsourceコピーではなくcommit SHAです。Daymarkだけのpushでは基盤・本番は変わりません。build/deploy中に`--remote`で最新版を取り込まず、reviewしたcommitだけを使います。Cloudflareへの反映は別途承認後に行います。

新cloneのsubmoduleは通常detached HEADなので、編集前に作業branchを確認します。基盤のpull後は、未commit変更がないことを確認して`git submodule update --init -- modules/daymark`で記録されたcommitへ揃えます。未保存の変更を強制的に破棄する操作はしません。

## Test and quality gates

標準の完了判定は次の1コマンドです。

```bash
pnpm check
```

DaymarkとTech Inboxの製品単体gateに続き、format、lint、Cloudflare生成型、TypeScript、Vitest、coverage、fresh local D1、実HTTP API、production build、artifact budget、desktop/mobile Playwright、依存監査を順番に実行します。個別コマンドと基準は[Quality gates](docs/quality-gates.md)を参照してください。

Tech Inboxだけのformat・lint・TypeScript・coverage付き単体test・宣言付きbuildは`pnpm tech-inbox:check`で確認できます。製品UIは注入client/UIのmockで単体検証し、実際のHTTP・共通UIとの接続は基盤の既存component/page testとE2Eでも検証します。単体gateだけでは基盤との組み合わせを保証しないため、phase完了には`pnpm check`全体が必要です。

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

本番の定期確認では、同じprocess environmentを使って読み取り専用のhealth checkを実行できます。

```bash
pnpm cloudflare:health
```

現在のQueue/DLQ backlogと、直近24時間のQueue terminal failure、app Worker、metadata-fetcherのrequest・error・status集計だけを確認します。message本文、記事情報、credential、account詳細、所有者情報は取得・表示しません。通常Queueのbacklog、新しいDLQ/fail、Worker errorまたはnon-success invocationがあれば失敗し、過去から保持されているDLQ backlogは警告だけを表示します。

## Secrets

productionでは次の値をWorker Secretsとして登録します。実値はファイル、command引数、issue、commit、logへ残しません。

- `TEAM_DOMAIN`
- `POLICY_AUD`
- `ALLOWED_EMAIL`

Cloudflare API tokenもrepositoryへ保存せず、対象account・必要権限・短い有効期限に限定します。`.dev.vars`、`.env`、token、個人email allowlistはcommit禁止です。詳細は[Security](docs/security.md)を参照してください。

## Cost policy

初期版はCloudflare Freeプラン内、月額0円を方針とします。Workers Paid、独自ドメイン、R2、Workers AI、Browser Rendering、有料monitoringなどを所有者の合意なしに有効化しません。Free枠が不足する場合は、課金より先にpolling、再試行、Queue投入、取得項目を減らします。確認日と上限は[Cloudflare setup](docs/cloudflare-setup.md)に記録しています。

Phase 24では、Daymark復元のD1 bound valueをUTF-8で1,000,000 bytes以下に分割し、snapshot取得を含む50 query/invocation以内へ制限しました。最大復元はD1の日次write枠に近いため、同じUTC日の大容量復元を重ねません。Phase 25では3年分backupの書き込みなしpreviewを最大400記録/requestへ分割し、本番で29 requestすべて成功、例外0、コールド最大約12.3 ms、ウォーム後P99約9.1 msを確認しました。

## 初期版で対応しないもの

- Service Worker、offline、Web Push
- RSS、自動AI要約、AIタグ付け
- 記事本文・画像の保存
- メモ、お気に入り、優先度、共有、コメント
- 複数ユーザー、組織、招待、権限管理
- React Native、Share Extension、Android共有、native通知
- R2、KV、Durable Objects、Vectorize、Workers AI、Browser Rendering
- ダークモードとChrome以外の全機能の正式保証（iPhone SafariのPWA確認は上記の範囲で実施済み）

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

- [rizakura-hontai / Daymark design](docs/rizakura-hontai-design.md)
- [rizakura-hontai phase roadmap](docs/rizakura-hontai-roadmap.md)
- [Cloudflare名称移行・Tech Inbox分離の手順](docs/foundation-migration.md)
- [Security](docs/security.md)
- [Operations](docs/operations.md)
- [Cloudflare setup](docs/cloudflare-setup.md)
- [Quality gates](docs/quality-gates.md)
- [Manual device test](docs/manual-device-test.md)
- [Progress](docs/progress.md)
- [Architecture decisions](docs/decisions/)
