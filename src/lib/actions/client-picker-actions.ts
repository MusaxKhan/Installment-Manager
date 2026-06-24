"use server";

import { listClients } from "@/lib/services/client-service";

export async function getClientsForPicker() {
  const clients = await listClients();
  return clients.map((c) => ({
    id: c.id,
    label: `${c.clientCode} — ${c.name}`,
  }));
}
