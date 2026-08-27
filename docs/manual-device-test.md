# Manual device test

最終更新: 2026-08-27

## 現在の状態

| 対象 | 状態 | 備考 |
|---|---|---|
| Playwright desktop Chrome 1280 × 800 | 成功 | 自動E2E 6シナリオ |
| Playwright mobile Chrome 320 × 700 | 成功 | 自動E2E 6シナリオ。実機確認の代替ではない |
| iPhone Google Chrome | 未実施 | Phase 9でAccess保護済みURLを用意した後に実施する |
| Android Google Chrome | 未実施 | Phase 9でAccess保護済みURLを用意した後に実施する |

実機を操作していない状態を「確認済み」と記録しない。OS、Chrome、端末、向き、実施者、日時を結果に残す。個人情報や秘密値をスクリーンショット、issue、commitへ含めない。

## 実施前提

1. Phase 9のデプロイとCloudflare Access設定が完了している。
2. 対象URLの全トラフィックが所有者のemail 1件だけを許可するAccess policyで保護されている。
3. metadata-fetcherに公開route、`workers.dev`、preview URLがない。
4. 本番smoke test用の記事URLを準備し、終了後にテスト記事を削除できる。
5. Chromeのdownload権限と新しいタブの動作を確認できる。

## 共通チェックリスト

次の表をiPhone ChromeとAndroid Chromeでそれぞれ実施する。

| # | 操作 | 期待結果 | 結果 |
|---:|---|---|---|
| 1 | 未認証状態でURLを開く | Cloudflare Access loginへ移動し、アプリやAPIデータを表示しない | 未実施 |
| 2 | 許可されたemailでloginする | 未読一覧を表示できる | 未実施 |
| 3 | URL入力をfocusしてkeyboardを表示する | 入力欄、保存操作、本文が横にはみ出さず操作できる | 未実施 |
| 4 | 技術記事URLを貼り付けて保存する | 保存通知とpending表示が出て、最終的にreadyまたは安全なfailed表示になる | 未実施 |
| 5 | 追加・編集・削除dialogを開閉する | focusがdialog内へ移り、閉じた後は開始位置へ戻る | 未実施 |
| 6 | 記事を既読化し、undoする | 未読一覧から消え、undoで復元される | 未実施 |
| 7 | すべて一覧で既読を未読へ戻す | 未読状態へ変わり、filter結果も更新される | 未実施 |
| 8 | タイトルまたはURLで検索する | 一致する記事だけが表示され、検索解除で戻る | 未実施 |
| 9 | 元記事を開く | 新しいタブで開き、Tech Inbox側の状態を失わない | 未実施 |
| 10 | 設定画面からJSONを書き出す | 日付入り`.json`をdownloadでき、記事とURL aliasだけが含まれる | 未実施 |
| 11 | 縦向きで主要画面を操作する | 横overflowや操作不能なcontrolがない | 未実施 |
| 12 | 横向きで主要画面を操作する | 可能な端末では横overflowやdialog切れがない | 未実施 |
| 13 | logoutまたはAccess session無効化後にAPIへアクセスする | private data APIが401または403で拒否される | 未実施 |

## 結果記録テンプレート

```text
対象: iPhone Chrome / Android Chrome
実施日時（UTC）:
実施者:
端末:
OS version:
Chrome version:
接続環境:
向き: 縦 / 横
結果: pass / fail / blocked
失敗したcheck番号:
再現手順:
秘密情報を含まない証跡の保存先:
備考:
```

failまたはblockedがあればPhase 9完了扱いにせず、再現条件と影響範囲を記録して修正後に再実施する。
