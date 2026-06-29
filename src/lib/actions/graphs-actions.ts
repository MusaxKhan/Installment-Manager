"use server";

import { getGraphsData } from "@/lib/services/graphs-service";

export async function fetchGraphsData() {
  return getGraphsData();
}