import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { ArticlesPage } from "./pages/ArticlesPage";
import { SettingsPage } from "./pages/SettingsPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/articles" replace />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/articles" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
