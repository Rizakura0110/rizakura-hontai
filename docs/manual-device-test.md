# Manual device test

最終更新: 2026-09-23

## 現在の状態

| 対象 | 状態 | 備考 |
|---|---|---|
| Playwright desktop Chrome 1280 × 800 | 成功 | 自動E2E 9シナリオ |
| Playwright mobile Chrome 320 × 700 | 成功 | 自動E2E 9シナリオ。実機確認の代替ではない |
| iPhone Google Chrome | 成功 | 2026-08-27の実機共通チェックと、2026-08-28のタグ機能再確認に成功 |
| iPhone Safari PWA | 成功 | 2026-08-31に所有者から本番でのPWA確認完了報告。範囲はPhase 17の結果を参照 |
| Daymark desktop/mobile Chrome | 成功 | 2026-09-01に日・週・月・習慣管理・backupのlocal自動E2E。実機確認の代替ではない |
| Daymark iPhone Safari PWA | 成功 | 2026-09-02に入口、独立PWA、日・週・月への記録反映を本番確認 |
| Tech Inbox既読活動 PC browser | 成功 | 2026-09-14に所有者が既読/未読/再既読、日付選択、全記事/設定/Daymarkへの移動を確認 |
| Tech Inbox既読活動 iPhone Safari PWA | スキップ | 2026-09-14の所有者判断で後日確認へ延期。過去のPWA成功や自動mobile E2Eで代替しない |
| Android Google Chrome | スキップ | 所有者判断でPhase 9では実施しない。成功扱いにはしない |
| Phase 31 新origin PC browser | 成功 | 2026-09-22に本人login、記事/タグ/活動・Daymark日週月表示、両製品の保存と再読み込み反映を所有者確認 |
| Phase 31 新origin iPhone Safari / 2 PWA | 成功 | 2026-09-23に所有者が両PWAの再追加・新アイコン起動・login・表示・保存・閉じて再起動を確認。旧originの過去成功とは区別 |
| Phase 34 分離構成 PC / iPhone両PWA | 成功 | 2026-09-23に所有者がPCの両製品表示・保存とiPhone両PWAを確認。記事metadata取得とJSON書き出しも成功 |

実機を操作していない状態を「確認済み」と記録しない。OS、Chrome、端末、向き、実施者、日時を結果に残す。個人情報や秘密値をスクリーンショット、issue、commitへ含めない。

## Phase 31: 新originへの移行確認

2026-09-22にWorker/Accessを改名し、新originで保存とQueue配送を再開した。同日、所有者から「PC表示・保存OK」を受領し、下記1〜2が成功。2026-09-23に「PWA確認できた」を受領し、依頼した3〜4の両PWA再追加・起動・login・表示・保存・再起動も成功として記録した。PCのOS・browser version・向き、iPhone機種・OS/Safari version・向き、強制logout後の再loginは個別報告がなく推測しない。5の旧アイコン整理は確認後の任意操作で、完了条件ではない。接続先は現行Wranglerの`APP_ORIGIN`を使用する。旧hostnameは404になり、新URLへ自動redirectしない。

1. PC browserで新しい入口へloginし、Tech Inboxの記事・タグ・活動と、Daymarkの日・週・月を表示する。
2. 元が未読の記事1件を「既読→未読」に戻し、Daymarkで今日の実際の記録を1件保存する。再読み込み後も結果が残ることを確認する。
3. iPhone Safariで新originの`/tech-inbox/`と`/daymark/`をそれぞれ開き、共有メニューから各製品をホーム画面へ追加し直す。入口そのものを製品PWAとして追加しない。
4. 新しい2つのアイコンから直接起動し、各製品のlogin・表示・保存・閉じて再起動を確認する。再loginが必要な場合も元の製品へ戻れることを確認する。
5. 新しいPWAが動くことを確認してから、旧originのアイコンとbookmarkを整理する。旧アイコンを先に削除したことだけを移行成功とは扱わない。

Android実機は従来の所有者判断でskipを維持する。PC・iPhoneそれぞれの報告を区別して記録する。

## Phase 34: 分離構成反映後の確認

2026-09-23に既存originへ分離構成を反映した。アプリversionは`bb0edad9-9f86-4b07-bb05-a504c3429bd8`、記事metadata-fetcherは`0e36a07b-f5d1-40f6-b847-39a1ff4b4ef2`。同じoriginとPWA identityを維持するため、既存の2アイコンを起動して確認する。所有者からPCの表示・保存とiPhone両PWAの成功報告を受領した。端末/OS/browser versionと操作時刻は未提供。

1. PCで現行originへloginし、Tech Inboxの記事・タグ・活動・設定、Daymarkの日・週・月・設定を再読み込みして表示する。
2. 元が未読の記事1件だけを既読にしてから未読へ戻し、Daymarkで今日の実際の記録を保存する。再読み込み後も結果が残ることを確認する。既存の既読記事は検査用に未読へ戻さない。
3. iPhone Safariの既存Tech Inbox/Daymark PWAアイコンから各画面を直接開き、記事と日・週・月の表示を確認する。再追加は画面が壊れた場合だけ検討する。

上記1〜3は、所有者の「PC表示・保存／iPhone両PWAともOK」の報告をもって成功として記録した。続いて所有者から「メタデータ取得・JSON書き出しともOK」を受領し、Tech Inboxの新規URL保存後のtitle取得または既存失敗記事の再取得、設定からの記事JSON書き出しが成功したと記録した。どちらのmetadata経路を使用したか、端末・時刻の詳細は未提供。JSON復元は依頼も実行もしていない。Android実機は従来の所有者判断でskipを維持する。

Phase 19〜24の入口・URL整理・DaymarkはPhase 25でproductionへ反映済みです。Phase 25当時のiPhone成功を、その後のPhase 31/34移行確認と混同しません。Daymark JSONの書き出しと復元previewは本番ブラウザで確認済みです。3年fixtureはpreviewだけを行い、確定復元しません。

## Phase 25: iPhone Safariで行う最終確認

同じAccess loginを使い、次の最小範囲を確認する。Android実機は所有者判断でスキップする。

| # | 操作 | 期待結果 | 結果 |
|---:|---|---|---|
| 1 | Safariでproductionの入口を開く | rizakura-hontai入口が表示され、Tech InboxとDaymarkの両方へ移動できる | 成功 |
| 2 | 既存のTech Inboxホーム画面アイコンを開く | URL barのないTech Inbox画面が開き、既存記事を表示できる | 成功 |
| 3 | 期待と違う画面が開く場合だけ、SafariのTech Inbox画面からホーム画面へ追加し直す | 新しいアイコンからTech Inboxへ直接起動できる | 再追加不要 |
| 4 | SafariでDaymarkを開き、共有メニューから「ホーム画面に追加」する | Tech Inboxとは別のDaymarkアイコンが追加される | 成功 |
| 5 | Daymarkアイコンから起動する | URL barのないDaymark画面が直接開き、日・週・月・習慣管理へ移動できる | 成功 |
| 6 | 実際に使う習慣、または後で削除できる確認用習慣を1件作り、今日の記録を保存する | 日画面へ反映され、週・月画面でも当日の状態を確認できる | 成功 |

確認結果は端末・OS versionを提供できる範囲で記録し、確認用データを作った場合は不要になった時点で削除する。

### Phase 25実施結果

- 報告受領日: 2026-09-02（JST。実際の操作時刻は未提供）
- 実施者: repository owner
- 対象: iPhone Safari。機種、OS・Safari version、画面の向きは未記録
- 接続環境: production、Cloudflare Access保護済みURL
- 結果: pass。所有者から上記6項目がすべて正常との報告を受領した
- Android: 所有者判断によりskip。自動mobile E2Eを実機passとは扱わない

## Phase 28: Tech Inbox既読活動の本番確認（PC成功・iPhoneスキップ）

app Worker反映後の確認範囲は以下のとおり。PCの主要操作は所有者の成功報告を受領した。iPhone SafariのTech Inbox PWAは所有者判断で今回はスキップし、後日確認する。自動mobile E2Eの成功を実機確認へ置き換えない。Androidは所有者の既存skip方針を維持する。

| # | 操作 | 期待結果 | PC | iPhone |
|---:|---|---|---|---|
| 1 | Tech Inboxから「活動」を開き、直接URLでも再読み込みする | 草・要約が表示され、記事専用PWA内に留まる | 表示成功。直接URL reloadの個別報告なし | スキップ |
| 2 | 未読の記事1件を既読にし、活動へ移動する | 日本時間の今日の草、全期間と今月の件数が1件増える | 成功 | スキップ |
| 3 | 同じ記事を未読へ戻し、活動へ移動する | 元の日の草と件数が減る | 成功 | スキップ |
| 4 | 同じ記事を再び既読にし、活動へ移動する | 新しい既読日の件数へ1件加算され、重複しない | 成功 | スキップ |
| 5 | 日付入力・草の選択、PCでは矢印キーも使用する | 選んだ日付と件数を確認でき、iPhoneでは草の部分だけ横scrollできる | 日付選択成功。矢印キーの個別報告なし | スキップ |
| 6 | 全記事、設定、入口からDaymarkへ戻る | 既存の記事・タグ・設定・Daymarkを表示できる | 成功 | スキップ |

確認は所有者が選んだ記事だけで行い、元が未読なら終了時に未読へ戻す。既存の既読記事を未読化すると元の`read_at`を失うため、確認用には使わない。記事作成・削除は必須ではない。実施日時と実施者、提供可能な端末/OS情報、deployment versionを結果へ記録する。

### Phase 28の確認記録

- 報告受領日: 2026-09-14（JST。実際の操作時刻は未提供）
- 実施者: repository owner
- 接続環境: production、Cloudflare Access保護済みURL
- deployment version: `42d201d4-a175-4800-9035-bcdc35132d62`
- 表示: 所有者のbrowserから草と件数の「表示OK」を受領。この報告時点では端末・OS・browser未提供だった
- 再取得: 所有者へ画面の「更新」を読み込み完了ごとに3回押すよう依頼し、「更新OK」を受領。表示更新の成功報告であり、CPU gateの通過とは区別する
- CPU観測: 更新後の最後3 app Worker requestsはP99 7.621 ms以下・`success`・errors 0。GraphQLの集計を使い、端末別操作checkの代替にはしない
- PC操作: 所有者から「PCのブラウザで確認した。問題はなかった」と受領。直前に依頼した既読で+1、未読で-1、再既読で重複なく+1、日付選択・全記事/設定/Daymarkへの移動を成功として記録。OS・browser名/version・向き・実際の操作時刻は未提供
- iPhone: 所有者が後日確認するため今回はスキップとする指示を受領。表示、既読/未読/再既読、日付選択・横scroll、既存機能への往復を成功扱いにはしない
- 確認範囲の補足: PCの直接URL reloadと矢印キーの個別報告は未提供であり、実施済みと推測しない。これらの動作はdesktop/mobile自動E2Eで検証済みだが、実機成功とは区別する
- Android: 所有者の既存skip方針を維持し、成功扱いにはしない

## 既存機能の実施前提

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
