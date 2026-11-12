import { useEffect, useState } from "react";
import { probeRemoteAssets, subscribeRemoteAssets } from "./remote-assets.ts";

/**
 * 订阅资源库探活结果。generation 变化后应重新调用 resolveAsset / getCharacterSkin，
 * 好把已经烘焙的 URL 从本地切到远端（或保持本地）。
 */
export function useRemoteAssetGeneration(): number {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeRemoteAssets(() => setGeneration((n) => n + 1));
    void probeRemoteAssets();
    return unsubscribe;
  }, []);
  return generation;
}
