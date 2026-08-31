import { BrowserRouter, Route, Routes } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { ArticlesPage } from "./pages/ArticlesPage";
import { SettingsPage } from "./pages/SettingsPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/tech-inbox/" element={<ArticlesPage />} />
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
  );
}
