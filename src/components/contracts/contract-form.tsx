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
import { Loader2, WifiOff, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalculationPreview } from "./calculation-preview";
import { CashInHandNotice } from "./cash-in-hand-notice";
import { createContractAction } from "@/lib/actions/contract-actions";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { enqueueOperation } from "@/lib/offline/outbox";
import { offlineDb } from "@/lib/offline/db";
import { contractSchema } from "@/lib/validations/contract";
import { toDateInputValue } from "@/lib/utils/format";
import { updateContractAction } from "@/lib/actions/contract-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
interface ClientOption {
  id: number;
  label: string;
  isBlacklisted?: boolean;
  maxOverdueMonths?: number;
}

export function ContractForm({
  clients,
  defaultClientId,
  mode = "create",
  contractId,
  hasPayments = false,
  initialValues,
  cashInHand,
}: {
  clients: ClientOption[];
  defaultClientId?: number;

  mode?: "create" | "edit";
  contractId?: number;
  hasPayments?: boolean;
  /** Current cash-in-hand, used to warn before a purchase that would
   * exceed available cash and offer a shortcut to take a loan. Only
   * meaningful for new contracts — omitted entirely on edit. */
  cashInHand?: number;

  initialValues?: {
    clientId: number;
    productName: string;
    productDescription?: string;
    initiatedBy: string;
    purchasePrice: number;
    profitPercent: number;
    numberOfInstallments: number;
    startDate: string;
    hasGuarantor: boolean;
    guarantor?: {
      name?: string | null;
      phone?: string | null;
      address?: string | null;
      cnic?: string | null;
    };
  };
}) {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
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
        isBlacklisted: c.isBlacklisted,
        maxOverdueMonths: c.maxOverdueMonths,
      }));

  const [clientId, setClientId] = React.useState<string>(
    initialValues?.clientId
      ? String(initialValues.clientId)
      : defaultClientId
        ? String(defaultClientId)
        : ""
  );
  const selectedClient = clientOptions.find(
    (c) => String(c.id) === clientId
  );
  const [purchasePrice, setPurchasePrice] =
    React.useState<number>(
      initialValues?.purchasePrice ?? 0
    );
  const [profitPercent, setProfitPercent] =
    React.useState<number>(
      initialValues?.profitPercent ?? 0
    );
  const [numberOfInstallments, setNumberOfInstallments] =
    React.useState<number>(
      initialValues?.numberOfInstallments ?? 12
    );
  const [hasGuarantor, setHasGuarantor] =
    React.useState(
      initialValues?.hasGuarantor ?? false
    );

    function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (mode === "edit") {
      const formData = new FormData(e.currentTarget);
      submitContract(formData);
      return;
    }

    setShowConfirm(true);
  }
  async function submitContract(
    formData: FormData
  ) {
    setError(null);

    if (isOnline) {
      setIsPending(true);
      const result =
        mode === "edit"
          ? await updateContractAction(
              contractId!,
              formData
            )
          : await createContractAction(
              null,
              formData
            );
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

      if (mode === "edit") {
        if (!contractId) {
          setError(
            "Missing contract id — can't queue this edit. Please reload the page."
          );
          return;
        }
        if (hasPayments) {
          // updateContractRecord (the server-side function this syncs
          // to) refuses to change financial terms once payments exist.
          // Catching this offline too, rather than letting it queue
          // and only fail at sync time, avoids a confusing delay
          // between "looks queued" and "actually rejected."
          const financialFieldsChanged =
            parsed.data.purchasePrice !== initialValues?.purchasePrice ||
            parsed.data.profitPercent !== initialValues?.profitPercent ||
            parsed.data.numberOfInstallments !==
              initialValues?.numberOfInstallments ||
            parsed.data.startDate !== initialValues?.startDate;
          if (financialFieldsChanged) {
            setError(
              "Financial terms can't be changed once payments exist on this contract."
            );
            return;
          }
        }
        await enqueueOperation("update_contract", {
          ...payload,
          contractId,
        });
        toast.success(
          "Contract changes queued — will sync once you're back online."
        );
        router.push(`/contracts/${contractId}`);
        return;
      }

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
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="space-y-6 lg:col-span-2"
      >
        {!isOnline && (
          <Badge variant="overdue" className="flex w-fit items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5" />
            Offline — this will be queued and synced later
          </Badge>
        )}

        <input type="hidden" name="clientId" value={clientId} />

        <div className="space-y-1.5">
          <Label htmlFor="client-select">Client</Label>
          <Select
            value={clientId}
            onValueChange={setClientId}
            required
            disabled={mode === "edit"}
          >
            <SelectTrigger id="client-select">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clientOptions.map((client) => (
                <SelectItem key={client.id} value={String(client.id)}>
                  <span
                    className={cn(
                      client.isBlacklisted && "text-status-overdue"
                    )}
                  >
                    {client.isBlacklisted && "⛔ "}
                    {client.label}
                    {client.isBlacklisted &&
                      ` (${client.maxOverdueMonths}mo overdue)`}
                  </span>
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
          {selectedClient?.isBlacklisted && (
            <div className="flex items-start gap-2 rounded-md border border-status-overdue/30 bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue">
              <Ban className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                <strong>This client is blacklisted.</strong> They&apos;ve been
                overdue for {selectedClient.maxOverdueMonths} months on a
                previous contract. Consider their repayment history before
                creating a new contract.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="productName">Product Name</Label>
            <Input
              id="productName"
              name="productName"
              required
              defaultValue={initialValues?.productName}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="initiatedBy">Initiated By</Label>
            <Input
              id="initiatedBy"
              name="initiatedBy"
              required
              defaultValue={initialValues?.initiatedBy}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="productDescription">Product Description</Label>
          <Textarea
            id="productDescription"
            name="productDescription"
            defaultValue={
              initialValues?.productDescription
            }
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
              disabled={hasPayments}
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
              disabled={hasPayments}
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
              disabled={hasPayments}
            />
          </div>
        </div>

        {cashInHand !== undefined && (
          <CashInHandNotice
            cashInHand={cashInHand}
            purchasePrice={purchasePrice}
          />
        )}

        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={
              initialValues?.startDate
                ? initialValues.startDate
                : toDateInputValue(new Date())
            }
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
              <Input id="guarantorName" name="guarantorName" defaultValue={ initialValues?.guarantor?.name ?? "" } />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guarantorPhone">Guarantor Phone</Label>
              <Input id="guarantorPhone" name="guarantorPhone" defaultValue={ initialValues?.guarantor?.phone ?? "" } />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guarantorCnic">Guarantor CNIC</Label>
              <Input id="guarantorCnic" name="guarantorCnic" defaultValue={ initialValues?.guarantor?.cnic ?? "12345-1234567-1" } />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guarantorAddress">Guarantor Address</Label>
              <Input id="guarantorAddress" name="guarantorAddress" defaultValue={ initialValues?.guarantor?.address ?? "" } />
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
              mode === "edit"
                ? "Update Contract"
                : "Create Contract"
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

      <AlertDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Create Contract?
            </AlertDialogTitle>

            <AlertDialogDescription asChild>
              <div>
                <p>Please review carefully before continuing.</p>

                <p className="mt-4">
                  The following fields can only be changed until the first payment is recorded:
                </p>

                <ul className="mt-2 list-disc pl-5">
                  <li>Purchase Price</li>
                  <li>Profit Percentage</li>
                  <li>Number of Installments</li>
                  <li>Start Date</li>
                  <li>Initiated By</li>
                </ul>

                <p className="mt-4">
                  After any payment is recorded, the financial structure of the contract becomes locked.
                </p>

                <p className="mt-4">
                  Product details and guarantor information can still be edited later.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Go Back
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={async () => {
                if (!formRef.current) return;

                const formData = new FormData(
                  formRef.current
                );

                await submitContract(formData);
              }}
            >
              Create Contract
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}