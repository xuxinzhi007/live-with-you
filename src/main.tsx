import { createRoot } from "react-dom/client";
import "../styles.css";
import { App } from "./App";
import { Studio } from "./Studio";
import { CharacterDetail } from "./CharacterDetail";
import { useDeviceType } from "./hooks/useDeviceType";
import { MobileLayout } from "./layouts/MobileLayout";

const params = new URLSearchParams(window.location.search);

function Root() {
  const { isMobile } = useDeviceType();
  const forceMobile = params.has("mobile") || params.has("mobilePrototype");
  const forceDesktop = params.has("desktop");

  if (params.has("studio")) return <Studio />;
  if (params.has("character")) return <CharacterDetail />;
  return forceMobile || (!forceDesktop && isMobile) ? <MobileLayout /> : <App />;
}

createRoot(document.getElementById("root")!).render(<Root />);
