# rizakura-me: 共通基盤とDaymarkの設計

最終更新: 2026-08-31
状態: Phase 18の共通基盤設計を基にPhase 19の入口・共通APIをローカル実装。production反映は未実施。Daymarkの機能・UIは実装直前に所有者と設計する。公開範囲・配布方式はPhase 20の外部操作前に確定する。本書の後続計画は実装・公開済みを意味しない。

最新の所有者指示を本設計の前提とする。旧実装ガイドの「記事専用」「PWAを実装しない」という初期scopeからの変更を記録する。手順と完了条件は[フェーズ計画](rizakura-me-roadmap.md)、判断の要約は[ADR-0009](decisions/0009-rizakura-me-product-boundaries.md)を参照する。

## 1. 合意した構成

| 対象 | 名称・役割 |
|---|---|
| 共通基盤・入口のサイト | `rizakura-me`。本人限定のトップページから各機能へ移動する |
| 基盤と記事を管理するrepository | 現在の`webclip`を将来`rizakura-me`へ改名する。履歴を維持する |
| 記事管理 | `Tech Inbox`。記事、タグ、URL、metadata、記事backupを担当する |
| 習慣管理 | `Daymark`。画面、API処理、domain、schema定義、testを別repository `daymark`で管理する |
| PWA | Tech InboxとDaymarkを別々に追加・起動する。rizakura-me専用PWAは作らない |
| production | 同一origin、公開app Worker 1つ、既存D1 1つ。記事用metadata-fetcherは引き続き非公開Workerとして分離する |

```text
Browser → Cloudflare Access → rizakura-me（入口）
                               ├─ Tech Inbox（記事画面・専用PWA）
                               └─ Daymark（習慣画面・専用PWA）

基盤repository → 各機能をbuild時に統合 → app Worker → 共通D1
                       ↑                               ├─ 記事用table
               Daymarkの固定version                    └─ Daymark用table
```

repository、PWA、deployment、databaseの単位は独立して考える。Daymark repositoryへのpushだけではproductionを更新しない。基盤側で取り込みversionを更新し、組み合わせを検証してからdeployする。3つ目の基盤専用repository、別の習慣用production Worker、独自domain購入は今回のscope外。

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

### パッケージ取り込み

- 自作moduleを完全version固定したpackageとして取り込む。rootのlockfileでproductionの組み合わせを再現する。sourceを手作業でコピーして二重編集しない。
- React等の共有runtimeは互換peerを宣言し、基盤の固定versionへ揃える。秘密情報、実データ、Cloudflare設定、不要なtest成果物は配布物へ含めない。
- Git URL、直接tarball URL、moving branch/tag、`latest`、未審査のinstall scriptをdependency指定に使わない。
- [既存の供給網ルール](dependency-baseline.md)を維持する。registryから取り込む自作packageにも既存の公開後7日ルールが適用されるため、即日取り込みを前提にしない。例外設定を勝手に追加しない。
- Phase 20では、clean checkoutから取得・build・統合testを再現する最小moduleで連携を先に検証する。公開直後は検証用source testを進めても、本番候補の取り込みgateを迂回しない。

配布先はPhase 20のrepository作成・package公開前に、公開範囲の回答を得て確定する。Phase 18/19の基盤作業はこの回答待ちにしない。publicの場合は無料のnpm public packageを第一候補とする。privateの場合はnpmの有料private packageを採用せず、GitHub Packagesの無料枠と超過停止設定、認証の扱いを確認してから再判断する。npmのnamespace所有権やpublish権限も外部操作前に確認する。[npm public](https://docs.npmjs.com/about-public-packages/)、[npm private](https://docs.npmjs.com/about-private-packages/)、[GitHub Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages)

Phase 20までに扱うDaymark moduleは、読み込み・認証・build境界を検証する非機密の接続確認用stubに限定する。仮の習慣フォーム、記録用API DTO、業務table、migration、集計処理を先に作らない。接続確認用stubを習慣機能の仕様やUI承認とみなさない。

新repositoryのローカル配置は現在の許可領域内の無視対象directoryを候補とし、親repositoryに`.git`やsourceを取り込まない。兄弟directoryや現在のworkspace自体の移動は、この設計だけを根拠に実施しない。clone先、ignore、realpath、個別Git rootをPhase 20で確認する。

## 3. URL・HTML・独立PWA

| URL path | 提供内容 | manifest |
|---|---|---|
| `/` | rizakura-meの入口。記事・習慣の2つの導線 | 専用manifestなし |
| `/tech-inbox/` | Tech Inboxの全記事画面 | Tech Inbox専用 |
| `/tech-inbox/settings` | 記事のタグ管理・backup等 | Tech Inbox専用 |
| `/daymark/` | Daymarkの製品入口。内部画面・navigationは実装直前に設計 | Daymark専用 |
| `/api/v1/articles*`、`/api/v1/tags*`、既存export/import | 既存APIを互換維持 | 対象外 |
| `/api/v1/daymark/*` | 新しい習慣API | 対象外 |

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
- 既存header `X-Tech-Inbox-Client`は互換入力として維持し、新しい共通名`X-Rizakura-Me-Client`を導入する場合も値・Origin・JSON検証は弱めない。単に製品名が変わったことを理由に古いclientを破壊しない。
- D1を直接利用するproduction Workerは既存app Workerのみとする。metadata-fetcherにDB・Secretsを追加しない。
- Tech Inboxの既存table名は変更しない。Daymark用tableは`daymark_`prefixを付け、製品間のforeign key・SQL joinを初期版では作らない。
- Daymarkがschema定義を提供し、基盤repositoryだけが全schemaからmigrationを生成・review・commitする。migration履歴・snapshotを両repositoryで独立生成しない。
- 同じD1にはtable単位の隔離を仮定しない。import境界のtestとSQL reviewで誤操作を防ぐが、同じWorker・DB・originの障害影響は共有される。
- 通常testはlocal DBだけを使う。Daymark独立test用の一時DBに加え、基盤側では既存記事・タグを入れたDBへの追加migrationを検証する。
- logへ習慣名、実績値、記事情報、backup本文を追加しない。DB全体のTime Travel復元は両製品へ影響するため、製品別JSON復元と区別する。

## 5. Daymarkの機能・UIは実装直前に設計する

2026-08-31の所有者指示により、習慣管理の機能・UIを今の段階で確定しない。初回draftにあった入力方式、数値精度、目標の適用日、集計ルール、具体的なtable構成は採用済みの仕様ではなく、本設計から外した。

現在維持するのは「習慣の達成状況や数値目標の記録を管理したい」という目的と、別repository・共通基盤・独立PWAという技術境界だけとする。

- Phase 18/19: 共通認証、入口、Tech Inboxの分離、命名と互換性を先に進める。
- Phase 20: repository・開発環境・CI・非機密の接続確認用stubによる連携を準備する。習慣の業務仕様に依存する実装は行わない。
- Phase 20完了後、Phase 21の機能実装前に一度区切り、所有者と機能・UIを設計する。画面案だけでなく、入力・保存・達成判定・履歴の意味も合わせて決める。
- 所有者との設計合意後に、DB schema、API DTO、業務処理、画面実装へ進む。先に作ったDB/APIへUIを合わせる順序にはしない。

設計時には、入力形式・記録の粒度、達成条件、数値/単位、日付の区切り、未入力の扱い、目標変更・休止・過去修正、集計、画面構成・navigation、必要なbackup項目を確認する。この列挙は検討項目であり、機能の採否や既定値の決定ではない。

## 6. Backup方針

- Tech Inboxの既存schema v1/v2 export/importを維持する。Daymarkを追加しただけで旧exportがDB全体のbackupになったとは扱わない。
- 製品別backupの識別・version管理を行い、Daymarkの項目・UI上の入口・復元の意味は機能/UI設計後に定める。
- Tech InboxへのimportはDaymark tableを操作せず、Daymarkへのimportは記事tableを操作しない。
- Daymarkのrecord識別、衝突の扱い、参照整合の具体的な規則は確定したデータモデルに合わせる。既存データを無断で上書きせず、他製品を変更しないことを共通の安全条件とする。
- 現在の記事import上限1 MiB・記事件数上限を習慣へそのまま流用しない。Phase 23で長期記録を使って容量・batch数・CPUを検証し、必要なら期間分割を提供する。書き出し成功したデータが無説明で復元不能になる仕様や、黙った切り捨ては禁止する。
- 初期版では両製品を一括上書きする復元を作らない。data migration前には両製品のbackupまたはDB全体の復元手段を確保する。

## 7. rizakura-meへの命名移行

| 対象 | 目標と扱い |
|---|---|
| 入口・共通layout・共通説明 | `rizakura-me`へ変更する。Tech Inboxの画面名・PWA名は維持する |
| repository名 | `webclip`から`rizakura-me`へ変更予定。対象・衝突・remote・CIを確認し、履歴を維持する |
| root package・共通module | 基盤部分を`rizakura-me`へ統一。記事専用の`tech-inbox`識別子は維持する |
| 共通API client header等 | 互換期間を設ける。旧clientを一括で切り捨てない |
| Worker・Access application・D1 | 基盤名を`rizakura-me`へ揃える移行対象。ただしPhase 18/19でremote名やIDを変更しない |
| 記事用Queue・DLQ・metadata-fetcher | 記事専用なので`tech-inbox`名を維持する |
| ローカル作業directory | 現在の`/Users/ryo/dev/webclip`を維持。repository表示名とfilesystemの移動を混同しない |
| 過去の進捗・deployment記録 | 当時の名前・versionを残す。過去の事実を新名称で上書きしない |

Worker名はworkers.devのhostnameに関係するため、変更にはAccess対象、APP_ORIGIN、JWT audience、PWA identity、旧URLの扱いの同時確認が必要になる。[Cloudflare workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

D1の物理名変更は安全なin-place変更が可能かを実行時に確認する。単にWranglerの名前を変更したり、旧DBを削除して同名の新DBを作ったりしない。名前だけのために2つ目のDBを常用する方針にはしない。productionの名称移行はPhase 25の独立した承認gateとし、保留したlegacy識別子があれば明記する。

## 8. 未実施の外部操作・所有者確認

1. Phase 20のrepository作成・package公開前に、Daymarkのpublic/privateと配布先を確定する。未回答をPhase 18/19の停止理由にしない。
2. package namespace・publish権限の確認、公開物の範囲への合意。repositoryがpublicでも新たなregistry公開を自動承認とは扱わない。
3. Phase 20でGitHub上のrepository改名・新規作成を行う前の対象・衝突・権限確認。
4. Phase 25でのproduction DB更新・deploy・リソース名/URL移行の承認。

外部操作とは別に、Phase 21の業務実装前には所有者との機能・UI設計合意を必須とする。準備完了や基盤作業への許可を、未設計の習慣機能への承認へ読み替えない。

料金や権限の確認が必要でも、推測で有料プランや公開設定を選ばない。Phase 18ではCloudflare、GitHub repository設定、registry、依存設定を変更しない。
