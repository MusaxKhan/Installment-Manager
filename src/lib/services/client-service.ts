import { createClient } from "@/lib/supabase/server";
import { mapClient, mapContract } from "./mappers";
import type { Client, ClientWithContracts } from "@/types/domain";
import type { ClientFormValues } from "@/lib/validations/client";

export class ClientServiceError extends Error {}

/** Generates the next sequential client code via the DB sequence function */
async function getNextClientCode(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const { data, error } = await supabase.rpc("next_client_code");
  if (error || !data) {
    throw new ClientServiceError(
      `Failed to generate client code: ${error?.message ?? "unknown error"}`
    );
  }
  return data as string;
}

export async function listClients(params?: {
  search?: string;
  includeDeleted?: boolean;
}): Promise<Client[]> {
  const supabase = await createClient();
  let query = supabase.from("clients").select("*");

  if (!params?.includeDeleted) {
    query = query.eq("is_deleted", false);
  }

  if (params?.search && params.search.trim().length > 0) {
    const term = params.search.trim();
    query = query.or(
      `name.ilike.%${term}%,cnic.ilike.%${term}%,phone.ilike.%${term}%,client_code.ilike.%${term}%`
    );
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    throw new ClientServiceError(`Failed to list clients: ${error.message}`);
  }
  return (data ?? []).map(mapClient);
}

export async function getClientById(
  id: number
): Promise<ClientWithContracts | null> {
  const supabase = await createClient();

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (clientError) {
    throw new ClientServiceError(
      `Failed to fetch client: ${clientError.message}`
    );
  }
  if (!clientRow) return null;

  const { data: contractRows, error: contractError } = await supabase
    .from("contracts")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  if (contractError) {
    throw new ClientServiceError(
      `Failed to fetch client contracts: ${contractError.message}`
    );
  }

  return {
    ...mapClient(clientRow),
    contracts: (contractRows ?? []).map(mapContract),
  };
}

export async function createClientRecord(
  values: ClientFormValues
): Promise<Client> {
  const supabase = await createClient();
  const clientCode = await getNextClientCode(supabase);

  const { data, error } = await supabase
    .from("clients")
    .insert({
      client_code: clientCode,
      name: values.name,
      cnic: values.cnic || null,
      phone: values.phone || null,
      address: values.address || null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ClientServiceError(
        "A client with this CNIC already exists."
      );
    }
    throw new ClientServiceError(`Failed to create client: ${error.message}`);
  }

  return mapClient(data);
}

export async function updateClientRecord(
  id: number,
  values: ClientFormValues
): Promise<Client> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .update({
      name: values.name,
      cnic: values.cnic || null,
      phone: values.phone || null,
      address: values.address || null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ClientServiceError(
        "A client with this CNIC already exists."
      );
    }
    throw new ClientServiceError(`Failed to update client: ${error.message}`);
  }

  return mapClient(data);
}

/** Soft delete — preserves history, hides from default listings */
export async function softDeleteClient(id: number): Promise<void> {
  const supabase = await createClient();

  // Guard: don't allow deleting a client with active/overdue contracts.
  const { count, error: countError } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("client_id", id)
    .in("status", ["ACTIVE", "OVERDUE"]);

  if (countError) {
    throw new ClientServiceError(
      `Failed to check client contracts: ${countError.message}`
    );
  }
  if ((count ?? 0) > 0) {
    throw new ClientServiceError(
      "Cannot delete a client with active or overdue contracts."
    );
  }

  const { error } = await supabase
    .from("clients")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) {
    throw new ClientServiceError(`Failed to delete client: ${error.message}`);
  }
}
