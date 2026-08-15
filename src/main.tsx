import { createRoot } from "react-dom/client";
import "../styles.css";
import { App } from "./App";
import { Studio } from "./Studio";

createRoot(document.getElementById("root")!).render(
  new URLSearchParams(window.location.search).has("studio") ? <Studio /> : <App />,
);
