# ADR-0013: Daymarkの日次記録と履歴モデル

日付: 2026-09-01
状態: accepted（所有者との機能・PC画面設計で合意）

## 背景

Daymarkは、毎日の習慣を達成したか、数値目標をどの程度達成したかを記録する。Phase 20ではrepository境界だけを準備し、入力、日付、未入力、目標変更、集計の意味は所有者との設計まで確定しなかった。Phase 21で日・週・月のPC画面案を確認し、画面が必要とするデータモデルを決めた。

## 決定

- 初期版の記録粒度は1日。習慣はチェック式または数値式とし、作成後に種類を変更しない。
- 数値は0〜10億、小数3桁までとし、DBには1000倍した整数を保存する。数値習慣は単位と`at_least`/`at_most`の比較条件を持つ。
- 日付境界は`Asia/Tokyo`。今日と過去の記録は作成・修正・削除でき、未来日は拒否する。
- 記録なしは`unentered`、チェック`false`や目標未達の数値は`incomplete`として区別する。達成率の分母は有効な習慣の`complete`、`incomplete`、`unentered`である。
- 習慣の状態は`active`、`paused`、`archived`。休止・アーカイブ中、作成前、未来日は`excluded`とし分母へ入れない。
- 目標、単位、比較条件、状態は適用開始日付きversionとして保存する。変更は今日以降だけに適用し、過去の評価を変更しない。
- 週は月曜〜日曜の7日を返す。習慣別の行は、その習慣が存在した週内の日だけを持つ。月は暦月の全日を返す。
- Daymark repositoryは契約、domain service、repository interface、Drizzle schemaを所有する。基盤repositoryはD1 adapter、認証済みHTTP、migration履歴を所有する。
- Phase 21はデータ・APIまでとし、合意した日・週・月画面と独立PWAはPhase 22、backupはPhase 23で実装する。

## データとAPI

- `daymark_habits`: ID、現在名、変更不能な種類、作成日、timestamp
- `daymark_habit_versions`: 習慣、適用開始日、状態、数値目標・単位・比較条件
- `daymark_records`: 習慣と日付ごとに1件のチェック値または数値
- `/api/v1/daymark/habits`: 一覧・作成
- `/api/v1/daymark/habits/:id`: 名称変更
- `/api/v1/daymark/habits/:id/configurations/:date`: 今日以降の設定をupsert
- `/api/v1/daymark/day?date=...`: 日次表示データ
- `/api/v1/daymark/habits/:id/records/:date`: 記録のupsert・削除
- `/api/v1/daymark/history/week?start=...`: 月曜始まりの週集計
- `/api/v1/daymark/history/month?month=...`: 月集計

すべて既存app Workerの共通認証・request validation・Rate Limit配下へ置く。習慣名や記録値をlogへ出さない。

## 影響

設定履歴によりtableは増えるが、過去の達成判定を現在目標で書き換えずに済む。日次限定のため週N回・曜日指定などは表現しない。必要になった場合は既存履歴の意味を維持した別仕様として設計する。画面実装前でもlocal D1と実HTTPで保存・競合・集計を検証できる一方、production migrationとdeployには別の承認が必要である。
