# Manual device test

最終更新: 2026-09-01

## 現在の状態

| 対象 | 状態 | 備考 |
|---|---|---|
| Playwright desktop Chrome 1280 × 800 | 成功 | 自動E2E 9シナリオ |
| Playwright mobile Chrome 320 × 700 | 成功 | 自動E2E 9シナリオ。実機確認の代替ではない |
| iPhone Google Chrome | 成功 | 2026-08-27の実機共通チェックと、2026-08-28のタグ機能再確認に成功 |
| iPhone Safari PWA | 成功 | 2026-08-31に所有者から本番でのPWA確認完了報告。範囲はPhase 17の結果を参照 |
| Daymark desktop/mobile Chrome | 成功 | 2026-09-01にlocal自動E2E。実機確認の代替ではない |
| Daymark iPhone Safari PWA | 未実施 | Phase 22は未デプロイ。Phase 25の本番反映後に確認する |
| Android Google Chrome | スキップ | 所有者判断でPhase 9では実施しない。成功扱いにはしない |

実機を操作していない状態を「確認済み」と記録しない。OS、Chrome、端末、向き、実施者、日時を結果に残す。個人情報や秘密値をスクリーンショット、issue、commitへ含めない。

Phase 19〜22の入口・URL整理・Daymarkはまだproduction未反映です。上記の既存iPhone成功を新構成の移行成功とは扱いません。反映後は入口と両製品の往復、既存PWAが旧`/articles`から新`/tech-inbox/`へ起動できること、Daymarkを別PWAとして追加・直接起動できることを確認します。metadataが更新されない場合だけ追加し直しを検討します。

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
| 2 | 許可されたemailでloginする | 全記事一覧を表示でき、`/`も`/articles`へ移動する | 未実施 |
| 3 | URL入力をfocusしてkeyboardを表示する | 入力欄、保存操作、本文が横にはみ出さず操作できる | 未実施 |
| 4 | 技術記事URLを貼り付け、既存タグとその場で作成したタグを選んで保存する | 保存通知とタグチップ、pending表示が出て、最終的にreadyまたは安全なfailed表示になる | 未実施 |
| 5 | 追加・編集・削除dialogを開閉する | focusがdialog内へ移り、閉じた後は開始位置へ戻る | 未実施 |
| 6 | 記事を既読化し、undoする | 全記事一覧の状態表示が変わり、undoで未読へ戻る | 未実施 |
| 7 | すべて一覧で既読を未読へ戻す | 未読状態へ変わり、filter結果も更新される | 未実施 |
| 8 | タイトルまたはURLで検索する | 一致する記事だけが表示され、検索解除で戻る | 未実施 |
| 9 | 元記事を開く | 新しいタブで開き、Tech Inbox側の状態を失わない | 未実施 |
| 10 | 設定画面からJSONを書き出す | 日付入り`.json`をdownloadでき、記事、URL alias、タグ、タグ付けだけが含まれる | 未実施 |
| 11 | 縦向きで主要画面を操作する | 横overflowや操作不能なcontrolがない | 未実施 |
| 12 | 横向きで主要画面を操作する | 可能な端末では横overflowやdialog切れがない | 未実施 |
| 13 | logoutまたはAccess session無効化後にAPIへアクセスする | private data APIが401または403で拒否される | 未実施 |
| 14 | 設定画面でタグを追加し、名前変更後に削除する | タグごとに異なる色で追加され、名前変更しても色が維持され、削除しても記事は残る | 未実施 |

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

## Phase 9実施結果

### iPhone Google Chrome

- 実施日時（UTC）: 2026-08-27T14:39:34Z
- 実施者: repository owner
- 端末: iPhone（機種名未提供）
- OS: iOS 26.0.1（Workers Logsのuser agentで確認）
- Chrome: 143.0.7499.151（Workers Logsのuser agentで確認）
- 接続環境: production、Cloudflare Access保護済みURL
- 向き: 縦・横
- 結果: pass
- 失敗したcheck番号: なし
- 備考: 所有者から「iPhone全部OK」と報告され、当時のcheck 1〜13を完了した。Access login、keyboard中layout、追加・編集・削除dialog、記事保存、検索、既読化とundo、元記事の新規tab、JSON download、縦横layout、未認証時のAccess遮断を確認した。監視したapp Worker requestはすべて`outcome: ok`、例外なし。cold requestは17 ms、その後は2〜7 msだった。実機テスト用記事がremote D1に0件であることを終了後に確認した。check 14とタグ付き保存は後から追加されたため、この実機passには含めない。

### Android Google Chrome

- 実施日時（UTC）: 未実施
- 実施者: 未実施
- 端末・OS・Chrome: 未記録
- 結果: skipped by owner
- 備考: repository ownerの明示判断によりPhase 9ではスキップした。Playwrightの320 × 700 mobile Chrome 6シナリオは成功しているが、Android実機成功の代替とは記録しない。

### 2026-08-28 UI更新後の再確認

- 対象deployment: `e1c03d86-0314-42c2-9676-4109e0c8c2c1`
- local desktop/mobile E2E: pass（合計12 tests）
- 未認証root/APIのAccess redirect: pass
- Access applicationとowner email完全一致policy: pass
- 認証済みowner browser表示: pass。ownerが`/`から全記事画面を表示でき、ナビゲーションが「すべて」「設定」だけであることを確認した。確認端末は未記録のため、iPhone実機でUI更新版を再実施したとは記録しない。

### 2026-08-28 タグ機能更新後の再確認

- 対象deployment: `ce9014c2-9cd4-4a73-b59c-2fceb1a4a30f`
- local desktop/mobile E2E: pass（合計18 tests。タグ作成、付与、絞り込み、名前変更、削除、URL保存時のタグ付けを含む）
- 未認証root/APIのAccess redirect: pass
- 認証済みowner browser表示: pass。設定画面の「新しいタグ名」と「追加」フォームが表示されることを確認した
- iPhone Chromeでのタグ機能再確認: pass。2026-08-28T13:58:51Zにrepository ownerから、タグの追加・URL保存時の付与・絞り込み・名前変更・削除後の記事保持を確認できたと報告された
- JSON backup: pass。repository ownerが設定画面からJSONを書き出し、privateな保存先へ保存できたことを確認した。保存先と内容はrepositoryへ記録しない
- Android Chrome実機: owner判断により引き続きスキップ。自動mobile E2Eを実機passとは扱わない

## Phase 17: iPhone Safari PWA実機確認

- 報告受領日: 2026-08-31（JST。実際の操作日時は未提供）
- 実施者: repository owner
- 対象: 案内したiPhone SafariでのPWA確認。機種、OS・Safari version、画面の向きは未記録
- 接続環境: production、Cloudflare Access保護済みURL
- 対象deployment: `991d4212-61d0-4543-b4b2-fa4e1c7f782d`
- 案内した確認範囲: Safariからホーム画面へ追加し、青い`TI`アイコンから起動してURL barのないstandalone表示、全記事画面、記事・タグの表示を確認する
- 結果: pass。所有者からSafariでPWAを確認できたとの完了報告を受領した。個別の操作ログは取得していない
- 確認範囲外: Access session期限切れ後の再ログイン、Safariでの全CRUD操作、Android実機。Service Worker・offline cacheは実装していないため、offline動作を保証しない
