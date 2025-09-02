import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  urlOrMethod: string,
  methodOrData?: string,
  dataOrUndefined?: unknown | undefined,
): Promise<any> {
  let url: string;
  let method: string;
  let data: unknown | undefined;

  // Support both patterns: apiRequest(url) and apiRequest(url, method, data)
  if (methodOrData && typeof methodOrData === 'string' && ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(methodOrData.toUpperCase())) {
    // New pattern: apiRequest(url, method, data)
    url = urlOrMethod;
    method = methodOrData.toUpperCase();
    data = dataOrUndefined;
  } else {
    // Old pattern: apiRequest(url) or apiRequest(url, data) (defaults to GET)
    url = urlOrMethod;
    method = 'GET';
    data = methodOrData;
  }

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
