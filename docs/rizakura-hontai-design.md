# rizakura-hontai: 共通基盤とDaymarkの設計

最終更新: 2026-09-02
状態: Phase 25完了。production migrationと統合版を反映し、本番CPU観測で検出した3年分Daymark previewの反復超過を、最大400記録のrequest分割と対象recordだけのD1読取で解消した。改善版の29 requestは全成功し、コールド最大約12.3 ms、ウォーム後P99約9.1 msだった。iPhoneで入口、Tech InboxとDaymarkの独立PWA、日・週・月への記録反映も確認した。

2026-08-31の所有者指示で、当初の基盤名rizakura-meをrizakura-hontaiへ変更した。既存の`Rizakura0110/rizakura-me`は別repositoryとしてそのまま残し、今回の基盤には使わない。Phase 18/19の実行記録とADRは当時の名称を保持する。

最新の所有者指示を本設計の前提とする。旧実装ガイドの「記事専用」「PWAを実装しない」という初期scopeからの変更を記録する。手順と完了条件は[フェーズ計画](rizakura-hontai-roadmap.md)、判断の要約は[ADR-0009](decisions/0009-rizakura-me-product-boundaries.md)を参照する。

## 1. 合意した構成

| 対象 | 名称・役割 |
|---|---|
| 共通基盤・入口のサイト | `rizakura-hontai`。本人限定のトップページから各機能へ移動する |
| 基盤と記事を管理するrepository | `Rizakura0110/rizakura-hontai`。旧`webclip`から履歴・repository IDを維持して改名済み |
| 記事管理 | `Tech Inbox`。記事、タグ、URL、metadata、記事backupを担当する |
| 習慣管理 | `Daymark`。画面、API処理、domain、schema定義、testを別repository `daymark`で管理する |
| PWA | Tech InboxとDaymarkを別々に追加・起動する。rizakura-hontai専用PWAは作らない |
| production | 同一origin、公開app Worker 1つ、既存D1 1つ。記事用metadata-fetcherは引き続き非公開Workerとして分離する |

```text
Browser → Cloudflare Access → rizakura-hontai（入口）
                               ├─ Tech Inbox（記事画面・専用PWA）
                               └─ Daymark（習慣画面・専用PWA）

基盤repository → 各機能をbuild時に統合 → app Worker → 共通D1
                       ↑                               ├─ 記事用table
               Daymarkの固定commit SHA                 └─ Daymark用table
```

repository、PWA、deployment、databaseの単位は独立して考える。Daymark repositoryへのpushだけではproductionを更新しない。基盤側で取り込みcommitを更新し、組み合わせを検証してからdeployする。3つ目の基盤専用repository、別の習慣用production Worker、独自domain購入は今回のscope外。

## 2. コードの所有と連携

### 基盤repository

- Access JWT検証、owner限定の認可、Origin・JSON・client header検証、Rate Limit、security headers、安全なerrorとlogを管理する。
- 入口ページ、共通UI部品、HTML entrypoint、機能へのnavigation、PWA配信を組み立てる。共通UIを使っても各製品の名前・icon・画面内navigationは独立させる。
- D1 binding、全schemaの組み立て、migration履歴、backupの入口、統合test、CI、production設定・deployを管理する。
- Tech Inboxの業務処理は共通基盤とは別moduleへ置く。タグやmetadata取得を汎用基盤へ持ち上げない。

### Daymark repository

- 習慣画面、入力フォーム、日付・目標・達成判定、契約schema、API handler、Daymark用repository adapter、DB schema定義、backup変換とtestを所有する。
- browser用、server用、contracts、DB schemaのentrypointを分ける。browserからserver entrypointをimportできないことをbuildで検査する。
- production Worker、Access設定、DB資格情報、remote migration/deploy commandを持たせない。app Workerの保護済みAPI配下へhandlerを組み込む。
- 注入されたDB・clock・ID生成などの必要な能力を使い、Tech Inboxのserviceやtableを直接参照しない。
- 共通contractは製品に依存させず、統合部分だけが両製品を参照する。相互importや、Daymarkから基盤アプリ全体への依存を作らない。

### Git submoduleとworkspaceによる取り込み

- `modules/daymark`のGit submoduleを完全commit SHAで固定し、`@rizakura-hontai/daymark`を`workspace:0.0.0`として取り込む。gitlinkが自作source、root lockfileが第三者依存の組み合わせを固定する。sourceを手作業でコピーして二重編集しない。
- React等の共有runtimeは互換peerを宣言し、基盤の固定versionへ揃える。秘密情報、実データ、Cloudflare設定、不要なtest成果物は配布物へ含めない。
- Git URL、直接tarball URL、moving branch/tag、`latest`、未審査のinstall scriptをdependency指定に使わない。
- [既存の供給網ルール](dependency-baseline.md)を両repositoryで維持する。registry依存には公開後7日gateを適用し、例外設定を追加しない。自作sourceはnpm配布をやめ、既存のworkspace sourceと同じくGit reviewと品質gateを通す。
- Phase 20では、clean checkoutから固定commitの取得・build・統合testを再現する。Daymark単体CIと基盤統合CIを設け、Daymarkを先にcommit/pushしてから基盤のgitlinkを更新する。build時の`git submodule update --remote`は使わない。

2026-08-31に所有者がnpm公開を使わないGit submodule方式を承認した。`Rizakura0110/daymark`のpublic作成承認は維持する。packageは`private: true`とし、npmアカウント・scope取得・publish権限は不要。公開repositoryに秘密情報や実データを含めない。判断変更は[ADR-0012](decisions/0012-daymark-git-submodule.md)に記録する。

Phase 20は読み込み・認証・build境界を検証する非機密の接続確認用stubに限定した。Phase 21は所有者との機能・PC画面設計後に、画面より先に必要な契約・domain・schema・APIを実装した。Phase 22ではDaymark repositoryが注入可能なReact画面を所有し、基盤が認証済みHTTP client・HTML・PWA配信を接続した。Phase 23ではDaymarkがbackup schema・merge判断・設定画面を所有し、基盤が保護APIとD1 adapterを接続した。

新repositoryのローカル配置は現在の許可領域内の`modules/daymark`とする。親repositoryはgitlinkと`.gitmodules`だけを管理し、Daymarkのsourceは別Git履歴へ記録する。両repositoryのcache・dist・秘密fileはignoreする。兄弟directoryやworkspace自体は移動せず、realpathとGit rootを確認する。

## 3. URL・HTML・独立PWA

| URL path | 提供内容 | manifest |
|---|---|---|
| `/` | rizakura-hontaiの入口。記事・習慣の2つの導線 | 専用manifestなし |
| `/tech-inbox/` | Tech Inboxの全記事画面 | Tech Inbox専用 |
| `/tech-inbox/settings` | 記事のタグ管理・backup等 | Tech Inbox専用 |
| `/daymark/` | Daymarkの日次入力、週/月履歴、習慣管理、backup設定画面 | Daymark専用 |
| `/api/v1/articles*`、`/api/v1/tags*`、既存export/import | 既存APIを互換維持 | 対象外 |
| `/api/v1/daymark/*` | 習慣・集計・Daymark専用backup API | 対象外 |

- `/articles`は`/tech-inbox/`、`/settings`は`/tech-inbox/settings`へ同一origin内で互換遷移させ、queryを維持する。任意URLへのredirectは許可しない。
- 単一のHTMLを全pathへ返してmanifestだけをclient側で付け替える方式を避ける。直接アクセス時から入口・記事・習慣に適したHTML metadataとmanifest linkを返す。
- 全体としては1つのStatic Assets buildへ集約する。入口、Tech Inbox、DaymarkのHTML entrypointとdeep link fallbackを明示的に配信する。
- APIや欠落assetへHTML fallbackを返さない。製品内の未知画面はその製品内の404または安全な入口に限定し、習慣のpathを記事一覧へ吸収しない。
- 製品間と入口への移動は通常のdocument navigationを基本とし、manifest・HTML metadataを確実に切り替える。PWAから対象範囲外へ移動するとbrowserへ戻る場合があるため、installed appの自動起動は保証しない。

| PWA項目 | Tech Inbox | Daymark |
|---|---|---|
| name / short_name | `Tech Inbox` | `Daymark` |
| id | 既存の`/`を維持 | `/daymark/` |
| start_url | `/tech-inbox/` | `/daymark/` |
| scope | `/tech-inbox/` | `/daymark/` |
| manifest配信 | 既存`/manifest.webmanifest`を互換維持 | `/daymark/manifest.webmanifest` |
| icon / Apple metadata | 既存TI icon・記事専用metadata | Daymark専用icon・metadata |

Tech Inboxの`id: /`はアプリの識別子であり、入口ページがTech Inboxになるという意味ではない。manifestのidはscope外でもよいため、既存identityを維持してstart_urlとscopeを分ける。origin変更は別identityになるため、Worker名を含むURL変更と同時に無条件適用しない。[Web App Manifest: id](https://www.w3.org/TR/appmanifest/#id-member)

旧manifestを保持したinstalled PWAでは、起動先`/articles`からの互換遷移が必要になる。OSがmetadata更新を反映するかは実機で検証し、必要な場合だけ追加し直しを案内する。manifest更新だけで必ず移行できるとは記録しない。

manifest linkの`crossorigin="use-credentials"`を維持する。Service Worker、offline cache、Web Pushは追加せず、`worker-src 'none'`を維持する。入口にもAccessを適用するが、PWAごとのsession共有は保証せず、各PWAからのlogin・再loginを実機確認する。

## 4. 認証・DB・運用境界

- Phase 18時点の`app.ts`は保護対象pathを列挙していた。Phase 19で`platform/api.ts`の共通APIを既定保護とし、新handlerがJWT・Origin・Rate Limitを通らず処理へ到達しない構造をローカル実装した。例外は正確なhealth endpointのGET/HEADだけとする。
- 現行headerは`X-Rizakura-Hontai-Client`とし、旧`X-Rizakura-Me-Client`・`X-Tech-Inbox-Client`を互換入力として維持する。いずれかが`web`で、指定した全headerが`web`であることを要求する。値・Origin・JSON検証は弱めない。新clientはserver rollback用に`X-Tech-Inbox-Client`も送る。
- D1を直接利用するproduction Workerは既存app Workerのみとする。metadata-fetcherにDB・Secretsを追加しない。
- Tech Inboxの既存table名は変更しない。Daymark用tableは`daymark_`prefixを付け、製品間のforeign key・SQL joinを初期版では作らない。
- Daymarkがschema定義を提供し、基盤repositoryだけが全schemaからmigrationを生成・review・commitする。migration履歴・snapshotを両repositoryで独立生成しない。
- 同じD1にはtable単位の隔離を仮定しない。import境界のtestとSQL reviewで誤操作を防ぐが、同じWorker・DB・originの障害影響は共有される。
- 通常testはlocal DBだけを使う。Daymark独立test用の一時DBに加え、基盤側では既存記事・タグを入れたDBへの追加migrationを検証する。
- logへ習慣名、実績値、記事情報、backup本文を追加しない。DB全体のTime Travel復元は両製品へ影響するため、製品別JSON復元と区別する。

## 5. Daymarkの合意仕様

2026-09-01に所有者と初期要件およびPC画面案を確認し、日・週・月の構成で実装を進めることを合意した。Phase 21はデータ・API、Phase 22は画面・PWAに分ける。

### 記録と達成判定

- 記録粒度は1日。初期版では曜日限定・週N回・月N回の習慣を作らない。
- 種類はチェック式と数値式。数値式は0〜10億、小数3桁まで、20文字までの単位、「目標以上」または「目標以下」を持つ。DBは1000倍の整数で保持する。
- チェック式の`true`は達成、`false`は明示的未達。数値式は保存値をその日の目標と比較する。記録なしは未入力として未達と区別する。
- 日付境界は`Asia/Tokyo`。今日と過去は作成・修正・削除できる。未来への記録と未来の週/月の取得は拒否し、現在の週/月に含まれる未来日は集計対象外にする。

### 設定履歴

- 習慣は有効・休止・アーカイブの状態を持つ。休止・アーカイブ中は日次の記録対象および集計の分母から除く。
- 種類は作成後に変更しない。名称は現在名を更新できる。
- 目標、単位、比較条件、状態は適用開始日付きversionとして保存する。変更の適用日は今日以降だけとし、過去日を以前の設定で再評価できるようにする。
- 習慣作成前の日は対象外。週途中で作成した場合、その週の作成日以降だけを習慣別集計へ含める。

### 表示用集計と画面

- 日表示は各習慣の設定・記録・達成/未達/未入力と日全体の件数・達成率を返し、Phase 22の主な入力画面にする。
- 週表示は月曜〜日曜の7日を固定し、日別集計と習慣別の対象日・達成数・達成率を返す。
- 月表示は暦月の全日を返し、各日の達成・未達・未入力・対象数・達成率と月全体の集計を表示する。
- PC画面は日・週・月を切り替える。Phase 22でresponsive対応とDaymark専用PWAを実装し、画面上の最終文言・操作詳細を確認する。

具体的な契約と判断理由は[ADR-0013](decisions/0013-daymark-daily-domain.md)を参照する。

## 6. Backup方針

- Tech Inboxの既存schema v1/v2 export/importを維持する。Daymarkを追加しただけで旧exportがDB全体のbackupになったとは扱わない。
- Daymark backupは`product: "daymark"`、schema version 1で識別し、習慣、全設定履歴、日次記録を含める。認証情報、Cloudflare設定、Tech Inboxの記事は含めない。
- Tech InboxへのimportはDaymark tableを操作せず、Daymarkへのimportは記事tableを操作しない。
- 習慣は互換な同一IDまたは一意な完全fingerprintへ対応付け、ID衝突時は再割り当てする。設定履歴は習慣IDと適用日、記録は習慣IDと記録日を自然keyとし、同値なら一致、異なる既存値は上書きせず競合skipとして表示する。同じbackupの再実行は重複を作らない。
- Daymarkは習慣200、設定履歴2,000、記録20,000とpretty JSON 4 MiBを上限にする。書き出しと読み込みを同じfile上限に揃え、超過・参照不整合は明示errorで停止し、黙った切り捨てをしない。代表的な10習慣では1年3,650記録が1.12 MiB、3年10,950記録が3.36 MiB、4 MiB境界が約13,046記録だった。
- Daymark復元fileはmetadata 1 requestと最大400日次記録ごとのrequestへ内部で分ける。各record requestには参照する習慣と初期設定を含め、APIも400件超を拒否する。D1は対象の自然key・IDに一致する日次記録だけを読み、追加行をUTF-8で1,000,000 bytes以下のJSON bound valueへ分割してrequest単位のbatchへ渡す。途中失敗時は同じfileを再実行し、追加済みを一致として冪等に続行する。
- 初期版では両製品を一括上書きする復元を作らない。data migration前には両製品のbackupまたはDB全体の復元手段を確保する。

## 7. rizakura-hontaiへの命名移行

| 対象 | 目標と扱い |
|---|---|
| 入口・共通layout・共通説明 | `rizakura-hontai`へ変更する。Tech Inboxの画面名・PWA名は維持する |
| repository名 | `webclip`から`rizakura-hontai`へ改名済み。履歴を維持し、remoteを新URLへ更新する。既存の別repository `rizakura-me`には触れない |
| root package・共通module | 基盤部分を`rizakura-hontai`へ統一。記事専用の`tech-inbox`識別子は維持する |
| 共通API client header等 | 互換期間を設ける。旧clientを一括で切り捨てない |
| Worker・Access application・D1 | 基盤名を`rizakura-hontai`へ揃える移行対象。ただしPhase 18/19でremote名やIDを変更しない |
| 記事用Queue・DLQ・metadata-fetcher | 記事専用なので`tech-inbox`名を維持する |
| ローカル作業directory | 現在の`/Users/ryo/dev/webclip`を維持。repository表示名とfilesystemの移動を混同しない |
| 過去の進捗・deployment記録 | 当時の名前・versionを残す。過去の事実を新名称で上書きしない |

Worker名はworkers.devのhostnameに関係するため、変更にはAccess対象、APP_ORIGIN、JWT audience、PWA identity、旧URLの扱いの同時確認が必要になる。[Cloudflare workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

D1の物理名変更は安全なin-place変更が可能かを実行時に確認する。単にWranglerの名前を変更したり、旧DBを削除して同名の新DBを作ったりしない。名前だけのために2つ目のDBを常用する方針にはしない。productionの名称移行はPhase 25の独立した承認gateとし、保留したlegacy識別子があれば明記する。

## 8. 外部操作・所有者確認

1. Daymarkのpublic repository作成、commit固定のGit submodule連携、repository公開物review、独立CIと基盤のclean checkout統合gateは完了した。npm公開・ログインは行わない。
2. Phase 21の機能・PC画面設計は所有者と合意し、データ・APIのlocal実装まで完了した。
3. Phase 22で合意した画面とDaymark専用PWAをlocal実装・検証した。
4. Phase 23でDaymarkのbackup・復元をlocal実装・検証した。
5. Phase 24で3年分fixture、統合互換、D1 bound/query/write、構成・PWA・bundle・Free境界をlocal検証した。
6. Phase 25でproduction DB更新・deployを行い、名称を維持した既存リソースとURL、Access、統合版の本番CPU、iPhoneの2 PWAを確認した。

Phase 21〜23の完了はlocal実装と検証を対象とし、本番D1へのmigrationやdeploy承認には読み替えない。

料金や権限の確認が必要でも、推測で有料プランや公開設定を選ばない。Phase 18ではCloudflare、GitHub repository設定、registry、依存設定を変更しない。
