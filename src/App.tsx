import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AuthScreen from '@/components/AuthScreen';
import ResetPasswordScreen from '@/components/ResetPasswordScreen';
import AppHeader from '@/components/AppHeader';
import ShopPage from '@/pages/ShopPage';
import CartPage from '@/pages/CartPage';
import OrdersPage from '@/pages/OrdersPage';
import SellerPage from '@/pages/SellerPage';
import AdminPage from '@/pages/AdminPage';
import { supabase } from '@/lib/supabase';
import type { View } from '@/types/marketplace';

function MarketplaceShell() {
  const { user } = useAuth();
  const [view, setView] = useState<View>('shop');
  const [cartCount, setCartCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const userId = user?.id ?? null;

  const refreshCartCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('cart_items')
      .select('id', { count: 'exact', head: true });
    if (!error) setCartCount(count ?? 0);
  }, []);

  useEffect(() => {
    void refreshCartCount();
  }, [refreshCartCount]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase
      .from('app_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active && !error) setIsAdmin(data !== null);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div className="min-h-screen bg-stone-50">
      <AppHeader view={view} onNavigate={setView} cartCount={cartCount} isAdmin={isAdmin} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {view === 'shop' && <ShopPage onCartChange={refreshCartCount} onGoToCart={() => setView('cart')} />}
        {view === 'cart' && (
          <CartPage
            onCartChange={refreshCartCount}
            onGoToOrders={() => setView('orders')}
            onGoToShop={() => setView('shop')}
          />
        )}
        {view === 'orders' && <OrdersPage />}
        {view === 'selling' && <SellerPage />}
        {view === 'admin' && isAdmin && <AdminPage />}
      </main>
    </div>
  );
}

function Root() {
  const { session, loading, recovering } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" aria-label="Loading" />
      </div>
    );
  }

  if (recovering) return <ResetPasswordScreen />;
  if (!session) return <AuthScreen />;

  return <MarketplaceShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
