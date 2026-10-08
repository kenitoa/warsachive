"use client";
import { useEffect } from "react";

/** Deep links must open the evidence drawers enclosing the destination. */
export function KnowledgeAnchorJump() {
  useEffect(() => {
    let active = true;
    let firstFrame = 0;
    let settledFrame = 0;
    function reveal() {
      if (!active) return;
      let id: string; try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!id) return;
      const target = document.getElementById(id); if (!target) return;
      let ancestor: HTMLElement | null = target.parentElement;
      while (ancestor) { if (ancestor instanceof HTMLDetailsElement) ancestor.open = true; ancestor = ancestor.parentElement; }
      target.scrollIntoView({ block: "start", behavior: "instant" }); if (target.hasAttribute("tabindex")) target.focus({ preventScroll: true });
    }
    // Native fragment scrolling can run after hydration. Open the drawer, then
    // align again after the browser has laid out its expanded contents.
    function alignAfterLayout() {
      if (!active) return;
      cancelAnimationFrame(firstFrame); cancelAnimationFrame(settledFrame);
      firstFrame = requestAnimationFrame(() => { reveal(); settledFrame = requestAnimationFrame(reveal); });
    }
    alignAfterLayout();
    window.addEventListener("hashchange", alignAfterLayout);
    window.addEventListener("load", alignAfterLayout);
    void document.fonts.ready.then(alignAfterLayout);
    return () => {
      active = false; cancelAnimationFrame(firstFrame); cancelAnimationFrame(settledFrame);
      window.removeEventListener("hashchange", alignAfterLayout); window.removeEventListener("load", alignAfterLayout);
    };
  }, []);
  return null;
}
