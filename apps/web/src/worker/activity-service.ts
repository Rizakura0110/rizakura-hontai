import {
  type ArticleActivityResponse,
  articleActivityResponseSchema,
} from "@rizakura-hontai/contracts";
import { createReadActivityWindow, summarizeReadActivity } from "@tech-inbox/core/activity";
import type { Clock } from "./article-service";
import type { ActivityRepository } from "./repositories/activity-repository";

export class ActivityService {
  readonly #repository: ActivityRepository;
  readonly #clock: Clock;

  constructor(repository: ActivityRepository, clock: Clock) {
    this.#repository = repository;
    this.#clock = clock;
  }

  async get(): Promise<ArticleActivityResponse> {
    const window = createReadActivityWindow(this.#clock());
    const snapshot = await this.#repository.loadReadActivity(window);
    return articleActivityResponseSchema.parse(summarizeReadActivity(window, snapshot));
  }
}
