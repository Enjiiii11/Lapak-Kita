import { useEffect, useState } from 'react';
import { KeyRound, LogOut, Package, ReceiptText, ShieldCheck, ShoppingBag, ShoppingCart, Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { View } from '@/types/marketplace';
import ChangePasswordModal from '@/components/ChangePasswordModal';

type AppHeaderProps = {
  view: View;
  onNavigate: (view: View) => void;
  cartCount: number;
  isAdmin: boolean;
};

const NAV_ITEMS: { view: View; label: string; icon: typeof ShoppingBag; adminOnly?: boolean }[] = [
  { view: 'shop', label: 'Shop', icon: ShoppingBag },
  { view: 'cart', label: 'Cart', icon: ShoppingCart },
  { view: 'orders', label: 'Orders', icon: ReceiptText },
  { view: 'selling', label: 'Sell', icon: Package },
  { view: 'admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
];

export default function AppHeader({ view, onNavigate, cartCount, isAdmin }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const displayName = user?.full_name ?? 'Account';

  return (
    <header
      className={`sticky top-0 z-40 border-b border-stone-200 bg-white transition-shadow duration-300 ${
        scrolled ? 'shadow-md' : 'shadow-sm'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('shop')}
          className="flex items-center gap-2 rounded-lg transition hover:opacity-80"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white">
            <Store className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-stone-900">Lapak Kita</span>
        </button>

        <nav className="flex items-center gap-1 rounded-2xl bg-stone-100 p-1" aria-label="Main">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map(({ view: target, label, icon: Icon }) => {
            const active = view === target;
            return (
              <button
                key={target}
                type="button"
                onClick={() => onNavigate(target)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
                {target === 'cart' && cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden max-w-[12rem] min-w-0 text-right md:block" title={displayName}>
            <span className="block truncate text-sm font-medium text-stone-700">{displayName}</span>
          </div>
          <button
            type="button"
            onClick={() => setChangingPassword(true)}
            className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Change password</span>
            <span className="sr-only sm:hidden">Change password</span>
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </header>
  );
}
