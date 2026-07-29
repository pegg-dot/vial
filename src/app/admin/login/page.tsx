import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { staffLoginAction } from "@/server/auth/actions";
export const metadata: Metadata = { title: "Staff access" };
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const p = await searchParams;
  return (
    <section className="mx-auto max-w-[520px] px-5 py-20 sm:px-8">
      <div className="ink hard-lg rounded-[24px] bg-[#111214] p-8 text-white">
        <span className="inline-grid size-12 place-items-center rounded-[14px] border border-white/25 bg-white/10 text-white"><KeyRound className="size-6" /></span>
        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#8fa2ff]">VIAL control plane</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-.04em]">Open the control plane.</h1>
        {p.error && <p className="mt-4 rounded-[10px] border border-white/20 bg-[#d3372c]/20 px-3 py-2 text-sm font-semibold text-[#ffb3ad]">{p.error}</p>}
        <form action={staffLoginAction} className="mt-8 space-y-4">
          <input type="hidden" name="returnTo" value={p.next || "/admin"} />
          <label className="block text-sm font-bold text-white">Staff email<input name="email" type="email" required className="mt-2 min-h-[3.25rem] w-full rounded-[12px] border-[1.5px] border-white/25 bg-white/5 px-4 text-sm font-medium text-white outline-none focus:border-[#8fa2ff] focus:shadow-[3px_3px_0_0_#2b31d8]" /></label>
          <label className="block text-sm font-bold text-white">Password<input name="password" type="password" required className="mt-2 min-h-[3.25rem] w-full rounded-[12px] border-[1.5px] border-white/25 bg-white/5 px-4 text-sm font-medium text-white outline-none focus:border-[#8fa2ff] focus:shadow-[3px_3px_0_0_#2b31d8]" /></label>
          <button className="h-12 w-full rounded-full border-2 border-white bg-white text-sm font-bold text-[#111214] transition hover:bg-[#8fa2ff] hover:border-[#8fa2ff]">Continue securely</button>
        </form>
        {process.env.NODE_ENV !== "production" && <p className="mt-6 text-xs font-medium text-white/55">Admin: jon@vial.test / VialDemoAdmin!2026<br />Reviewer: maya@vial.test / VialDemoReviewer!2026</p>}
      </div>
    </section>
  );
}
