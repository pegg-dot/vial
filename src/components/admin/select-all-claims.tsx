"use client";
import { useRef } from "react";

// The one piece of the review queue that needs a script: a master checkbox that ticks or clears
// every claim checkbox in the same form. Everything else — selection state, submission, which
// button means what — is native form behaviour, so the queue still works with JS disabled
// (minus this convenience).
export function SelectAllClaims() {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold">
      <input
        ref={ref}
        type="checkbox"
        className="size-4.5 accent-[#2b31d8]"
        onChange={() => {
          const form = ref.current?.form;
          if (!form) return;
          for (const el of form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="selected"]')) {
            el.checked = ref.current!.checked;
          }
        }}
      />
      Select all
    </label>
  );
}
