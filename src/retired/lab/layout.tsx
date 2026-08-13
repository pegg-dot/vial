import { notFound } from "next/navigation";
import { LaboratoryShell } from "@/components/laboratory/laboratory-shell";
import { requirePrincipal } from "@/server/auth/principal";
import { getLaboratoryContext } from "@/server/evidence-network/repository";
export default async function Layout({children}:{children:React.ReactNode}){const principal=await requirePrincipal({accountTypes:["laboratory"]});const context=await getLaboratoryContext(principal.email);if(!context)notFound();return <LaboratoryShell name={String(context.lab.display_name)} role={context.membership.role} completion={Number(context.onboarding?.completion_percent??0)} accreditation={String(context.lab.accreditation_status)}>{children}</LaboratoryShell>}
