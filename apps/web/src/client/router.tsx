import { TechInboxApp } from "@rizakura-hontai/tech-inbox/app";
import { techInboxClient, techInboxUi } from "./tech-inbox";

export function AppRouter() {
  return <TechInboxApp client={techInboxClient} ui={techInboxUi} />;
}
