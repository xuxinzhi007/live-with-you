import { useState, useEffect } from "react";

export type DeviceType = "desktop" | "mobile";

interface DeviceConfig {
  isMobile: boolean;
  deviceType: DeviceType;
  viewportWidth: number;
  viewportHeight: number;
  isPortrait: boolean;
}

const MOBILE_BREAKPOINT = 768;

function detectDevice(): DeviceConfig {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = width <= MOBILE_BREAKPOINT || window.matchMedia("(pointer: coarse)").matches;
  return {
    isMobile,
    deviceType: isMobile ? "mobile" : "desktop",
    viewportWidth: width,
    viewportHeight: height,
    isPortrait: height > width,
  };
}

export function useDeviceType(): DeviceConfig {
  const [config, setConfig] = useState<DeviceConfig>(detectDevice);

  useEffect(() => {
    const handleResize = () => setConfig(detectDevice());
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const pointerQuery = window.matchMedia("(pointer: coarse)");
    mediaQuery.addEventListener("change", handleResize);
    pointerQuery.addEventListener("change", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      mediaQuery.removeEventListener("change", handleResize);
      pointerQuery.removeEventListener("change", handleResize);
    };
  }, []);

  return config;
}

export function isMobileDevice(): boolean {
  return detectDevice().isMobile;
}

export function getDeviceConfig(): DeviceConfig {
  return detectDevice();
}
