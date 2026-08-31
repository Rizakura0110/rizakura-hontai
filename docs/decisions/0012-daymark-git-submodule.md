# ADR-0012: DaymarkをGit submoduleとして統合する

日付: 2026-08-31
状態: accepted（所有者承認済み）

## 背景

所有者はTech Inboxと同じ開発・テスト・push・承認後deployの流れを希望し、npm公開を使わない方式を承認した。Daymarkを別repositoryにする要件は維持する。ADR-0009のregistry配布に関する判断を本ADRで更新し、履歴自体は書き換えない。

## 決定

- 承認済みのpublic repository `Rizakura0110/daymark`を、基盤内の`modules/daymark`へGit submoduleとして置く。別のGit履歴を持ち、基盤はsourceの複製ではなくgitlinkの完全commit SHAを記録する。
- packageは`@rizakura-hontai/daymark`、`private: true`。基盤は`workspace:0.0.0`で参照し、npm公開・ログイン・scope取得を行わない。packageのversionではなくgitlinkが自作sourceの版を固定する。
- root lockfileで組み合わせの第三者依存を固定し、Daymarkの独立lockfileで単体CIを再現する。Node/pnpm、完全version、7日gate、integrity・install scriptのルールを両方に維持する。registryの7日gateを無効化せず、自作sourceは既存workspace sourceと同じくGit review/testを通す。
- CIと新cloneはsubmoduleを初期化し、記録されたcommitを取得する。build中の`--remote`、moving branch、Git URLのpackage dependency指定、手動sourceコピーを使わない。
- Daymark単体gateと基盤統合gateを実施し、Daymarkを先にcommit/pushしてから基盤の参照commitをcommit/pushする。どちらのpushも本番を自動更新しない。
- Phase 20は非機密のbrowser/server/contracts/schema接続stubだけ。習慣機能・UI・業務schema・migration・PWAは先行実装しない。Cloudflare構成は変更しない。

## 影響

npm公開・認証管理がなくなる代わりに、Daymark変更時には基盤の参照commit更新が必要になる。取り込み後の統合testで互換性を確認する。ローカル作業・cache・Git metadataは既存workspace配下だけに置く。

## 参考

- [Git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- [pnpm workspace protocol](https://pnpm.io/workspaces#workspace-protocol-workspace)
- [actions/checkout submodules](https://github.com/actions/checkout)
