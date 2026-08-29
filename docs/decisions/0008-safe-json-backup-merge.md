# ADR-0008: JSON backupを既存データへ非破壊でマージする

- Status: Accepted
- Date: 2026-08-29

## Context

JSON exportは長期backupとして保存できるが、D1へ戻すアプリ内手段がなかった。全面置換は現在のデータを失う危険があり、preview時点から確定までにデータが変わる可能性もある。記事、URL alias、タグ、タグ付けにはID、URL、名前、色、件数のconstraintがあり、部分成功も避ける必要がある。

## Decision

- schema version 1と2を受け入れ、1 MiB、record件数、参照整合、URL正規化、一意性をserverで検証する。
- original URLが既存aliasと一致する記事、および正規化名が一致するタグは既存recordへ対応付ける。既存のfieldは更新しない。
- 新規recordのIDとタグ色は可能ならbackup値を保ち、既存値と衝突する場合だけ未使用値へ割り当て直す。
- 別の記事が所有する既存URL alias、タグcatalog 100件、1記事10タグを超える追加は既存値を変えずスキップし、previewと確定responseへ件数を返す。
- previewは書き込まず、確定時に最新snapshotから同じpure planを再計算する。新規記事、タグ、alias、関連はD1の単一batchで追加し、予期しないconstraint conflictでは全体を失敗させる。
- backup内でmetadata取得待ちの`pending`記事はQueueへ一括投入せず、URLを保持して`NETWORK_ERROR`の`failed`へ変換する。利用者が必要な記事だけ再取得する。
- responseとlogにはbackup本文、URL、titleを含めない。APIは既存のAccess再検証、Origin、client header、Rate Limitを通す。

## Consequences

- 現在のデータを削除・上書きせず、過去backupから不足分だけ復元できる。同じbackupの再実行は重複を作らない。
- URL conflictや上限超過は全面失敗ではなく明示的なskipになるため、利用者はpreviewと確定件数を確認する必要がある。
- previewと確定の間に別の変更がある場合、確定時の再計算結果が変わり得る。安全性を優先し、preview結果をそのままblind applyするtoken方式は採用しない。
- `pending`記事のmetadataは自動再開されないため、復元後に必要な記事を手動で再取得する操作が必要になる。
