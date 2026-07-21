"use server";

import { requirePrincipal } from "@/server/auth/principal";
import { createApiKey, revokeApiKey, API_SCOPES, type ApiScope } from "@/server/api-access/keys";

export async function createApiKeyAction(input: { name: string; scopes: string[] }): Promise<{ plaintext: string; prefix: string }> {
  const principal = await requirePrincipal({ accountTypes: ["customer", "seller"] });
  const scopes = input.scopes.filter((scope): scope is ApiScope => (API_SCOPES as string[]).includes(scope));
  const issued = await createApiKey({ ownerId: principal.id, name: (input.name || "API key").slice(0, 80), scopes: scopes.length ? scopes : ["market:read"] });
  return { plaintext: issued.plaintext, prefix: issued.prefix };
}

export async function revokeApiKeyAction(keyId: string): Promise<void> {
  const principal = await requirePrincipal({ accountTypes: ["customer", "seller"] });
  await revokeApiKey(principal.id, keyId);
}
