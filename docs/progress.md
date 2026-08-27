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
