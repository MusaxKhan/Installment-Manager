import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getContractById } from "@/lib/services/contract-service";
import { getClientsForPicker } from "@/lib/actions/client-picker-actions";
import { ContractForm } from "@/components/contracts/contract-form";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [contract, clients] = await Promise.all([
    getContractById(Number(id)),
    getClientsForPicker(),
  ]);

  if (!contract) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/contracts/${contract.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to Contract
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit Contract</CardTitle>
        </CardHeader>

        <CardContent>
          <ContractForm
            clients={clients}
            mode="edit"
            contractId={contract.id}
            hasPayments={contract.payments.length > 0}
            initialValues={{
                clientId: contract.client.id,
                productName: contract.productName,
                productDescription: contract.productDescription ?? "",
                initiatedBy: contract.initiatedBy,
                purchasePrice: contract.purchasePrice,
                profitPercent: contract.profitPercent,
                numberOfInstallments: contract.numberOfInstallments,
                startDate: contract.startDate,
                hasGuarantor: !!contract.guarantor,
                guarantor: {
                name: contract.guarantor?.name ?? "",
                phone: contract.guarantor?.phone ?? "",
                address: contract.guarantor?.address ?? "",
                cnic: contract.guarantor?.cnic ?? "",
                },
            }}
            />
        </CardContent>
      </Card>
    </div>
  );
}