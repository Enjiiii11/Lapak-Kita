export function formatRupiah(amount: number): string {
  return `Rp${Math.round(amount).toLocaleString('id-ID')}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatWeight(kg: number): string {
  return `${kg.toLocaleString('en-US', { maximumFractionDigits: 2 })} kg`;
}
