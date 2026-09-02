# Security

最終更新: 2026-09-02

Phase 19以降の共通基盤整理を含むsourceとproductionの方針です。Phase 25で統合版をproductionへ反映し、既存のAccess所有者email完全一致policyを維持しています。

## 保護対象と境界

Tech Inboxが扱う主なprivate dataは保存した記事URL、タイトル等のメタデータ、既読状態、タグ、Daymarkが扱う主なprivate dataは習慣名、目標、状態履歴、日次記録です。Accessで検証された所有者識別情報は認証に使います。記事本文、画像、Access JWT、Cloudflare設定値、API tokenはD1へ保存しません。

信頼境界は次の3つです。

1. BrowserからCloudflare Accessおよびapp Workerまで
2. app WorkerからD1、Queue、Rate Limiting bindingまで
3. app WorkerからService Binding経由のmetadata-fetcher、およびfetcherから外部記事siteまで

metadata-fetcherをD1・Queue・Secretsから分離し、外部HTML取得側が侵害された場合の到達範囲を限定します。

## 認証と認可

- productionの全trafficをCloudflare Access applicationで保護する
- Allow policyは所有者email 1件への完全一致だけとし、Everyone、domain全体、bypassを許可しない
- app Workerでも`Cf-Access-Jwt-Assertion`を`jose`で再検証する
- RS256、issuer、audience、expiry、任意のnot-before、subject、email完全一致を必須にする
- `TEAM_DOMAIN`はHTTPSの`*.cloudflareaccess.com` originだけを許可する
- productionで設定やJWTが欠ける場合はrepositoryへ到達する前にfail closedする
- local迂回は`ENVIRONMENT=local`、HTTP loopback、`APP_ORIGIN`完全一致の組み合わせだけに限定する
- `/api`以下は製品ごとのpath列挙なしに共通保護を通す。例外は正確な`/api/v1/health`へのGET/HEADだけで、未知path・将来の製品APIも未認証では拒否する

認証middlewareはJWT payloadをdomain serviceへ渡さず、検証済みの`AuthPrincipal`へ変換します。Access policyだけに依存せず、Worker内検証を第二の境界として維持します。

運用時の`pnpm cloudflare:preflight`は読み取り専用APIで、Access applicationの対象Worker、所有者email 1件だけのallow policy、7日session、launcher非表示、app/fetcherの`workers.dev`・preview公開状態を継続検査します。credential値と個人emailは出力しません。

## API入力と変更操作

- request、query、responseをstrictなZod schemaで検証し、未知fieldを拒否する
- 通常のJSON request bodyを16 KiB、Tech Inbox backup importを1 MiB、Daymark backup importを4 MiBに各envelope余白を加えた上限までに制限し、宣言値とstream実測値の両方を検査する
- 変更操作は`Content-Type: application/json`、`Origin`の`APP_ORIGIN`完全一致、`X-Rizakura-Hontai-Client: web`を要求する。旧`X-Rizakura-Me-Client: web`・`X-Tech-Inbox-Client: web`だけのclientも互換入力として許可するが、指定したいずれかのheaderが不正・空・競合値なら拒否する。新clientはrollback互換のため現行headerと`X-Tech-Inbox-Client`を送る
- URL、title、tag、pagination cursor等へ長さ・形式・列挙値の上限を設ける
- D1のUNIQUE、CHECK、foreign key、transactional batchでservice検証を補強する
- clientへ返すerrorは安全な列挙済みcodeと一般化したmessageに限定し、内部例外を返さない

Rate Limiting bindingはAccess principalのsubjectとemailをSHA-256化した値とroute categoryをkeyにします。生の識別子をbindingへ渡しません。categoryはcreate 30/min、metadata retry 10/min、mutation 60/min、read 120/min、export 5/minです。import previewはexport、import確定はmutationへ分類します。これは認証や厳密なglobal quotaの代替ではありません。

製品固有の分類がないAPIも、変更系はmutation、それ以外はreadへ既定分類します。HEADは対応するGETと同じ分類とし、export制限を回避させません。共通基盤は記事のhandler、DB adapter、業務UIをimportせず、static ESM importの境界testで維持します。

## SSRFと外部HTML

metadata-fetcherは次を強制します。

- `http`と`https`だけを許可し、credential付きURLを拒否する
- portを80と443に限定する
- loopback、private、link-local、documentation、multicast等のIPv4/IPv6を拒否する
- localhostおよびinternal用途のhostname suffix、単一label hostnameを拒否する
- redirectごとにURLを再検証し、最大3回、loopを拒否する
- 外部fetchを8秒、HTML responseを1 MiBに制限する
- HTML/XHTML以外を拒否し、stream上限超過時は読み取りを中断する
- 任意file、本文、画像を保存しない

fetcherは`workers_dev: false`、`preview_urls: false`で公開routeを持たず、D1、Queue、Access Secretsのbindingも持ちません。外部site固有の失敗は記事全体の削除につなげず、URLを保持して安全な失敗状態を表示します。

## Browser security

Static AssetsとAPIの両方に次を設定します。

- CSP: selfを基本とし、object、frame ancestor、workerを禁止する。PWA manifestだけは同一originから許可する
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- camera、microphone、geolocation、payment、USBを無効化するPermissions Policy
- same-originのOpener/Resource Policy
- HSTS
- `X-Robots-Tag`と`robots.txt`によるindex拒否

外部由来のtitle、site名、概要はReactのtextとして表示し、HTMLを注入しません。元記事linkは新しいtabで開き、openerを渡しません。

入口と記事は別のHTML entrypointを配信し、入口では記事APIを取得しません。既知の記事pathだけを記事HTMLへ対応付け、欠落asset・未知path・APIへHTML fallbackを返しません。HTMLのCache-Controlを設定し、旧manifestとPWA idは維持します。製品間の移動は同一originのdocument navigationです。画面・static assetsへのAccess保護は従来どおりhost全体のapplicationで行い、同一originを製品間の強い隔離とはみなしません。

## Data、export、backup

- D1へ記事、URL alias、タグ、記事・タグ関連と、`daymark_`prefixの習慣、設定履歴、日次記録だけを保存する。製品間のforeign keyは作らない
- 製品別JSON exportはruntime検証済みの公開DTOだけで構成し、認証情報、Worker設定、相手製品のデータを含めない。Tech Inbox schema v1/v2とDaymark schema v1を製品識別子で混同させない
- export responseは`no-store`とし、Rate Limitを適用する
- JSON importはschema、件数、参照整合、製品固有の一意性を検証し、既存値を上書きしない。Daymarkの競合設定・記録は現在値を残してskipし、追加はUTF-8で1,000,000 bytes以下のJSON bound valueへ分割して単一D1 batchで確定する
- import responseとrequest logにはURL、title、習慣名、実績値、backup本文を含めず、件数と安全なerrorだけを返す
- Daymarkは習慣200、設定履歴2,000、日次記録20,000、pretty JSON 4 MiBを上限とし、書き出せたfileが読み込み上限を超えないよう同じfile上限を適用する。超過時は切り捨てず停止する
- タグ削除は関連だけを削除し、記事本体を保持する
- canonical重複統合では残存記事を決定的に選び、タグ上限超過件数を構造化logへ残す
- migration前にJSON exportまたはD1 Time Travel bookmarkを確認する

backupと復元手順は[Operations](operations.md)を参照してください。

## Secretsとcredential

- `.dev.vars`、`.env`、Cloudflare API token、Access JWT、cookie、private key、個人email allowlistをcommitしない
- production secretは`wrangler secret put`の対話入力またはCloudflare dashboardで登録する
- API tokenは対象account、必要権限、短い有効期限に限定し、process environmentだけで渡す
- command引数、shell history、issue、screenshot、logへsecret実値を残さない
- token使用後は失効させ、漏えいが疑われる場合は直ちにrotationする
- `.gitignore`とphase終了時のtracked diff scanを維持する

## Logsとprivacy

構造化logはrequest ID、固定route名、method、status、処理時間、安全なerror code等に限定します。JWT、authorization header、cookie、URL query/body、email、Access設定値、外部HTMLを記録しません。Rate Limit keyもhash化します。

調査時はWorkers Logsでstatus、outcome、exception、CPU time、Queue eventを確認します。logを共有する場合は、request ID以外の識別情報とURLを再確認してredactします。

## Supply chainと品質ゲート

- direct dependencyを完全固定し、lockfileをcommitする
- 公開後7日未満のpackage、exotic subdependency、未審査build scriptをpnpm設定で拒否する
- build scriptは審査済みの完全versionだけを許可する
- Cloudflare生成型差分、strict TypeScript、unit/component/integration/E2E、coverage、実D1、artifact budget、auditを`pnpm check`で検証する
- high/critical advisoryは0件を必須にする
- GitHub Actionsは`contents: read`だけを許可し、checkout credentialを保持せず、Cloudflare secretを渡さない
- Playwrightのlocal previewには無効なdomain・audience・emailの固定placeholderだけを使い、production認証値を参照しない
- workflowが使用する公式actionは完全なcommit SHAへ固定し、tagの移動による内容変更を避ける
- CIのNode.jsは固定URLから取得し、SHA-256一致後だけworkspace配下へ展開・実行する
- CIのpnpmは固定URLから取得し、dependency baselineのSHA-512 integrity一致後だけ展開・実行する

既知のmoderate advisory 1件はDrizzle Kit配下の開発専用推移依存で、runtime bundleには含まれません。上流解消をdependency更新時に再確認し、互換範囲外の強制overrideは行いません。詳細は[Dependency baseline](dependency-baseline.md)を参照してください。

## 残余リスク

- Cloudflare accountまたは所有者のidentity providerが侵害されるとAccessを突破される可能性があるため、account MFAを維持する
- Rate Limiting bindingはeventually consistentで、厳密なglobal quotaではない
- 外部siteのHTMLやnetwork特性によりmetadata取得は失敗し得る
- Freeプラン上限超過時は課金される前提にせず、処理失敗や機能制限を想定する
- Daymark確定復元はsnapshot取得を含めて50 D1 query/invocation以内、最大新規復元を88,600 rows written/day相当へ制限する。同じUTC日の大容量操作を重ねず、D1 metricsを運用判断値にする
- Tech Inbox全体には件数上限がないため、D1の将来容量をlocal fixtureから保証しない。production database sizeが400 MB以上ならmigration・大量import・deployを停止する
- 3年backupのparse・検証・mergeはCPU負荷が大きいため、最大400記録/requestへ分割する。Phase 25のpreview-only本番観測で29 requestの成功・例外0・コールド最大約12.3 ms・ウォーム後P99約9.1 msを確認済みだが、今後もError 1102、`exceededCpu`、反復する10 ms超過を停止条件にする
- Android実機確認は所有者判断でスキップされており、mobile Chromium E2Eは実機成功の代替ではない
- D1 Time Travelの保持期間外に備え、定期的なJSON exportが必要である

## Incident response

1. Access policy、Worker deployment、D1、Queue、Secretsのどこに影響があるかを切り分ける。
2. 漏えいの可能性があるtokenとsessionを失効し、secretをrotationする。
3. 必要ならAccess applicationを維持したままapp Workerを既知のversionへrollbackする。
4. D1変更が疑われる場合は現在のbookmarkとJSON exportを確保し、復元操作を止めて影響範囲を確認する。
5. Queue deliveryをpauseできる場合は新規処理を止め、DLQをpurgeせず内容の由来を確認する。
6. 秘密情報を含まないtimeline、version ID、request ID、影響、復旧結果を`docs/progress.md`へ記録する。

rollback、D1 Time Travel、Queue、logsの具体的手順は[Operations](operations.md)に記載しています。
