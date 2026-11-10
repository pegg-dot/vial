import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ArtCoa, ArtFlask, ArtMagnifierVial, ArtMolecule, ArtShieldCheck, VialBuddy } from "@/components/vial-art";

/**
 * The one visual system for every research page, lifted from the landing page (/intelligence):
 * paper ground, ink borders (`.ink`), hard offset shadows (`.hard`), display-weight headings,
 * blue eyebrows, mint and blue tints, floating vial art. Pages compose these instead of
 * choosing their own colours, so a reader moving between the market, a dossier, the desk and
 * "How we check" sees one product. No hooks here: every piece renders on the server and can be
 * used from client components too.
 */

export const UI = {
  container: "mx-auto max-w-[1320px] px-5 sm:px-8",
  containerNarrow: "mx-auto max-w-[1080px] px-5 sm:px-8",
  eyebrow: "text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]",
  eyebrowMuted: "text-[11px] font-extrabold uppercase tracking-[.12em] text-[#4a4d56]",
  h1: "text-balance text-[clamp(2.6rem,6vw,4.4rem)] font-extrabold leading-[.92] tracking-[-.045em] text-[#111214]",
  h1Compact: "text-balance text-[clamp(2.1rem,4.2vw,3.25rem)] font-extrabold leading-[.95] tracking-[-.045em] text-[#111214]",
  h2: "text-balance text-[clamp(1.9rem,3.6vw,2.6rem)] font-extrabold leading-[.98] tracking-[-.04em] text-[#111214]",
  h3: "text-xl font-extrabold tracking-[-.035em] text-[#111214]",
  h4: "text-base font-extrabold tracking-[-.02em] text-[#111214]",
  lead: "text-lg font-medium leading-8 text-[var(--muted)]",
  body: "text-sm font-medium leading-6 text-[var(--muted)]",
  bodyInk: "text-sm font-medium leading-6 text-[#3a3d46]",
  small: "text-xs font-medium leading-5 text-[var(--muted)]",
  link: "inline-flex min-h-6 items-center gap-1 text-sm font-extrabold text-[#2b31d8] hover:underline",
  linkSmall: "inline-flex min-h-6 items-center gap-1 text-xs font-extrabold text-[#2b31d8] hover:underline",
  field: "field",
} as const;

/* ───────────────────────────── tones ───────────────────────────── */

export type Tone = "white" | "paper" | "mint" | "blue" | "violet" | "warn" | "danger" | "ink" | "blueSolid";

const TONE_BG: Record<Tone, string> = {
  white: "bg-white text-[#111214]",
  paper: "bg-[var(--background)] text-[#111214]",
  mint: "bg-[#e6fbf6] text-[#111214]",
  blue: "bg-[#eef0ff] text-[#111214]",
  violet: "bg-[#f0edff] text-[#111214]",
  warn: "bg-[#fff3d8] text-[#111214]",
  danger: "bg-[#ffecea] text-[#111214]",
  ink: "bg-[#111214] text-white",
  blueSolid: "bg-[#2b31d8] text-white",
};

/** Accent text colour that reads on each tone, for eyebrows and icons inside it. */
export const TONE_ACCENT: Record<Tone, string> = {
  white: "text-[#2b31d8]",
  paper: "text-[#2b31d8]",
  mint: "text-[#0b6b60]",
  blue: "text-[#2b31d8]",
  violet: "text-[#5a4be0]",
  warn: "text-[#9b6b22]",
  danger: "text-[#ce403b]",
  ink: "text-white/70",
  blueSolid: "text-white/70",
};

/* ───────────────────────────── art ───────────────────────────── */

export type ArtName = "vial" | "molecule" | "flask" | "shield" | "coa" | "magnifier";

const ART: Record<ArtName, ComponentType<{ className?: string }>> = {
  vial: (p) => <VialBuddy {...p} liquid="#2b31d8" />,
  molecule: ArtMolecule,
  flask: (p) => <ArtFlask {...p} fill="#12b3a6" />,
  shield: ArtShieldCheck,
  coa: ArtCoa,
  magnifier: ArtMagnifierVial,
};

const ART_SLOTS = [
  "gum-float absolute right-[5%] top-[14%] hidden w-24 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-28",
  "gum-float-rev absolute right-[16%] bottom-[10%] hidden w-16 drop-shadow-[4px_4px_0_#111214] lg:block lg:w-20",
  "gum-float-slow absolute left-[3%] bottom-[12%] hidden w-16 drop-shadow-[4px_4px_0_#111214] xl:block",
];

/** Floating illustrations behind a hero. Purely decorative; hidden from assistive tech. */
export function FloatingArt({ art }: { art: readonly ArtName[] }) {
  if (art.length === 0) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {art.slice(0, ART_SLOTS.length).map((name, index) => {
        const Art = ART[name];
        return <Art key={name + index} className={ART_SLOTS[index]} />;
      })}
    </div>
  );
}

/* ───────────────────────────── page chrome ───────────────────────────── */

export type Crumb = { href?: string; label: string };

export function Breadcrumb({ items, label = "Breadcrumb", className = "" }: { items: readonly Crumb[]; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={"flex flex-wrap items-center gap-2 text-xs font-bold text-[#4a4d56] " + className}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={item.label + index} className="inline-flex items-center gap-2">
            {item.href && !last
              ? <Link href={item.href} className="hover:text-[#2b31d8] hover:underline">{item.label}</Link>
              : <span aria-current={last ? "page" : undefined} className={last ? "text-[#111214]" : ""}>{item.label}</span>}
            {!last && <span aria-hidden="true">/</span>}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * Every page opens the same way: optional breadcrumb, blue eyebrow, one display h1, a lead, a
 * row of pill actions, and an optional framed aside (a form, a snapshot, a stat). Backed by a
 * bottom ink rule and floating art, exactly like the landing hero.
 */
export function PageHero({
  eyebrow, title, lead, note, actions, aside, asideClassName = "", breadcrumb, art = ["molecule", "flask"], tone = "paper",
  align = "left", size = "default", children, className = "",
}: {
  eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; note?: ReactNode; actions?: ReactNode; aside?: ReactNode;
  /** Classes for the aside's grid cell itself, so `hidden lg:block` hides the cell and its gap, not just its content. */
  asideClassName?: string;
  breadcrumb?: readonly Crumb[]; art?: readonly ArtName[]; tone?: Tone; align?: "left" | "center";
  size?: "default" | "compact"; children?: ReactNode; className?: string;
}) {
  const centered = align === "center";
  return (
    <section className={"relative isolate overflow-hidden border-b-2 border-[#111214] " + TONE_BG[tone] + " " + className}>
      {tone === "paper" && <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-0 -z-10 opacity-40" />}
      <FloatingArt art={art} />
      <div className={UI.container + (size === "compact" ? " pb-10 pt-7 sm:pb-12 sm:pt-9" : " pb-14 pt-10 sm:pb-20 sm:pt-14")}>
        {breadcrumb && <Breadcrumb items={breadcrumb} className={centered ? "justify-center" : ""} />}
        <div className={"grid gap-8 " + (aside ? "lg:grid-cols-[1.1fr_.9fr] lg:items-end " : "") + (breadcrumb ? "mt-6" : "")}>
          <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
            {eyebrow && <p className={UI.eyebrow + " flex items-center gap-2" + (centered ? " justify-center" : "")}>{eyebrow}</p>}
            <h1 className={(size === "compact" ? UI.h1Compact : UI.h1) + " mt-4"}>{title}</h1>
            {lead && <p className={UI.lead + " mt-5 max-w-2xl" + (centered ? " mx-auto" : "")}>{lead}</p>}
            {note && <p className={UI.small + " mt-3 max-w-2xl" + (centered ? " mx-auto" : "")}>{note}</p>}
            {actions && <div className={"mt-7 flex flex-wrap items-center gap-3" + (centered ? " justify-center" : "")}>{actions}</div>}
            {children}
          </div>
          {aside && <div className={"min-w-0 " + asideClassName}>{aside}</div>}
        </div>
      </div>
    </section>
  );
}

/** Eyebrow + h2 + lead with an optional right-hand action, the rhythm every landing section uses. */
export function SectionHeading({ eyebrow, title, lead, action, id, level = 2, className = "" }: {
  eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; action?: ReactNode; id?: string; level?: 2 | 3; className?: string;
}) {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <div className={"flex flex-wrap items-end justify-between gap-4 " + className}>
      <div className="max-w-3xl">
        {eyebrow && <p className={UI.eyebrow}>{eyebrow}</p>}
        <Heading id={id} className={(level === 3 ? UI.h3 : UI.h2) + " mt-3"}>{title}</Heading>
        {lead && <p className={UI.body + " mt-3 max-w-2xl"}>{lead}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** A content band: container + vertical rhythm. `band` adds the white, mint or blue full-bleed background with ink rules. */
export function Section({ id, band, narrow = false, tight = false, children, className = "", ariaLabel, ariaLabelledBy }: {
  id?: string; band?: Tone; narrow?: boolean; tight?: boolean; children: ReactNode; className?: string; ariaLabel?: string; ariaLabelledBy?: string;
}) {
  const inner = <div className={(narrow ? UI.containerNarrow : UI.container) + (tight ? " py-8 sm:py-10" : " py-12 sm:py-16") + " " + className}>{children}</div>;
  if (!band) return <section id={id} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} className="scroll-mt-32">{inner}</section>;
  return (
    <section id={id} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} className={"scroll-mt-32 border-y-2 border-[#111214] " + TONE_BG[band]}>{inner}</section>
  );
}

/* ───────────────────────────── frames ───────────────────────────── */

const SHADOW = { hard: "hard", sm: "hard-sm", lg: "hard-lg", blue: "hard-blue", none: "" } as const;
const PAD = { none: "", sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" } as const;

/** The card. Ink border, hard shadow, white by default. `press` makes a whole-card link lift on hover. */
export function Frame({
  as: As = "div", tone = "white", shadow = "hard", pad = "md", radius = "rounded-[18px]", press = false, thin = false,
  id, ariaLabel, ariaLabelledBy, className = "", children,
}: {
  as?: "div" | "section" | "article" | "aside" | "li" | "nav"; tone?: Tone; shadow?: keyof typeof SHADOW; pad?: keyof typeof PAD;
  radius?: string; press?: boolean; thin?: boolean; id?: string; ariaLabel?: string; ariaLabelledBy?: string; className?: string; children: ReactNode;
}) {
  return (
    <As id={id} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}
      className={[thin ? "ink-1" : "ink", SHADOW[shadow], press ? "press" : "", radius, TONE_BG[tone], PAD[pad], className].filter(Boolean).join(" ")}>
      {children}
    </As>
  );
}

/** A whole card that is a link: the landing page's feature and "go deeper" cards. */
export function CardLink({ href, eyebrow, title, body, action = "Open", icon: Icon, tone = "blue", external = false, ariaLabel, className = "" }: {
  href: string; eyebrow?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; icon?: ComponentType<{ className?: string }>;
  tone?: "blue" | "mint" | "violet"; external?: boolean; ariaLabel?: string; className?: string;
}) {
  const inner = (
    <>
      {Icon && <IconTile icon={Icon} tone={tone} />}
      {eyebrow && <span className={"text-[11px] font-extrabold uppercase tracking-[.12em] " + (Icon ? "mt-5 " : "") + TONE_ACCENT[tone]}>{eyebrow}</span>}
      <span className={UI.h3 + " block " + (eyebrow || Icon ? "mt-3" : "")}>{title}</span>
      {body && <span className={UI.body + " mt-2 block flex-1"}>{body}</span>}
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8]">
        {action} {external ? <ArrowUpRight className="size-4" aria-hidden="true" /> : <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />}
      </span>
    </>
  );
  const cls = "ink hard press group flex flex-col rounded-[18px] bg-white p-6 " + className;
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} className={cls}>{inner}</a>
    : <Link href={href} aria-label={ariaLabel} className={cls}>{inner}</Link>;
}

export function IconTile({ icon: Icon, tone = "blue", size = "md", className = "" }: {
  icon: ComponentType<{ className?: string }>; tone?: "blue" | "mint" | "violet" | "white" | "warn"; size?: "sm" | "md" | "lg"; className?: string;
}) {
  const box = size === "sm" ? "size-9 rounded-lg" : size === "lg" ? "size-16 rounded-2xl" : "size-12 rounded-xl";
  const glyph = size === "sm" ? "size-[18px]" : size === "lg" ? "size-8" : "size-6";
  return (
    <span className={"ink-1 grid shrink-0 place-items-center " + box + " " + TONE_BG[tone] + " " + className} aria-hidden="true">
      <Icon className={glyph + " text-[#2b31d8]"} />
    </span>
  );
}

/* ───────────────────────────── numbered sections and contents ───────────────────────────── */

export type ContentsItem = { id: string; label: string };

/**
 * One contents list in the same order every time: a sticky column beside the page on large
 * screens and a horizontal bar under the header on phones. Plain anchors, no script.
 */
export function StickyContents({ items, label }: { items: readonly ContentsItem[]; label: string }) {
  return (
    <nav aria-label={label}
      className="sticky top-[72px] z-20 -mx-5 border-b-2 border-[#111214] bg-[rgba(247,247,244,.96)] px-5 backdrop-blur-md sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
      <ol className="flex gap-1 overflow-x-auto py-2 lg:sticky lg:top-28 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:py-0">
        {items.map((item, index) => (
          <li key={item.id} className="shrink-0">
            <a href={"#" + item.id}
              className="flex min-h-11 items-center gap-2.5 rounded-full px-3.5 text-[13px] font-bold text-[#3a3d46] hover:bg-black/[.06] hover:text-[#111214] lg:min-h-9 lg:rounded-lg lg:px-2.5">
              <span aria-hidden="true" className="font-mono text-[11px] text-[#2b31d8]">{String(index + 1).padStart(2, "0")}</span>
              <span className="whitespace-nowrap">{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

const HEADER_TONE = { white: "", mint: "bg-[#e6fbf6]", blue: "bg-[#eef0ff]", violet: "bg-[#f0edff]" } as const;

/**
 * The single frame a numbered page section uses: numbered eyebrow, one h2, optional intro, body.
 * `flush` drops the body padding for content that brings its own rows (a divided list, a table),
 * so the frame ends where the content ends. `titleId` pins the h2's id when something links to it.
 */
export function NumberedSection({ id, number, eyebrow, title, intro, actions, chips, titleId, headerTone = "white", flush = false, className = "", children }: {
  id: string; number: number; eyebrow: ReactNode; title: ReactNode; intro?: ReactNode; actions?: ReactNode; chips?: ReactNode; titleId?: string;
  headerTone?: keyof typeof HEADER_TONE; flush?: boolean; className?: string; children: ReactNode;
}) {
  const headingId = titleId ?? id + "-title";
  return (
    <section id={id} aria-labelledby={headingId} className={"ink hard-sm scroll-mt-36 overflow-hidden rounded-[16px] bg-white " + className}>
      <header className={"border-b-2 border-[#111214] px-5 py-3.5 " + HEADER_TONE[headerTone]}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-extrabold uppercase tracking-[.16em] text-[#2b31d8]">
              <span className="font-mono">{String(number).padStart(2, "0")}</span> · {eyebrow}
            </p>
            <h2 id={headingId} className="mt-1 text-balance text-[clamp(1.125rem,1.6vw,1.375rem)] font-extrabold leading-[1.15] tracking-[-.03em] text-[#111214]">{title}</h2>
            {intro && <p className="mt-1 max-w-3xl text-[13px] font-medium leading-5 text-[#4a4d56]">{intro}</p>}
            {chips && <div className="mt-2.5 flex flex-wrap gap-1.5">{chips}</div>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div className={flush ? "" : "space-y-4 px-5 py-4"}>{children}</div>
    </section>
  );
}

/** The two-column body every numbered page uses: sticky contents on the left, sections on the right. */
export function ContentsLayout({ contents, label, children, className = "" }: { contents: readonly ContentsItem[]; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={"grid grid-cols-1 items-start gap-x-6 gap-y-4 lg:grid-cols-[180px_minmax(0,1fr)] " + className}>
      <StickyContents items={contents} label={label} />
      <div className="min-w-0 grid items-start gap-4">{children}</div>
    </div>
  );
}

/* ───────────────────────────── small parts ───────────────────────────── */

const PILL = {
  primary: "ink hard-sm press bg-[#2b31d8] text-white",
  secondary: "ink hard-sm press bg-white text-[#111214]",
  ink: "ink hard-sm press bg-[#111214] text-white",
  mint: "ink hard-sm press bg-[#e6fbf6] text-[#111214]",
  ghost: "ink-1 bg-white text-[#111214] hover:bg-[#eef0ff]",
} as const;

/** The pill button. A link when `href` is given (external links open in a new tab), otherwise a button. */
export function Pill({ href, external = false, variant = "secondary", size = "md", icon: Icon, arrow, type = "button", disabled, onClick, ariaLabel, ariaPressed, className = "", children }: {
  href?: string; external?: boolean; variant?: keyof typeof PILL; size?: "md" | "sm"; icon?: ComponentType<{ className?: string }>;
  arrow?: "right" | "up"; type?: "button" | "submit"; disabled?: boolean; onClick?: () => void; ariaLabel?: string; ariaPressed?: boolean; className?: string; children: ReactNode;
}) {
  const cls = ["inline-flex items-center justify-center gap-2 rounded-full font-extrabold", size === "sm" ? "min-h-9 px-4 text-xs" : "min-h-11 px-5 text-sm",
    PILL[variant], disabled ? "opacity-50" : "", className].join(" ");
  const inner = (
    <>
      {Icon && <Icon className="size-4" aria-hidden="true" />}
      {children}
      {arrow === "right" && <ArrowRight className="size-4" aria-hidden="true" />}
      {arrow === "up" && <ArrowUpRight className="size-4" aria-hidden="true" />}
    </>
  );
  // A link may also need a click handler (closing a dialog it sits in); it never turns the link into a button.
  if (href && external) return <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} aria-label={ariaLabel} className={cls}>{inner}</a>;
  if (href) return <Link href={href} onClick={onClick} aria-label={ariaLabel} className={cls}>{inner}</Link>;
  return <button type={type} disabled={disabled} onClick={onClick} aria-label={ariaLabel} aria-pressed={ariaPressed} className={cls}>{inner}</button>;
}

const CHIP: Record<Tone, string> = {
  white: "bg-white text-[#111214]", paper: "bg-[var(--background)] text-[#111214]", mint: "bg-[#e6fbf6] text-[#0b6b60]",
  blue: "bg-[#eef0ff] text-[#2b31d8]", violet: "bg-[#f0edff] text-[#5a4be0]", warn: "bg-[#fff3d8] text-[#9b6b22]",
  danger: "bg-[#ffecea] text-[#ce403b]", ink: "bg-[#111214] text-white", blueSolid: "bg-[#2b31d8] text-white",
};

/** Small uppercase label chip. Use `tone` to say what kind of fact it is, never to decorate. */
export function Chip({ tone = "white", icon: Icon, className = "", children }: { tone?: Tone; icon?: ComponentType<{ className?: string }>; className?: string; children: ReactNode }) {
  return (
    <span className={"ink-1 inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.1em] " + CHIP[tone] + " " + className}>
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}{children}
    </span>
  );
}

/** A boxed figure: big number, small label. */
export function Stat({ icon: Icon, value, label, note, tone = "white", className = "" }: {
  icon?: ComponentType<{ className?: string }>; value: ReactNode; label: ReactNode; note?: ReactNode; tone?: "white" | "mint" | "blue"; className?: string;
}) {
  return (
    <div className={"ink hard-sm rounded-[16px] p-4 " + TONE_BG[tone] + " " + className}>
      {Icon && <Icon className="size-4 text-[#2b31d8]" aria-hidden="true" />}
      <p className={"text-3xl font-extrabold tabular-nums tracking-[-.045em] " + (Icon ? "mt-3" : "")}>{value}</p>
      <p className="mt-1 text-xs font-bold text-[var(--muted)]">{label}</p>
      {note && <p className="mt-1 text-[11px] font-medium leading-4 text-[var(--muted)]">{note}</p>}
    </div>
  );
}

/** Inline figures with no box: the masthead row under a hero. */
export function StatRow({ items, className = "" }: { items: readonly { icon?: ComponentType<{ className?: string }>; value: ReactNode; label: ReactNode }[]; className?: string }) {
  return (
    <div className={"flex flex-wrap gap-x-10 gap-y-4 " + className}>
      {items.map(({ icon: Icon, value, label }, index) => (
        <div key={index}>
          <p className="flex items-center gap-2 text-3xl font-extrabold tabular-nums tracking-[-.045em] text-[#111214]">{Icon && <Icon className="size-5 text-[#2b31d8]" aria-hidden="true" />}{value}</p>
          <p className="mt-1 text-xs font-bold text-[var(--muted)]">{label}</p>
        </div>
      ))}
    </div>
  );
}

/** A note the reader must not miss: a limit, a warning, a status. Tone says which. */
export function Notice({ tone = "warn", icon: Icon, title, role, live, id, className = "", children }: {
  tone?: "warn" | "danger" | "mint" | "blue" | "paper" | "white"; icon?: ComponentType<{ className?: string }>; title?: ReactNode; role?: "status" | "alert" | "note";
  live?: "polite" | "assertive"; id?: string; className?: string; children: ReactNode;
}) {
  return (
    <div id={id} role={role} aria-live={live} className={"ink-1 flex items-start gap-3 rounded-[14px] px-4 py-3 " + TONE_BG[tone] + " " + className}>
      {Icon && <Icon className={"mt-0.5 size-4 shrink-0 " + TONE_ACCENT[tone]} aria-hidden="true" />}
      <div className="min-w-0 text-sm font-medium leading-6 text-[#111214]">
        {title && <p className="font-extrabold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

/** Term/detail pairs in a grid. The dossier overview, a snapshot strip, a study's registry facts. */
export function Facts({ items, cols = 3, tone, className = "" }: {
  items: readonly { term: ReactNode; detail: ReactNode }[]; cols?: 2 | 3 | 4; tone?: "mint" | "blue" | "paper"; className?: string;
}) {
  const grid = cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3";
  if (!tone) {
    return (
      <dl className={"grid gap-4 " + grid + " " + className}>
        {items.map(({ term, detail }, index) => (
          <div key={index}><dt className={UI.eyebrowMuted}>{term}</dt><dd className="mt-1 text-sm font-bold text-[#111214]">{detail}</dd></div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={"ink-1 grid overflow-hidden rounded-[14px] " + grid + " " + TONE_BG[tone] + " " + className}>
      {items.map(({ term, detail }, index) => (
        <div key={index} className={"px-5 py-3 " + (index < items.length - 1 ? "border-b border-[#111214]/15 sm:border-b-0 sm:border-r" : "")}>
          <dt className={"text-[11px] font-extrabold uppercase tracking-[.12em] " + TONE_ACCENT[tone]}>{term}</dt>
          <dd className="mt-1 text-sm font-bold text-[#111214]">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export type RecordItem = { href: string; title: ReactNode; note?: ReactNode; action?: ReactNode; icon?: ComponentType<{ className?: string }>; external?: boolean; meta?: ReactNode };

/** A list of linked records: the dossier's source trail, a page's related links. One row per record, every row a link. */
export function RecordList({ items, className = "" }: { items: readonly RecordItem[]; className?: string }) {
  return (
    <ul className={"divide-y divide-[#111214]/10 rounded-[14px] border border-[#111214]/15 bg-white " + className}>
      {items.map(({ href, title, note, action, icon: Icon, external, meta }, index) => {
        const inner = (
          <>
            {Icon && <Icon className="mt-0.5 size-5 shrink-0 text-[#2b31d8]" aria-hidden="true" />}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-[#111214]">{title}</span>
              {note && <span className="mt-0.5 block text-xs font-medium leading-5 text-[#4a4d56]">{note}</span>}
              {action && <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-extrabold text-[#2b31d8]">{action} {external ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : <ArrowRight className="size-3.5" aria-hidden="true" />}</span>}
            </span>
            {meta && <span className="shrink-0 text-right text-xs font-bold text-[#4a4d56]">{meta}</span>}
          </>
        );
        const cls = "flex min-h-11 items-start gap-3 px-5 py-4 hover:bg-[#eef0ff]";
        return (
          <li key={index}>
            {external ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>}
          </li>
        );
      })}
    </ul>
  );
}

/** The quiet small print that closes a page: scope, limits, a link to the method. */
export function PageFootnote({ children, href, linkLabel, className = "" }: { children: ReactNode; href?: string; linkLabel?: ReactNode; className?: string }) {
  return (
    <div className={UI.container + " border-t border-[#111214]/20 py-8 text-xs font-medium leading-6 text-[#666970] " + className}>
      <p className="max-w-4xl">{children}</p>
      {href && linkLabel && <Link href={href} className="mt-3 inline-flex min-h-6 items-center gap-1 font-bold text-[#2b31d8] hover:underline">{linkLabel} <ArrowRight className="size-4" aria-hidden="true" /></Link>}
    </div>
  );
}

/** A quiet inner panel inside a Frame: thin border, paper ground. For sub-groups that must not compete with the frame. */
export function Quiet({ as: As = "div", id, ariaLabel, className = "", children }: { as?: "div" | "section" | "article" | "li"; id?: string; ariaLabel?: string; className?: string; children: ReactNode }) {
  return <As id={id} aria-label={ariaLabel} className={"rounded-[14px] border border-[#111214]/15 bg-[#fbfbf8] p-4 " + className}>{children}</As>;
}
