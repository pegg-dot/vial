"use client";
import { useEffect } from "react";

// Anything the reader does to move the page ends the landing: the page is theirs from then on.
const READER_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
const SETTLE_MS = 4000;

/**
 * Lands a URL hash on its target and keeps it there while the page is still growing.
 *
 * The browser scrolls to `#id` as soon as the element exists, but this page keeps growing after
 * that: sections above the target stream in through Suspense and client components fill out on
 * hydration (measured: the document grew by ~1,700px after the load event, which pushed the target
 * ~1,000px below the viewport). So: land once, then re-land on every body resize for a few
 * seconds, and stop the moment the reader scrolls or touches anything. `scroll-margin` classes on
 * the target keep the sticky header off it. Runs once per page load; in-page clicks are untouched.
 */
export function HashLanding() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id || typeof ResizeObserver === "undefined") return;
    const land = () => document.getElementById(id)?.scrollIntoView({ block: "start" });
    const observer = new ResizeObserver(() => land());
    const stop = () => {
      observer.disconnect();
      clearTimeout(timer);
      for (const event of READER_EVENTS) window.removeEventListener(event, stop);
    };
    const timer = setTimeout(stop, SETTLE_MS);
    for (const event of READER_EVENTS) window.addEventListener(event, stop, { passive: true });
    observer.observe(document.body);
    land();
    return stop;
  }, []);
  return null;
}
