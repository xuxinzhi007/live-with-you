import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { App } from "./App";
import { Studio } from "./Studio";
import { CharacterDetail } from "./CharacterDetail";
import { useDeviceType } from "./hooks/useDeviceType";
import { WorldApp } from "./mobile/WorldApp";

const LegacyMobile = lazy(() =>
  import("./layouts/MobileLayout").then((module) => ({ default: module.MobileLayout })),
);

const params = new URLSearchParams(window.location.search);

function Root() {
  const { isMobile } = useDeviceType();
  const forceMobile = params.has("mobile") || params.has("mobilePrototype");
  const forceDesktop = params.has("desktop");
  const legacy = params.has("legacy") || params.has("legacyMobile");

  if (params.has("studio")) return <Studio />;
  if (params.has("character")) return <CharacterDetail />;
  if (legacy) {
    return (
      <Suspense fallback={null}>
        <LegacyMobile />
      </Suspense>
    );
  }
  // V2：手机与 ?mobile 进入可走动的单主角小世界；桌面保留旧版预览。
  if (forceMobile || (!forceDesktop && isMobile)) return <WorldApp />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(<Root />);
