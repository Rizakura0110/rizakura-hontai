import { TechInboxProvider } from "@rizakura-hontai/tech-inbox/app";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { techInboxClient, techInboxUi } from "./tech-inbox";

// Integration tests retain the real host HTTP and UI adapters after extraction.
export function renderTechInbox(element: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(element, {
    ...options,
    wrapper: ({ children }) => (
      <TechInboxProvider client={techInboxClient} ui={techInboxUi}>
        {children}
      </TechInboxProvider>
    ),
  });
}
