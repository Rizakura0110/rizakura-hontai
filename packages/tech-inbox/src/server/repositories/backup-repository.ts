import type { BackupImportPlan } from "../backup-import";
import type { ArticleExportSnapshot } from "./article-repository";

export interface BackupRepository {
  loadSnapshot(): Promise<ArticleExportSnapshot>;
  apply(plan: BackupImportPlan): Promise<void>;
}
