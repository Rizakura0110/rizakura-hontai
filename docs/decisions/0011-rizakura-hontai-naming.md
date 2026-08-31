# ADR-0011: 基盤名をrizakura-hontaiへ変更する

- Status: Accepted
- Date: 2026-08-31
- Scope: Phase 20の命名移行。Daymark機能・npm公開・production反映は含まない

## Context

GitHubで旧webclipの改名先を確認したところ、Rizakura0110/rizakura-meは2025年作成の別repositoryとして既に存在した。所有者は既存repositoryの改名・削除ではなく、新しい基盤名rizakura-hontaiを指定した。

## Decision

- 共通基盤・入口・内部workspaceはrizakura-hontaiとする。製品名Tech Inbox・Daymarkは維持する。
- GitHubのwebclipをrizakura-hontaiへ改名する。repository ID、履歴、main branch、public設定を維持し、local remoteだけを新URLへ揃える。既存rizakura-meは変更しない。
- 新しいHTTP client headerはX-Rizakura-Hontai-Clientとする。旧X-Rizakura-Me-Client・X-Tech-Inbox-Clientも互換入力として受け入れるが、不正値が一つでもあれば拒否する。新clientは従来どおりTech Inbox headerも送り、server rollbackを可能にする。
- 現行の設計書・roadmapを新名称へ移し、参照を更新する。過去の進捗・ADRの当時の名称は保持する。
- 作業directory、Cloudflare Worker・D1・Access設定・本番URLは変更しない。それらの移行は本番影響の確認と別の明示承認を要する。
- 内部workspace名はprivateなローカル名で、npm scopeの所有や公開権限を意味しない。Daymarkのpublic repository・npm public配布は承認済みだが、ログイン・namespace確認と公開・7日gate通過はPhase 20の残作業とする。

## Verification

表示名・package参照・新旧headerのtest、全品質ゲートを実行する。第三者依存のversion・integrity、供給網policy、PWA identity、既存DB/API契約を変更しない。

- [現行設計](../rizakura-hontai-design.md)
- [フェーズ計画](../rizakura-hontai-roadmap.md)
