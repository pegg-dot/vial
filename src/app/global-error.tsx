"use client";

/**
 * The last line of defence, for errors thrown by the ROOT LAYOUT itself.
 *
 * `error.tsx` cannot catch these. Next's own docs are explicit that an error boundary does not wrap
 * the layout above it in the same segment, and that root-layout errors need `global-error`. Without
 * this file, a failure in the root layout — which awaits the catalog on every request — renders
 * Next's unstyled "Application error: a server-side exception has occurred" on EVERY url, including
 * pages that need no data at all. That is precisely what visitors saw during the database outage.
 *
 * This file replaces the entire document, so it declares its own <html> and <body> and inherits no
 * stylesheet. Every style here is inline on purpose; a global stylesheet that failed to load is one
 * of the things that can put a reader on this page.
 *
 * The copy says what is true and what to do, and never blames the reader or implies their data is
 * affected. VialGrade holds no accounts of consequence and takes no payment, so an outage here is
 * an inconvenience, and the page should read like one.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#f7f7f4", color: "#111214", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <main style={{ maxWidth: "560px", width: "100%", background: "#ffffff", border: "2px solid #111214", borderRadius: "18px", padding: "32px", boxShadow: "4px 4px 0 #111214" }}>
          <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "#b26a00" }}>
            Temporarily unavailable
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: "30px", lineHeight: 1.1, letterSpacing: "-.03em", fontWeight: 800 }}>
            VialGrade is having a problem on our end.
          </h1>
          <p style={{ margin: "16px 0 0", fontSize: "15px", lineHeight: 1.6, color: "#61636b" }}>
            This is not something you did, and nothing you saved is affected. The site is back as
            soon as the fault clears — usually a few minutes.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "24px" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{ border: "2px solid #111214", borderRadius: "999px", background: "#111214", color: "#ffffff", padding: "10px 20px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
            >
              Try again
            </button>
            {/* A plain anchor, deliberately. This boundary renders when the ROOT LAYOUT failed, so
                client-side routing is exactly what cannot be trusted here — next/link would try a
                soft navigation back into the broken tree. A hard document request is the only way
                out. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ border: "2px solid #111214", borderRadius: "999px", background: "#ffffff", color: "#111214", padding: "10px 20px", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}
            >
              Back to the homepage
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
