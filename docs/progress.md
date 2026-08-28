# Progress

## Phase 0: 作業境界確認、環境監査、依存バージョン決定

### 実施内容

- `PROJECT_ROOT`を`/Users/ryo/dev/webclip`へ固定し、絶対パスとrealpathが一致することを確認した。
- 初期状態が空ディレクトリ、Git未初期化、外部向きsymlinkなしであることを確認した。
- `PROJECT_ROOT`直下をmain branchのGitリポジトリとして初期化した。global Git設定は変更していない。
- macOS arm64、Git 2.50.1、既存Node.js 22.22.3、既存pnpm 11.10.0を読み取り専用で確認した。
- 公式情報とnpm metadataから、公開後7日ルール、engine、peer dependencyを満たす完全バージョンを選定した。
- Node.js 24.19.0 LTSとpnpm 11.22.0をchecksum/integrity検証後、`.tools/`配下へローカル導入した。
- pnpm store、cache、config、data、temporary directoryをPROJECT_ROOT配下へ限定できる構成を追加した。
- pnpm v11の供給網保護設定を追加した。
- Cloudflare FreeプランのWorkers、D1、Queues、Accessを確認し、リモート変更を行わないcost gateを記録した。
- Tailwind 4.1系とVite 8のpeer不整合を解消するADRを追加した。

### 変更ファイル

- `.gitignore`
- `.node-version`
- `package.json`
- `pnpm-workspace.yaml`
- `docs/dependency-baseline.md`
- `docs/decisions/0001-tailwind-vite-8-compatibility.md`
- `docs/cloudflare-setup.md`
- `docs/progress.md`

### 採用判断

- Node.js 24.19.0 LTSを採用した。
- pnpm 11.22.0を採用し、7日未満の11.23.0と11.24.0は採用しなかった。
- Vite 8との正式なpeer互換性を確保するため、Tailwind CSS 4.3.3を採用した。
- direct dependencyの詳細は`docs/dependency-baseline.md`へ記録した。
- install scriptは空の`allowBuilds`から開始し、Phase 1で必要なpackageだけを審査する。

### 実行したコマンド

- `pwd -P`
- `find . -maxdepth 3 -type l -print`
- `uname -srm`
- `git --version`
- `git init -b main`
- `node --version`
- `pnpm --version`
- npm公式registry metadataの取得と`jq`による確認
- Node.js公式archiveと`SHASUMS256.txt`の取得
- `shasum -a 256 .tmp/node-v24.19.0-darwin-arm64.tar.xz`
- pnpm tarballのSHA-512 integrity計算
- `.tools/node/bin/node --version`
- `.tools/node/bin/node .tools/pnpm/bin/pnpm.cjs --version`
- project-local XDG/cache/store設定を指定した`pnpm doctor`

### 検証結果

- 作業境界: pass
- Node.js archive SHA-256: pass
- pnpm tarball SHA-512 integrity: pass
- local Node version: 24.19.0
- local pnpm version: 11.22.0
- pnpm doctor: pass（全項目成功）
- pnpm-workspace configuration parse: pass
- ignored local tool/cache/config directories: pass
- project-local tool symlinks: pass（すべて相対参照で`.tools/node`内に解決）
- package compatibility review: pass（Tailwind差異はADRで解消）
- Cloudflare remote changes: なし
- dependency audit: Phase 1でlockfile生成後に実施

### Phase 0終了時の未解決事項

- direct dependencyを含む実lockfileがまだないため、推移依存を含む`pnpm audit`はPhase 1の完了条件とする。
- Rate Limiting Bindingは公式ドキュメント上利用可能だが、リモート設定直前に追加課金が発生しないことを再確認する。

## Phase 1: Workspaceと最小アプリの構築

### 実施内容

- pnpm workspaceとして`apps/web`、`workers/metadata-fetcher`、`packages/contracts`、`packages/core`、`packages/db`を作成した。
- direct dependencyを完全固定し、lockfileを生成した。
- Biome、TypeScript strict、Vitest、V8 coverage、Playwrightの土台を設定した。
- React SPA、React Router、Tailwind CSSを構成し、画面からhealth APIへの接続状態を表示する最小画面を実装した。
- Honoで`GET /api/v1/health`と、未知API用の安全なJSON 404 responseを実装した。
- Cloudflare Vite pluginでSPAとWorkerを統合し、Static AssetsのSPA fallbackと`/api/*`のWorker優先routingを設定した。
- Wranglerから`CloudflareBindings`を生成し、型が設定と一致することを`--check`で検証するようにした。
- metadata fetcher Workerは、後続実装用の非公開設定`workers_dev: false`、`preview_urls: false`と最小entrypointだけを用意した。
- install時に実行されるesbuild/workerdのscriptを個別審査し、完全バージョン単位で許可した。
- Cloudflareへのログイン、リソース作成、設定変更、デプロイは行っていない。

### 変更ファイル

- Root: `.gitignore`、`.node-version`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`biome.json`、`tsconfig.base.json`、`tsconfig.tools.json`、`vitest.config.ts`
- Web: `apps/web/package.json`、`index.html`、`vite.config.ts`、`wrangler.jsonc`、`worker-configuration.d.ts`、Client/Worker/test source、runtime別tsconfig
- Metadata fetcher: `workers/metadata-fetcher/package.json`、`tsconfig.json`、`wrangler.jsonc`、`src/index.ts`
- Shared packages: `packages/contracts`、`packages/core`、`packages/db`のpackage/tsconfig/source、`packages/db/migrations/.gitkeep`
- Test scaffold: `tests/e2e/.gitkeep`
- Docs: `docs/dependency-baseline.md`、`docs/cloudflare-setup.md`、`docs/progress.md`、`docs/decisions/0001-*`、`0002-*`、`0003-*`

### 採用判断

- Phase 1のunit/component testは通常のVitestを使い、Cloudflare runtime専用test pluginはD1、Queue、Service Bindingを導入する後続フェーズまで追加しない。
- Hono handlerは`app.request()`で高速に検証し、Cloudflare routingを含む統合動作はproduction preview smoke testで補完する。
- direct dependencyはStable完全固定を維持する。Stable toolchainが内部固定する推移pre-release/deprecated packageだけを[ADR-0003](decisions/0003-toolchain-transitive-prereleases.md)の条件で受け入れる。
- Cloudflare `compatibility_date`は現在日付ではなく、固定workerdが対応する2026-08-15とする。
- Cloudflareリモート操作はPhase 1の対象外とし、local設定と検証だけに留める。

### 自動テスト構成

- 標準runnerはVitest 4.1.11、標準environmentはNodeとした。
- React component testだけをfile単位でjsdomに切り替え、Testing Libraryで表示とAPI疎通を確認する。
- Hono APIは外部serverを起動せず`app.request()`でhealth response、cache header、request ID、安全な404形式を確認する。
- `test:coverage`はV8 providerを使う。Phase 1時点では2 test files、3 testsが成功し、statements 85.71%、branches 58.33%、functions 87.5%、lines 85.18%だった。coverage thresholdは機能が増えるPhase 8で確定する。
- production相当の統合確認として`vite preview`を起動し、SPA、SPA fallback、health API、未知APIをHTTPでsmoke testした。
- Playwrightは将来の主要フローE2E用に固定済みだが、Phase 1には操作対象の機能がないためspecはまだ追加していない。

### TypeScript設定上の判断

- Client、Worker、Vite設定、testを別tsconfigへ分け、それぞれに必要なruntime型だけを読み込む。
- 本番sourceは`skipLibCheck: false`のstrict検査を維持する。
- Vitestの`tinybench 2.9.0`およびCloudflare toolchainの推移`.d.ts`にはTypeScript 7で発生する上流型エラーがあるため、tool/test設定だけ`skipLibCheck: true`とした。自分たちの`.ts`/`.tsx`はこの設定でも検査される。

### 検証結果

- `pnpm install --frozen-lockfile`: pass
- `pnpm format:check`: pass
- `pnpm lint`: pass
- `pnpm cf:typecheck`: pass
- `pnpm typecheck`: pass
- `pnpm test`: pass（2 files、3 tests）
- `pnpm test:coverage`: pass
- `pnpm build`: pass（Worker bundleとclient assetsを生成）
- production preview smoke test: pass
- `pnpm audit --audit-level high`: pass（high 0、critical 0、moderate 1）

### 実行した主なコマンド

- `pnpm install`、`pnpm install --frozen-lockfile`
- `pnpm cf:typegen`、`pnpm cf:typecheck`
- `pnpm format`、`pnpm format:check`、`pnpm lint`
- `pnpm typecheck`
- `pnpm test`、`pnpm test:coverage`
- `pnpm build`
- `pnpm preview -- --host 127.0.0.1 --port 4173`とlocal HTTP smoke request
- `pnpm audit --audit-level high`、`pnpm audit --json`
- `pnpm check`
- `pnpm why`によるbuild script、pre-release、deprecated、advisory到達経路の確認
- secret候補、direct prerelease指定、作業境界外symlinkの静的検査

### 既知事項

- moderate advisory 1件とdeprecatedな推移依存2件は`drizzle-kit 0.31.10`配下に限定される。内容と判断は`docs/dependency-baseline.md`へ記録した。
- Cloudflare runtimeの更新時は、Wrangler、Vite plugin、workerd、`compatibility_date`を一組として再検証する。

### 未解決事項

- Phase 1の実装・品質ゲートにblockerはない。
- ユーザーからPhase完了時のcommitと個人remoteへの直接pushが承認された。今後の永続的な運用条件はrootの`AGENTS.md`へ記録した。
- moderate advisoryと推移pre-release/deprecated packageは上流toolchain更新時に再確認する。

## Phase 2: Core、Contracts、DB schema

### 実施内容

- WHATWG URLを使う純粋なURL正規化を`packages/core`へ実装した。
- 記事、URL alias、一覧条件、repository入出力、metadata状態と列挙済みerror codeを、Cloudflare、React、D1へ依存しないdomain型として定義した。
- API request/response、Article DTO、Queue message、metadata-fetcher入出力をstrictなZod schemaとして`packages/contracts`へ実装した。
- `articles`と`article_urls`をDrizzle schemaへ実装し、明示CHECK、外部キーcascade、一意なnormalized URL、指定4 indexを定義した。
- Drizzle Kitで初期migrationとsnapshot/journalを生成した。
- Web Workerへlocal D1 bindingを追加し、Wrangler生成型へ`DB: D1Database`を反映した。
- freshなlocal D1へmigrationを適用して、制約と再適用を自動検証するscriptを追加した。
- domain型だけを扱い、Hono、Zod、Drizzle、D1へ依存しない`ArticleRepository` interfaceを定義した。
- 既存health APIのresponse型をContractsから参照し、API型の重複定義を除いた。
- Cloudflareへのログイン、remote D1作成、remote migration、デプロイは行っていない。

### URL正規化

- 前後空白を除き、最大4096文字とした。
- `http:`と`https:`だけを許可し、username/password付きURLを拒否する。
- hostname、default port、fragment、root以外の明確な単一末尾slashをWHATWG URLの規則で正規化し、意味が変わり得る連続slashは保持する。
- 指定13種のtracking parameterだけを列挙どおりのkeyで除去し、大小文字が異なる内容parameterは保持する。
- 残ったqueryをdecoded key、value、元順序で安定sortし、内容parameter、重複parameter、raw percent encodingを保持する。
- SSRF判定は正規化と分離し、IP literalや非標準portをこの段階で過剰に拒否しない。

### Contractsと型境界

- URL 4096、title 500、description 2000、検索query 200、一覧limit 1〜100/default 30をschemaで検証する。
- 未知field、DBのsnake_case、clientが変更できないserver管理field、空PATCHを拒否する。
- Article DTOでは`status`と`readAt`の相関も検証する。
- Queue messageは`{ articleId, url, attempt }`へ固定し、初回attemptを0として扱えるnon-negative integerにした。
- metadata-fetcherの失敗は列挙済みcodeだけを返し、stackや任意の内部例外文字列を契約へ含めない。
- domain `Article`、API `ArticleDto`、DB `ArticleRow`/`ArticleInsert`を別の型として維持する。

### DBとmigration

- status、metadata status、title manual flag、metadata attempt count、status/readAt相関をSQLite CHECKとしてmigrationへ含めた。
- `article_urls.normalized_url`をprimary keyとし、記事削除時のalias cascadeを外部キーで保証した。
- status/savedAt/id、status/readAt/id、siteName、alias articleIdの指定indexを生成した。
- `pnpm db:verify:local`ではfresh DBへの初回適用、migration履歴、table/index、各CHECK、一意制約、外部キー、cascade、二回目の冪等適用を実DBで確認する。
- Drizzle 0.45.2の宣言ファイルにはTypeScript 7で発生する上流型errorがあるため、`packages/db`だけ`skipLibCheck: true`とした。自分たちのschema sourceとtestsはstrictに型検査している。

### 自動テスト構成

- URL正規化はscheme、credential、default/non-default port、fragment、slash、全tracking parameter、content parameter、重複query、encoded value、IPv4/IPv6、IDN、最大長、冪等性、過剰正規化防止を検証する。
- Contractsは全strict object、境界値、enum、UTC日時、camelCase、状態相関、Queue、fetcher成功/失敗、安全なAPI errorを検証する。
- DBはDrizzle table metadataと生成migration SQLの両方を検証し、local D1でruntime制約も検証する。
- Phase 2終了時は10 test files、109 testsが成功した。
- coverageは全体statements 96.69%、branches 86.95%、functions 96.00%、lines 96.61%。URL正規化はstatements/functions/lines 100%、branches 96.15%だった。

### 検証結果

- `pnpm install --frozen-lockfile`: pass
- `pnpm format:check`: pass
- `pnpm lint`: pass
- `pnpm cf:typecheck`: pass
- `pnpm typecheck`: pass
- `pnpm test`: pass（10 files、109 tests）
- `pnpm test:coverage`: pass
- `pnpm db:verify:local`: pass
- `pnpm build`: pass
- production preview smoke（SPA、fallback、health API、未知API）: pass
- `pnpm audit --audit-level high`: pass（high 0、critical 0、moderate 1）

### 未解決事項

- Phase 2の実装とlocal検証にblockerはない。
- repositoryのD1実装、CRUD API、cursor、search/filter/sort、統一error handlerはPhase 3で実装する。
- remote D1 resourceと`database_id`はPhase 9の明示許可後まで作成・設定しない。
- 既知のmoderate advisory 1件はPhase 1と同じDrizzle Kit配下の開発専用推移依存である。

## Phase 3: 記事CRUD API

### 実施内容

- D1用`ArticleRepository`を実装し、DB rowからdomain `Article`への明示mapperと状態不変条件の検査を追加した。
- `GET/POST /api/v1/articles`と`GET/PATCH/DELETE /api/v1/articles/:id`をHonoへ実装した。
- 一覧へstatus filter、title/original URL/site name検索、site filter、3種のsort、1〜100件のcursor paginationを追加した。
- URL登録と変更はPhase 2の正規化を必ず通し、`article_urls.normalized_url`のprimary keyを最終的な同時実行時の重複防止として使用する。
- URL変更時はalias差し替え、metadata fieldの初期化、記事更新をD1 batchで一体として実行する。
- title変更はmanual flagを設定し、read/unreadの遷移時だけ`readAt`を現在UTCまたはnullへ更新する。
- 全API応答へ`Cache-Control: no-store`と新規request IDを付け、エラー形式をContractsの安全なJSON shapeへ統一した。
- local記事APIは`ENVIRONMENT=local`の場合だけ認証をbypassし、それ以外はPhase 6のAccess JWT検証実装までfail closedで403にする。
- local用の非secret設定例を`apps/web/.dev.vars.example`へ追加し、実値を入れる`.dev.vars`はignore対象のまま維持した。
- 変更系APIへ16KiB body上限、JSON Content-Type、`APP_ORIGIN`完全一致、`X-Tech-Inbox-Client: web`を適用した。
- log fieldをrequest ID、固定route名、method、status、duration、安全なerror codeに限定した。URL、query、body、cookie、内部例外、stackは記録しない。
- Cloudflareへのログイン、remote D1変更、remote migration、デプロイは行っていない。

### Repository、検索、cursor

- SQL条件はDrizzleのparameter bindingまたは固定SQLのD1 Prepared Statementだけで構築し、入力値をSQL文字列へ連結しない。
- LIKE検索では`!`をescape文字として`!`、`%`、`_`をescapeし、sort columnは列挙済み3分岐だけを許可する。
- cursorはversion、検索条件、sort条件、sort値、記事IDをUTF-8 JSONからunpadded base64urlへ符号化するopaque valueとした。
- cursorのfield集合、version、型、長さ、base64url、現在の検索条件との一致を検証し、不正値や別条件への再利用は400で拒否する。
- `saved_desc`、`saved_asc`、`read_desc`の各sortへ記事IDのtie-breakerを付け、同じtimestampでも重複や欠落が出ないkeyset paginationにした。
- 新規登録は記事とoriginal aliasをD1 batchで保存する。競合時は一意制約失敗後に既存aliasを取得し、片方だけ201、残りを200 `alreadyExists`として返す。
- URL変更は事前競合に加え、batch実行中の一意制約競合も409へ変換する。

### 自動テスト構成

- VitestでcursorのUnicode往復、条件不一致、null read timestamp、不正base64url、過長値、余分fieldを検証する。
- Hono API testでlocal bypass、production fail closed、未知field、安全なerror/log、bodyなしDELETEを検証する。
- service testでURL変更時のmetadata reset、manual title、read stateのatomic changesとURL競合変換を検証する。
- mapper testでDB rowとdomain型を分離し、status/readAt不整合を拒否する。
- `pnpm api:verify:local`は`.tmp`内にfresh D1とassetsなしの一時Wrangler設定を作り、現在のWorker sourceを直接起動する。新規・正規化重複・同時重複・取得・更新・URL競合・削除・cascade・検索escape・SQL injection文字列・filter・sort・cursor・主要入力errorを実HTTPで検証後、安全に削除する。
- Phase 3終了時は14 test files、135 testsが成功した。
- coverageはstatements 66.29%、branches 56.46%、functions 75.29%、lines 67.67%。別processの実D1統合testはV8 unit coverageへ計上されないため、D1 repositoryの表示値は実HTTP検証結果と分けて扱う。threshold確定は予定どおりPhase 8で行う。

### 検証結果

- `pnpm install --frozen-lockfile`: pass
- `pnpm format:check`: pass
- `pnpm lint`: pass
- `pnpm cf:typecheck`: pass
- `pnpm typecheck`: pass
- `pnpm test`: pass（14 files、135 tests）
- `pnpm test:coverage`: pass
- `pnpm db:verify:local`: pass
- `pnpm api:verify:local`: pass
- `pnpm build`: pass
- production preview smoke（SPA、fallback、health API、未知API、記事APIの403 fail closed）: pass
- `pnpm audit --audit-level high`: pass（high 0、critical 0、moderate 1）

### 未解決事項

- Phase 3の実装とlocal検証にblockerはない。
- Queue producerとmetadata取得はPhase 5、Cloudflare Access JWT再検証とrate limitはPhase 6で実装する。
- production記事APIはPhase 6完了まで意図的に403で閉じている。
- remote D1 resourceと`database_id`はPhase 9の明示許可後まで作成・設定しない。
- Drizzle 0.45.2のTypeScript 7非互換な上流宣言を読み込むため、Worker tsconfigにも`skipLibCheck: true`を限定適用した。Worker sourceとtests自体はstrictに型検査している。
- 既知のmoderate advisory 1件はPhase 1と同じDrizzle Kit配下の開発専用推移依存である。

## Phase 4: Web UI

### 実施内容

- PCでは固定sidebar、mobileではheaderとsafe area対応bottom navigationを持つ共通layoutを実装した。
- `/`を未読一覧、`/articles`を全記事一覧、`/settings`を設定案内として実装した。JSON export等の設定機能は予定どおりPhase 7で追加する。
- Contractsのresponse schemaで成功応答をruntime検証するclient APIを追加し、一覧、登録、更新、削除を既存APIへ接続した。
- URL登録をPCのinline formとmobileのdialogで実装し、重複時は既存記事へのlinkを持つ通知を表示する。
- 記事cardへsite initial、site名、title、保存日、公開日、未読・既読、metadata pending/failed、元記事link、編集、削除を実装した。
- 検索、status filter、3種のsort、cursorによる追加読込を実装した。
- 既読・未読切替、既読化で未読一覧から消えた記事を復元できるundo、編集dialog、削除確認dialogを実装した。
- loading skeleton、empty state、error/retry、成功・失敗toast、処理中状態を実装した。
- native `dialog`を基盤に、初期focus、focus trap、Escape、閉じた後のfocus復帰を実装した。
- 外部favicon/OGP画像は表示せず、API由来文字列はReactのtext nodeとしてだけ描画する。`dangerouslySetInnerHTML`は使用していない。
- reduced motion、明示label、focus indicator、44px相当の操作target、色以外の状態表示を追加した。
- `pnpm check`へPlaywright E2Eを組み込み、phase完了時の標準gateで毎回実行するようにした。
- Cloudflareへのlogin、remote resource変更、deployは行っていない。

### 自動テスト構成

- Testing Library component testで、API文字列の非HTML描画、検索query、既読化とundo、重複登録、変更系request headerを検証する。
- Playwrightはsystem Google Chromeを使用し、1280x800のdesktopと320x700のmobile viewportで同じ主要flowを実行する。
- E2EではURL登録、検索、編集、削除、設定route、既読化とundo、dialog focus、mobile navigation、320px時の横overflow、XSS文字列の非HTML描画を検証する。
- E2EのAPIはbrowser routeで状態付きmockにし、UI failureをD1状態から分離する。実D1とWorker APIは既存の`pnpm api:verify:local`で別に検証する。
- Phase 4終了時はVitest 14 test files、138 testsとPlaywright 4 testsが成功した。
- coverageはstatements 60.64%、branches 52.40%、functions 59.66%、lines 62.43%。UIの詳細branch拡充とthreshold確定は予定どおりPhase 8で行う。

### Browser確認

- 実ブラウザでdesktop layoutのsidebar、main column、空状態を確認した。
- viewportを320x700へ切り替え、`innerWidth`と`scrollWidth`がともに320で横scrollがないこと、mobile headerとbottom navigationが成立することを確認した。
- mobile追加dialogの初期focusがURL inputへ入り、閉じる操作後に追加buttonへfocusが戻ることを確認した。

### 検証結果

- `pnpm format:check`: pass
- `pnpm lint`: pass
- `pnpm cf:typecheck`: pass
- `pnpm typecheck`: pass
- `pnpm test`: pass（14 files、138 tests）
- `pnpm test:coverage`: pass
- `pnpm db:verify:local`: pass
- `pnpm api:verify:local`: pass
- `pnpm build`: pass
- `pnpm e2e`: pass（Google Chrome desktop/mobile、4 tests）
- `pnpm audit --audit-level high`: pass（high 0、critical 0、moderate 1）

### 未解決事項

- metadata取得の短時間polling、retry操作、pendingからready/failedへのE2EはQueueを実装するPhase 5で追加する。
- JSON exportと設定画面の実機能はPhase 7で追加する。
- coverage thresholdと必須flow全体のE2E拡充、manual device test手順はPhase 8で行う。
- production記事APIはPhase 6完了まで意図的に403で閉じている。
- 既知のmoderate advisory 1件はPhase 1と同じDrizzle Kit配下の開発専用推移依存である。

## Phase 5: Queueとmetadata-fetcher

### 実施内容

- 記事の新規登録とURL変更後に`{ articleId, url, attempt }`をQueueへ送り、送信失敗時は記事を残したままmetadataをfailedへ更新するproducerを実装した。既存重複記事は再投入しない。
- app WorkerへQueue consumerを追加し、message schema検証、削除済み・URL変更済み・ready済みmessageの安全なack、Service Binding呼び出し、成功・失敗状態の保存を実装した。
- 一時障害だけを段階的に再投入し、3回到達後はCloudflare Queuesのnative retryへ渡してDLQへ送る。恒久障害はfailedとしてackし、手動retry APIからattemptをリセットできる。
- `tech-inbox-metadata-fetcher`をprivate Workerとして実装し、appからService Bindingだけで接続した。`workers_dev`とpreview URLは無効のままで、D1、Queue、Secrets bindingは与えていない。
- fetcherはHTTP(S)、credentialsなし、80/443だけを許可し、localhost、内部suffix、private・loopback・link-local・multicast・unspecified・reserved IP、IPv4-mapped IPv6を拒否する。
- redirectはmanualで最大3回とし、loopを検出して全遷移先を再検証する。外部取得はGET、8秒timeout、1MiB上限、HTML/XHTMLだけに制限した。
- `HTMLRewriter`でtitle、OG/Twitter title、description、site名、canonical、favicon、OG image、公開日候補を抽出し、制御文字・空白・長さ・URLをsanitizeする。
- 同一hostnameまたは`www.`差だけのcanonical aliasをD1へ追加し、既存ownerをkeeperとしてalias、metadata、未読状態、新しい保存日時を統合後、重複記事を削除する。手動titleはSQLでも保護する。
- UIへ初回2秒、最大5秒、合計30秒までのmetadata短時間pollingを追加した。ready/failed到達または画面非表示で停止し、failed cardから手動再取得できる。
- Viteのauxiliary Worker設定でlocal/build時にもprivate fetcherを同時構成し、metadata-fetcher単体のWrangler dry-run buildも標準buildへ追加した。
- Cloudflare remote resourceの作成、login、deployは行っていない。

### 自動テスト構成

- URL policy testで危険scheme、credentials、禁止port、内部hostname、IPv4/IPv6のprivate・reserved範囲、IPv4-mapped IPv6を拒否し、public宛先を許可することを検証する。
- fetcher testでredirect先の再検証、redirect上限、1MiB超過streamのcancel、content-type拒否、8秒timeoutを検証する。
- metadata選択testでOG title優先、制御文字と空白のsanitize、relative URL解決、危険URLの破棄、公開日時のUTC化を検証する。
- consumer testで重複messageの冪等性、URL変更後messageのstale処理、manual title保持、一時障害のattempt上限とDLQ向けnative retry移行を検証する。
- API/component testでretry endpointのQueue投入、strict request、UI pollingの2秒開始・terminal停止、failed cardからの再取得を検証する。
- Phase 5終了時はVitest 18 test files、173 testsとPlaywright 4 testsが成功した。
- coverageはstatements 60.19%、branches 53.47%、functions 58.20%、lines 61.98%。D1 repositoryの表示値は別processのlocal実動確認と分けて扱い、threshold確定は予定どおりPhase 8で行う。

### 検証結果

- `pnpm cf:typegen`: pass（app/fetcher両方）
- `pnpm format:check`: pass
- `pnpm lint`: pass
- `pnpm cf:typecheck`: pass
- `pnpm typecheck`: pass
- `pnpm test`: pass（18 files、173 tests）
- `pnpm test:coverage`: pass
- `pnpm db:verify:local`: pass
- `pnpm api:verify:local`: pass
- `pnpm build`: pass（app、auxiliary fetcher、fetcher dry-runでbindingsなし）
- `pnpm e2e`: pass（Google Chrome desktop/mobile、4 tests）
- `pnpm audit --audit-level high`: pass（high 0、critical 0、moderate 1）

### 未解決事項

- production記事APIはPhase 6完了まで意図的に403で閉じている。Access JWT再検証、production rate limit、許可email設定はPhase 6で実装する。
- remote Queue、DLQ、Worker、Service BindingはPhase 9の明示許可後まで作成・deployしない。
- JSON exportと設定画面の実機能はPhase 7、coverage thresholdと必須flow全体のE2E拡充はPhase 8で行う。
- 既知のmoderate advisory 1件はPhase 1と同じDrizzle Kit配下の開発専用推移依存である。

## Phase 6: 認証とセキュリティ強化

### 実施内容

- Cloudflare Accessの`Cf-Access-Jwt-Assertion`を`jose`で再検証するmiddlewareを実装した。RS256署名、issuer、audience、expiration、not-before、subject、許可email完全一致を確認する。
- Accessのteam domainはHTTPSのCloudflare Access originだけを許可し、JWKSをissuer単位で再利用する。設定不足や検証失敗時は内部理由を応答・logへ出さずfail closedとした。
- `ENVIRONMENT=local`の完全一致、HTTP loopback、`APP_ORIGIN`とrequest originの一致をすべて満たす場合だけにlocal bypassを限定した。それ以外はproduction、preview、未設定、公開originを含めAccess認証を必須にし、productionへlocal用headerなどの迂回経路を設けていない。
- 検証済みJWTを`AuthPrincipal`へ変換し、記事serviceやrepositoryをCloudflare Accessのclaim構造から分離した。
- Worker Rate Limiting bindingをcreate、metadata retry、update/delete、list/getの4区分で追加した。keyはAccess subjectとemailのSHA-256 hashと固定route categoryだけで構成し、生のemail、subject、URL、queryを渡さない。
- 変更系APIのJSON Content-Type、`APP_ORIGIN`完全一致、`X-Tech-Inbox-Client: web`、16KiB上限とstrict schemaを再確認し、不正Originがrepository到達前に拒否されるtestを追加した。
- Static AssetsとWorker APIの両方へ厳格なCSP、clickjacking、MIME sniffing、referrer、permissions、cross-origin、HSTS、indexing防止headerを追加し、`robots.txt`でもcrawlerを拒否した。
- metadata-fetcherは`workers_dev: false`、`preview_urls: false`、public routeなしを維持した。
- productionとpreviewをCloudflare AccessのAll trafficで保護する手順、exact email policy、Worker Secrets、cost gate、deploy後negative testを`docs/cloudflare-setup.md`へ記録した。
- security header追加で並列E2E数が増えた際に判明した一覧取得競合を修正し、中断済みrequestのresponseが新しい検索結果を上書きしないようにした。
- Cloudflareへのlogin、remote Access/Rate Limiting設定、secret登録、deployは行っていない。

### 変更ファイル

- AccessとAPI security: `apps/web/src/worker/access-auth.ts`、`rate-limit.ts`、`security-headers.ts`、`app.ts`と対応test
- Static Assets: `apps/web/public/_headers`、`apps/web/public/robots.txt`
- Cloudflare/local設定: `apps/web/wrangler.jsonc`、`worker-configuration.d.ts`、`.dev.vars.example`
- UI/E2E: `apps/web/src/client/pages/ArticlesPage.tsx`、`tests/e2e/article-inbox.spec.ts`
- 文書: `docs/cloudflare-setup.md`、`docs/progress.md`

### 自動テスト構成

- local RSA key pairとJWKSでAccess JWTを実際に署名し、正常系、JWT欠落、issuer/audience/email不一致、期限切れ、未来のnbf、exp欠落、設定不備を検証する。
- production requestで検証済みprincipalがrate limiterへ渡ること、非localの設定不足と`ENVIRONMENT=local`を設定した公開originがrepositoryへ到達せず閉じることをHono API testで確認する。
- 全rate categoryのbinding選択、hash keyに生のsubject/emailが含まれないこと、429、非local binding欠落時の503、local simulationをunit testで確認する。
- APIの全security headerをunit test、Static AssetsとAPIのheaderおよび`robots.txt`をPlaywrightのproduction previewで確認する。

### 検証結果

- `pnpm cf:typegen`: pass（4 Rate Limiting bindingを生成型へ反映）
- `pnpm check`: pass
  - format、lint、生成型差分、TypeScript: pass
  - Vitest: 20 files、197 tests pass
  - fresh local D1 migration/constraint verification: pass
  - local実HTTP CRUD/input defense verification: pass
  - app、auxiliary fetcher、fetcher dry-run build: pass
  - Playwright: desktop/mobile合計6 tests pass
  - audit: high 0、critical 0、既知moderate 1
- `pnpm test:coverage`: pass（statements 62.34%、branches 56.60%、functions 60.15%、lines 63.94%）
- Static Assets build出力に`_headers`と`robots.txt`が含まれることを確認した。
- metadata-fetcher configにpublic routeがなく、`workers_dev`と`preview_urls`がfalseであることを確認した。
- secret候補、JWT、cookie、authorization、email実値、private keyのGit差分混入確認: pass

### 未解決事項

- remote Access application、Worker Secrets、Rate Limiting bindingの有効化とproduction/preview実機negative testは、明示的なdeploy許可後のPhase 9で行う。
- JSON exportはPhase 7、coverage thresholdと必須flow全体のE2E拡充はPhase 8で行う。
- Rate Limiting bindingはPhase 9のremote設定直前に追加課金表示がないことを再確認する。

## Phase 7: JSONエクスポートと設定画面

### 実施内容

- 既存のstrictなexport contractを利用し、`schemaVersion: 1`、UTC `exportedAt`、全記事、全original/canonical URL aliasを返す`GET /api/v1/export`を実装した。
- D1 repositoryは記事とaliasを同一batchで読み、記事を保存日の降順、aliasをnormalized URL順の決定的な順序で出力する。通常一覧のlimit/cursorを再利用せず、100件上限を超えるexportも切り捨てない。
- export APIをAccess JWT再検証対象に追加し、production設定不足時はrepositoryへ到達する前にfail closedとした。
- export専用Rate Limiting bindingを5 requests/minuteで追加し、principalのhashと`export` categoryだけをkeyに使用した。
- APIへ`Content-Disposition: attachment`とUTC日付入り`tech-inbox-export-YYYY-MM-DD.json` filenameを設定した。既存middlewareにより`Cache-Control: no-store`、request ID、security headersも維持する。
- 設定画面で保存記事数、未読記事数、schema versionを表示し、loading、safe error、retryを実装した。
- 設定画面でruntime検証済みのexport responseを整形JSONのBlobへ変換し、同じUTC日付filenameでdownloadするようにした。件数取得済みデータを再利用するため、download時にAPIを重複呼び出ししない。
- contract、API、download fileのtop-level fieldを固定し、JWT、Access email、Worker設定、内部情報が含まれないことを検証した。
- Cloudflare remote resourceの作成・変更、login、deployは行っていない。

### 変更ファイル

- Contracts test: `packages/contracts/test/api.test.ts`
- Repository/service/API: `apps/web/src/worker/repositories/*`、`article-service.ts`、`app.ts`、`rate-limit.ts`と対応test
- Cloudflare型・設定: `apps/web/wrangler.jsonc`、`apps/web/worker-configuration.d.ts`
- Client/UI: `apps/web/src/client/api/articles.ts`、`apps/web/src/client/pages/SettingsPage.tsx`とcomponent test
- Integration/E2E: `scripts/verify-phase3-api.mjs`、`tests/e2e/article-inbox.spec.ts`
- 文書: `docs/cloudflare-setup.md`、`docs/progress.md`

### 自動テスト構成

- Contracts testでschema version固定、strict top-level、strict alias fieldを確認する。
- Service testでarticle/alias mapping、UTC exportedAt、一覧上限を超える101件の欠落防止を確認する。
- API testでattachment filename、no-store、全記事・alias、内部設定非混入、production fail-closedを確認する。
- fresh local D1と実HTTPで記事4件・URL alias 5件の全件性、alias参照整合性、filename、top-level fieldを確認する。
- Component testで件数、未読件数、schema version、safe error、retryを確認する。
- Playwrightでdesktop Chromeと320px mobile Chromeの両方からdownloadを実行し、filename、JSON field、記事・alias件数、secret非混入を確認する。

### 検証結果

- `pnpm cf:typegen`: pass（export 5/min bindingを生成型へ反映）
- `pnpm check`: pass
  - format、lint、生成型差分、TypeScript: pass
  - Vitest: 21 files、205 tests pass
  - fresh local D1 migration/constraint verification: pass
  - local実HTTP CRUD/input defense/export verification: pass
  - app、auxiliary fetcher、fetcher dry-run build: pass
  - Playwright: desktop/mobile合計6 tests pass（両環境でJSON download成功）
  - audit: high 0、critical 0、既知moderate 1
- `pnpm test:coverage`: pass（statements 63.17%、branches 57.71%、functions 61.13%、lines 64.56%）
- export security review: top-level field固定、article/alias参照整合、secret候補非混入、production fail-closedを確認してpass

### 未解決事項

- exportのremote Access/Rate Limiting実機確認は、明示的なdeploy許可後のPhase 9で行う。
- coverage threshold確定、必須flow全体のE2E拡充、manual iPhone/Android Chrome確認手順はPhase 8で行う。
- 既知のmoderate advisory 1件はPhase 1と同じDrizzle Kit配下の開発専用推移依存である。

## Phase 8: テストと品質ゲート

### 実施内容

- pure unit test、React component test、Worker/API integration testを拡充し、API clientの全操作とsafe error、request body境界、HTML metadata sanitization、IPv4/IPv6 SSRF境界、fetch timeout/redirect/size/status、Queue再試行と失敗処理を検証した。
- 記事一覧のpagination、sort、status filter、未読へ戻す、load error/retry、編集、削除をcomponent testへ追加した。composer、card、modal、編集・削除dialog、desktop/mobile navigationも直接検証した。
- V8 coverageにstatements、branches、functions、lines各80%のglobal thresholdを設定した。URL正規化、SSRF URL判定、契約schemaはbranch 90%を個別thresholdにした。
- D1 adapterはfake DBでcoverage数値を作らずfresh local D1と実HTTPで検証し、Worker runtime entrypointは生成型、typecheck、production/dry-run build、統合テストで検証する責務分離を明文化した。
- Playwrightの状態付きAPI mockを拡張し、ガイド必須のURL登録、duplicate、pendingからready、metadata失敗、既読化とundo、未読へ戻す、検索、filter、title編集、URL編集と競合、削除、JSON export、unauthorized API拒否を網羅した。
- 全Playwrightシナリオをdesktop Chrome 1280 × 800とmobile Chrome 320 × 700の両方で実行する構成を維持した。
- `docs/manual-device-test.md`を作成し、iPhone/Android ChromeのAccess login、keyboard中layout、保存、dialog、既読、検索、新規tab、JSON download、縦横向き、logout後API拒否の手順と結果templateを用意した。emulation成功と実機未実施を明確に分けた。
- production artifactのraw size上限とgzip参考値を検証する`pnpm quality:artifacts`を追加し、`pnpm check`へcoverageとartifact budgetを組み込んだ。
- Worker CPUのpredeploy risk reviewとしてlist/body/HTML/redirect/fetchの処理境界とD1 batch利用を確認した。local wall-clockをCloudflare CPU timeと偽らず、実CPU timeはPhase 9の限定deploy後にWorkers Logs/dashboardで確認するgateとして記録した。
- Cloudflare remote resourceの作成・変更、login、deployは行っていない。

### 変更ファイル

- Coverage/quality command: `vitest.config.ts`、`package.json`、`scripts/check-artifact-budgets.mjs`
- Client unit/component test: `apps/web/src/client/api/articles.test.ts`、`apps/web/src/client/components/ArticleComponents.test.tsx`、`apps/web/src/client/pages/ArticlesPage.test.tsx`
- Worker unit/integration test: `apps/web/src/worker/request-validation.test.ts`、`apps/web/src/worker/metadata-consumer.test.ts`
- Metadata fetcher test: `workers/metadata-fetcher/src/fetch-metadata.test.ts`、`html-metadata.test.ts`、`url-policy.test.ts`
- SSRF test seam: `workers/metadata-fetcher/src/url-policy.ts`
- E2E: `tests/e2e/article-inbox.spec.ts`
- 文書: `docs/quality-gates.md`、`docs/manual-device-test.md`、`docs/progress.md`

### 自動テスト構成

- Vitestは24 files、276 testsでpure、client component、Worker/APIを検証する。
- V8 coverage gateはテスト可能コード全体で全4指標80%以上、重要3領域のbranch 90%以上を自動失敗条件にする。
- `pnpm api:verify:local`はfresh local D1とWrangler Workerを使い、CRUD、同時duplicate、pagination、search/filter/sort、入力防御、全件JSON exportを実HTTPで確認する。
- Playwrightは6シナリオを2 projectで実行し、desktop/mobile合計12 testsで必須E2Eを検証する。
- `pnpm quality:artifacts`はapp Worker、metadata-fetcher、client JavaScript、client CSSのraw上限を検査する。

### 検証結果

- `pnpm check`: pass（format、lint、生成型差分、TypeScript、Vitest、coverage、fresh local D1、実HTTP API、production/dry-run build、artifact budget、desktop/mobile E2E、high audit）
- `pnpm test`: pass（24 files、276 tests）
- `pnpm test:coverage`: pass
  - 全体: statements 89.50%、branches 85.62%、functions 89.49%、lines 90.82%
  - URL正規化: branches 96.15%
  - SSRF URL判定: branches 96.00%
  - 契約schema: branches 100%
- `pnpm e2e`: pass（desktop/mobile合計12 tests）
- `pnpm build`: pass（app、auxiliary fetcher、fetcher単体dry-run）
- `pnpm quality:artifacts`: pass
  - app Worker: raw 409.1 KiB、gzip 89.2 KiB
  - metadata-fetcher: raw 571.9 KiB、gzip 86.2 KiB
  - client JavaScript: raw 327.8 KiB、gzip 98.4 KiB
  - client CSS: raw 27.1 KiB、gzip 6.1 KiB
- `pnpm audit --audit-level high`: pass（high 0、critical 0、既知moderate 1）

### 未解決事項

- iPhone ChromeとAndroid Chromeの実機確認はAccess保護済みURLが必要なため未実施であり、Phase 9のdeploy後に`docs/manual-device-test.md`へ結果を記録する。
- production Worker CPU timeは未計測である。Phase 9でWorkers Logsまたはdashboardを使い、Freeプランの10 ms/invocation基準に対してlist 100件、export、1 MiB HTML、redirect 3回を確認する。
- 既知のmoderate advisory 1件はPhase 1と同じDrizzle Kit配下の開発専用推移依存であり、runtime bundleには含まれない。

## Phase 9: Cloudflareリソース作成とproduction deploy

### 実施内容

- ユーザーの明示許可後、repositoryへ保存しない短期・対象account限定のAPI tokenを使い、token、account、Zero Trust organization、同名resourceの有無をpreflightで確認した。
- APACのD1 `tech-inbox`を作成してproduction databaseであることを確認し、`0000_cloudy_karen_page.sql`をremote適用した。
- Queue `tech-inbox-metadata`とDLQ `tech-inbox-metadata-dlq`をFree retention 24時間で作成した。
- `tech-inbox-metadata-fetcher`をpublic route、workers.dev、preview URLなしでdeployした。D1、Queue、Secrets bindingを持たないことを維持した。
- app Workerへremote D1、Queue producer/consumer、DLQ、metadata-fetcher Service Binding、5種類のRate Limiting binding、production originを設定し、生成型を更新してdeployした。
- Worker-level Access applicationを作成し、appのAll trafficを所有者email 1件への完全一致policyだけで保護した。session durationは7日、preview URLとapp launcher表示は無効にした。
- `TEAM_DOMAIN`、`POLICY_AUD`、`ALLOWED_EMAIL`をWorker Secretsとして登録した。値はrepository、command引数、文書、Git、logへ保存していない。
- 未認証rootと記事APIがAccess loginへ302になること、許可された所有者だけがCloudflare login後にproductionへ入れることを確認した。
- desktop ChromeでURL登録、pendingからready、検索、既読化とundo、title編集、JSON export、削除をproduction smoke testした。
- iPhone Chrome実機でAccess、縦横layout、keyboard、CRUD dialog、保存、検索、既読化とundo、新規tab、JSON download、未認証遮断を確認した。Android実機はowner判断でスキップし、成功扱いにはしていない。
- Workers Logsでappとmetadata-fetcherのstatus、例外、CPU timeを確認した。`jose`のJWKS取得を伴うcold requestは14〜21 ms、warm requestは2〜7 ms、fetcherは最大4 msで、すべて`outcome: ok`、Error 1102、`exceededCpu`、例外なしだった。
- FreeのCPU基準と認証処理の実測差をユーザーへ提示して承認を得た。Free、`jose`、同一origin構成を維持する判定をADR-0004へ記録した。
- JWT最適化の試行で独自検証を一時deployしたが、Cloudflare tokenのoptional header差により認証失敗を検出して直ちにrollbackした。さらにガイドの`jose`必須・独自JWT回避要件へ照らし、最終版は検証済みの`jose`実装へ戻した。ユーザーが最終版の正常表示を再確認した。
- 並列mobile E2Eで顕在化したroute遷移直後のtest timing競合を、遷移先headingの表示待ちで安定化した。アプリ本体の挙動変更はない。
- ownerの最新判断により専用の未読画面とナビゲーションを削除し、`/`を`/articles`へredirectする構成へ簡素化した。未読・既読の状態管理と全記事画面の状態filterは維持した。
- UI簡素化版を既存のapp Workerへ再deployした。新規resourceは作成せず、deployment versionは`e1c03d86-0314-42c2-9676-4109e0c8c2c1`となった。deploy後も未認証root/APIがAccessへ302となり、Access application 1件、owner email完全一致policy 1件、bypassなしをread-onlyで再確認した。
- ownerが認証済みproductionで`/`から全記事画面を表示でき、ナビゲーションが「すべて」「設定」だけになったことを確認した。確認端末は未記録であり、旧UIで完了済みのiPhone実機共通チェックとは分けて記録した。
- 1 MiB HTMLとredirect 3回のproduction境界確認では、2組の安全なpublic endpointがfetcherから`NETWORK_ERROR`となった。境界成功とは記録せず、一時articleを削除後に遅延messageがstaleとしてackされ、通常Queue 0件、remote D1の`phase9-boundary-*` 0件を確認した。決定的なsize・redirect境界はlocal自動testでpassしている。
- 実機テスト用articleがremote D1に残っていないことをread-only queryで確認し、既存のユーザーデータは保持した。
- Phase 9ではWorkers Paid、独自domain、その他の有料productを新たに有効化していない。API tokenはBilling Readを持たないため、既存subscriptionの有無はownerがdashboardで確認する。

### 変更ファイル

- Cloudflare設定・生成型: `apps/web/wrangler.jsonc`、`apps/web/worker-configuration.d.ts`
- Worker型調整: `apps/web/src/worker/app.ts`、`apps/web/src/worker/article-api.test.ts`
- UI簡素化: `apps/web/src/client/components/AppLayout.tsx`、`apps/web/src/client/components/ArticleComponents.test.tsx`、`apps/web/src/client/pages/ArticlesPage.tsx`とtest、`apps/web/src/client/router.tsx`、旧`HomePage`の削除
- 運用script: `scripts/verify-cloudflare-preflight.mjs`、`scripts/configure-cloudflare-access.mjs`、`package.json`
- E2E安定化: `tests/e2e/article-inbox.spec.ts`
- 文書・判断: `docs/cloudflare-setup.md`、`docs/quality-gates.md`、`docs/manual-device-test.md`、`docs/decisions/0004-workers-free-cpu-gate.md`、`docs/progress.md`

### 採用判断

- production認証は実装ガイドどおり`jose`でAccess JWTのRS256署名、issuer、audience、expiry、任意nbf、subject、所有者email完全一致を再検証する。
- Workers Freeの10 msは通常処理の基準とし、認証を伴うまれなcold requestだけは25 ms以下、`outcome: ok`、CPU errorなしの場合に許容する。連続超過や通常処理の反復超過は不合格とする。
- Static Assetsでは`ctx.access`がuser Workerへ渡らないため、現行の同一origin構成ではJWT再検証を置き換えない。
- Android実機はownerの明示判断でPhase 9から除外し、未実施をpassとは記録しない。

### 実行した主なコマンド

- `pnpm cloudflare:preflight`
- `pnpm --dir apps/web exec wrangler d1 create tech-inbox`
- `pnpm --dir apps/web exec wrangler d1 migrations apply tech-inbox --remote`
- `pnpm --dir apps/web exec wrangler queues create ...`
- `pnpm --dir apps/web exec wrangler deploy --config ../../workers/metadata-fetcher/wrangler.jsonc`
- `pnpm --dir apps/web exec wrangler deploy`
- `pnpm cloudflare:configure-access`
- `pnpm --dir apps/web exec wrangler tail tech-inbox-app --format json --sampling-rate 0.999`
- `pnpm check`

### 検証結果

- format、lint、Cloudflare生成型、TypeScript: pass
- Vitest: 24 files、276 tests pass
- coverage: statements 89.46%、branches 85.50%、functions 89.45%、lines 90.78%
- fresh local D1 migration/constraint verification: pass
- local実HTTP CRUD/input defense/export verification: pass
- production build、fetcher dry-run、artifact budget: pass
- Playwright: desktop/mobile合計12 tests pass
- dependency audit: high 0、critical 0、既知moderate 1
- production Access: 未認証root/API 302、許可owner login pass
- production desktop smoke: pass
- iPhone Chrome実機: pass
- production logs: Error 1102 0、`exceededCpu` 0、exception 0
- secret・credential混入: pass

### 未解決事項

- Billing情報は最小権限API tokenの対象外である。Phase 9で課金同意画面やPaid必須表示は出ておらず有料productを新規有効化していないが、既存のWorkers subscription有無はownerがCloudflare dashboardのBilling画面で確認する。
- metadata DLQに確認時点で6件あった。Phase 9境界test由来とは特定できず、所有データの可能性があるためpurgeせず保持した。Free retention 24時間後の自然失効またはPhase 10の運用手順で扱う。
- Android Chrome実機確認はowner判断でスキップした。手順は`docs/manual-device-test.md`に維持し、実施していない状態を成功とは扱わない。
- 既知のmoderate advisory 1件はPhase 1と同じDrizzle Kit配下の開発専用推移依存であり、runtime bundleには含まれない。

## Additional Feature T1: タグ基盤

### 実施内容

- 1記事へ複数タグを関連付ける`tags`、`article_tags` schemaとmigrationを追加した。タグ削除時は関連だけをcascade削除し、記事本体を保持する。
- タグ名をNFKC正規化し、前後空白除去、連続空白の集約、大小文字を区別しない一意性を実装した。表示名は利用者の入力表記を維持する。
- タグ数を100件、タグ名を30文字、1記事のタグを10件までに制限した。
- 0〜359度の色相をタグへ永続化し、使用中の色相と最大限離れる色を決定的に自動割当するようにした。色相はDBの一意制約でも重複を防ぐ。
- タグ一覧・作成・名前変更・削除APIと、記事ごとのタグ一覧・一括置換APIを追加した。すべて既存のAccess認証、入力防御、Rate Limit分類、安全なエラー形式の対象にした。
- 正規化名の重複、色相割当の同時競合、存在しない記事・タグ、上限超過をservice/repository境界で処理した。
- fresh local D1と実HTTP検証を拡張し、作成、正規化重複、異なる色、関連付け、名前変更時の色維持、競合、削除時の記事保持を確認した。
- このフェーズでは記事DTOへのタグ埋め込み、カード表示、編集UI、絞り込み、設定画面は実装していない。production migrationとdeployも行っていない。

### 採用判断

- 利用者による色指定は設けず、タグごとに保存した色相を全画面で共通利用する。詳細は[ADR-0005](decisions/0005-automatic-tag-colors.md)へ記録した。
- 色相はタグ名から算出せず、名前変更後も同じ色を維持する。
- タグ色を視覚上の補助として扱い、後続UIでは必ずタグ名も表示する。
- API基盤とUIを分けて検証し、このフェーズ単独ではremote DBへ未使用schemaを適用しない。

### 検証結果

- `pnpm check`: pass
  - format、lint、Cloudflare生成型差分、TypeScript: pass
  - Vitest: 28 files、302 tests pass
  - coverage: statements 86.05%、branches 81.83%、functions 86.33%、lines 87.46%
  - fresh local D1 migration/constraint verification: pass
  - local実HTTP CRUD/input defense/tag verification: pass
  - production build、fetcher dry-run、artifact budget: pass
  - Playwright: desktop/mobile合計12 tests pass
  - audit: high 0、critical 0、既知moderate 1
- tag core/service/APIの追加test: 8 files、69 tests pass
- remote Cloudflare changes: なし

### 次フェーズ

- 記事取得DTOへタグを含め、カードの色付きチップ、タグ編集・その場での新規作成、タグ絞り込み、設定画面の名前変更・削除を実装する。
- JSON export、URL重複統合、E2E、production migration/deployはUI完成後の統合フェーズで扱う。

## Additional Feature T2: タグUI

### 実施内容

- 記事一覧responseへ全タグcatalogと記事ごとのタグ割当を追加し、D1では記事ごとのN+1 queryを使わず一括取得するようにした。
- 記事カードへ、タグごとに保存された色相を使う色付きチップを表示した。色だけに依存せず、タグ名を常に表示する。
- 記事メニューへ「タグを編集」を追加し、既存タグの複数選択・解除と、dialog内での新規タグ作成・即時選択を実装した。
- 一覧へタグ絞り込みを追加した。filter条件をopaque cursorへ含め、異なるタグ条件でcursorを再利用した場合は拒否する。
- 設定画面へタグ管理を追加し、タグ名の変更と確認付き削除を実装した。削除時に記事自体は残ることを画面上でも明示した。
- API clientの共通HTTP・エラー処理を分離し、記事APIとタグAPIの認証失敗・validation error表示を統一した。
- 一覧取得とタグ作成が並行した場合も、新規タグをdialog内に保持して即時表示・保存できるようにした。
- このフェーズではJSON export schema、URL重複時のタグ統合、タグ操作を含むPlaywright E2E、production migrationとdeployは扱っていない。

### 採用判断

- 記事DTO本体は変更せず、一覧responseの`availableTags`と`tagsByArticleId`でタグを返す。これにより既存のexport schema version 1をこのフェーズで暗黙に変更しない。
- 一覧取得時はタグcatalogを1 query、表示記事の割当を1 queryで取得し、表示件数に比例するN+1 queryを避ける。
- タグ絞り込み中に、その記事から選択中タグを外した場合は一覧から即時に除外する。
- 色相はT1で永続化した値を共通利用し、UI側でタグ名や画面ごとに色を再計算しない。

### 検証結果

- `pnpm check`: pass
- format、lint、Cloudflare生成型差分、TypeScript: pass
- Vitest: 29 files、309 tests pass
- coverage: statements 85.47%、branches 80.68%、functions 85.00%、lines 87.39%
- 契約schema branch coverage: 100%
- fresh local D1 migration/constraint verification: pass
- local実HTTP tag filter、cursor文脈、タグ割当verification: pass
- production build、fetcher dry-run、artifact budget: pass
- Playwright: desktop/mobile合計12 tests pass
- Codex内ブラウザ: タグ絞り込み欄、タグ管理、320 × 700で横幅超過なしを確認
- audit: high 0、critical 0、既知moderate 1
- remote Cloudflare changes: なし

### 次フェーズ

- export schemaをversion upしてタグcatalogと記事割当を含め、既存versionとの互換性を明示する。
- URL重複統合時のタグunion方針を実装し、上限超過時の扱いを決める。
- タグ作成・割当・絞り込み・名前変更・削除をdesktop/mobile Playwright E2Eへ追加する。
- 全ゲート通過後、明示許可を得たうえでproduction D1 migrationとapp Worker deployを行い、本番で動作確認する。

## Additional Feature T3: タグ統合

### 実施内容

- JSON exportをschema version 2へ更新し、従来の記事・URL aliasに加えて、タグcatalogと記事・タグの関連を正規化形式で含めた。
- client contractはversion 1とversion 2のdiscriminated unionとし、既存exportを読める互換性を維持した。version 2ではURL aliasとタグ関連の参照整合性、関連の重複、1記事10タグ上限をruntime検証する。
- D1 repositoryは記事、URL alias、タグ、タグ関連を1回のbatchで読み、すべて決定的な順序で出力する。設定画面の説明とdownload testもversion 2へ更新した。
- metadata取得でcanonical URLが既存記事へ重複した場合、残存記事のタグを優先し、重複記事だけにあるタグを作成日時・タグID順で空き枠へ移すようにした。
- 両記事のタグ和集合が10件を超える場合は後順位の関連を移さず、件数を`droppedTagCount`としてmetadata consumerの構造化logへ含める。タグ定義自体は保持する。
- 実D1統合fixtureを追加し、残存記事9タグ・重複記事3タグの統合後に、記事が1件、関連が10件、未移行が2件となり、12タグの定義が残ることを実HTTPで確認した。
- Playwrightの状態付きAPI mockへタグAPIと記事関連を追加し、作成、複数付与、絞り込み、解除、再付与、名前変更、削除、記事保持、version 2 downloadをdesktop/mobile両方で検証した。
- production D1 migration、Worker deploy、remote dataの変更は行っていない。

### 採用判断

- exportとcanonical重複統合の詳細は[ADR-0006](decisions/0006-tag-export-and-canonical-merge.md)へ記録した。
- canonical URLを先に所有していた記事を残存記事とし、その記事の既存タグを利用者の優先判断として保持する。
- 上限超過を暗黙に無視せず、決定的な選択と欠落件数の構造化logを組み合わせる。
- 実D1 adapterはfake DBによるcoverage対象にせず、productionと同じrepository実装を一時的なlocal Worker entrypointから呼ぶ統合testで検証する。

### 検証結果

- `pnpm check`: pass
- format、lint、Cloudflare生成型差分、TypeScript: pass
- Vitest: 29 files、310 tests pass
- coverage: statements 85.70%、branches 80.91%、functions 85.19%、lines 87.58%
- 契約schema branch coverage: 100%
- fresh local D1 migration/constraint verification: pass
- local実HTTP export version 2、参照整合性、canonical重複タグ統合verification: pass
- production build、fetcher dry-run、artifact budget: pass
  - app Worker: raw 430.4 KiB、gzip 93.1 KiB
  - metadata-fetcher: raw 577.7 KiB、gzip 87.3 KiB
  - client JavaScript: raw 342.1 KiB、gzip 101.2 KiB
  - client CSS: raw 27.8 KiB、gzip 6.2 KiB
- Playwright: desktop/mobile合計14 tests pass
- Codex内ブラウザ: 設定画面のタグを含むexport説明と、320 × 700で横幅超過なしを確認
- audit: high 0、critical 0、既知moderate 1
- remote Cloudflare changes: なし

### 次フェーズ

- ownerの明示許可後、production D1へタグmigrationを適用し、app Workerをdeployする。
- productionでタグ作成・付与・絞り込み・名前変更・削除、記事保持、version 2 export、既存記事・認証・Free枠への影響を確認する。
