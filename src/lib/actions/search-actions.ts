"use server";

import { globalSearch } from "@/lib/services/search-service";
import type { SearchResult } from "@/types/domain";

export async function searchAction(term: string): Promise<SearchResult[]> {
  try {
    return await globalSearch(term);
  } catch {
    return [];
  }
}
