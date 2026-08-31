import {
  type ArticleTagsResponse,
  type ArticleResponse,
  articleIdParamsSchema,
  type BackupImportPreviewResponse,
  backupImportRequestSchema,
  type BackupImportResponse,
  createArticleRequestSchema,
  createTagRequestSchema,
  type CreateArticleResponse,
  type CreateTagResponse,
  type DeleteArticleResponse,
  type DeleteTagResponse,
  type ExportResponse,
  listArticlesQuerySchema,
  type ListArticlesResponse,
  type ListTagsResponse,
  MAX_BACKUP_IMPORT_BYTES,
  retryMetadataRequestSchema,
  type RetryMetadataResponse,
  replaceArticleTagsRequestSchema,
  tagIdParamsSchema,
  type TagResponse,
  updateArticleRequestSchema,
  updateTagRequestSchema,
} from "@rizakura-me/contracts";
import { Hono, type Context } from "hono";
import type { AppBindings } from "./bindings";
import type { ApiEnvironment, ApiRoutePolicy } from "./platform/api";
import { ArticleService, type Clock, type IdGenerator } from "./article-service";
import { BackupService } from "./backup-service";
import { toArticleDto } from "./article-dto";
import { createMetadataQueueProducer, type MetadataQueueProducer } from "./metadata-queue";
import { parseQuery, parseWithSchema, readJsonBody } from "./platform/request-validation";
import { createD1ArticleRepository } from "./repositories/d1-article-repository";
import { createD1TagRepository } from "./repositories/d1-tag-repository";
import type { ArticleRepository } from "./repositories/article-repository";
import type { BackupRepository } from "./repositories/backup-repository";
import { createD1BackupRepository } from "./repositories/d1-backup-repository";
import type { TagRepository } from "./repositories/tag-repository";
import { TagService } from "./tag-service";

type AppEnvironment = ApiEnvironment<AppBindings>;

export type TechInboxDependencies = {
  readonly repositoryFactory: (bindings: AppBindings) => ArticleRepository;
  readonly tagRepositoryFactory: (bindings: AppBindings) => TagRepository;
  readonly backupRepositoryFactory: (bindings: AppBindings) => BackupRepository;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly metadataQueueFactory: (bindings: AppBindings) => MetadataQueueProducer;
};

function safeRouteName(method: string, pathname: string): string {
  if (method === "GET" && pathname === "/api/v1/export") return "export.get";
  if (method === "POST" && pathname === "/api/v1/import/preview") return "import.preview";
  if (method === "POST" && pathname === "/api/v1/import") return "import.apply";
  if (pathname === "/api/v1/articles") {
    if (method === "GET") return "articles.list";
    if (method === "POST") return "articles.create";
  }

  if (pathname === "/api/v1/tags") {
    if (method === "GET") return "tags.list";
    if (method === "POST") return "tags.create";
  }

  if (/^\/api\/v1\/tags\/[^/]+$/u.test(pathname)) {
    if (method === "PATCH") return "tags.update";
    if (method === "DELETE") return "tags.delete";
  }

  if (/^\/api\/v1\/articles\/[^/]+\/tags$/u.test(pathname)) {
    if (method === "GET") return "article_tags.list";
    if (method === "PUT") return "article_tags.replace";
  }

  if (/^\/api\/v1\/articles\/[^/]+$/u.test(pathname)) {
    if (method === "GET") return "articles.get";
    if (method === "PATCH") return "articles.update";
    if (method === "DELETE") return "articles.delete";
  }

  if (/^\/api\/v1\/articles\/[^/]+\/retry-metadata$/u.test(pathname) && method === "POST") {
    return "articles.retry_metadata";
  }

  return "api.not_found";
}

function categoryForRoute(routeName: string): ApiRoutePolicy["rateLimit"] | undefined {
  if (routeName === "articles.create") return "create";
  if (routeName === "articles.retry_metadata") return "retry";
  if (routeName === "articles.update" || routeName === "articles.delete") return "mutate";
  if (
    routeName === "tags.create" ||
    routeName === "tags.update" ||
    routeName === "tags.delete" ||
    routeName === "article_tags.replace" ||
    routeName === "import.apply"
  ) {
    return "mutate";
  }
  if (
    routeName === "articles.list" ||
    routeName === "articles.get" ||
    routeName === "tags.list" ||
    routeName === "article_tags.list"
  ) {
    return "read";
  }
  if (routeName === "export.get" || routeName === "import.preview") return "export";
  return undefined;
}

export function techInboxRoutePolicy(method: string, pathname: string): ApiRoutePolicy | undefined {
  const name = safeRouteName(method === "HEAD" ? "GET" : method, pathname);
  const rateLimit = categoryForRoute(name);
  return rateLimit === undefined ? undefined : { name, rateLimit };
}

function articleService(context: Context<AppEnvironment>, dependencies: TechInboxDependencies) {
  return new ArticleService(
    dependencies.repositoryFactory(context.env),
    dependencies.clock,
    dependencies.idGenerator,
    dependencies.metadataQueueFactory(context.env),
  );
}

function tagService(context: Context<AppEnvironment>, dependencies: TechInboxDependencies) {
  return new TagService(
    dependencies.tagRepositoryFactory(context.env),
    dependencies.clock,
    dependencies.idGenerator,
  );
}

function backupService(context: Context<AppEnvironment>, dependencies: TechInboxDependencies) {
  return new BackupService(
    dependencies.backupRepositoryFactory(context.env),
    dependencies.clock,
    dependencies.idGenerator,
  );
}

export const defaultTechInboxDependencies: TechInboxDependencies = {
  repositoryFactory: (bindings) => createD1ArticleRepository(bindings.DB),
  tagRepositoryFactory: (bindings) => createD1TagRepository(bindings.DB),
  backupRepositoryFactory: (bindings) => createD1BackupRepository(bindings.DB),
  clock: () => new Date(),
  idGenerator: () => crypto.randomUUID(),
  metadataQueueFactory: (bindings) => createMetadataQueueProducer(bindings.METADATA_QUEUE),
};

export function createTechInboxApi(dependencies: TechInboxDependencies) {
  const app = new Hono<AppEnvironment>();
  app.get("/v1/export", async (context) => {
    context.set("routeName", "export.get");
    const response = await articleService(context, dependencies).exportAll();
    const utcDate = response.exportedAt.slice(0, 10);
    context.header(
      "Content-Disposition",
      `attachment; filename="tech-inbox-export-${utcDate}.json"`,
    );
    return context.json<ExportResponse>(response);
  });

  app.post("/v1/import/preview", async (context) => {
    context.set("routeName", "import.preview");
    const request = parseWithSchema(
      backupImportRequestSchema,
      await readJsonBody(context.req.raw, MAX_BACKUP_IMPORT_BYTES),
    );
    return context.json<BackupImportPreviewResponse>(
      await backupService(context, dependencies).preview(request),
    );
  });

  app.post("/v1/import", async (context) => {
    context.set("routeName", "import.apply");
    const request = parseWithSchema(
      backupImportRequestSchema,
      await readJsonBody(context.req.raw, MAX_BACKUP_IMPORT_BYTES),
    );
    return context.json<BackupImportResponse>(
      await backupService(context, dependencies).apply(request),
    );
  });

  app.get("/v1/articles", async (context) => {
    context.set("routeName", "articles.list");
    const query = parseWithSchema(
      listArticlesQuerySchema,
      parseQuery(new URL(context.req.url).searchParams),
    );
    const response = await articleService(context, dependencies).list(query);
    return context.json<ListArticlesResponse>(response);
  });

  app.post("/v1/articles", async (context) => {
    context.set("routeName", "articles.create");
    const request = parseWithSchema(
      createArticleRequestSchema,
      await readJsonBody(context.req.raw),
    );
    const response = await articleService(context, dependencies).create(request);
    const status = response.result === "created" ? 201 : 200;
    return context.json<CreateArticleResponse>(response, status);
  });

  app.get("/v1/tags", async (context) => {
    context.set("routeName", "tags.list");
    return context.json<ListTagsResponse>(await tagService(context, dependencies).list());
  });

  app.post("/v1/tags", async (context) => {
    context.set("routeName", "tags.create");
    const request = parseWithSchema(createTagRequestSchema, await readJsonBody(context.req.raw));
    const response = await tagService(context, dependencies).create(request);
    const status = response.result === "created" ? 201 : 200;
    return context.json<CreateTagResponse>(response, status);
  });

  app.patch("/v1/tags/:id", async (context) => {
    context.set("routeName", "tags.update");
    const { id } = parseWithSchema(tagIdParamsSchema, context.req.param());
    const request = parseWithSchema(updateTagRequestSchema, await readJsonBody(context.req.raw));
    return context.json<TagResponse>(await tagService(context, dependencies).update(id, request));
  });

  app.delete("/v1/tags/:id", async (context) => {
    context.set("routeName", "tags.delete");
    const { id } = parseWithSchema(tagIdParamsSchema, context.req.param());
    await tagService(context, dependencies).delete(id);
    return context.json<DeleteTagResponse>({ result: "deleted" });
  });

  app.get("/v1/articles/:id", async (context) => {
    context.set("routeName", "articles.get");
    const { id } = parseWithSchema(articleIdParamsSchema, context.req.param());
    const article = await articleService(context, dependencies).get(id);
    return context.json<ArticleResponse>({ article: toArticleDto(article) });
  });

  app.get("/v1/articles/:id/tags", async (context) => {
    context.set("routeName", "article_tags.list");
    const { id } = parseWithSchema(articleIdParamsSchema, { id: context.req.param("id") });
    return context.json<ArticleTagsResponse>(
      await tagService(context, dependencies).listForArticle(id),
    );
  });

  app.put("/v1/articles/:id/tags", async (context) => {
    context.set("routeName", "article_tags.replace");
    const { id } = parseWithSchema(articleIdParamsSchema, { id: context.req.param("id") });
    const request = parseWithSchema(
      replaceArticleTagsRequestSchema,
      await readJsonBody(context.req.raw),
    );
    return context.json<ArticleTagsResponse>(
      await tagService(context, dependencies).replaceArticleTags(id, request),
    );
  });

  app.patch("/v1/articles/:id", async (context) => {
    context.set("routeName", "articles.update");
    const { id } = parseWithSchema(articleIdParamsSchema, context.req.param());
    const request = parseWithSchema(
      updateArticleRequestSchema,
      await readJsonBody(context.req.raw),
    );
    const article = await articleService(context, dependencies).update(id, request);
    return context.json<ArticleResponse>({ article: toArticleDto(article) });
  });

  app.delete("/v1/articles/:id", async (context) => {
    context.set("routeName", "articles.delete");
    const { id } = parseWithSchema(articleIdParamsSchema, context.req.param());
    await articleService(context, dependencies).delete(id);
    return context.json<DeleteArticleResponse>({ result: "deleted" });
  });

  app.post("/v1/articles/:id/retry-metadata", async (context) => {
    context.set("routeName", "articles.retry_metadata");
    const { id } = parseWithSchema(articleIdParamsSchema, { id: context.req.param("id") });
    parseWithSchema(retryMetadataRequestSchema, await readJsonBody(context.req.raw));
    const article = await articleService(context, dependencies).retryMetadata(id);
    return context.json<RetryMetadataResponse>({ article: toArticleDto(article) });
  });

  return app;
}
