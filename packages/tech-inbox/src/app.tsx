import { BrowserRouter, Route, Routes } from "react-router";
import type { TechInboxRuntime } from "./browser";
import { AppLayout } from "./client/components/AppLayout";
import { ActivityPage } from "./client/pages/ActivityPage";
import { ArticlesPage } from "./client/pages/ArticlesPage";
import { SettingsPage } from "./client/pages/SettingsPage";
import { TechInboxProvider } from "./client/runtime";

export { AppLayout } from "./client/components/AppLayout";
export { ArticleCard } from "./client/components/ArticleCard";
export { ArticleComposer } from "./client/components/ArticleComposer";
export { DeleteArticleDialog, EditArticleDialog } from "./client/components/ArticleDialogs";
export { ActivityPage } from "./client/pages/ActivityPage";
export { ArticlesPage } from "./client/pages/ArticlesPage";
export { SettingsPage } from "./client/pages/SettingsPage";
export { TechInboxProvider } from "./client/runtime";

export function TechInboxApp({ client, ui }: TechInboxRuntime) {
  return (
    <TechInboxProvider client={client} ui={ui}>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/tech-inbox/" element={<ArticlesPage />} />
            <Route path="/tech-inbox/activity" element={<ActivityPage />} />
            <Route path="/tech-inbox/settings" element={<SettingsPage />} />
            <Route
              path="*"
              element={
                <div>
                  <h1 className="text-xl font-semibold">ページが見つかりません</h1>
                  <a className="mt-4 inline-block text-blue-700 underline" href="/tech-inbox/">
                    すべての記事へ戻る
                  </a>
                </div>
              }
            />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TechInboxProvider>
  );
}
