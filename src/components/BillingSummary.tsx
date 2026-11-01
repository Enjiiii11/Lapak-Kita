import { Package, Scale } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import type { UsageMeter } from '@/types/marketplace';

type BillingSummaryProps = {
  subtotalIdr: number;
  meters: UsageMeter[];
  totalIdr: number;
};

const METER_LABELS: Record<UsageMeter['metric'], { label: string; unit: string; icon: typeof Package }> = {
  units: { label: 'Item handling', unit: 'units', icon: Package },
  weight_kg: { label: 'Shipping weight', unit: 'kg', icon: Scale },
};

export default function BillingSummary({ subtotalIdr, meters, totalIdr }: BillingSummaryProps) {
  const usageTotal = meters.reduce((sum, meter) => sum + meter.cost_idr, 0);

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-stone-600">
          <span>Items subtotal</span>
          <span className="font-medium text-stone-900">{formatRupiah(subtotalIdr)}</span>
        </div>
      </div>

      <div className="space-y-3 rounded-xl bg-stone-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Metered usage</p>
        {meters.map((meter) => {
          const meta = METER_LABELS[meter.metric];
          const Icon = meta.icon;
          return (
            <div key={meter.metric} className="flex items-start justify-between gap-3 text-sm">
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 text-orange-500" aria-hidden="true" />
                <div>
                  <p className="font-medium text-stone-800">{meta.label}</p>
                  <p className="text-xs text-stone-500">
                    {meter.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })} {meta.unit} x{' '}
                    {formatRupiah(meter.unit_rate_idr)}
                    {meter.metric === 'weight_kg' ? '/kg' : '/unit'}
                  </p>
                </div>
              </div>
              <span className="font-medium text-stone-900">{formatRupiah(meter.cost_idr)}</span>
            </div>
          );
        })}
        <div className="flex justify-between border-t border-stone-200 pt-3 text-sm">
          <span className="text-stone-600">Usage cost</span>
          <span className="font-semibold text-stone-900">{formatRupiah(usageTotal)}</span>
        </div>
      </div>

      <div className="flex items-end justify-between border-t border-stone-200 pt-4">
        <span className="font-semibold text-stone-900">Total</span>
        <span className="text-2xl font-extrabold text-orange-600">{formatRupiah(totalIdr)}</span>
      </div>
    </div>
  );
}
