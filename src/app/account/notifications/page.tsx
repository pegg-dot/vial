import type { Metadata } from "next";
import { NotificationInbox } from "@/components/notification-inbox";
import { PushSubscription } from "@/components/push-subscription";
import { requirePrincipal } from "@/server/auth/principal";
import { listUserNotifications } from "@/server/consumer-intelligence/repository";
import { syncWatchlistNotifications } from "@/server/consumer-intelligence/service";
import { getVapidConfig } from "@/server/push/vapid";
export const metadata:Metadata={title:"Notifications",description:"Relevant reviewed market changes ranked by your explicit preferences."};
export const dynamic="force-dynamic";
export default async function Page(){const principal=await requirePrincipal({accountTypes:["customer","seller"]});await syncWatchlistNotifications(principal.id);const rows=await listUserNotifications(principal.id,{limit:100});const vapid=getVapidConfig();return <main className="mx-auto max-w-5xl px-5 py-14"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Alerts</p><h1 className="mt-3 text-5xl font-extrabold tracking-[-.06em]">Notifications</h1><p className="mt-4 max-w-2xl text-[var(--muted)]">Changes to the things you follow, ranked by how much you said you care — collected here, and pushed to your device when we pick them up.</p><div className="mt-8"><PushSubscription vapidPublicKey={vapid?.publicKey ?? null}/></div><div className="mt-6"><NotificationInbox initial={rows}/></div></main>}
