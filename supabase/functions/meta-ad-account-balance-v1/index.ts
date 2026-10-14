import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Contrato desta função: todos os valores monetários retornados estão em
// unidade MENOR (centavos) para moedas com 2 casas; moedas sem decimais usam 1.
// - balance, amount_spent, spend_cap (Graph API): já vêm em unidade menor.
// - prepay_account_balance / funding_source_details: CurrencyAmount com
//   `amount` em valor DECIMAL (ex.: "28.40") e, às vezes, `amount_in_hundredths`
//   (ex.: "2840"). Convertemos para unidade menor aqui, uma única vez.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "CLP", "COP", "CRC", "HUF", "ISK", "IDR", "JPY", "KRW", "PYG", "TWD", "VND",
]);

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Converte um CurrencyAmount (valor decimal) para unidade menor. */
function currencyAmountToMinor(value: unknown, currency: string): number | null {
  if (value == null) return null;
  const factor = ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    // Já em centésimos: usar direto, sem multiplicar.
    const hundredths = toNumber(record.amount_in_hundredths ?? record.AMOUNT_IN_HUNDREDTHS);
    if (hundredths != null) return factor === 1 ? Math.round(hundredths / 100) : Math.round(hundredths);
    return currencyAmountToMinor(record.amount ?? record.AMOUNT ?? record.value ?? record.VALUE, currency);
  }
  const decimal = toNumber(value);
  return decimal == null ? null : Math.round(decimal * factor);
}

function extractStoredBalanceMinor(value: unknown, currency: string): number | null {
  if (Array.isArray(value)) {
    const amounts = value
      .map((item) => extractStoredBalanceMinor(item, currency))
      .filter((amount): amount is number => amount != null);
    return amounts.length ? amounts.reduce((sum, amount) => sum + amount, 0) : null;
  }
  return extractStoredBalanceFromRecord(value, currency);
}

/** Extrai o valor de um texto como "R$28,40" ou "$1,234.56" em unidade menor. */
function parseDisplayStringToMinor(value: unknown, currency: string): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/\d[\d.,]*/);
  if (!match) return null;
  let raw = match[0].replace(/[.,]$/, "");
  const decimalMatch = raw.match(/[.,](\d{1,2})$/);
  let decimal: number;
  if (decimalMatch) {
    const intPart = raw.slice(0, raw.length - decimalMatch[0].length).replace(/[.,]/g, "");
    decimal = Number(`${intPart}.${decimalMatch[1]}`);
  } else {
    raw = raw.replace(/[.,]/g, "");
    decimal = Number(raw);
  }
  if (!Number.isFinite(decimal)) return null;
  const factor = ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
  return Math.round(decimal * factor);
}

function extractStoredBalanceFromRecord(value: unknown, currency: string): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const type = record.type ?? record.TYPE;
  if (String(type) === "20") {
    const fromAmount = currencyAmountToMinor(record.amount ?? record.AMOUNT, currency);
    if (fromAmount != null) return fromAmount;
    // A Meta pode retornar só o texto, ex.: "Saldo disponível (R$28,40 BRL)".
    return parseDisplayStringToMinor(record.display_string, currency);
  }
  for (const nested of Object.values(record)) {
    const found = extractStoredBalanceMinor(nested, currency);
    if (found != null) return found;
  }
  return null;
}

async function metaGet(
  graphVersion: string,
  accountId: string,
  accessToken: string,
  fields: string,
) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${accountId}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  const data = await response.json();
  return { response, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const graphVersion = Deno.env.get("META_GRAPH_VERSION") || "v26.0";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Integração não configurada." }, 503);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Sessão inválida." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: connection, error: connectionError } = await admin
    .from("meta_connections")
    .select("access_token,status")
    .eq("seller_id", user.id)
    .maybeSingle();

  if (connectionError) return json({ error: "Não foi possível localizar a conexão Meta." }, 500);
  if (!connection?.access_token || connection.status !== "connected") return json({ error: "Conta Meta não conectada." }, 404);

  const { data: account, error: accountError } = await admin
    .from("meta_ad_accounts_v2")
    .select("external_account_id,name,status")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (accountError) return json({ error: "Não foi possível localizar a conta de anúncios." }, 500);
  if (!account?.external_account_id) return json({ error: "Nenhuma conta de anúncios selecionada." }, 404);

  // Esta consulta básica é o fluxo estável. Não colocar campos opcionais de
  // pré-pago aqui, porque um único campo sem permissão faz a Meta devolver 400.
  const basicFields = "id,name,account_status,currency,balance,amount_spent,spend_cap,is_prepay_account";
  const { response, data } = await metaGet(
    graphVersion,
    account.external_account_id,
    connection.access_token,
    basicFields,
  );

  if (!response.ok || data?.error) {
    const message = data?.error?.message || "A Meta não permitiu consultar os dados financeiros da conta.";
    console.error("meta-ad-account-balance-v1 failed", message);
    return json({ error: message }, response.status >= 400 ? response.status : 502);
  }

  const isPrepay = Boolean(data.is_prepay_account);
  const currency = String(data.currency ?? "BRL").toUpperCase();
  // `balance` da Graph API já vem em unidade menor (centavos).
  let availableBalance = toNumber(data.balance);
  let balanceSource = "balance";

  if (isPrepay) {
    // 1) Campo específico de saldo pré-pago, quando disponível na versão/token.
    try {
      const prepayResult = await metaGet(
        graphVersion,
        account.external_account_id,
        connection.access_token,
        "prepay_account_balance",
      );
      if (prepayResult.response.ok && !prepayResult.data?.error) {
        const prepayBalance = currencyAmountToMinor(prepayResult.data.prepay_account_balance, currency);
        if (prepayBalance != null) {
          availableBalance = prepayBalance;
          balanceSource = "prepay_account_balance";
        }
      }
    } catch (error) {
      console.warn("prepay_account_balance lookup skipped", error);
    }

  }

  // Saldo armazenado (TYPE 20): vale para contas pré-pagas e também para contas que receberam
  // "fundos" por Pix/boleto sem serem marcadas como pré-pagas.
  {
    if (balanceSource === "balance") {
      try {
        const fundingResult = await metaGet(
          graphVersion,
          account.external_account_id,
          connection.access_token,
          "funding_source_details",
        );
        if (fundingResult.response.ok && !fundingResult.data?.error) {
          const storedBalance = extractStoredBalanceMinor(fundingResult.data.funding_source_details, currency);
          if (storedBalance != null) {
            availableBalance = storedBalance;
            balanceSource = "funding_source_details";
          }
        }
      } catch (error) {
        console.warn("funding_source_details lookup skipped", error);
      }
    }
  }

  // Em conta não pré-paga, `balance` é o valor DEVIDO à Meta, não o dinheiro disponível.
  // Sem saldo armazenado informado pela Meta, não mostramos R$ 0,00 como se fosse o saldo.
  if (!isPrepay && balanceSource === "balance") {
    availableBalance = null;
    balanceSource = "unavailable";
  }

  return json({
    account: {
      id: data.id ?? account.external_account_id,
      name: data.name ?? account.name ?? "Conta Meta",
      currency,
      account_status: data.account_status ?? null,
      is_prepay_account: isPrepay,
      balance: availableBalance,
      amount_spent: toNumber(data.amount_spent),
      spend_cap: toNumber(data.spend_cap),
      balance_source: balanceSource,
      balance_unit: "minor",
    },
    fetched_at: new Date().toISOString(),
  });
});
