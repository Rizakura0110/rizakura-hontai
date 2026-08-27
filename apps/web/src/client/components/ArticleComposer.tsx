import { type FormEvent, useState } from "react";
import { Modal } from "./Modal";

type ArticleComposerProps = {
  readonly onCreate: (url: string) => Promise<boolean>;
  readonly variant: "desktop" | "mobile";
};

export function ArticleComposer({ onCreate, variant }: ArticleComposerProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmedUrl = url.trim();
    if (trimmedUrl === "") {
      setError("URLを入力してください。");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const succeeded = await onCreate(trimmedUrl);
      if (succeeded) {
        setUrl("");
        setMobileDialogOpen(false);
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "保存できませんでした。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (variant === "desktop") {
    return (
      <form
        aria-label="記事を保存"
        className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
        onSubmit={(event) => void submit(event)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="article-url">
              保存する記事のURL
            </label>
            <input
              autoComplete="url"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:text-sm"
              id="article-url"
              inputMode="url"
              maxLength={4096}
              onChange={(event) => setUrl(event.currentTarget.value)}
              placeholder="https://example.com/article"
              required
              type="url"
              value={url}
            />
            <button
              className="min-h-11 shrink-0 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "保存中…" : "保存"}
            </button>
          </div>
          {error === "" ? null : <p className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      </form>
    );
  }

  return (
    <>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        onClick={() => setMobileDialogOpen(true)}
        type="button"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ＋
        </span>
        追加
      </button>

      <Modal
        description="保存したい技術記事のURLを入力してください。"
        onClose={() => setMobileDialogOpen(false)}
        open={mobileDialogOpen}
        title="記事を追加"
      >
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-medium text-slate-700" htmlFor="mobile-article-url">
            記事URL
          </label>
          <input
            autoComplete="url"
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            data-autofocus
            id="mobile-article-url"
            inputMode="url"
            maxLength={4096}
            onChange={(event) => setUrl(event.currentTarget.value)}
            placeholder="https://example.com/article"
            required
            type="url"
            value={url}
          />
          {error === "" ? null : <p className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              onClick={() => setMobileDialogOpen(false)}
              type="button"
            >
              キャンセル
            </button>
            <button
              className="min-h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
