"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface CartLine {
  id: string;
  slug: string;
  name: string;
  quantityLabel: string;
  vendor: string;
  quantity: number;
  unitPrice: number;
  state: string;
}

export interface Cart {
  id: string;
  lines: CartLine[];
  subtotal: number;
  shipping: number;
  platformFee: number;
  tax: number;
  total: number;
  eligible: boolean;
  issues: string[];
}

type CommerceContextValue = {
  cart: Cart | null;
  loading: boolean;
  add: (slug: string) => Promise<void>;
  setQuantity: (id: string, quantity: number) => Promise<void>;
  refresh: () => Promise<void>;
};

const CommerceContext = createContext<CommerceContextValue | null>(null);

export function CommerceCartProvider({ children, authenticated = false }: { children: React.ReactNode; authenticated?: boolean }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(authenticated);

  const refresh = useCallback(async () => {
    if (!authenticated) { setCart(null); setLoading(false); return; }
    const response = await fetch("/api/v1/commerce/cart", { cache: "no-store" });
    setCart(response.ok ? ((await response.json()) as Cart) : null);
    setLoading(false);
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    fetch("/api/v1/commerce/cart", { cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as Cart) : null))
      .then((nextCart) => {
        if (!active) return;
        setCart(nextCart);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authenticated]);

  const add = useCallback(async (slug: string) => {
    if (!authenticated) throw new Error("Sign in to use the sandbox cart");
    setLoading(true);
    const response = await fetch("/api/v1/commerce/cart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingSlug: slug, quantity: 1 }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setLoading(false);
      throw new Error(payload.error);
    }
    setCart(payload as Cart);
    setLoading(false);
  }, [authenticated]);

  const setQuantity = useCallback(async (id: string, quantity: number) => {
    const response = await fetch("/api/v1/commerce/cart", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lineId: id, quantity }),
    });
    if (response.ok) setCart((await response.json()) as Cart);
  }, []);

  const value = useMemo(() => ({ cart, loading, add, setQuantity, refresh }), [cart, loading, add, setQuantity, refresh]);
  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerceCart() {
  const context = useContext(CommerceContext);
  if (!context) throw new Error("CommerceCartProvider missing");
  return context;
}
