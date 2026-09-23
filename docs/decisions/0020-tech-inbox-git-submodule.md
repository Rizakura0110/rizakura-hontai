# ADR-0020: Tech Inboxを固定commitのGit submoduleで統合する

日付: 2026-09-23
状態: 採用（Phase 33）。本番反映はPhase 34。

## 決定

- 所有者が別途承認したpublic `Rizakura0110/tech-inbox`を製品repositoryとし、`modules/tech-inbox`に完全commit SHAのgitlinkで取り込む。Daymarkと同じ方式で、npm公開・moving branch追従・製品からの独立deployは行わない。
- 初期sourceはPhase 32の`packages/tech-inbox`の検証済みsnapshotとする。74 source/test filesの内容は変えず、元の基盤履歴は保持する。基盤全履歴、資格情報、実データ、無関係な製品履歴を新repositoryへコピーしない。
- 製品の独立lockfile/CI/品質gateと、基盤の結合lockfile/CI/品質gateを分ける。公開後7日・完全version/integrity・peer検査・install script制限を維持し、初回lockfileは既存解決graphの到達可能な部分だけを引き継ぐ。
- 製品のtest/review/commit/pushを先行し、基盤gitlinkの更新後に組み合わせとclean checkoutを検証する。新cloneでは両submoduleの固定commitを初期化し、未commit変更を強制破棄しない。
- 共通runtimeはReact、React DOM、React Router、Zod、Drizzleの同一実体へ解決する。独立installでは同じversionでも別コピーになり得るため、Vite/Vitestで共有先を明示し、出力chunkへの重複混入をbuild guardで拒否する。既存のsize/coverage budgetを緩和しない。

## 維持する境界

- Tech Inboxは記事の画面・業務処理・契約・schema定義・metadata処理を所有する。基盤は認証、HTTP/D1/Queue adapter、PWA配信、全schema集約、migration、Cloudflare設定とdeployを所有する。
- repositoryの分離はサービス・DB・originの分離ではない。追加Worker/DB、料金変更、認証変更、data migrationは不要で、Phase 33では本番を変更しない。
- Phase 32後続CIのサイズ超過と分離後testのReact二重読み込みは、共有runtimeの解決統一と回帰検査で扱う。ローカルだけの成功をCI成功と記録せず、最終結果は[Progress](../progress.md)へ残す。
