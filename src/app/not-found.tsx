import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-[900px] flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
      <p className="ink-1 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#111214]">404 · Record not found</p>
      <h1 className="mt-5 text-5xl font-extrabold tracking-[-.05em] text-[#111214] sm:text-6xl">This market record does not exist.</h1>
      <p className="mt-5 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">The listing may have changed, or the URL may be incomplete.</p>
      <Link href="/market" className="ink hard-sm press mt-7 rounded-full bg-[#111214] px-5 py-3 text-sm font-bold text-white">Return to market</Link>
    </section>
  );
}
