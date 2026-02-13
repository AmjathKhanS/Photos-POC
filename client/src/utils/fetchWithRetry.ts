/**
 * Fetch with automatic retry on connection errors
 * Useful for handling server startup delays
 */

interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 5,
    retryDelay = 1000,
    timeout = 10000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If response is ok or it's a real error (not connection issue), return it
      if (response.ok || response.status >= 400) {
        return response;
      }

      // If it's a server error (5xx), retry
      if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      return response;
    } catch (error: any) {
      lastError = error;

      // Only retry on network errors (connection refused, timeout, etc.)
      const isNetworkError =
        error.name === 'TypeError' ||
        error.name === 'AbortError' ||
        error.message?.includes('fetch') ||
        error.message?.includes('network');

      if (!isNetworkError || attempt >= maxRetries) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      const delay = retryDelay * Math.pow(1.5, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}
