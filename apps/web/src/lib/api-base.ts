export function getApiBase(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL_BROWSER ??
      '/api'
    );
  }

  return (
    process.env.NEXT_PUBLIC_API_BASE_URL_BROWSER ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    '/api'
  );
}
