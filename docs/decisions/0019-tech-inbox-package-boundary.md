# ADR-0019: Tech Inboxを先に同一repository内の製品packageへ分離する

日付: 2026-09-23
状態: 採用（Phase 32）。別repository作成と本番反映はPhase 33/34。

## 背景

Cloudflareの基盤名・origin移行を終え、Tech InboxをDaymarkと同様に独立管理できる構成へ進める。移動と同時にAPI、DB、画面挙動や認証を変更せず、先に固定した製品境界を検証する。

## 決定

- `packages/tech-inbox`にprivate workspace package `@rizakura-hontai/tech-inbox`を置く。Phase 32では通常の追跡directoryであり、Git submodule、新repository、npm公開ではない。
- 製品が画面・記事/タグ/活動/backup契約・純粋なdomain・service・repository port・記事schema定義・metadata取得/解析/再試行判断・単体testを所有する。
- 基盤は共通HTTP契約、認証/認可/Origin/Rate Limit/安全なerror、HTTP adapter、D1 adapter、Queue/service binding、maintenance制御、HTMLRewriterの生成、共通UI/入口/PWA配信、全schema集約、過去migration、結合test・deployを所有する。
- browserへ`TechInboxClient`と共通UIの型付きportを渡す。製品は基盤HTTP/資格情報や共通UI実装をimportせず、注入なしで暗黙にfetchへfallbackしない。
- serviceはHTTP statusを持たない`TechInboxError`を返す。基盤routeで既存の400/404/409と安全なmessageへ変換し、それ以外の例外は従来どおり非公開の500にする。
- metadata業務はrepository・fetch・Queue送信・clock・HTML parserを注入する。基盤はfrozen判定を先に行い、native retry/ackとログを管理する。fetcherの非公開設定、SSRF防止、URL/redirect/容量/時間制限は変えない。
- `app`/`browser`/`contracts`/`core`と`server`/`schema`/`metadata`のentrypointを分ける。後者はbrowser exportを無効化し、相対source importでもclient buildが失敗する検査を追加する。基盤やDaymarkへの逆向きimportをsourceとunit fixtureの両方で検査する。
- 記事tableの物理定義・migration履歴は変えない。schemaは製品から基盤へ一方向に集約し、製品は基盤のDB packageに依存しない。

## 品質と後続

- 製品単体の型検査は基盤tsconfigやCloudflare生成型に依存しない。domain/contracts/metadata/schemaのcoverageと、client/UI mockによる単体testを製品内で実行する。
- UIの包括的coverageは基盤の既存HTTP/UI結合testで維持し、移動先TSXも全体coverageへ含める。既存閾値を下げず、両製品のlocal D1/API/E2Eも実行する。
- third-partyのversion・integrity・7日gate・install script policyを変えず、lockfileはworkspace importerだけを更新する。
- Phase 33で公開範囲と対象repositoryを確認し、同じ製品sourceを`modules/tech-inbox`の固定commit submoduleへ移す。独立CIとlockfileの整備、clean checkoutの結合検証はそのphaseで行う。
- Phase 32だけでは本番を更新しない。追加Worker/DBや有料サービスは導入しない。
