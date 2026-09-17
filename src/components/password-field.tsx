"use client";
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// A password box you can read back.
//
// Every password field on the site was a bare `type="password"` with no way to see what you had
// typed, which is the one control that actually prevents the failure it is meant to prevent: a
// typo in a long password is invisible, so the first evidence of it is a rejected sign-in, and on
// the staff login that reads as "am I locked out?" rather than "I mistyped". Password managers
// solve this for saved credentials and do nothing for the first entry of one.
//
// This renders its OWN label rather than being dropped inside the caller's. The first version was a
// bare input the call sites wrapped in `<label>Password…</label>`, which put an interactive button
// inside a label element — invalid, ambiguous about what a click on the label does, and it gave two
// controls in one region an accessible name containing "Password". Owning the label keeps the
// toggle a sibling of the input, where it belongs.
//
// Toggling the `type` of the SAME input is deliberate — it keeps the value, the cursor, the
// autofill association and the form binding intact. Re-rendering a different element would drop all
// four, and password managers key on the element.
//
// Shown state persists nowhere: it lives as long as the form is on screen and is never written to
// storage, so a revealed password cannot outlive the page it was typed on.
export function PasswordField({
  name,
  label = "Password",
  hint,
  className = "field",
  labelClassName = "block text-sm font-bold text-[#111214]",
  inputClassName = "mt-2",
  required,
  minLength,
  autoComplete,
  tone = "light",
}: {
  name: string;
  label?: string;
  hint?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  /** `dark` for the staff control plane, which is white-on-near-black. */
  tone?: "light" | "dark";
}) {
  const [shown, setShown] = useState(false);
  const inputId = `password-${useId()}`;
  return (
    <div>
      <label htmlFor={inputId} className={labelClassName}>{label}</label>
      <span className="relative block">
        <input
          id={inputId}
          name={name}
          type={shown ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          // Room for the control, so a long password never runs underneath it.
          className={`${className} ${inputClassName} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          // The label carries the ACTION and aria-pressed carries the state. A button labelled only
          // "Show password" while the password is already showing tells a screen reader the
          // opposite of the truth.
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          aria-controls={inputId}
          className={`absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[12px] transition ${
            tone === "dark" ? "text-white/60 hover:text-white" : "text-black/40 hover:text-[#111214]"
          }`}
        >
          {shown ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      </span>
      {hint && <span className="mt-1 block text-xs font-medium text-[var(--muted)]">{hint}</span>}
    </div>
  );
}
