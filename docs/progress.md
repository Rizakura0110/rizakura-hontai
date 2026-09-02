# Progress

現在の基盤名は`rizakura-hontai`。2026-08-31のPhase 20命名移行で変更し、過去の記録にある`rizakura-me`は当時の名前として保持する。現行の[フェーズ計画](rizakura-hontai-roadmap.md)・[設計書](rizakura-hontai-design.md)を参照する。

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
- このフェーズの実装・検証時点ではproduction D1 migration、Worker deploy、remote dataの変更は行っていない。後述のproduction反映はユーザーの明示許可後に別工程で実施した。

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
- remote Cloudflare changes: フェーズ実装・検証時点ではなし

### Production反映（2026-08-28）

- ownerの明示許可後、production D1 `tech-inbox`へ`0001_swift_rockslide.sql`を適用した。適用後は`0000`と`0001`がmigration履歴にあり、記事0件、タグ0件、記事タグ関連0件だった。
- 既存のAccess、D1、Queue、Service Binding、Rate Limiting設定を維持してapp Workerをdeployした。deployment versionは`44b7011a-e46e-4f2b-b040-1c675925a560`である。
- 未認証rootと記事APIがAccessへ302になることを確認し、ownerがCloudflare login後にproductionを正常表示できることを確認した。
- この反映では新しい有料productやresourceを作成していない。

## Additional Feature T4: URL保存時のタグ付け

### 実施内容

- 記事作成requestへ最大10件の`tagIds`を追加し、保存後の記事タグをresponseで返すようにした。タグ未指定の既存requestは空配列として扱う。
- 新規記事では記事本体、original URL alias、タグ関連をD1の同一batchへまとめ、記事だけが保存される部分成功を避けた。
- 正規化URLが登録済みの場合は新しい記事を作らず、既存タグを維持して選択タグを追加する。和集合が10件を超える場合と存在しないタグはvalidation errorにした。
- desktopのURL保存フォームとmobileの追加dialogへ、既存タグの複数選択、その場での新規タグ作成・即時選択、選択数表示を追加した。
- 保存responseを使って記事カードのタグチップと現在のタグ絞り込み結果を即時更新する。登録済みURLへタグを反映した場合は専用通知を表示する。
- fresh local D1と実HTTPで、新規記事へのタグ同時保存、登録済みURLへのタグ追加、存在しないタグの拒否を確認した。
- desktop/mobile PlaywrightへURL保存時の既存タグ選択、新規タグ作成、保存直後の複数タグ表示を追加した。
- 設計判断は[ADR-0007](decisions/0007-tagging-during-article-creation.md)へ記録した。
- 実装フェーズ完了時点ではproduction deployを行わず、commit後にownerの明示許可を得て後述のproduction反映を実施した。

### 採用判断

- 新規記事とタグ関連は同時確定するが、新しいタグ定義は既存のタグAPIで先に作成する。記事保存を取り消して未使用タグが残った場合は設定画面から削除できる。
- duplicate登録ではタグを置換せず和集合にする。これにより既存の分類を失わず、同じURLの再登録をタグ追加操作として利用できる。
- API responseへ保存後のタグを含め、保存直後の追加GETを行わず一覧状態を更新する。

### 検証結果

- `pnpm test`: pass（29 files、312 tests）
- coverage: statements 85.99%、branches 81.06%、functions 85.82%、lines 87.83%
- `pnpm api:verify:local`: pass
- `pnpm build`: pass
- artifact budget: pass（app Worker 433.3 KiB、client JavaScript 345.1 KiB）
- Playwright: pass（desktop/mobile合計16 tests）
- Codex内ブラウザ: desktopの保存フォームと320 × 700のmobile追加dialogを確認し、mobileはdocument幅320 px、dialog幅267 pxで横overflowなし
- full `pnpm check`: pass
- audit: high 0、critical 0、既知moderate 1
- remote Cloudflare changes: 実装フェーズ完了時点ではなし

### Production反映（2026-08-28）

- ownerの明示許可後、commit `9608e9d`を既存の`tech-inbox-app`へdeployした。deployment versionは`948efd5a-da7e-4cc3-9409-197418317d25`である。
- D1 migrationと新規resource作成は行わず、既存のD1、Queue producer/consumer、metadata-fetcher Service Binding、5種類のRate Limiting binding、production変数を維持した。
- deploy後、未認証rootと記事APIがともにCloudflare Accessへ302になることを確認した。

### 設定画面のタグ名保存修正とProduction反映（2026-08-28）

- 設定画面で複数タグを編集し、1件目を保存した際に別タグの未保存名が戻る問題を修正した。タグ一覧更新時は既存draftを保持し、保存行だけAPIの確定名へ同期する。
- 2タグを同時に編集して順番に保存できるcomponent回帰testを追加し、full `pnpm check`をpassした（Vitest 313件、desktop/mobile Playwright 16件、high/critical audit 0、既知moderate 1）。
- commit `a47add2`を既存の`tech-inbox-app`へdeployした。deployment versionは`3e3a02bf-d6b0-40ea-9dec-8fb37b1f0e3a`である。
- D1 migrationと新規resource作成は行わず、既存bindingを維持した。deploy後、未認証rootと記事APIがともにCloudflare Accessへ302になることを確認した。ownerの認証済み画面確認は後続deploymentへ引き継いだ。

### 設定画面のタグ追加とProduction反映（2026-08-28）

- 設定画面のタグ管理へ「新しいタグ名」と「追加」フォームを設け、追加直後に自動色付きのタグを一覧へ反映するようにした。同名タグ、100件上限、操作中の重複送信も画面上で処理する。
- component testで新規追加と同名案内、desktop/mobile Playwrightで設定画面からの追加を確認した。full quality gateはVitest 315件、Playwright 18件、high/critical audit 0、既知moderate 1でpassした。
- commit `aa9dc59`を既存の`tech-inbox-app`へdeployした。deployment versionは`ce9014c2-9cd4-4a73-b59c-2fceb1a4a30f`である。
- D1 migrationと新規resource作成は行わず、既存bindingを維持した。deploy後、未認証rootと記事APIがともにCloudflare Accessへ302になることを確認し、ownerが認証済み設定画面で「新しいタグ名」と「追加」フォームの表示を確認した。

## Phase 10: 最終文書化

### 実施内容

- `README.md`を作成し、目的、機能、技術構成、対応環境、local setup、品質ゲート、migration、deploy、secret、費用方針、非対応機能、troubleshootingを1か所から参照できるようにした。
- `docs/security.md`を作成し、AccessとWorker内JWT再検証、API入力防御、Rate Limiting、SSRF分離、security headers、データ・秘密情報・log・供給網、残余リスク、incident responseを整理した。
- `docs/operations.md`を作成し、JSON export、Queue・DLQ、Workers Logs、release、migration、deploy、rollback、D1 Time Travel、障害切り分け、定期確認を運用手順として整理した。
- dependency baseline、Cloudflare setup、quality gates、manual device testを最終状態へ同期した。過去のiPhone実機passを後から追加したタグ機能へ拡張せず、タグ機能の自動E2E・owner表示確認と未実施の実機再確認を分けて記録した。
- `.env`系の秘密情報ファイルもrepository全階層で無視し、exampleだけを明示的に許可するようにした。
- 実装ガイドのDefinition of Doneを、後続のowner要件で変更された専用未読画面と追加されたタグ機能も含めて監査した。

### 変更ファイル

- `.gitignore`
- `README.md`
- `docs/security.md`
- `docs/operations.md`
- `docs/dependency-baseline.md`
- `docs/cloudflare-setup.md`
- `docs/quality-gates.md`
- `docs/manual-device-test.md`
- `docs/progress.md`

### 採用判断

- READMEへproduction URL、Access設定値、個人email、token等を記載せず、保護前URLを公開しない方針を維持する。
- remote migration、rollback、D1 restore、Queue pause・purgeは通常の品質ゲートやphase終了処理へ含めず、対象と影響を確認した明示的な運用操作とする。
- Phase 10では新しいarchitecture判断を追加していないため、ADRは新設せず既存ADRへリンクする。
- 専用未読画面はownerの後続指示で削除済みだが、全記事画面の未読・既読状態とfilter、保存直後の反映は維持している。タグ機能はownerの後続指示を正として初期仕様へ追加した。

### Definition of Done監査

| 分類 | 判定 | 根拠 |
|---|---|---|
| 記事管理 | pass | URL登録、重複防止、canonical統合、非同期metadata、失敗時URL保持、既読・未読、検索・filter・sort、編集、削除をunit・実D1・実HTTP・E2Eで確認 |
| タグ | pass | 複数タグ、自動一意色、追加・名前変更・削除、記事保持、URL保存時付与、filter、export、canonical統合を自動検証 |
| Export | pass | schema version 2で記事、alias、タグ、関連を検証しdownload E2Eを確認。version 1の読取互換も維持 |
| Browser品質 | pass | desktop/mobile Chrome E2E 18 tests。iPhone Chromeは共通項目とタグ機能を実機pass。Android実機はowner判断でスキップし、手順だけを維持 |
| 認証・security | pass | Accessの所有者email完全一致、Worker内JWT再検証、非公開fetcher、SSRF、security headers、secret非混入を確認 |
| 品質・供給網 | pass | format、lint、生成型、TypeScript、315 tests、coverage、実D1、実HTTP、build、artifact budget、high/critical audit 0 |
| 費用・scope | pass | Phase作業で月額有料serviceを新規有効化せず、PWA・React Native・記事本文保存等を実装していない |
| 文書・運用 | pass | README、security、Cloudflare、operations、device test、quality、dependency、progress、ADRを整備 |
| 変更境界 | pass | projectのtool・cache・一時状態をrepository配下に限定。Phase 10ではCloudflare remote stateを変更していない |

### 実行したコマンド

- `pnpm check`
- Markdown relative link検査
- Phase 10変更ファイルのsecret候補scan
- `git diff --check`
- `git check-ignore`による生成物・cache・secret fileのignore確認

### 検証結果

- format、lint、Cloudflare生成型差分、TypeScript: pass
- Vitest: 29 files、315 tests pass
- coverage: statements 86.05%、branches 81.33%、functions 86.13%、lines 87.89%
- fresh local D1 migration/constraint verification: pass
- local実HTTP CRUD、入力防御、タグ、export、canonical統合verification: pass
- production build、metadata-fetcher dry-run、artifact budget: pass
- Playwright: desktop/mobile合計18 tests pass
- audit: high 0、critical 0、既知moderate 1
- Markdown relative link、secret候補、whitespace、ignore確認: pass
- remote Cloudflare changes: なし

### Owner follow-up verification（2026-08-28）

- repository ownerがiPhone Chromeでタグの追加、URL保存時の付与、絞り込み、名前変更、削除後の記事保持を確認した。
- repository ownerが設定画面からJSON backupを書き出し、privateな保存先へ保存できたことを確認した。backup本体、保存先、記事情報はrepositoryへ記録していない。

### 未解決事項

- Android Chrome実機はowner判断でスキップした。手順を維持し、成功扱いにはしていない。
- 既知のmoderate advisory 1件はDrizzle Kit配下の開発専用推移依存でruntime bundleには含まれない。上流更新時に再確認する。

## Phase 11: 本番運用の安定化

### 実施内容

- 既存の`pnpm cloudflare:preflight`を、D1・Queue・Worker・Access applicationの名前確認だけでなく、productionの認証・公開境界を検査する読み取り専用operationへ強化した。
- Access applicationがapp Worker 1件だけを対象とし、所有者email 1件だけのallow policy、7日session、app launcher非表示であることを検査する。
- app Workerは`workers.dev`有効・preview URL無効、metadata-fetcherは`workers.dev`・preview URLとも無効であることを検査する。
- pure assertion moduleへ検証条件を分離し、Access対象、追加policy、別email、Everyone、session、launcher、fetcher公開の回帰testを追加した。
- Access設定作成scriptも同じassertion moduleを使用し、作成時と日常監査の判定差をなくした。
- 現行productionへ読み取り専用preflightを実行し、credentialや個人情報を出力せず全条件を確認した。

### 変更ファイル

- `scripts/cloudflare-preflight-assertions.mjs`
- `scripts/cloudflare-preflight-assertions.test.mjs`
- `scripts/verify-cloudflare-preflight.mjs`
- `scripts/configure-cloudflare-access.mjs`
- `vitest.config.ts`
- `docs/operations.md`
- `docs/security.md`
- `docs/cloudflare-setup.md`
- `docs/quality-gates.md`
- `docs/progress.md`

### 採用判断

- 定期監査はCloudflare APIのGETだけを使用し、policy、secret、Worker、database、Queueを変更しない。
- API token、account ID、所有者emailはprocess environmentから受け取り、成功・失敗時とも値を表示しない。
- app WorkerはAccessで保護するため`workers.dev`を維持し、previewは無効とする。metadata-fetcherはService Binding専用として両方を無効にする。
- remote確認は`pnpm check`へ含めず、credentialとnetworkを持つ運用時に明示実行する。判定ロジック自体は通常のVitestへ含める。

### 実行したコマンド

- `pnpm exec vitest run scripts/cloudflare-preflight-assertions.test.mjs`
- `pnpm cloudflare:preflight`
- `pnpm check`

### 検証結果

- preflight assertion test: 10 tests pass
- production read-only preflight: pass
  - D1、Queue、app Worker、metadata-fetcher、Access application: expected resourceが各1件存在
  - Access application: app Workerだけを対象、owner email完全一致policy 1件、7日session、launcher非表示
  - app Worker: `workers.dev`有効、preview URL無効
  - metadata-fetcher: `workers.dev`・preview URLとも無効
- format、lint、Cloudflare生成型差分、TypeScript: pass
- Vitest: 30 files、325 tests pass
- coverage: statements 86.05%、branches 81.33%、functions 86.13%、lines 87.89%
- fresh local D1、local実HTTP API、production build、artifact budget: pass
- Playwright: desktop/mobile合計18 tests pass
- audit: high 0、critical 0、既知moderate 1
- remote Cloudflare changes: なし

### 未解決事項

- Android Chrome実機はowner判断でスキップした状態を維持する。
- 既知のmoderate advisory 1件はDrizzle Kit配下の開発専用推移依存であり、runtime bundleには含まれない。

## Phase 12: GitHub Actions品質ゲート

### 実施内容

- `main`へのpushとpull requestで、localと同じ`pnpm check`を実行するGitHub Actions workflowを追加した。Markdownと`docs/`だけの変更は実行対象外とした。
- workflow permissionを`contents: read`だけに限定し、checkout credentialを保持せず、Cloudflare credential、Worker Secrets、production URLを渡さない構成にした。
- checkout actionを完全なcommit SHAへ固定した。Node.js 24.19.0とpnpm 11.22.0は公式配布物を固定URLから取得し、それぞれSHA-256・SHA-512一致後だけGitHub workspace配下へ展開する。
- pnpm store、Playwright browser、XDG data、temporary fileをGitHub workspace配下へ限定した。同一refの古いrunはcancelし、job timeoutを25分に設定した。
- Playwright previewへ`.invalid`を含む固定test値だけを渡し、production認証値から分離した。未認証APIが401 `UNAUTHORIZED`で拒否されることをdesktop/mobileの両方で確認する。
- E2E previewをIPv4 loopback `127.0.0.1`へ明示的にbindし、Linux runnerでもhealth checkとbrowser testが同じendpointへ接続するようにした。

### 変更ファイル

- `.github/workflows/quality.yml`
- `playwright.config.ts`
- `tests/e2e/article-inbox.spec.ts`
- `README.md`
- `docs/quality-gates.md`
- `docs/security.md`
- `docs/progress.md`

### 採用判断

- CIはremote Cloudflare stateを確認・変更しない。credentialが必要な読み取り専用production preflightは、Phase 11の明示的な運用コマンドとして分離したままにする。
- GitHub runner既定のpackage manager shimに依存せず、repositoryのintegration scriptが要求するproject-local tool layoutをCIでも再現する。
- test用のdomain、audience、emailは認証を成立させない固定placeholderとし、repository ownerのemailやAccess設定値をGitHubへ登録しない。
- E2E serverは外部interfaceへ公開せず、loopbackだけで待ち受ける。

### 実行したコマンド

- `pnpm check`
- `CI=true pnpm e2e`
- YAML syntax check
- `git diff --check`
- generated file・cache・temporary fileのignore確認
- tracked contentのcredential・個人email pattern scan
- `gh run watch`によるpush後の実CI確認

### 検証結果

- local format、lint、Cloudflare生成型差分、TypeScript: pass
- local Vitest: 30 files、325 tests pass
- local coverage: statements 86.05%、branches 81.33%、functions 86.13%、lines 87.89%
- local fresh D1、実HTTP API、production build、artifact budget: pass
- local Playwright: desktop/mobile合計18 tests pass（`CI=true`を含む）
- local audit: high 0、critical 0、既知moderate 1
- GitHub Actions run `33185298895`: success（commit `798e84a`）
- 初期runで検出したpnpm shim layout、project-local Node、Linux localhost解決の差はworkflowとE2E設定で解消し、失敗したgateを迂回・無効化していない。
- credential pattern、個人Gmail、whitespace、ignore確認: pass
- remote Cloudflare changes: なし

### 未解決事項

- Android Chrome実機はowner判断でスキップした状態を維持する。
- 既知のmoderate advisory 1件はDrizzle Kit配下の開発専用推移依存であり、runtime bundleには含まれない。

## Phase 13: JSONバックアップの安全な復元

### 実施内容

- 設定画面へ最大1 MiBのJSON backup選択、local schema確認、server preview、明示確認、復元結果表示を追加した。
- schema version 1・2について、record上限、参照整合、original URL alias、正規化URL、ID・タグ名・タグ色の一意性を検証するimport contractを追加した。
- original URLとタグ正規化名で既存recordへ対応付け、既存値を更新・削除しないpure merge planを実装した。新規IDとタグ色の衝突は未使用値へ再割り当てし、URL conflictと上限超過はskip件数へ反映する。
- previewでは書き込まず、確定時に最新snapshotから再計算する。新規記事、タグ、URL alias、タグ付けはD1の単一batchで追加する。
- backup内の`pending`記事はQueueへ一括再投入せず、URLを保持した`NETWORK_ERROR`の`failed`へ変換して個別再取得できるようにした。
- import routeへAccess、Origin、client header、body上限、Rate Limitを適用し、responseとrequest logへbackup本文や記事情報を含めない。
- 設計判断は[ADR-0008](decisions/0008-safe-json-backup-merge.md)へ記録した。

### 変更ファイル

- `packages/contracts/src/api.ts`
- `apps/web/src/worker/backup-import.ts`
- `apps/web/src/worker/backup-service.ts`
- `apps/web/src/worker/repositories/backup-repository.ts`
- `apps/web/src/worker/repositories/d1-backup-repository.ts`
- `apps/web/src/worker/app.ts`
- `apps/web/src/client/api/backup.ts`
- `apps/web/src/client/components/BackupImporter.tsx`
- `apps/web/src/client/pages/SettingsPage.tsx`
- contract、service、repository、API、component、実HTTP、desktop/mobile E2E test
- README、operations、security、quality gate、ADR、progress

### 採用判断

- 全面置換や既存recordの更新は行わず、不足分だけを非破壊でマージする。同じbackupを再投入しても重複を作らない。
- preview planを保存せず、確定時に最新D1から再計算する。並行変更があっても古い判断で既存データを上書きしない。
- 予期したURL conflictや件数上限はskipとして可視化し、予期しないDB conflictは単一batch全体を失敗させる。
- production deploy、remote migration、Cloudflare resource変更はPhase 13に含めない。

### 検証結果

- format、lint、Cloudflare生成型差分、TypeScript: pass
- Vitest: 33 files、338 tests pass
- coverage: statements 86.62%、branches 81.77%、functions 87.39%、lines 88.30%
- local実HTTP・一時D1: preview、単一batch復元、ID・色再割り当て、pending reset、再実行no-opをpass
- production build、metadata-fetcher dry-run、artifact budget: pass
  - app Worker: raw 449.7 KiB、gzip 96.7 KiB
  - metadata-fetcher: raw 585.5 KiB、gzip 88.8 KiB
  - client JavaScript: raw 356.4 KiB、gzip 104.1 KiB
  - client CSS: raw 28.9 KiB、gzip 6.3 KiB
- Playwright: desktop/mobile合計20 tests pass
- audit: high 0、critical 0、既知moderate 1
- GitHub Actions run `33252333989`: success（feature commit `0a2c2b8`）
- production read-only preflight: pass
  - 既存D1、Queue、app Worker、metadata-fetcher、Access applicationとowner限定policyを確認
- app Workerだけをproductionへdeploy（version `21a94e2e-04f1-426a-a782-00201a04a5f0`）
  - D1 migration、Cloudflare resource作成、metadata-fetcher変更、課金設定変更: なし
  - 既存のD1、Queue、Service Binding、Rate Limit、production originを維持
- 未認証production smoke: pass
  - top page、記事API、新しいimport preview APIはいずれもCloudflare Accessへ302 redirect
- owner browserで設定URLへの認証とproduction appへの到達を確認
- backupの選択・preview・復元は実行しておらず、production dataの変更: なし

### 未解決事項

- Android Chrome実機はowner判断でスキップした状態を維持する。
- 既知のmoderate advisory 1件はDrizzle Kit配下の開発専用推移依存であり、runtime bundleには含まれない。

## Phase 14: Production backup復元プレビュー訓練

### 実施内容

- ownerがproduction設定画面から最新のschema version 2 JSON backupを取得し、同じファイルを復元previewへ読み込ませた。
- previewに表示された追加、一致、競合skip、ID・色再割り当て、pending resetの全件数を確認した。
- production D1では記事本文を出力せず、記事、URL alias、タグ、タグ付けの件数だけをread-only queryで照合した。
- 復元確定は実行せず、backup fileもownerの端末外へ共有していない。

### 変更ファイル

- `docs/progress.md`

### 採用判断

- 同じbackupを現在の環境へpreviewすることで、schema version 2の読み込み、本番API、既存recordへの対応付け、冪等なno-op計画をproduction dataへ書き込まず確認する。
- previewのタグ付け0件は、production D1の`article_tags`も0件であることから欠落ではなく現在状態との一致と判断した。
- 書き込み経路は自動testで検証済みのため、production訓練だけを目的とした不要な復元確定は行わない。

### 実行したコマンド

- production設定画面でJSON exportと復元preview
- production D1への件数だけのread-only `SELECT`
- `pnpm check`
- `git diff --check`、ignore確認、tracked contentのcredential pattern scan

### 検証結果

- backup: schema version 2、記事1件、URL alias 1件、タグ3件、タグ付け0件
- preview: 記事1件、URL alias 1件、タグ3件が既存recordと一致
- preview: 新規追加、競合skip、ID・タグ色再割り当て、pending resetはすべて0件
- production D1 count: 記事1件、URL alias 1件、タグ3件、タグ付け0件でpreviewと一致
- production D1 query: `rows_written` 0、`changed_db` false
- 復元確定とproduction data変更: なし
- format、lint、Cloudflare生成型差分、TypeScript: pass
- Vitest: 33 files、338 tests pass
- coverage: statements 86.62%、branches 81.77%、functions 87.39%、lines 88.30%
- fresh local D1、local実HTTP API、production build、artifact budget: pass
- Playwright: desktop/mobile合計20 tests pass
- audit: high 0、critical 0、既知moderate 1

### 未解決事項

- Android Chrome実機はowner判断でスキップした状態を維持する。
- 既知のmoderate advisory 1件はDrizzle Kit配下の開発専用推移依存であり、runtime bundleには含まれない。

## Phase 15: Production運用ヘルスチェック

### 実施内容

- Cloudflare Access、D1、Queue、Worker、Worker subdomainを既存のread-only preflightで再監査した。
- Queue/DLQのresource接続、現在backlog、retention設定、過去7日のmessage operation集計、2つのWorkerの直近24時間のrequest・error・status集計を確認した。
- 現在backlogと直近24時間の新しいDLQ/fail、app Worker・metadata-fetcherのerror/non-successを安全に反復確認する`pnpm cloudflare:health`を追加した。
- health commandはmessage本文、記事情報、credential、account詳細、所有者情報を取得・表示せず、API errorの詳細もそのまま出力しない。
- 未認証のrootと記事APIがCloudflare Accessへ302 redirectされることと、production D1の記事metadata状態を件数だけで確認した。

### 変更ファイル

- `scripts/cloudflare-health-assertions.mjs`
- `scripts/cloudflare-health-assertions.test.mjs`
- `scripts/verify-cloudflare-health.mjs`
- `package.json`
- `README.md`
- `docs/operations.md`
- `docs/quality-gates.md`
- `docs/progress.md`

### 採用判断

- 通常Queueの現在backlog、新しいDLQ/fail、Worker error/non-successはhealth checkを失敗させる。trafficがないWorkerは0件の正常状態として扱う。
- 過去から保持されているDLQ backlogは件数とbytesだけを警告する。本文をpullせず、ack、retry、purgeを自動化しない。
- 直近24時間の集計は毎回現在時刻から計算し、remote stateを変更する通常の品質ゲートやGitHub Actionsには含めない。
- Phase 9で記録したDLQ 6件と、その後の1件はAnalytics上のDLQ delivery時刻と合計bytesが現在backlogに一致した。新しいDLQは24時間以内に発生していないため、継続障害ではないと判断した。

### 実行したコマンド

- `pnpm cloudflare:preflight`
- `pnpm cloudflare:health`
- `wrangler queues info`によるQueue/DLQ接続確認
- `wrangler deployments list`によるapp Worker・metadata-fetcher version確認
- Cloudflare read-only REST/GraphQL APIによるQueue・Worker集計確認
- production D1へのmetadata status件数だけのread-only `SELECT`
- 未認証root・記事API smoke
- `pnpm exec vitest run scripts/cloudflare-health-assertions.test.mjs`
- `pnpm check`
- `git diff --check`、ignore確認、tracked contentのcredential pattern scan

### 検証結果

- production preflight: pass
  - D1、Queue、app Worker、metadata-fetcher、Access applicationとowner限定policyが期待状態
- Queue接続: app Workerのproducer 1、consumer 1。通常Queue backlog 0件・0 bytes
- DLQ接続: producer 0、consumer 0。保持backlog 7件・851 bytes
- Queue/DLQ retention: 86,400秒。確認中のbacklog増加: なし
- 直近24時間のQueue terminal failure: DLQ 0、fail 0
- app Worker: 53 requests、53 success、0 errors
- metadata-fetcher: 3 requests、3 success、0 errors
- production D1 metadata: ready 1件、pending/failed 0件、`rows_written` 0、`changed_db` false
- app Worker最新versionはPhase 13 deployの`21a94e2e-04f1-426a-a782-00201a04a5f0`、metadata-fetcherは意図どおり据え置き
- 未認証root・記事API: Cloudflare Accessへ302 redirect
- health assertion test: 10 tests pass
- remote resource、Queue message、production dataの変更: なし
- format、lint、Cloudflare生成型差分、TypeScript: pass
- Vitest: 34 files、348 tests pass
- coverage: statements 86.62%、branches 81.77%、functions 87.39%、lines 88.30%
- fresh local D1、local実HTTP API、production build、artifact budget: pass
- Playwright: desktop/mobile合計20 tests pass
- audit: high 0、critical 0、既知moderate 1
- GitHub Actions run `33254453287`: success（feature commit `a98b35f`）

### 未解決事項

- DLQには過去の7件が保持されている。本文を確認していないためpurgeせず、次回health checkで件数増加と直近24時間の新規deliveryを監視する。
- Android Chrome実機はowner判断でスキップした状態を維持する。
- 既知のmoderate advisory 1件はDrizzle Kit配下の開発専用推移依存であり、runtime bundleには含まれない。

## Phase 16: Desktop sidebarスクロール修正

### 実施内容

- 長い設定画面をスクロールするとdesktop sidebarが途中で切れる問題を修正した。
- desktop sidebarをviewportへ固定し、main contentにはsidebar幅と同じ左余白を設けた。
- 低いviewportでもsidebar自身を縦スクロールできるようにした。mobile navigationは変更していない。
- 長いmain contentを最下部までスクロールしてもsidebarがviewport全高に残るE2E regression testを追加した。

### 変更ファイル

- `apps/web/src/client/components/AppLayout.tsx`
- `tests/e2e/article-inbox.spec.ts`
- `docs/progress.md`

### 採用判断

- `sticky`要素は親要素の末端で一緒に流れ、main contentが長い画面ではsidebarの背景と下部説明がviewportから外れるため、desktopだけ`fixed`配置へ変更した。
- sidebar幅224pxを`w-56`と外側の`md:pl-56`で一致させ、既存のdesktop content幅とmobile layoutを維持した。
- regression testではテスト専用にmain contentを200vhへ伸ばし、最下部までスクロールした後のsidebar上端0px・下端viewport高を検証する。

### 実行したコマンド

- production build後の対象Playwright test
- local previewを1318×766で開き、設定画面をスクロールする実表示確認
- `pnpm check`
- production deploy前後の`pnpm cloudflare:preflight`
- `pnpm --dir apps/web exec wrangler deploy`
- deploy後の`pnpm cloudflare:health`
- 未認証root・記事API smoke
- `git diff --check`、ignore確認、tracked contentのcredential pattern scan

### 検証結果

- 1318×766のlocal previewで、スクロール前後ともsidebarは上端0px・下端766px・高さ766pxを維持
- format、lint、Cloudflare生成型差分、TypeScript: pass
- Vitest: 34 files、348 tests pass
- coverage: statements 86.62%、branches 81.77%、functions 87.39%、lines 88.30%
- fresh local D1、local実HTTP API、production build、artifact budget: pass
- Playwright: desktop/mobile合計21 tests pass、desktop専用regression testのmobile実行1件skip
- audit: high 0、critical 0、既知moderate 1
- GitHub Actions run `33255159239`: success（fix commit `126507d`）
- production app Worker deployment version: `ce557ef5-671b-4664-a015-3ea786adafff`
- D1、Queue、Service Binding、5種類のRate Limiting binding、production変数: 維持
- DB schema、API、migration、新規resource、metadata-fetcherの変更: なし
- deploy後preflight: owner email完全一致policy、7日session、launcher非表示、appだけの公開境界を維持してpass
- 未認証root・記事API: Cloudflare Accessへ302 redirect
- deploy後health: app Worker 33 requests・33 success・0 errors、metadata-fetcher 1 request・1 success・0 errors
- 通常Queue backlog 0件、直近24時間のDLQ/fail 0件。過去のDLQ 7件・851 bytesは本文を読まず変更なし
- ownerが認証済みproduction設定画面を最下部までスクロールし、sidebarが切れないことを確認

### 未解決事項

- Android Chrome実機はowner判断でスキップした状態を維持する。
- 既知のmoderate advisory 1件はDrizzle Kit配下の開発専用推移依存であり、runtime bundleには含まれない。

## Phase 17: iPhone PWA基盤

完了: 2026-08-31。本番反映済みで、所有者からSafariでのPWA確認完了報告を受領した。

### 実施内容

- Tech InboxをiPhoneのホーム画面からstandalone表示で起動するWeb App Manifestを追加した。
- 既存UIと同じ青地・白文字の`TI`ブランドから、Apple touch 180px、標準192px・512px、maskable 512pxのPNG iconを生成した。
- HTMLへtheme color、application name、Apple standalone metadata、manifest・icon linkを追加した。
- Cloudflare Access配下でも認証sessionを付けてmanifestを取得するため、manifest linkへ`crossorigin="use-credentials"`を指定した。
- CSPは同一originのmanifestだけを許可し、Service Workerとoffline cacheを禁止する`worker-src 'none'`は維持した。
- desktop/mobile E2Eでmanifest内容、全icon配信、HTML metadata、CSP境界を検証した。

### 変更ファイル

- `apps/web/public/manifest.webmanifest`
- `apps/web/public/icons/icon-source.svg`
- `apps/web/public/icons/apple-touch-icon.png`
- `apps/web/public/icons/icon-192.png`
- `apps/web/public/icons/icon-512.png`
- `apps/web/public/icons/icon-maskable-512.png`
- `apps/web/index.html`
- `apps/web/public/_headers`
- `apps/web/src/worker/security-headers.ts`
- `apps/web/src/worker/app.test.ts`
- `tests/e2e/article-inbox.spec.ts`
- `README.md`
- `docs/security.md`
- `docs/quality-gates.md`
- `docs/manual-device-test.md`
- `docs/progress.md`

### 採用判断

- App Store費用とnative appの7日ごとの再署名を避け、既存のCloudflare Free構成をそのまま使うPWAを採用した。
- PWA iconは新しいブランドを作らず、sidebar・mobile headerで使用中の`TI`ロゴを再利用した。
- 記事情報を端末へ独自cacheせず、更新の即時反映と認証境界を単純に保つため、初期版ではService Workerを登録しない。
- start URLは既存の全記事画面`/articles`、scopeと安定したapp IDは同一origin全体の`/`とした。

### 実行したコマンド

- macOS Quick Lookと`sips`によるPNG生成・寸法確認
- icon 512pxの目視確認
- `vitest run apps/web/src/worker/app.test.ts`
- production build後の対象Playwright test
- `pnpm check`
- deploy前後の`pnpm cloudflare:preflight`
- app Workerだけのproduction deploy
- 未認証root・API・manifestのHTTP確認と`pnpm cloudflare:health`
- 実機完了報告後の文書更新に対する`pnpm format:check`
- `git diff --check`、ignore確認、tracked contentのcredential pattern scan

### 検証結果

- icon: Apple 180×180、標準192×192・512×512、maskable 512×512、すべてPNG
- manifest: app ID `/`、start URL `/articles`、scope `/`、display `standalone`、標準・maskable iconを検証
- HTML: credential付きmanifest link、Apple touch icon、theme/application/standalone metadataを検証
- CSP: `manifest-src 'self'`、`worker-src 'none'`をStatic AssetsとAPIの両方で検証
- 対象Playwright: desktop/mobile 2 tests pass
- format、lint、Cloudflare生成型差分、TypeScript: pass
- Vitest: 34 files、348 tests pass
- coverage: statements 86.62%、branches 81.77%、functions 87.39%、lines 88.30%
- fresh local D1、local実HTTP API、production build、artifact budget: pass
- Playwright: desktop/mobile合計21 tests pass、desktop専用regression testのmobile実行1件skip
- audit: high 0、critical 0、既知moderate 1
- GitHub Actions run `33256409753`: success（feature commit `36cfedb`）
- production app Worker deployment version: `991d4212-61d0-4543-b4b2-fa4e1c7f782d`
- D1、Queue、Service Binding、5種類のRate Limiting binding、production変数: 維持
- dependency、DB schema、API機能、migration、新規resource、metadata-fetcherの変更: なし
- deploy前後preflight: owner email完全一致policy、7日session、launcher非表示、appだけの公開境界を維持してpass
- deploy時の未認証`/`・`/api/articles`・`/manifest.webmanifest`: Cloudflare Accessへ302 redirect（API確認に使ったpathは`/api/articles`であり、実際のAPI routeは`/api/v1/articles`）
- deploy後health: app Worker 43 requests・43 success・0 errors、metadata-fetcher 1 request・1 success・0 errors
- 同healthで通常Queue backlog 0件、直近24時間のDLQ/fail 0件。過去のDLQ 7件・851 bytesは本文を読まず変更なし
- 上記のproduction checkはデプロイ時の結果であり、2026-08-31の実機完了報告受領時に再実行したものではない
- 2026-08-31にownerからSafariでのPWA確認完了報告を受領。案内した確認範囲と未確認項目は`docs/manual-device-test.md`に記録した

### 未解決事項

- Access session期限切れ後の再ログインとSafariでの全CRUD操作は今回の実機確認には含めない。
- Android Chrome実機はowner判断でスキップした状態を維持する。
- 既知のmoderate advisory 1件はDrizzle Kit配下の開発専用推移依存であり、runtime bundleには含まれない。

## Phase 18: rizakura-meの共通基盤・命名・連携境界の設計

状態: 完了（2026-08-31）。所有者の追加指示により、習慣の機能・UI設計は実装直前へ移し、本フェーズを共通基盤の設計へ限定した。公開範囲・配布方式はPhase 20の外部操作前に確定する。

### 実施内容

- 共通基盤・入口をrizakura-me、記事をTech Inbox、習慣をDaymarkとする設計とPhase 18〜25の計画を文書化した。
- 基盤＋記事は既存repository、Daymarkは別repository、productionは同一app Worker・D1で統合する境界を整理した。
- 入口専用PWAは作らず、Tech Inbox・DaymarkそれぞれにHTML entrypoint、manifest、icon、scopeを用意する方針を記録した。
- 既存Tech InboxのPWA id `/`を維持し、旧`/articles`・`/settings`・manifestを互換対応する移行方針を記録した。
- 共通API認証、単一migration履歴、製品別backup、命名移行時の外部操作の承認境界を整理した。
- 初回draftの習慣入力・目標・数値精度・日付・集計・table構成を確定扱いから外した。Phase 20完了後、Phase 21の業務実装前に所有者と機能・UIを設計するgateを設けた。
- Phase 20までのDaymark連携は非機密の接続確認用stubに限定し、習慣用フォーム・業務API・tableを先行実装しないことを`AGENTS.md`にも記録した。
- 既存のdependency policyとregistry公開・認証・費用を確認した。public/privateの未回答を基盤作業の停止理由にせず、Phase 20の外部操作前に配布方式と合わせて確定する。

### 変更ファイル

- `AGENTS.md`
- `README.md`
- `docs/rizakura-me-design.md`
- `docs/rizakura-me-roadmap.md`
- `docs/decisions/0009-rizakura-me-product-boundaries.md`
- `docs/progress.md`

### 採用判断

- 本フェーズは設計文書のみ。名称置換、画面・API・DB実装、package追加、GitHub repository改名/作成、registry公開、Cloudflare変更は実施しない。
- Git URL・直接tarball依存を使わず、現行の完全固定・7日gateを維持する。自作packageの即日取り込みのために例外設定を追加しない。
- public/privateと具体的な配布方式の確定はPhase 20へ移す。作成・公開の許可を推測せず、Phase 18/19では外部設定を変更しない。
- 最新指示によりPhase 18の完了条件から習慣機能/UI・配布先の確定を外した。既存の品質ゲートは維持し、failed checkを免除していない。

### 実行したコマンド

- 既存guide、source、manifest、router、Wrangler、dependency/quality/operations文書の読み取り
- npm、GitHub Packages、pnpm、Web App Manifest、Cloudflareの公式仕様確認
- `pnpm check`
- 文書更新後の`pnpm format:check`、Markdown relative link検査、whitespace・秘密情報pattern・ignore確認

### 検証結果

- format、lint、Cloudflare生成型差分、TypeScript: pass
- Vitest: 34 files、348 tests pass
- coverage: statements 86.62%、branches 81.77%、functions 87.39%、lines 88.30%
- fresh local D1、local実HTTP API、production build、artifact budget: pass
- Playwright: desktop/mobile合計21 tests pass、desktop専用testのmobile実行1件skip
- audit: high 0、critical 0、既知moderate 1
- build時のproduction secrets不足warningはcredentialを用意していないlocal検証によるもの。秘密情報を補充せず、E2Eは従来のtest専用設定でpassした
- 最新のscope変更後も`pnpm check`を再実行し、全品質ゲートがpassした
- 文書更新後のformat、Markdown relative link 27件、whitespace、追跡対象の秘密情報pattern scan、生成物・cache・secret fileのignore確認: pass
- runtime code、dependency、lockfile、production、GitHub repository設定、package registryの変更: なし
- 新しい入口・Daymark・独立PWAの実装/実機検証: 未実施

### 未解決事項

- Daymarkの機能・UIは未設計。Phase 20完了後、Phase 21の業務実装前に所有者と合意する。
- Daymark repositoryのpublic/privateと配布方式はPhase 20の外部操作前に確定する。Phase 18/19の停止条件ではない。
- package namespace・publish権限、GitHub改名/新規作成、本番名/URL移行は後続フェーズの明示的な外部操作gateとする。

## Phase 19: rizakura-meの共通基盤と入口

状態: 完了（2026-08-31）。実装・ローカル検証を完了し、productionへの反映は行っていない。

### 実施内容

- rizakura-meの入口を追加し、Tech Inboxへのdocument navigationと記事画面からの戻りlinkを実装した。Daymarkは準備中表示だけで、業務機能・フォーム・DB/APIは作っていない。
- Tech Inboxを`/tech-inbox/`・`/tech-inbox/settings`へ移し、旧`/articles`・`/settings`からqueryを保持して互換遷移する。
- 入口と記事のHTML/JS entrypointを分離した。入口は記事APIを取得せず、manifestを持たない。記事の既存PWA id・manifest URL・iconを維持し、start_url/scopeを記事配下へ分けた。
- ASSETS bindingと既知pathの配信を追加し、全体SPA fallbackを無効化した。未知path、Daymark未提供path、欠落assetへHTMLを返さない。
- 記事APIを共通認証・request検証・Rate Limit・error/logから分離した。health GET/HEAD以外のAPIは未知pathを含めて既定保護し、未分類handlerにもread/mutate制限を適用する。
- 共通UI・HTTP client・HTTP契約を分離し、root/web/contracts/dbの内部package名をrizakura-meへ整理した。新旧client headerを互換維持する。
- 旧機能のtestを維持し、入口往復、URL/HTML/PWA互換、仮の追加APIの保護、import境界のtestを追加した。

### 主な変更ファイル

- `apps/web/index.html`、`apps/web/tech-inbox/index.html`、`vite.config.ts`、`wrangler.jsonc`、`worker-configuration.d.ts`
- `apps/web/src/client/portal.tsx`、`pages/PortalPage.tsx`、`platform/`、記事layout/routerとimport参照
- `apps/web/src/worker/app.ts`、`bindings.ts`、`tech-inbox-api.ts`、`platform/`と既存API/testのimport参照
- `packages/contracts/src/http.ts`、各workspaceのpackage manifest、`pnpm-lock.yaml`
- `tests/e2e/article-inbox.spec.ts`、`scripts/platform-boundaries.test.mjs`、`vitest.config.ts`
- README、設計/roadmap、Security、Operations、Cloudflare setup、Quality gates、manual device test、dependency baseline、ADR-0010

### 採用判断

- 既存Cloudflare/Vite構成、D1・Access・origin・Queueの対象は維持し、新しいhosting・DB・Worker・外部依存は追加しない。
- 入口と記事は別HTMLとし、client側だけのmanifest付け替えは行わない。記事の既知画面だけをWorker経由で配信し、欠落assetへfallbackしない。
- package名変更は内部workspace参照だけ。第三者package version・integrity・7日policyを変更しない。
- 習慣機能の設計・実装を先行しない。公開範囲や配布先、repository作成・改名はPhase 20へ残す。

### 実行したコマンド

- 既存source・guide・設計書とCloudflare/Viteの公式仕様確認
- `pnpm install --frozen-lockfile`、`pnpm cf:typegen`
- `pnpm format`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm e2e`
- `pnpm check`

### 検証結果

- 最終の`pnpm check`が成功。format、lint、生成型整合、TypeScript、test、coverage、local D1・実HTTP、build、artifact budget、E2E、auditを通過した
- 39 files・407 unit/component/integration tests、27 desktop/mobile E2E testsがpass。desktop専用sidebar testのmobile実行1件は従来どおりskip
- coverageはstatements 86.98%、branches 82.79%、functions 87.21%、lines 88.59%で既存thresholdを満たした
- artifact budgetはapp Worker 451.7 KiB raw / 97.1 KiB gzip、metadata-fetcher 585.6 / 88.8、client JS合計359.6 / 106.0、CSS 30.2 / 6.5で上限内
- dependency auditはhigh 0・critical 0。既知の開発時推移依存のmoderate 1件は継続し、runtime依存の追加やpolicy緩和はない
- 全phase差分をreviewし、`git diff --cached --check`、変更documentのlocal link 40件、生成物・cache・秘密fileのignoreとtracked contentのcredential pattern scanを確認した。対象外ファイル・検出された秘密値の混入はない
- TypeScriptのASSETS test fixture不足を修正した。import境界testは固定TypeScript 7の非対応compiler APIを使わず、static ESM検査へ修正してpassした
- buildの本番Secrets不足warningには本番credentialを補充せず、E2Eはtest専用設定で実行した

### 未解決事項

- 本番反映、実際のAccess・CPU、既存iPhone PWAのmetadata更新・起動先移行は未確認。local testを本番/実機成功とは記録しない
- GitHub repository改名・Daymark repository作成・package公開、Cloudflare resource名変更、remote migrationは未実施
- 次はPhase 20の別repository・配布連携準備。習慣機能・UI設計はPhase 21冒頭に所有者と行う

## Phase 20: 別repositoryとpackage連携の準備

状態: 完了（2026-08-31）。命名移行に続き、Daymarkのpublic repository・Git submodule連携を実装した。local全品質gateと基盤CIのclean checkout検証が成功。npm公開は最新の所有者指示で取り下げた。

### 命名移行

- 所有者は当初の基盤名rizakura-meをrizakura-hontaiへ変更するよう指示した。記事製品Tech Inboxと習慣製品Daymarkは改名しない。
- GitHubの`Rizakura0110/rizakura-me`は2025年作成の別repository（ID 1058698925）と確認し、一切変更していない。
- 新名称の重複がないことと管理権限を確認し、`Rizakura0110/webclip`を`Rizakura0110/rizakura-hontai`へ改名した。repository ID 1347410907、main branch、public設定を維持し、local originを新URLへ更新した。
- 入口・共通layout・内部package/import・HTTP client header・設計/roadmap・作業規約を新名称へ更新した。過去のADRと進捗は当時の名前を保持する。
- 旧X-Rizakura-Me-ClientとX-Tech-Inbox-Clientを互換入力として維持し、不正・空・複数値が混じるrequestは拒否する。新clientはX-Rizakura-Hontai-Clientと従来のTech Inbox headerを送る。
- ローカルdirectory、Cloudflare Worker・D1・Access・Queue・本番URL、記事PWA identity、業務DB/API契約は変更していない。本番deployは実行していない。
- 検証中に既存Modalの遅延autofocusがURL入力からタイトルへfocusを奪う競合を発見した。失敗traceのPATCH本文がURL変更ではなくtitle変更になっていることと、再現用component testの失敗を確認した。dialog内で選択済みのinputからはfocusを奪わず、focusが外れた場合だけ補完する最小修正と2件の回帰testを追加した。競合エラーを確認する既存E2Eの期待値・timeoutは緩めていない。

### 検証

- `pnpm install --frozen-lockfile`: 395 entriesの供給網policy検証とworkspace再リンクが成功。第三者依存・7日policyの変更なし。
- 修正後の`pnpm check`が成功。format・lint・生成型整合・TypeScript・local D1/実HTTP・build・artifact budget・E2E・auditを通過した。
- 39 files・414 unit/component/integration tests、27 desktop/mobile E2E testsがpass。desktop専用sidebar testのmobile実行1件は従来どおりskip。
- focus修正後、失敗していたmobileのURL競合E2Eを追加で10回繰り返し、全10回passした。
- coverageはstatements 86.99%、branches 82.94%、functions 87.23%、lines 88.58%で既存threshold内。
- artifactはapp Worker 451.7 KiB raw / 97.1 KiB gzip、fetcher 585.6 / 88.8、client JS 359.7 / 106.0、CSS 30.2 / 6.5で上限内。
- auditはhigh 0・critical 0。既知の開発時推移依存moderate 1件は継続。本番Secrets不足のbuild warningにはcredentialを補充せず、E2Eは専用fixtureを使用した。
- 全差分をreviewし、documentのlocal link 53件、ignore・tracked contentのcredential pattern scanを確認した。移動した設計書のADR link 1件を修正して再検証した。生成物や秘密fileはcommit対象に含まない。

### Git submodule連携の実施内容・採用判断

- 所有者が記事クリップと同じ開発・test・push・承認後deployを希望し、npmを使わない方式を承認した。ADR-0012でregistry配布案を取り下げた。npmログイン・scope取得・公開後7日の自作package待機は不要になったが、第三者registry依存の7日gateは維持した。
- owner・衝突なし・権限を確認し、public `Rizakura0110/daymark`を作成した。`modules/daymark`に別Git履歴を保持し、基盤はgitlinkの完全commit SHAとworkspace参照で統合する。既存の別repository rizakura-meには触れていない。
- Daymarkはprivate workspace packageとしてbrowser/server/contracts/schemaの非機密stubを提供する。portalの準備中表示と保護された`/api/v1/daymark/status`で接続確認し、習慣機能・UI・table・migrationは未作成のままとした。
- 両repositoryの固定toolchain・lockfile・供給網policyを維持した。単体CIと基盤のsubmodule checkout付きCIを用意し、Cloudflare credentialsやdeploy jobは追加していない。
- Viteがbrowser:nullだけではserver importを拒否しないことを失敗testで検出した。解決後sourceを検査するVite pluginとbrowser条件の型検査を追加し、package import・相対source importの両方を実buildで拒否する。
- 初回の実HTTP gateはWranglerのworkerd/worker/browser条件でserver入口が拒否され失敗した。workerd条件を先に解決するexportと回帰testを追加し、修正後のfull checkがpassした。gateを迂回・無効化していない。

### 変更ファイル

- `.gitmodules`と`modules/daymark`のgitlink、workspace/lockfile、CI、root scripts
- portalのbrowser import、共通保護配下のDaymark接続APIとtest、client型検査、Vite境界plugin・実build検証
- 実HTTP・E2E検証、ADR、設計・roadmap・README・品質基準・依存基準・作業規約

### コマンドと追加検証結果

- `pnpm daymark:check`: frozen install、format、lint、TypeScript、2 files・8 tests、coverage全指標100%、宣言付きbuild、audit pass（単体は既知脆弱性なし）。DaymarkのGitHub Actionsも`e5b341d`でsuccess。
- 修正後の`pnpm check`: format、lint、生成型整合、TypeScript、40 files・419 tests、coverage、fresh local D1、実HTTP、production/dry-run build、artifact budget、E2E、auditすべてpass。
- coverage: statements 87.02%、branches 83.00%、functions 87.29%、lines 88.61%。既存thresholdを維持した。
- E2E: desktop/mobile 27 pass、desktop専用sidebarのmobile実行1件は従来どおりskip。新接続APIの未認証401も確認した。
- artifact raw/gzip: app Worker 452.3/97.2 KiB、fetcher 585.6/88.8、client JS 359.7/106.0、CSS 30.2/6.5。すべてbudget内。
- audit: high 0、critical 0、既知の開発用推移依存moderate 1。第三者依存のversion・integrityと既存migrationに変更なし。
- Daymarkを先にcommit/pushしてから基盤の参照を更新した。公開物review、秘密情報pattern scan、生成物ignore確認を実施した。

### Clean checkoutと完了確認

- 基盤commit `a524d95`をpushし、GitHub Actions run `33403352565`が3分32秒でsuccessした。clean checkoutで固定Daymark commit `e5b341d`を取得し、frozen installからDaymark単体gate・基盤統合gate・実HTTP・build・desktop/mobile E2Eまで再現した。
- 基盤・Daymarkのlocal mainは各origin/mainと同期し、Daymarkの作業treeと基盤のgitlinkは一致している。Phase 20の対象変更を両repositoryへcommit・push済み。

### 次フェーズ・変更していないもの

- 習慣の業務機能・UIは未設計・未実装。Phase 21冒頭に所有者と設計する。
- npm公開、Cloudflareへのdeploy・resource作成・課金変更・remote DB操作は実施していない。本番は従来のTech Inboxのまま。

## Phase 21: Daymarkの機能設計とデータ・API基盤

状態: 完了（2026-09-01、未デプロイ）。所有者と習慣の要件および日・週・月のPC画面案を合意し、画面実装と分けて契約・domain・DB schema・保護APIまでを実装した。

### 合意した仕様

- 毎日1件ずつ記録するチェック式と数値式の習慣を扱う。数値は0〜10億、小数3桁まで、単位と「目標以上/以下」の比較を持つ。
- 日付は日本時間。今日と過去の記録を作成・修正・削除でき、未来は拒否する。記録なしは未入力、チェックfalseまたは目標未達値は明示的未達として区別する。
- 状態は有効・休止・アーカイブ。休止・アーカイブ、作成前、未来日は集計の分母から除く。
- 目標・単位・比較条件・状態の変更は今日以降の適用開始日を持つversionとして保存し、過去の評価を変更しない。種類は作成後に変えない。
- 週表示は月曜〜日曜の7日を日別・習慣別に集計し、週途中に作成した習慣は作成日以降だけを対象とする。月表示は暦月の全日を日別集計する。

### 実装内容

- Daymark repositoryへZod契約、JST日付・1000倍整数・達成判定・設定履歴・日/週/月集計のdomain service、repository interfaceを追加した。
- `daymark_habits`、`daymark_habit_versions`、`daymark_records`のDrizzle schemaを追加した。名称/単位長、種類/状態、チェック/数値shape、数値上限、一意性、index、cascadeをDB制約にした。
- 基盤repositoryがmigration `0002_mature_iron_monger.sql`とsnapshotを所有する。既存の記事・URL alias・タグ・タグ付けtableを変更せず、同じD1へ`daymark_`tableを追加する。
- app WorkerへD1 adapterと`/api/v1/daymark/*`を追加した。習慣一覧/作成、名称変更、今日以降の設定upsert、日次取得、記録upsert/削除、週/月集計を既存のAccess認証、Origin・JSON・client header検証、read/mutate Rate Limit、安全なerror/log配下へ置いた。
- API statusはdomain準備完了を示す`ready`とJSTを返す。browserはまだ準備中表示のままで、利用画面を先行公開しない。
- 判断をADR-0013、設計・roadmap・README・品質基準・運用手順へ反映した。

### 検証結果

- Daymark単体: format、lint、TypeScript、5 files・38 tests、coverage全指標100%、宣言付きbuild、既知脆弱性0件。
- 基盤: Cloudflare生成型整合、TypeScript、40 files・423 tests、coverage statements 87.32% / branches 83.40% / functions 87.32% / lines 88.90%がpass。
- fresh local D1でmigration `0000`〜`0002`、全Daymark table/index/CHECK/UNIQUE/cascade、数値上限、再適用無変更を検証した。既存記事・タグ入りDBも保持した。
- 一時local D1を使う実HTTPでDaymark status、作成、一覧、記録、日/週/月集計、削除と既存記事フローがpassした。
- production/dry-run buildとentrypoint境界がpass。artifactはapp Worker 482.2 KiB raw / 103.1 KiB gzip、metadata-fetcher 585.6 / 88.8、client JS 359.7 / 106.0、CSS 30.2 / 6.5でbudget内。
- Playwrightはdesktop/mobile 27件pass、desktop専用sidebarのmobile 1件skip。依存監査はhigh 0・critical 0で、既知の開発用推移依存moderate 1件だけを継続した。

### 変更していないもの・次フェーズ

- production D1へのmigration、Cloudflare deploy、resource作成、Access・課金設定変更は実施していない。本番は従来どおり。
- Daymarkの日・週・月画面、responsive対応、専用manifest/PWAはPhase 22で実装する。製品別JSON backupはPhase 23へ残す。

## Phase 22: Daymark画面と独立PWA

状態: 完了（2026-09-01、未デプロイ）。Phase 21で合意した日・週・月・習慣管理画面を保護APIへ接続し、Daymark専用HTML・manifest・iconをlocal buildとdesktop/mobile E2Eで検証した。

### 実装内容

- Daymark repositoryへ、注入された`DaymarkClient`だけを使うReact画面を追加した。日次のチェック・数値入力、過去日移動、未入力への戻し、達成率を操作できる。
- 月曜〜日曜の週tableと、暦月の各日を達成率で表示して日次画面へ進める月カレンダーを実装した。
- チェック式・数値式の習慣追加と、名称・目標・単位・達成条件・有効/休止/アーカイブ変更を実装した。設定変更は既存APIどおり今日から適用する。
- desktop固定sidebar、mobile bottom navigation、入口への通常linkを持つresponsive構成にした。
- 基盤repositoryへDaymark API client、`/daymark/`専用HTML entrypoint、Tailwind source連携、document routingを追加し、入口の準備中表示を利用可能な導線へ変更した。
- Daymark専用manifestはid/start_url/scopeを`/daymark/`へ揃え、専用Apple/192/512/maskable iconを配信する。入口にmanifestを付けず、Tech Inboxの既存identityと混在させない。
- Static Assetsのworker-first対象をHTML pathだけに限定した。`/daymark/*`全体を先にWorkerへ渡すとmanifest/iconが404になることをE2Eで検出し、root/indexだけへ狭めた。
- Vite boundaryへ`app` entrypointを加え、Daymarkのserver/schemaがbrowser bundleへ混入しない既存拒否を維持した。

### 検証結果

- 最終`pnpm check`が成功。format、lint、Cloudflare生成型、TypeScript、unit/component/integration test、coverage、fresh local D1、実HTTP、production/dry-run build、artifact budget、desktop/mobile E2E、auditを通過した。
- Daymark単体は7 files・43 testsがpassし、domain・契約・日付処理のcoverageはstatements/branches/functions/linesすべて100%。宣言付きbuildと依存監査も成功し、既知脆弱性0件だった。
- 基盤は41 files・429 testsがpass。coverageはstatements 87.50%、branches 83.45%、functions 87.57%、lines 89.06%で既存threshold内。
- Playwrightは31 testsがpassし、desktop専用sidebar testのmobile実行1件だけを意図どおりskipした。Daymarkの日次記録、週/月切替、習慣追加・編集、320px幅、専用HTML/manifest/iconを両viewportで確認した。
- artifact raw/gzipはapp Worker 482.5/103.2 KiB、metadata-fetcher 585.6/88.8、client JavaScript 399.6/115.7、CSS 34.0/7.1で全budget内。
- 基盤auditはhigh 0・critical 0。既知の開発用推移依存moderate 1件だけを継続し、Daymark単体は既知脆弱性0件だった。
- build時の本番Secrets不足warningにはcredentialを補充せず、E2Eは`.invalid`のtest専用値を使用した。

### 変更していないもの・次フェーズ

- production D1へのmigration、Cloudflare deploy、resource・Access・課金設定変更は実施していない。本番は従来のTech Inboxのまま。
- Phase 23でDaymarkのJSON backup・復元を実装する。Phase 24の統合互換確認、Phase 25の明示承認後deploy・iPhone実機確認は未実施。

## Phase 23: Daymark製品別JSONバックアップ・復元

状態: 完了（2026-09-01、未デプロイ）。Daymarkの習慣、設定履歴、日次記録を専用JSONへ書き出し、参照整合と競合件数をpreviewして既存値を上書きせず復元できるようにした。Tech Inboxのschema v1/v2とtableは維持した。

### 実装内容・判断

- Daymark repositoryへ`product: "daymark"`・schema version 1のbackup契約を追加した。習慣、全設定履歴、日次記録のID一意性、自然key、参照先、種類、作成日との前後関係、初期設定の存在をZodで検証する。
- 非破壊merge planは、互換な同一習慣を既存recordへ対応付け、異なるrecordとのID衝突を未使用IDへ割り当て直す。設定履歴と日次記録は習慣＋日付で照合し、同値を一致、異値を競合skipとして現在値を保持する。同じbackupの再投入はno-opになる。
- Daymark画面へ「設定」を追加し、件数表示、JSON download、4 MiB file検証、復元preview、確認checkbox、確定結果を実装した。競合skipとTech Inbox非変更を画面上で説明する。
- 基盤へ`GET /api/v1/daymark/export`、`POST /api/v1/daymark/import/preview`、`POST /api/v1/daymark/import`を追加した。共通Access、Origin、JSON、client header、no-store、export/mutate Rate Limitを通す。
- D1 adapterは追加行をtable別JSON配列へ変換し、`json_each`で展開する習慣・設定履歴・記録の最大3 SQL statementを1回のtransactional batchへ渡す。件数に比例したstatementを作らず、batch失敗を部分retryしない。
- 上限は習慣200、設定履歴2,000、日次記録20,000、pretty JSON 4 MiB。書き出しと読み込みを同じfile上限にし、超過や不整合を黙って切り捨てず明示errorで停止する。判断は[ADR-0014](decisions/0014-daymark-product-backup.md)へ記録した。

### 容量・DB適用測定

- 36文字ID、標準timestamp、チェック式10習慣の代表fixtureでは、1年3,650記録が1,177,936 bytes（1.12 MiB）、3年10,950記録が3,521,236 bytes（3.36 MiB）だった。
- 同fixtureのpretty JSON 4 MiB境界は約13,046記録・4,194,052 bytes。18,250記録は5.59 MiB、20,000記録は6.13 MiBとなるため、20,000記録fixtureでexport停止を自動testした。
- 実local D1ではJSON配列を3 statementで取り込み、最小fixtureの確定・再preview no-opに加え、10習慣・10設定履歴・3,650日次記録のpreviewと確定を同じ実HTTP gateで確認した。20,000記録のrepository planもstatement数が3のままであることをunit testした。復元前後のTech Inbox exportから`exportedAt`を除いた内容が一致した。

### 検証結果

- Daymark単体は8 files・64 testsがpassし、domain・契約・日付・backup処理のcoverageはstatements/branches/functions/linesすべて100%。format、lint、TypeScript、宣言付きbuild、auditもpassした。
- 基盤Vitestは42 files・434 testsがpass。coverageはstatements 87.75%、branches 83.70%、functions 87.89%、lines 89.26%で既存threshold内。
- fresh一時D1を使う実HTTPでDaymark export、preview、確定、再実行no-op、3,650記録の長期fixture、既存記事不変を検証した。D1 repository unit testでは20,000記録でも最大3 statementの単一batchとなることと、失敗時の非retryを確認した。
- Playwrightはdesktop/mobileでDaymark JSON download、file選択、preview、確認、復元完了を既存の日・週・月・習慣管理・PWAフローと合わせて検証し、31 testsがpass、desktop専用1 testがmobileで意図どおりskipした。
- production/dry-run buildとartifact budgetはpassした。app Workerはraw 500.6 KiB・gzip 106.3 KiB、metadata Workerはraw 585.6 KiB・gzip 88.8 KiB、client JSはraw 411.4 KiB・gzip 118.3 KiB、CSSはraw 34.0 KiB・gzip 7.1 KiBで既存budget内だった。高・重大脆弱性0件も確認した。production secretは補充せず、本番D1・Cloudflareへ接続していない。

### 変更していないもの・次フェーズ

- production D1 migration、Cloudflare deploy、resource・Access・課金設定変更は実施していない。本番は従来のTech Inboxのまま。
- 期間分割exportは初期版へ追加していない。上限超過時は明示停止し、Phase 24でquery/CPU・無料枠・全体互換性を再確認する。
- 次はPhase 24の統合品質・互換性・無料枠内設計の検証。Phase 25の本番反映は引き続き所有者の明示承認後に行う。

## Phase 24: 統合品質・互換性・Cloudflare Free境界

状態: 完了（2026-09-02、未デプロイ）。入口、Tech Inbox、Daymarkの既存統合gateを維持しながら、3年分のDaymark復元、D1のbound/query/write境界、2つのPWA、Cloudflare Free構成を再検証した。

### 実装内容・判断

- Phase 23のDaymark復元は最大4 MiBのJSONをtableごとに1つのD1 stringへbindしており、D1のstring/BLOB 2,000,000 bytes上限を超える可能性があった。各bound valueをUTF-8で1,000,000 bytes以下へ分割した。
- 習慣、設定履歴、日次記録の順を保った1回のtransactional batchと非retryを維持した。確定requestのsnapshot取得3 queryを予約し、writeを最大47 statement、合計50 query/invocation以内にした。
- repository unit testを20,000記録まで拡張し、複数chunkの順序、全bound bytes、boolean/null変換、全件保持、単一行超過時のbatch前停止を確認した。
- 実HTTPの長期fixtureを10習慣・10設定履歴・1年3,650記録から3年10,950記録へ変更し、preview、確定、再preview no-opとTech Inbox export不変をfresh local D1で確認した。
- `scripts/phase24-platform-budget.test.mjs`を追加し、Worker/D1/Queue数、未採用binding、Queue message/batch/retry、2つのPWA identity、backup body、D1 bound/query/read/write/databaseの設計予算を固定した。
- 最大Daymark復元はtable行とindex entryを含め88,600 rows written、snapshotは論理22,200行をtable/index分で2倍にした44,400 rows readの保守的予算とした。Freeの日次write上限に近いため、同じUTC日に大容量復元を重ねない運用とした。
- D1は500 MB/databaseだが、Tech Inbox全体には件数上限がないため、静的な将来容量を偽って保証しない。Phase 25でproductionの現在値を確認し、80%の400 MBを停止閾値にする。
- local Nodeの時間をWorkers CPU timeとみなさない。3年fixtureの書き込みなしpreviewをPhase 25の本番観測へ残し、通常処理の10 ms超過が3回以上連続または反復する場合、Error 1102、`exceededCpu`、例外が1件でも出る場合を停止条件にした。判断は[ADR-0015](decisions/0015-free-tier-release-gates.md)へ記録した。

### 最終検証結果

- `pnpm check`が成功。Daymark単体、format、lint、Cloudflare生成型、全TypeScript、unit/component/integration test、coverage、fresh local D1、3年fixtureの実HTTP、production/dry-run build、artifact budget、desktop/mobile E2E、dependency auditを通過した。
- Daymark単体は8 files・64 testsがpassし、domain・契約・日付・backup処理のstatements/branches/functions/linesはすべて100%。宣言付きbuildとauditもpassし、既知脆弱性0件だった。
- 基盤Vitestは43 files・440 testsがpass。coverageはstatements 87.80%、branches 83.67%、functions 87.94%、lines 89.31%で既存threshold内だった。
- fresh local D1のmigration・制約・再適用がpass。実HTTPでは10,950記録のpreview・確定・再preview no-op、既存記事不変を確認した。
- production/dry-run buildとartifact budgetはpass。app Worker raw 501.2 KiB・gzip 106.5 KiB、metadata-fetcher raw 585.6 KiB・gzip 88.8 KiB、client JavaScript raw 411.4 KiB・gzip 118.3 KiB、CSS raw 34.0 KiB・gzip 7.1 KiBだった。
- Playwrightはdesktop/mobile 31 testsがpassし、desktop専用sidebar testのmobile 1件だけを意図どおりskipした。入口と各製品、旧URL、未知path/asset、認証、記事・タグ・backup、Daymark日/週/月/管理/backup、2 manifest/iconを再確認した。
- 基盤auditはhigh 0・critical 0。既知の開発用推移依存moderate 1件だけを継続した。build時のproduction Secrets不足warningには値を補充せず、本番credentialを使用していない。

### 変更していないもの・次フェーズ

- production D1 migration、Cloudflare deploy、resource・Access・課金設定変更、本番データの読書きは実施していない。本番は従来のTech Inboxのまま。
- Phase 25は所有者の明示承認後に、preflight、backup、remote migration `0002`、deploy、Access/旧URL/2 PWA/実機、3年preview-only CPUを段階確認する。CPU停止条件に触れた場合は確定復元や公開完了へ進まない。
