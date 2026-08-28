# Security

最終更新: 2026-08-28

## 保護対象と境界

Tech Inboxが扱う主なprivate dataは、保存した記事URL、タイトル等のメタデータ、既読状態、タグ、Accessで検証された所有者識別情報です。記事本文、画像、Access JWT、Cloudflare設定値、API tokenはD1へ保存しません。

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

認証middlewareはJWT payloadをdomain serviceへ渡さず、検証済みの`AuthPrincipal`へ変換します。Access policyだけに依存せず、Worker内検証を第二の境界として維持します。

## API入力と変更操作

- request、query、responseをstrictなZod schemaで検証し、未知fieldを拒否する
- JSON request bodyを16 KiBまでに制限し、宣言値とstream実測値の両方を検査する
- 変更操作は`Content-Type: application/json`、`Origin`の`APP_ORIGIN`完全一致、`X-Tech-Inbox-Client: web`を必須にする
- URL、title、tag、pagination cursor等へ長さ・形式・列挙値の上限を設ける
- D1のUNIQUE、CHECK、foreign key、transactional batchでservice検証を補強する
- clientへ返すerrorは安全な列挙済みcodeと一般化したmessageに限定し、内部例外を返さない

Rate Limiting bindingはAccess principalのsubjectとemailをSHA-256化した値とroute categoryをkeyにします。生の識別子をbindingへ渡しません。categoryはcreate 30/min、metadata retry 10/min、mutation 60/min、read 120/min、export 5/minです。これは認証や厳密なglobal quotaの代替ではありません。

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

- CSP: selfを基本とし、object、frame ancestor、worker、manifestを禁止
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- camera、microphone、geolocation、payment、USBを無効化するPermissions Policy
- same-originのOpener/Resource Policy
- HSTS
- `X-Robots-Tag`と`robots.txt`によるindex拒否

外部由来のtitle、site名、概要はReactのtextとして表示し、HTMLを注入しません。元記事linkは新しいtabで開き、openerを渡しません。

## Data、export、backup

- D1へ記事、URL alias、タグ、記事・タグ関連だけを保存する
- JSON exportはruntime検証済みの公開DTOだけで構成し、認証情報やWorker設定を含めない
- export responseは`no-store`とし、Rate Limitを適用する
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

既知のmoderate advisory 1件はDrizzle Kit配下の開発専用推移依存で、runtime bundleには含まれません。上流解消をdependency更新時に再確認し、互換範囲外の強制overrideは行いません。詳細は[Dependency baseline](dependency-baseline.md)を参照してください。

## 残余リスク

- Cloudflare accountまたは所有者のidentity providerが侵害されるとAccessを突破される可能性があるため、account MFAを維持する
- Rate Limiting bindingはeventually consistentで、厳密なglobal quotaではない
- 外部siteのHTMLやnetwork特性によりmetadata取得は失敗し得る
- Freeプラン上限超過時は課金される前提にせず、処理失敗や機能制限を想定する
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
