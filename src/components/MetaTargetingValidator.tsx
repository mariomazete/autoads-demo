import { useState } from "react";
import { CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const INTERESTS = [
  "Volkswagen", "Fiat", "Jeep", "Chevrolet", "Toyota", "Honda", "Hyundai", "Renault", "Nissan", "Ford",
  "Peugeot", "Citroën", "Mitsubishi", "Kia", "Caoa Chery", "BYD", "GWM", "BMW", "Mercedes-Benz", "Audi",
  "Volvo", "Porsche", "Land Rover", "Lexus", "RAM", "Jaguar", "MINI", "Suzuki", "JAC", "Geely", "GAC",
  "Omoda", "Jaecoo", "Leapmotor", "Subaru", "Seres", "Maserati", "Ferrari", "Lamborghini", "McLaren",
  "Aston Martin", "Bentley", "Rolls-Royce", "Tesla", "Cupra", "Zeekr", "Neta",
  "Marcas de veículos automotores", "SUV", "Pick-up", "carros", "veículos", "veículos elétricos", "veículos híbridos",
  "carros novos", "veículos novos", "0 km", "zero km", "automóveis", "compra de carros", "comprar carro",
  "compra e venda de veículos", "venda de carros", "concessionárias", "concessionária de automóveis",
  "financiamento de veículos", "financiamento de carros", "Webmotors", "iCarros", "OLX Autos", "Mercado Livre Autos",
  "sites de venda de carros", "sites de venda de veículos", "carros importados", "veículos importados",
];

type Match = { id: string | null; name: string | null; path: string[]; audience_size: number | null; valid?: boolean };
type Result = { query: string; accepted: boolean; selected?: Match | null; matches: Match[]; error?: string };

export function MetaTargetingValidator() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function validate() {
    setLoading(true); setError(""); setResults(null);
    const { data, error: invokeError } = await supabase.functions.invoke("meta-targeting-search-v1", { body: { interests: INTERESTS } });
    if (invokeError || data?.error) {
      setError(invokeError?.message || data?.error || "Não foi possível consultar a Meta.");
      setLoading(false); return;
    }
    setResults(Array.isArray(data?.results) ? data.results : []); setLoading(false);
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" /> Validação de público Meta</CardTitle>
            <CardDescription>Teste os interesses automotivos padrão diretamente na Meta. Só são aceitas correspondências automotivas válidas.</CardDescription>
          </div>
          <Button onClick={() => void validate()} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "Consultando Meta..." : "Validar interesses"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">A consulta usa somente a autorização Meta deste usuário. Nenhuma campanha ou público é criado ou alterado. Resultados fora do contexto automotivo são rejeitados.</p>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        {results ? (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr>
              <th className="px-3 py-2 font-medium">Consulta</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Nome encontrado</th><th className="px-3 py-2 font-medium">ID Meta</th>
            </tr></thead><tbody>
              {results.map((result) => { const match = result.selected ?? null; return <tr key={result.query} className="border-t">
                <td className="px-3 py-2 font-medium">{result.query}</td><td className="px-3 py-2"><Badge variant={result.accepted ? "default" : "destructive"} className="gap-1">{result.accepted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{result.accepted ? "Aceito" : "Rejeitado"}</Badge></td>
                <td className="px-3 py-2">{match?.name || result.error || "Nenhum interesse automotivo válido encontrado"}</td><td className="px-3 py-2 font-mono text-xs">{match?.id || "—"}</td>
              </tr>; })}
            </tbody></table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
