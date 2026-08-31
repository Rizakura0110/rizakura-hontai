import {
  backupImportSnapshotSchema,
  type BackupImportSnapshot,
  type BackupImportSummary,
  MAX_BACKUP_IMPORT_FILE_BYTES,
} from "@rizakura-hontai/contracts";
import { type ChangeEvent, useState } from "react";
import { applyBackupImport, previewBackupImport } from "../api/backup";
import { userFacingError } from "../platform/http";

type BackupImporterProps = {
  readonly onImported: () => void;
};

const countRows: readonly [keyof BackupImportSummary["changes"], string][] = [
  ["articlesCreated", "追加する記事"],
  ["articlesMatched", "既存と一致した記事"],
  ["articleIdsRemapped", "割り当て直す記事ID"],
  ["articleUrlsCreated", "追加するURL alias"],
  ["articleUrlsMatched", "既存と一致したURL alias"],
  ["articleUrlsSkipped", "競合でスキップするURL alias"],
  ["tagsCreated", "追加するタグ"],
  ["tagsMatched", "既存と一致したタグ"],
  ["tagsSkipped", "上限でスキップするタグ"],
  ["tagIdsRemapped", "割り当て直すタグID"],
  ["tagColorsReassigned", "割り当て直すタグ色"],
  ["articleTagsCreated", "追加するタグ付け"],
  ["articleTagsMatched", "既存と一致したタグ付け"],
  ["articleTagsSkipped", "競合・上限でスキップするタグ付け"],
  ["pendingArticlesReset", "再取得可能な失敗状態へ戻す記事"],
];

export function BackupImporter({ onImported }: BackupImporterProps) {
  const [backup, setBackup] = useState<BackupImportSnapshot | null>(null);
  const [fileName, setFileName] = useState("");
  const [summary, setSummary] = useState<BackupImportSummary | null>(null);
  const [applied, setApplied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setBackup(null);
    setFileName(file?.name ?? "");
    setSummary(null);
    setApplied(false);
    setConfirmed(false);
    setError("");
    setSuccess("");
    if (file === undefined) return;
    if (file.size > MAX_BACKUP_IMPORT_FILE_BYTES) {
      setError("バックアップファイルは1MB以下にしてください。");
      return;
    }

    try {
      const parsed: unknown = JSON.parse(await file.text());
      const validated = backupImportSnapshotSchema.safeParse(parsed);
      if (!validated.success) {
        setError("Tech Inboxから書き出した有効なJSONバックアップを選択してください。");
        return;
      }
      setBackup(validated.data);
    } catch {
      setError("JSONファイルを読み込めませんでした。");
    }
  }

  async function preview() {
    if (backup === null) return;
    setBusy("preview");
    setError("");
    setSuccess("");
    setSummary(null);
    setApplied(false);
    setConfirmed(false);
    try {
      const response = await previewBackupImport(backup);
      setSummary(response.summary);
    } catch (caught) {
      setError(userFacingError(caught));
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (backup === null || summary === null || !confirmed) return;
    setBusy("apply");
    setError("");
    setSuccess("");
    try {
      const response = await applyBackupImport(backup);
      setSummary(response.summary);
      setApplied(true);
      setConfirmed(false);
      setSuccess(
        response.summary.hasChanges
          ? "バックアップを安全に復元しました。"
          : "すべて既存データと一致していたため、変更はありませんでした。",
      );
      onImported();
    } catch (caught) {
      setError(userFacingError(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">JSONバックアップから復元</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        既存データは上書きせず、新しい記事・URL alias・タグ・タグ付けだけを追加します。
      </p>

      <label className="mt-5 block text-sm font-semibold text-slate-800" htmlFor="backup-file">
        バックアップファイル（1MB以下）
      </label>
      <input
        accept="application/json,.json"
        className="mt-2 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold file:text-slate-800"
        disabled={busy !== null}
        id="backup-file"
        onChange={(event) => void chooseFile(event)}
        type="file"
      />
      {backup !== null ? <p className="mt-2 text-xs text-slate-600">選択済み: {fileName}</p> : null}

      <button
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-blue-700 bg-white px-5 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={backup === null || busy !== null}
        onClick={() => void preview()}
        type="button"
      >
        {busy === "preview" ? "確認しています…" : "復元内容を確認"}
      </button>

      {error !== "" ? (
        <p
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {success !== "" ? (
        <p
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {success}
        </p>
      ) : null}

      {summary !== null ? (
        <div className="mt-5 rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            {applied ? "復元結果" : "復元プレビュー"}
          </h3>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            schema v{summary.source.schemaVersion}・{summary.source.articles}記事・
            {summary.source.tags}タグのバックアップです。
          </p>
          <dl className="mt-3 divide-y divide-slate-100 text-sm">
            {countRows.map(([key, label]) => (
              <div className="flex items-center justify-between gap-4 py-2" key={key}>
                <dt className="text-slate-600">{label}</dt>
                <dd className="font-semibold tabular-nums text-slate-900">
                  {summary.changes[key]}件
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            読み込み待ちだった記事は、復元後に記事カードから情報取得を再試行できます。
          </p>
          {!applied ? (
            <>
              <label className="mt-4 flex min-h-11 items-start gap-3 text-sm leading-6 text-slate-700">
                <input
                  checked={confirmed}
                  className="mt-1 h-5 w-5 rounded border-slate-300"
                  disabled={busy !== null}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  type="checkbox"
                />
                既存データを上書きしないマージ内容を確認しました
              </label>
              <button
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!confirmed || busy !== null}
                onClick={() => void apply()}
                type="button"
              >
                {busy === "apply" ? "復元しています…" : "安全に復元する"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
