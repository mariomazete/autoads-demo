import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetaTargetingValidator } from "@/components/MetaTargetingValidator";

export function MetaTargetingValidatorLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        className="fixed bottom-5 right-5 z-[70] gap-2 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        Validar interesses Meta
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/30 p-4 backdrop-blur-[1px]">
          <div className="mx-auto mt-10 max-w-6xl rounded-2xl bg-background p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-primary">Ferramenta de validação</p>
                <h2 className="text-xl font-semibold">Interesses aceitos pela Meta</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <MetaTargetingValidator />
          </div>
        </div>
      ) : null}
    </>
  );
}
