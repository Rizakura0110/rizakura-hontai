import type {
  BackupImportPreviewResponse,
  BackupImportRequest,
  BackupImportResponse,
} from "@rizakura-me/contracts";
import { buildBackupImportPlan } from "./backup-import";
import type { Clock, IdGenerator } from "./article-service";
import type { BackupRepository } from "./repositories/backup-repository";

export class BackupService {
  readonly #repository: BackupRepository;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(repository: BackupRepository, clock: Clock, idGenerator: IdGenerator) {
    this.#repository = repository;
    this.#clock = clock;
    this.#idGenerator = idGenerator;
  }

  async preview(request: BackupImportRequest): Promise<BackupImportPreviewResponse> {
    const current = await this.#repository.loadSnapshot();
    const plan = buildBackupImportPlan(
      current,
      request.backup,
      this.#clock().toISOString(),
      this.#idGenerator,
    );
    return { result: "preview", summary: plan.summary };
  }

  async apply(request: BackupImportRequest): Promise<BackupImportResponse> {
    const current = await this.#repository.loadSnapshot();
    const plan = buildBackupImportPlan(
      current,
      request.backup,
      this.#clock().toISOString(),
      this.#idGenerator,
    );
    await this.#repository.apply(plan);
    return { result: "imported", summary: plan.summary };
  }
}
