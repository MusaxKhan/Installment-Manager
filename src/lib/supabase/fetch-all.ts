/**
 * Supabase (via PostgREST) caps every query at a server-side row limit
 * (`db.max_rows` in your project's API settings — commonly 1000,
 * sometimes lower). Hitting that cap produces NO error — the query
 * just silently returns exactly that many rows and stops. Any query
 * that's supposed to return "all rows" but doesn't explicitly paginate
 * around this will quietly start dropping data the moment the table
 * crosses that threshold, with zero warning.
 *
 * This walks a query in pages via `.range()` until a page comes back
 * smaller than the page size, guaranteeing every row is fetched
 * regardless of what max_rows is set to on this or any other Supabase
 * project.
 *
 * Usage — pass a function that applies `.range(from, to)` to a FRESH
 * query each call (a Supabase query builder can only be awaited once,
 * so it can't be reused across pages):
 *
 *   const contracts = await fetchAllRows((from, to) =>
 *     supabase.from("contracts").select("*").order("id").range(from, to)
 *   );
 */
export async function fetchAllRows<T>(
  buildPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }
    if (!data || data.length === 0) break;

    results.push(...data);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return results;
}