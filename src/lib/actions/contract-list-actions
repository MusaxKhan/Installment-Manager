"use server";

import { listContracts } from "../services/contract-service";
import type { ContractRow } from "../../types/database";

export async function getContractsList(status?: ContractRow["status"]) {
  return listContracts({ status });
}