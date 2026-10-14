import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

const SKEW_LIMIT_MS = 3 * 60 * 1000;
const REFRESH_EVERY_MS = 40 * 60 * 1000;

/** Seconds since epoch when the server issued this access token (server clock). */
function issuedAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.iat === "number" ? payload.iat : null;
  } catch {
    return null;
  }
}

/**
 * Keeps the login alive on computers with a wrong clock.
 * The auth library decides when to renew the session using the device clock; if the clock is
 * hours behind, it keeps using an expired session and every request fails ("a conta cai").
 * Here we compare a freshly issued token with the device time and, silently (no message on
 * screen), renew the session on a real-time timer (timers don't depend on the wall clock).
 */
export function SessionClockGuard() {
  const [skewMinutes, setSkewMinutes] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let active = true;

    const measure = (token: string | undefined) => {
      if (!token) return;
      const iat = issuedAt(token);
      if (iat == null) return;
      const skew = Date.now() - iat * 1000; // < 0: device behind the server
      // Only a clock that is BEHIND breaks the session (the library never renews in time).
      // A positive difference can simply be an older token (e.g. one restored from storage),
      // so it is never treated as a wrong clock.
      const skewed = skew < -SKEW_LIMIT_MS;
      if (!active) return;
      setSkewMinutes(skewed ? Math.round(skew / 60000) : null);
      if (skewed && !timer) {
        timer = setInterval(() => {
          void supabase.auth.refreshSession();
        }, REFRESH_EVERY_MS);
      }
      if (!skewed && timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    // On load, renew once: the stored session may already be expired on the server even if
    // this computer thinks it is still valid, and a fresh token tells us the server time.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: refreshed } = await supabase.auth.refreshSession();
      measure(refreshed.session?.access_token);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") measure(session?.access_token);
      if (event === "SIGNED_OUT") {
        setSkewMinutes(null);
        if (timer) clearInterval(timer);
        timer = null;
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      if (timer) clearInterval(timer);
    };
  }, []);

  // Proteção silenciosa: nenhum aviso é mostrado na tela.
  void skewMinutes;
  return null;
}
