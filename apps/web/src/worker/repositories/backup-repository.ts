import type { ArticleExportSnapshot } from "./article-repository";
import type { BackupImportPlan } from "../backup-import";

export interface BackupRepository {
  loadSnapshot(): Promise<ArticleExportSnapshot>;
  apply(plan: BackupImportPlan): Promise<void>;
}
