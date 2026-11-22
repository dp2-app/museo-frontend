import { useEffect } from "react";

/** Unificar la apertura de selectores personalizables en todas las rutas. */
export function useSelectoresInferiores() {
  useEffect(() => {
    if (!CSS.supports("appearance", "base-select")) return;
    const preparar = (event: Event) => {
      if (event instanceof KeyboardEvent && !["ArrowDown", "ArrowUp", " ", "Enter", "F4"].includes(event.key)) return;
      const target = event.target;
      if (!(target instanceof HTMLSelectElement) || !target.closest(".museum-app") || target.disabled || target.multiple || target.hasAttribute("size")) return;
      let rect = target.getBoundingClientRect();
      if (window.innerHeight - rect.bottom < 160) {
        target.scrollIntoView({ block: "center", behavior: "instant" });
        rect = target.getBoundingClientRect();
      }
      target.style.setProperty("--lista-alto-disponible", `${Math.max(44, window.innerHeight - rect.bottom - 16)}px`);
    };
    document.addEventListener("pointerdown", preparar, true);
    document.addEventListener("keydown", preparar, true);
    return () => {
      document.removeEventListener("pointerdown", preparar, true);
      document.removeEventListener("keydown", preparar, true);
    };
  }, []);
}
