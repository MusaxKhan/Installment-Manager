"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, User, FileText, Landmark, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { searchAction } from "@/lib/actions/search-actions";
import type { SearchResult } from "@/types/domain";

export function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (term.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setIsLoading(true);
    const handle = setTimeout(async () => {
      const found = await searchAction(term);
      setResults(found);
      setOpen(true);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(handle);
  }, [term]);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    setTerm("");
    router.push(result.href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search clients, contracts, CNIC..."
            className="pl-9"
            onFocus={() => results.length > 0 && setOpen(true)}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {results.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
            No matches for &ldquo;{term}&rdquo;
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {results.map((result) => (
              <li key={`${result.type}-${result.id}`}>
                <button
                  onClick={() => handleSelect(result)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {result.type === "client" ? (
                    <User className="h-4 w-4 text-muted-foreground" />
                  ) : result.type === "investor" ? (
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">{result.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.subtitle}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
