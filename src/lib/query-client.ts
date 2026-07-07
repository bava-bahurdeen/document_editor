import { QueryClient } from "@tanstack/react-query";

// Global TanStack Query client with standard caching and retry configurations
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // Data is considered fresh for 30 seconds
      gcTime: 1000 * 60 * 5, // Garbage collect unused caches after 5 minutes
      refetchOnWindowFocus: true, // Auto-refetch when user focuses page
      retry: (failureCount, error: any) => {
        // Do not retry on authorization or client input errors
        if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
          return false;
        }
        return failureCount < 3; // Max 3 retries
      },
    },
  },
});
