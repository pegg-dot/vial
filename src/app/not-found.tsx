import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-[900px] flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
      <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">404 · Record not found</p>
      <h1 className="mt-4 text-5xl font-semibold tracking-[-.06em] sm:text-6xl">This market record does not exist.</h1>
      <p className="mt-5 max-w-md text-sm leading-6 text-[var(--muted)]">The listing may have changed, or the URL may be incomplete.</p>
      <Link href="/market" className="mt-7 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Return to market</Link>
    </section>
  );
}
