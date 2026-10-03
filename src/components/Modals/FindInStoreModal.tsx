import React, { useEffect, useState } from 'react';
import { X, MapPin, Phone, Clock, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { SunglassesProduct } from '../../types';
import { getStoresAPI, checkStoreStockAPI, StoreStockAPI } from '../../services/api';

interface FindInStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: SunglassesProduct;
}

export const FindInStoreModal: React.FC<FindInStoreModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const [stores, setStores] = useState<StoreStockAPI['store'][]>([]);
  const [stockMap, setStockMap] = useState<Record<string, { inStock: boolean; count: number }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const loadStoreStock = async () => {
      setLoading(true);
      const storeList = await getStoresAPI();
      setStores(storeList);

      const stockResults: Record<string, { inStock: boolean; count: number }> = {};
      for (const store of storeList) {
        const stock = await checkStoreStockAPI(store.id, product.id);
        if (stock) {
          stockResults[store.id] = { inStock: stock.inStock, count: stock.count };
        }
      }
      setStockMap(stockResults);
      setLoading(false);
    };

    loadStoreStock();
  }, [isOpen, product.id]);

  if (!isOpen) return null;

  const filteredStores = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.zip.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-stone-950 border border-white/10 text-white rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400">
              <MapPin className="w-3.5 h-3.5" />
              <span>Official Sunglass Hut Retail Network</span>
            </div>
            <h2 className="text-xl font-serif text-white mt-1">
              Find In Store: {product.brand} {product.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-white/10 bg-white/5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search by city, state, or ZIP code (e.g. New York, Miami, 10020)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-900 border border-white/10 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>
        </div>

        {/* Stores List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-stone-400 text-sm font-mono">
              Checking real-time store inventory...
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">
              No Sunglass Hut stores found matching your search.
            </div>
          ) : (
            filteredStores.map((store) => {
              const stock = stockMap[store.id] || { inStock: false, count: 0 };

              return (
                <div
                  key={store.id}
                  className="p-4 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl transition-colors space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white">{store.name}</h3>
                      <p className="text-xs text-stone-400">
                        {store.address}, {store.city}, {store.state} {store.zip}
                      </p>
                    </div>

                    {stock.inStock ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-mono font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>In Stock ({stock.count} available)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-mono font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Order for Pickup</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-[11px] text-stone-400 font-mono pt-1 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-stone-500" />
                      <span>{store.phone}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-500" />
                      <span>{store.hours}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-stone-500">
                      Eligible for Free 2-Hour In-Store Virtual Mirror Try-On
                    </span>
                    <button
                      onClick={() => alert(`Reserved ${product.name} at ${store.name} for same-day VIP fitting!`)}
                      className="px-3.5 py-1.5 bg-white text-stone-950 font-semibold text-xs uppercase tracking-wider rounded-lg hover:bg-stone-200 transition-colors"
                    >
                      Reserve for Fitting
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-900 border-t border-white/10 flex items-center justify-between text-xs text-stone-400">
          <span>Official Luxottica / Sunglass Hut Real-Time Stock Feed</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium uppercase tracking-wider transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
