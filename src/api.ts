export interface Health {
  status: 'ok';
}

export async function fetchHealth(): Promise<Health> {
  const res = await fetch('/api/health');

  if (!res.ok) {
    throw new Error(`Health check failed: ${String(res.status)}`);
  }

  return (await res.json()) as Health;
}
