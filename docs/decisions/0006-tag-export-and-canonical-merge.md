# ADR-0006: タグを正規化形式でexportし、URL重複統合では残存記事を優先する

- Status: Accepted
- Date: 2026-08-28

## Context

タグ基盤とUIの追加後もJSON exportは記事とURL aliasだけを含むschema version 1のままであり、タグをバックアップできなかった。また、metadata取得でcanonical URLが既存記事を指した場合は2記事を1件へ統合するが、重複側の記事に付いたタグをそのまま削除すると利用者の分類を失う。

1記事へ設定できるタグは10件までである。両記事のタグの和集合が上限を超える場合は、どのタグを残すかを決定的にし、欠落を観測できる必要がある。

## Decision

- JSON exportをschema version 2へ上げ、従来の`articles`と`articleUrls`に加えて、タグcatalogの`tags`と正規化した関連の`articleTags`を出力する。
- clientのruntime schemaはversion 1とversion 2の両方を受け入れ、既存exportの読み取り互換性を維持する。新しいserver出力はversion 2だけとする。
- version 2では、URL aliasがexport対象記事を参照すること、タグ関連がexport対象の記事とタグを参照すること、関連が重複しないこと、1記事10件の上限を超えないことを検証する。
- canonical URL重複統合では、既存のcanonical URLを所有している記事を残存記事とする。残存記事にすでに付いているタグをすべて優先する。
- 重複側だけに付いているタグは、関連の作成日時、タグIDの順で残存記事の空き枠へ移す。和集合が10件を超える場合は、後順位の関連を移さない。
- 移せなかった関連数を`droppedTagCount`としてmetadata consumerの構造化logへ記録する。タグ定義自体は削除しない。

## Consequences

- version 2 exportから、記事、URL alias、タグ名・色相、記事へのタグ付けを再構成できる。
- exportの関連表現が正規化されるため、同じタグ情報を記事ごとに重複保存しない。
- canonical重複の解消で残存記事側の利用者判断を上書きせず、空きがある限り重複側の分類も保存する。
- 10件を超える関連は自動で残せないが、選択規則は決定的で、欠落数を運用logから確認できる。
- 将来importを追加する場合は、version 1ではタグなし、version 2では参照整合性検証済みの正規化データとして扱う。
