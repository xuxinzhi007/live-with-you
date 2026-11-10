import { useCallback, useRef, useState } from "react";

export interface Popup {
  id: number;
  text: string;
}

export interface UseUIState {
  toast: string | null;
  showToast: (msg: string) => void;
  popups: Popup[];
  pushPopup: (text: string) => void;
}

export function useUIState(): UseUIState {
  const [toast, setToast] = useState<string | null>(null);
  const [popups, setPopups] = useState<Popup[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupIdRef = useRef(1);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const pushPopup = useCallback((text: string) => {
    const id = popupIdRef.current++;
    setPopups((prev) => [...prev.slice(-3), { id, text }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, 1350);
  }, []);

  return { toast, showToast, popups, pushPopup };
}
