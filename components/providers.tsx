"use client";

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster, toast } from "sonner";
import { ThemeApplier } from "@/components/ThemeApplier";
import { CommandPalette } from "@/components/CommandPalette";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // Allow individual mutations to opt-out with meta: { silent: true }
            if (mutation.options.meta?.silent) return;
            const msg =
              (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              (error as Error)?.message ??
              "An error occurred";
            toast.error(msg);
          },
        }),
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (query.meta?.silent) return;
            const msg =
              (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              (error as Error)?.message ??
              "Failed to load data";
            // Only toast on background refetch failures, not initial loads
            if (query.state.data !== undefined) {
              toast.error(msg);
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="bottom-right"
        theme="dark"
        richColors
        toastOptions={{
          style: {
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            color: "white",
            fontFamily: "var(--font-sans)",
          },
        }}
      />
      <ThemeApplier />
      <CommandPalette />
      {children}
    </QueryClientProvider>
  );
}

