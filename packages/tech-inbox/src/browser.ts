import type { ComponentType, ReactNode } from "react";
import type {
  ArticleActivityResponse,
  ArticleDto,
  ArticleListStatus,
  ArticleSort,
  BackupImportPreviewResponse,
  BackupImportResponse,
  BackupImportSnapshot,
  CreateArticleResponse,
  CreateTagResponse,
  ExportResponse,
  ListArticlesResponse,
  ListTagsResponse,
  TagDto,
} from "./contracts";

export type RequestOptions = { readonly signal?: AbortSignal };
export type ListArticleOptions = RequestOptions & {
  readonly status: ArticleListStatus;
  readonly query: string;
  readonly tagId?: string;
  readonly sort: ArticleSort;
  readonly limit?: number;
  readonly cursor?: string;
};

// The host owns transport, credentials, response validation and safe error messages.
export type TechInboxClient = {
  readonly listArticles: (options: ListArticleOptions) => Promise<ListArticlesResponse>;
  readonly createArticle: (
    url: string,
    options?: RequestOptions & { readonly tagIds?: readonly string[] },
  ) => Promise<CreateArticleResponse>;
  readonly updateArticle: (
    id: string,
    changes: {
      readonly title?: string;
      readonly url?: string;
      readonly status?: "unread" | "read";
    },
    options?: RequestOptions,
  ) => Promise<ArticleDto>;
  readonly deleteArticle: (id: string, options?: RequestOptions) => Promise<void>;
  readonly retryArticleMetadata: (id: string, options?: RequestOptions) => Promise<ArticleDto>;
  readonly getArticleActivity: (options?: RequestOptions) => Promise<ArticleActivityResponse>;
  readonly exportArticles: (options?: RequestOptions) => Promise<ExportResponse>;
  readonly previewBackupImport: (
    backup: BackupImportSnapshot,
    options?: RequestOptions,
  ) => Promise<BackupImportPreviewResponse>;
  readonly applyBackupImport: (
    backup: BackupImportSnapshot,
    options?: RequestOptions,
  ) => Promise<BackupImportResponse>;
  readonly listTags: (options?: RequestOptions) => Promise<ListTagsResponse>;
  readonly createTag: (name: string, options?: RequestOptions) => Promise<CreateTagResponse>;
  readonly updateTag: (id: string, name: string, options?: RequestOptions) => Promise<TagDto>;
  readonly deleteTag: (id: string, options?: RequestOptions) => Promise<void>;
  readonly replaceArticleTags: (
    articleId: string,
    tagIds: readonly string[],
    options?: RequestOptions,
  ) => Promise<TagDto[]>;
  readonly userFacingError: (error: unknown) => string;
};

export type ModalProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
};

export type ToastState = {
  readonly id: number;
  readonly message: string;
  readonly tone?: "success" | "error" | "info";
  readonly action?:
    | { readonly label: string; readonly onClick: () => void | Promise<void> }
    | { readonly label: string; readonly href: string };
};

export type ToastProps = { readonly toast: ToastState | null; readonly onDismiss: () => void };

export type ProductLayoutProps = {
  readonly children: ReactNode;
  readonly brand: ReactNode;
  readonly navigation: ReactNode;
  readonly mobileNavigation: ReactNode;
  readonly description: string;
};

export type TechInboxUi = {
  readonly Modal: ComponentType<ModalProps>;
  readonly Toast: ComponentType<ToastProps>;
  readonly ProductLayout: ComponentType<ProductLayoutProps>;
};

export type TechInboxRuntime = { readonly client: TechInboxClient; readonly ui: TechInboxUi };

export const techInboxProduct = {
  id: "tech-inbox",
  name: "Tech Inbox",
  basePath: "/tech-inbox/",
} as const;
