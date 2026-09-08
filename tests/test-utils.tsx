/**
 * Shared component-test render helper. Wraps the unit under test with
 * the providers a typical app page expects (React Query, wine data, …).
 *
 * Currently minimal — agents B/C will extend this with WineDataProvider,
 * an auth provider stub, etc. Importing from here (instead of calling
 * RTL's `render` directly) keeps the wiring in one place so future
 * provider additions are a one-line change.
 */
import * as React from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface ProviderOptions extends RenderOptions {
  /** Override the default QueryClient — handy when a test needs to seed
   * the cache or assert on it after the render. */
  queryClient?: QueryClient;
}

/** Build a QueryClient with retries off so tests fail fast instead of
 * waiting for a 3-attempt exponential backoff on a mocked-error path. */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: React.ReactElement,
  { queryClient, ...options }: ProviderOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const client = queryClient ?? makeQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const utils = render(ui, { wrapper: Wrapper, ...options });
  return { ...utils, queryClient: client };
}

// Re-export common RTL helpers so tests can import everything from one place.
export * from "@testing-library/react";
