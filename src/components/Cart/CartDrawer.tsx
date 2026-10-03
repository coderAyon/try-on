import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Tag, Check, ShieldCheck } from 'lucide-react';
import { CartAPIResponse, updateCartItemAPI, removeFromCartAPI, applyCouponAPI } from '../../services/api';
import { SUNGLASSES_CATALOG } from '../../data/catalog';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartAPIResponse | null;
  onCartChange: (newCart: CartAPIResponse) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onCartChange,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderComplete, setOrderComplete] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdateQuantity = async (itemId: string, currentQty: number, delta: number) => {
    const newQty = currentQty + delta;
    const res = await updateCartItemAPI(itemId, newQty);
    if (res) onCartChange(res);
  };

  const handleRemove = async (itemId: string) => {
    const res = await removeFromCartAPI(itemId);
    if (res) onCartChange(res);
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setIsApplying(true);
    try {
      const res = await applyCouponAPI(couponCode.trim());
      if (res.success) {
        setCouponMessage({ text: res.message, isError: false });
        onCartChange(res.cart);
        setCouponCode('');
      } else {
        setCouponMessage({ text: res.message, isError: true });
      }
    } catch {
      setCouponMessage({ text: 'Failed to apply coupon', isError: true });
    } finally {
      setIsApplying(false);
    }
  };

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            fullName: 'Alexander Vance',
            email: 'alexander.vance@sunglasshut.com',
            phone: '+1 (555) 234-5678',
            address: '742 Evergreen Terrace',
            city: 'New York',
            state: 'NY',
            zip: '10001',
          },
          paymentMethod: 'Apple Pay / Stripe Verified',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderComplete(data.data.orderNumber);
        onCartChange({
          items: [],
          appliedCoupon: null,
          subtotal: 0,
          discountAmount: 0,
          taxAmount: 0,
          shippingAmount: 0,
          total: 0,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-stone-950 border-l border-white/10 text-white flex flex-col h-full shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-serif tracking-widest uppercase">Shopping Bag</h2>
            <span className="text-xs bg-white/10 text-stone-300 px-2 py-0.5 rounded-full font-mono">
              {cart?.items.reduce((acc, i) => acc + i.quantity, 0) || 0}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {orderComplete ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-serif text-white">Order Confirmed!</h3>
              <p className="text-sm text-stone-400">
                Thank you for your order. Order reference:{' '}
                <span className="text-amber-400 font-mono font-bold">{orderComplete}</span>
              </p>
              <p className="text-xs text-stone-500">
                Confirmation & tracking details have been sent to your email.
              </p>
              <button
                onClick={() => setOrderComplete(null)}
                className="mt-6 px-6 py-2.5 bg-white text-black font-semibold text-xs uppercase tracking-wider rounded-lg hover:bg-stone-200 transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          ) : !cart || cart.items.length === 0 ? (
            <div className="text-center py-16 text-stone-400 space-y-3">
              <ShoppingBag className="w-12 h-12 mx-auto stroke-[1.5] text-stone-600" />
              <p className="text-base font-serif text-stone-300">Your bag is empty</p>
              <p className="text-xs text-stone-500">
                Try on our iconic collection in the Virtual Mirror and add your favorite look.
              </p>
            </div>
          ) : (
            cart.items.map((item) => {
              const product = SUNGLASSES_CATALOG.find((p) => p.id === item.productId);
              const variant = product?.variants[item.variantIndex] || product?.variants[0];

              return (
                <div
                  key={item.id}
                  className="flex gap-4 p-3.5 bg-white/5 border border-white/10 rounded-xl"
                >
                  {/* Swatch & icon */}
                  <div
                    className="w-16 h-16 rounded-lg border border-white/20 flex items-center justify-center relative overflow-hidden flex-shrink-0"
                    style={{ backgroundColor: variant?.frameHex || '#111' }}
                  >
                    <div
                      className="w-8 h-8 rounded-full opacity-80"
                      style={{ backgroundColor: variant?.lensHex || '#253d2c' }}
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-stone-400 font-mono">
                          {product?.brand || 'Ray-Ban'}
                        </span>
                        <h4 className="text-sm font-semibold text-white truncate">
                          {product?.name || 'Sunglasses'}
                        </h4>
                      </div>
                      <span className="text-sm font-mono font-bold text-amber-400">
                        ${item.unitPrice * item.quantity}
                      </span>
                    </div>

                    <p className="text-xs text-stone-400 truncate mt-0.5">{variant?.name}</p>
                    <p className="text-[11px] text-stone-500 font-mono mt-0.5">Size: {item.size}</p>

                    {/* Quantity controls */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity, -1)}
                          className="w-6 h-6 flex items-center justify-center text-stone-300 hover:text-white rounded"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-bold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity, 1)}
                          className="w-6 h-6 flex items-center justify-center text-stone-300 hover:text-white rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemove(item.id)}
                        className="text-stone-500 hover:text-rose-400 p-1.5 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with totals & coupon */}
        {cart && cart.items.length > 0 && !orderComplete && (
          <div className="border-t border-white/10 px-6 py-4 bg-stone-900/90 space-y-3.5">
            {/* Promo Code Form */}
            <form onSubmit={handleApplyCoupon} className="space-y-1.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Enter Promo (e.g. SUN20)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/15 rounded-lg text-xs font-mono text-white placeholder-stone-500 uppercase tracking-wider focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isApplying || !couponCode.trim()}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors"
                >
                  {isApplying ? 'Applying...' : 'Apply'}
                </button>
              </div>
              {couponMessage && (
                <p
                  className={`text-[11px] font-mono ${
                    couponMessage.isError ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {couponMessage.text}
                </p>
              )}
              {cart.appliedCoupon && (
                <div className="flex items-center justify-between text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                  <span>Coupon {cart.appliedCoupon.code} applied (-{cart.appliedCoupon.discountPercentage}%)</span>
                  <span>-${cart.discountAmount}</span>
                </div>
              )}
            </form>

            {/* Price Breakdown */}
            <div className="space-y-1.5 text-xs text-stone-400 pt-2 border-t border-white/10 font-mono">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-white">${cart.subtotal}</span>
              </div>
              {cart.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span>-${cart.discountAmount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Est. Tax (8.25%)</span>
                <span className="text-white">${cart.taxAmount}</span>
              </div>
              <div className="flex justify-between">
                <span>Luxury Express Shipping</span>
                <span className={cart.shippingAmount === 0 ? 'text-emerald-400 font-semibold' : 'text-white'}>
                  {cart.shippingAmount === 0 ? 'FREE' : `$${cart.shippingAmount}`}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/10 font-serif">
                <span>Total</span>
                <span className="text-amber-400 font-mono text-base">${cart.total}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isCheckingOut ? (
                'Processing Order...'
              ) : (
                <>
                  Proceed to Checkout <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] text-stone-500 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>256-Bit SSL Encrypted & Official Sunglass Hut Guarantee</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
