import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import "../styles.css";
import "../styles-mobile.css";
import { App } from "./App";
import { Studio } from "./Studio";
import { CharacterDetail } from "./CharacterDetail";
import { MobileLayout } from "./layouts/MobileLayout";

const params = new URLSearchParams(window.location.search);

function useDeviceType() {
  const getIsMobile = () =>
    params.has("mobile") ||
    (!params.has("desktop") &&
      (window.innerWidth <= 768 || window.matchMedia("(pointer: coarse)").matches));

  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const coarseQuery = window.matchMedia("(pointer: coarse)");

    function checkMobile() {
      setIsMobile(getIsMobile());
    }

    mediaQuery.addEventListener("change", checkMobile);
    coarseQuery.addEventListener("change", checkMobile);
    window.addEventListener("resize", checkMobile);

    return () => {
      mediaQuery.removeEventListener("change", checkMobile);
      coarseQuery.removeEventListener("change", checkMobile);
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return isMobile;
}

function Root() {
  const isMobile = useDeviceType();

  if (params.has("studio")) return <Studio />;
  if (params.has("character")) return <CharacterDetail />;
  return isMobile ? <MobileLayout /> : <App />;
}

createRoot(document.getElementById("root")!).render(<Root />);
