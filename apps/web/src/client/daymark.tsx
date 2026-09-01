import { DaymarkApp } from "@rizakura-hontai/daymark/app";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { daymarkClient } from "./api/daymark";
import "./styles/index.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <DaymarkApp client={daymarkClient} />
  </StrictMode>,
);
