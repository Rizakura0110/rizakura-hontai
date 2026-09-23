# Tech Inbox

記事・タグ・既読活動・JSON backup・metadata取得を所有する製品package。
現在はrizakura-hontai repository内のprivate workspaceで、npmへ公開しない。

## Entry points

| Export | 用途 |
|---|---|
| `app` | 注入型React画面、製品route、結合test用の製品components/provider |
| `browser` | `TechInboxClient`・共通UIのport型、製品identity |
| `contracts` | 記事/タグ/活動/backup/Queue/fetcherの入出力schema |
| `core` / `core/*` | 状態・日付集計・URL正規化などの純粋処理 |
| `server` | service・domain error・repository/Queue port |
| `schema` | 記事用Drizzle table定義（migrationは持たない） |
| `metadata` | 注入型metadata取得/解析とQueue messageの処理判断 |

`server`・`schema`・`metadata`はbrowserから利用できない。
基盤やDaymarkをimportせず、実DB/Queue、認証付きHTTP、clock、ID生成、共通UI、HTML parserなど必要な能力を基盤が渡す。Cloudflare資格情報や本番設定をこのdirectoryへ追加しない。

## 検証

rootで固定lockfileをinstallした後、次を実行する。

```sh
pnpm tech-inbox:check
pnpm tech-inbox:boundaries
pnpm check
```

最初のcommandはこのpackage内のformat/lint、source/test型検査、単体test、domain/contracts/metadata/schema coverage、declaration buildを実行する。UIは注入client/UIの単体testと、基盤側の実HTTP adapterを使う既存結合test/coverage/E2Eで確認する。

`pnpm check`はDaymarkを含む結合版と依存監査まで実行する。製品単体test成功だけではdeployしない。cache・coverage・dist・node_modulesはGitへ含めない。

Phase 33で別repositoryと固定commit submoduleへ移す予定。現段階ではこのpackageだけのlockfileや独立repository CIは作らず、rootの供給網policy/lockfileを使う。
