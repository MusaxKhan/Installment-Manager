"use server";

import { listClients } from "@/lib/services/client-service";

export async function getClientsForPicker() {
  const clients = await listClients();
  return clients.map((c) => ({
    id: c.id,
    label: `${c.clientCode} — ${c.name}`,
  }));
}

/** Full client list for the clients page table — used by the online path */
export async function getClientsList(search?: string) {
  return listClients({ search });
}