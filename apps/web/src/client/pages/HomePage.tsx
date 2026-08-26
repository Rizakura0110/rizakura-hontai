import { useEffect, useState } from "react";

type ApiStatus = "checking" | "connected" | "unavailable";

function isHealthResponse(value: unknown): value is { status: "ok" } {
  return typeof value === "object" && value !== null && "status" in value && value.status === "ok";
}

export function HomePage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();

    async function checkApi() {
      try {
        const response = await fetch("/api/v1/health", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const body: unknown = await response.json();

        setApiStatus(response.ok && isHealthResponse(body) ? "connected" : "unavailable");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setApiStatus("unavailable");
        }
      }
    }

    void checkApi();

    return () => controller.abort();
  }, []);

  const apiStatusText: Record<ApiStatus, string> = {
    checking: "API接続を確認中…",
    connected: "API接続済み",
    unavailable: "APIに接続できません",
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12">
      <section
        aria-labelledby="page-title"
        className="w-full rounded-xl border bg-white p-6 shadow-sm"
      >
        <p className="text-sm font-medium text-blue-700">Phase 1</p>
        <h1 id="page-title" className="mt-2 text-2xl font-semibold text-slate-900">
          Tech Inbox
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          技術記事を保存し、未読・既読を整理するための受信箱です。
        </p>
        <p aria-live="polite" className="mt-4 text-sm text-slate-500">
          {apiStatusText[apiStatus]}
        </p>
      </section>
    </main>
  );
}
