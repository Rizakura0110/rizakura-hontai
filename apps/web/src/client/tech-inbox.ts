import type { TechInboxClient, TechInboxUi } from "@rizakura-hontai/tech-inbox/browser";
import { getArticleActivity } from "./api/activity";
import {
  createArticle,
  deleteArticle,
  exportArticles,
  listArticles,
  retryArticleMetadata,
  updateArticle,
} from "./api/articles";
import { applyBackupImport, previewBackupImport } from "./api/backup";
import { createTag, deleteTag, listTags, replaceArticleTags, updateTag } from "./api/tags";
import { userFacingError } from "./platform/http";
import { Modal } from "./platform/Modal";
import { ProductLayout } from "./platform/ProductLayout";
import { Toast } from "./platform/Toast";

export const techInboxClient: TechInboxClient = {
  getArticleActivity,
  createArticle,
  deleteArticle,
  exportArticles,
  listArticles,
  retryArticleMetadata,
  updateArticle,
  applyBackupImport,
  previewBackupImport,
  createTag,
  deleteTag,
  listTags,
  replaceArticleTags,
  updateTag,
  userFacingError,
};

export const techInboxUi: TechInboxUi = { Modal, ProductLayout, Toast };
