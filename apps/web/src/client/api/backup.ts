import {
  backupImportPreviewResponseSchema,
  backupImportResponseSchema,
  type BackupImportSnapshot,
} from "@tech-inbox/contracts";
import { apiFetch, assertSuccess } from "./http";

type RequestOptions = {
  readonly signal?: AbortSignal;
};

export async function previewBackupImport(
  backup: BackupImportSnapshot,
  options: RequestOptions = {},
) {
  const response = await apiFetch(
    "/api/v1/import/preview",
    { method: "POST", body: JSON.stringify({ backup }) },
    options.signal,
  );
  return backupImportPreviewResponseSchema.parse(await assertSuccess(response));
}

export async function applyBackupImport(
  backup: BackupImportSnapshot,
  options: RequestOptions = {},
) {
  const response = await apiFetch(
    "/api/v1/import",
    { method: "POST", body: JSON.stringify({ backup }) },
    options.signal,
  );
  return backupImportResponseSchema.parse(await assertSuccess(response));
}
