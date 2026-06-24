"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, WifiOff } from "lucide-react";
import { CalculationPreview } from "./calculation-preview";
import { createContractAction } from "@/lib/actions/contract-actions";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { enqueueOperation } from "@/lib/offline/outbox";
import { offlineDb } from "@/lib/offline/db";
import { contractSchema } from "@/lib/validations/contract";
import { toDateInputValue } from "@/lib/utils/format";

interface ClientOption {
  id: number;
  label: string;
}

export function ContractForm({
  clients,
  defaultClientId,
}: {
  clients: ClientOption[];
  defaultClientId?: number;
}) {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Offline: source the client picker from the local cache instead of
  // the server-rendered list (which may be stale or simply unavailable
  // if this page was opened fresh while offline via a cached shell).
  const cachedClients = useLiveQuery(
    () => offlineDb.clients.filter((c) => !c.isDeleted).toArray(),
    []
  );
  const clientOptions: ClientOption[] = isOnline
    ? clients
    : (cachedClients ?? []).map((c) => ({
        id: c.id,
        label: `${c.clientCode} — ${c.name}`,
      }));

  const [clientId, setClientId] = React.useState<string>(
    defaultClientId ? String(defaultClientId) : ""
  );
  const [purchasePrice, setPurchasePrice] = React.useState<number>(0);
  const [profitPercent, setProfitPercent] = React.useState<number>(0);
  const [numberOfInstallments, setNumberOfInstallments] =
    React.useState<number>(12);
  const [hasGuarantor, setHasGuarantor] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    if (isOnline) {
      setIsPending(true);
      const result = await createContractAction(null, formData);
      setIsPending(false);
      if (result && !result.success) {
        setError(result.error ?? "Something went wrong.");
      }
      return;
    }

    // Offline path: validate locally with the same schema the server
    // uses, then queue. The actual profit/installment calculation is
    // re-derived server-side at sync time from purchasePrice/profitPercent
    // /numberOfInstallments — we never trust or send a pre-computed
    // schedule from the offline client.
    const selectedClientId = Number(formData.get("clientId"));
    const isPendingClient = selectedClientId < 0;

    // If the chosen client was itself created offline and hasn't synced
    // yet, it doesn't have a real server ID — only a negative temp ID.
    // contractSchema requires a positive clientId (correctly, since
    // that's what the server needs), so for this case we validate
    // everything else normally but carry the temp ID separately as a
    // dependency the sync engine must resolve to a real ID first.
    const values = {
      clientId: isPendingClient ? 1 : selectedClientId, // placeholder, replaced below if valid
      productName: formData.get("productName"),
      productDescription: formData.get("productDescription"),
      initiatedBy: formData.get("initiatedBy"),
      purchasePrice: formData.get("purchasePrice"),
      profitPercent: formData.get("profitPercent"),
      numberOfInstallments: formData.get("numberOfInstallments"),
      startDate: formData.get("startDate"),
      hasGuarantor,
      guarantor: hasGuarantor
        ? {
            name: formData.get("guarantorName"),
            phone: formData.get("guarantorPhone"),
            address: formData.get("guarantorAddress"),
            cnic: formData.get("guarantorCnic"),
          }
        : undefined,
    };

    const parsed = contractSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input.");
      return;
    }

    setIsPending(true);
    try {
      const payload = isPendingClient
        ? { ...parsed.data, clientId: selectedClientId } // restore the real (negative) temp id
        : parsed.data;

      await enqueueOperation("create_contract", payload);
      toast.success(
        isPendingClient
          ? "Contract queued — it'll sync right after the new client does, and generate its installment schedule then."
          : "Contract queued — will sync and generate its installment schedule once you're back online."
      );
      router.push("/contracts");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-2">
        {!isOnline && (
          <Badge variant="overdue" className="flex w-fit items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5" />
            Offline — this will be queued and synced later
          </Badge>
        )}

        <input type="hidden" name="clientId" value={clientId} />

        <div className="space-y-1.5">
          <Label htmlFor="client-select">Client</Label>
          <Select value={clientId} onValueChange={setClientId} required>
            <SelectTrigger id="client-select">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clientOptions.map((client) => (
                <SelectItem key={client.id} value={String(client.id)}>
                  {client.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {clientOptions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {isOnline
                ? "No clients yet — create one first."
                : "No clients cached locally yet. Connect once to cache your client list for offline use."}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="productName">Product Name</Label>
            <Input id="productName" name="productName" required placeholder="e.g. Honda CD70" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="initiatedBy">Initiated By</Label>
            <Input id="initiatedBy" name="initiatedBy" required placeholder="Staff member name" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="productDescription">Product Description</Label>
          <Textarea
            id="productDescription"
            name="productDescription"
            placeholder="Model, color, condition, anything worth noting"
          />
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="purchasePrice">Purchase Price (Rs.)</Label>
            <Input
              id="purchasePrice"
              name="purchasePrice"
              type="number"
              min="0"
              step="0.01"
              required
              value={purchasePrice || ""}
              onChange={(e) => setPurchasePrice(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profitPercent">Profit %</Label>
            <Input
              id="profitPercent"
              name="profitPercent"
              type="number"
              min="0"
              step="0.01"
              required
              value={profitPercent || ""}
              onChange={(e) => setProfitPercent(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="numberOfInstallments">No. of Installments</Label>
            <Input
              id="numberOfInstallments"
              name="numberOfInstallments"
              type="number"
              min="1"
              step="1"
              required
              value={numberOfInstallments || ""}
              onChange={(e) => setNumberOfInstallments(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={toDateInputValue(new Date())}
            className="max-w-xs"
          />
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Checkbox
            id="hasGuarantor"
            name="hasGuarantor"
            checked={hasGuarantor}
            onCheckedChange={(checked) => setHasGuarantor(checked === true)}
          />
          <Label htmlFor="hasGuarantor" className="cursor-pointer">
            This contract has a guarantor
          </Label>
        </div>

        {hasGuarantor && (
          <div className="grid grid-cols-1 gap-4 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="guarantorName">Guarantor Name</Label>
              <Input id="guarantorName" name="guarantorName" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guarantorPhone">Guarantor Phone</Label>
              <Input id="guarantorPhone" name="guarantorPhone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guarantorCnic">Guarantor CNIC</Label>
              <Input id="guarantorCnic" name="guarantorCnic" placeholder="12345-1234567-1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guarantorAddress">Guarantor Address</Label>
              <Input id="guarantorAddress" name="guarantorAddress" />
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating contract...
              </>
            ) : (
              "Create Contract"
            )}
          </Button>
        </div>
      </form>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <CalculationPreview
          purchasePrice={purchasePrice}
          profitPercent={profitPercent}
          numberOfInstallments={numberOfInstallments}
        />
      </div>
    </div>
  );
}
