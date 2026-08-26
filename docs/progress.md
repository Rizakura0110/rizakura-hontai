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
