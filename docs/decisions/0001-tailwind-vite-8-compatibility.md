# ADR-0001: Tailwind CSS 4.3系を採用する

- Status: Accepted
- Date: 2026-08-26

## Context

実装ガイドはVite 8 StableとTailwind CSS 4.1系Stableを基準としている。しかし、4.1系の最終版`@tailwindcss/vite 4.1.18`が宣言するVite peer dependencyは`^5.2.0 || ^6 || ^7`であり、Vite 8を正式に許可していない。

Viteを7系へ下げると、ガイドが明示するVite 8の採用方針から外れる。peer dependencyを無視すると、サポートされていない組み合わせになり再現性も下がる。

## Decision

`tailwindcss`と`@tailwindcss/vite`を、公開後7日以上経過したStableの`4.3.3`へ揃える。`@tailwindcss/vite 4.3.3`はpeer dependencyでVite 8を正式に許可している。

## Consequences

- Vite 8、Cloudflare Vite plugin、Tailwind Vite pluginのpeer dependencyが整合する。
- Tailwindの採用minorはガイド記載の4.1から4.3へ変わる。
- Tailwind 4.3の公式仕様だけを使用し、experimental APIは使用しない。
