import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { buildWhatsAppUrl, formatKes } from '../utils/whatsapp';
import { ResilientImage } from '../components/ResilientImage';

export const SavedItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    products,
    favouriteIds,
    toggleFavourite,
    clearSavedItems,
    addToCart,
    addToQuoteDraft,
    getEffectiveUnitPrice,
    settings,
    notify,
  } = useStore();

  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const savedProducts = useMemo(
    () => products.filter((p) => p.isActive && favouriteIds.includes(p.id)),
    [products, favouriteIds]
  );

  const getQty = (productId: string) => Math.max(1, quantities[productId] || 1);

  const setQty = (productId: string, next: number, maxStock: number) => {
    const safe = Math.max(1, Math.min(Math.max(1, maxStock), next));
    setQuantities((prev) => ({ ...prev, [productId]: safe }));
  };

  const totalEstimatedKes = useMemo(() => {
    return savedProducts.reduce((sum, p) => {
      const q = getQty(p.id);
      return sum + getEffectiveUnitPrice(p, q) * q;
    }, 0);
  }, [savedProducts, quantities]);

  const handleAddAllToCart = () => {
    const inStock = savedProducts.filter((p) => p.stockQty > 0);
    if (inStock.length === 0) {
      notify('None of your saved items are currently in stock.', 'error');
      return;
    }
    inStock.forEach((p) => addToCart(p, getQty(p.id)));
    navigate('/checkout');
  };

  const handleSendAllToQuote = () => {
    if (savedProducts.length === 0) return;
    savedProducts.forEach((p) => addToQuoteDraft(p, Math.max(p.minWholesaleQty, getQty(p.id))));
    navigate('/request-quote');
  };

  const savedWaUrl = useMemo(() => {
    const lines = savedProducts.map(
      (p, idx) =>
        `${idx + 1}. ${p.name} — Qty: ${getQty(p.id)} ${p.unit} (${formatKes(
          getEffectiveUnitPrice(p, getQty(p.id))
        )} each)`
    );
    const msg = [
      `Hello DELARICO MERCHANDISE & SUPPLIES,`,
      `Please confirm availability and pricing for my Saved Materials List:`,
      ...lines,
      `Estimated Subtotal: ${formatKes(totalEstimatedKes)}`,
    ].join('\n');
    return buildWhatsAppUrl(msg, settings.whatsappNumber);
  }, [savedProducts, quantities, totalEstimatedKes, settings.whatsappNumber]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 font-sans space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-semibold text-royal-700 mb-1">Saved Items &amp; Wishlist</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900">
            Your Saved Building Materials ({savedProducts.length})
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Items saved here persist in your browser&apos;s local storage for quick project planning and reordering anytime.
          </p>
        </div>

        {savedProducts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleAddAllToCart}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors whitespace-nowrap"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add All to Cart</span>
            </button>
            <button
              type="button"
              onClick={handleSendAllToQuote}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors whitespace-nowrap"
            >
              <FileText className="w-4 h-4" />
              <span>Request Bulk Quote</span>
            </button>
            <button
              type="button"
              onClick={() => void clearSavedItems()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:text-rose-700 hover:border-rose-200 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear List</span>
            </button>
          </div>
        )}
      </div>

      {savedProducts.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center space-y-4">
          <Heart className="w-10 h-10 text-slate-300 mx-auto" />
          <h2 className="text-lg font-bold text-navy-900">Your Saved Items list is empty</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Click the heart icon on any cement, steel, timber, mabati, door, or hardware item to save it here for later.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700 transition-colors"
          >
            <span>Browse Construction Materials</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Saved Items List */}
          <div className="lg:col-span-8 space-y-4">
            {savedProducts.map((product) => {
              const qty = getQty(product.id);
              const unitPrice = getEffectiveUnitPrice(product, qty);
              const isBulk = unitPrice < product.priceKes;

              return (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <Link
                      to={`/product/${product.slug}`}
                      className="w-24 h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0"
                    >
                      <ResilientImage
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{product.categoryName}</span>
                        <span>·</span>
                        <span
                          className={
                            product.stockQty > 0
                              ? 'text-emerald-700 font-medium'
                              : 'text-rose-700 font-medium'
                          }
                        >
                          {product.stockQty > 0
                            ? `${product.stockQty.toLocaleString()} in stock`
                            : 'Out of stock'}
                        </span>
                      </div>
                      <Link
                        to={`/product/${product.slug}`}
                        className="text-sm sm:text-base font-bold text-navy-900 hover:text-royal-700 line-clamp-2"
                      >
                        {product.name}
                      </Link>
                      <div className="flex items-baseline gap-2 text-sm">
                        <span className="font-bold text-navy-900 tabular-nums">
                          {formatKes(unitPrice)}
                        </span>
                        <span className="text-xs text-slate-500">/ {product.unit}</span>
                        {isBulk && (
                          <span className="text-xs font-semibold text-emerald-700">
                            · Bulk Rate Applied
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quantity + Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
                      <button
                        type="button"
                        onClick={() => setQty(product.id, qty - 1, product.stockQty)}
                        aria-label="Decrease quantity"
                        className="p-2 text-slate-600 hover:text-navy-900"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, product.stockQty)}
                        value={qty}
                        onChange={(e) => setQty(product.id, Number(e.target.value) || 1, product.stockQty)}
                        className="w-12 text-center text-xs font-bold bg-white border-x border-slate-200 py-1.5 tabular-nums focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQty(product.id, qty + 1, product.stockQty)}
                        aria-label="Increase quantity"
                        className="p-2 text-slate-600 hover:text-navy-900"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => addToCart(product, qty)}
                      disabled={product.stockQty <= 0}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 disabled:bg-slate-200 disabled:text-slate-400 whitespace-nowrap"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Add to Cart</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleFavourite(product.id)}
                      aria-label={`Remove ${product.name} from saved items`}
                      title="Remove from Saved Items"
                      className="p-2 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-lg hover:border-rose-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Card */}
          <aside className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-navy-900">Saved Project Estimate</h2>
            <div className="space-y-2 text-xs text-slate-600 pb-4 border-b border-slate-200">
              <div className="flex justify-between">
                <span>Saved Items Count</span>
                <span className="font-semibold text-navy-900 tabular-nums">
                  {savedProducts.length} items
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-navy-900 pt-1">
                <span>Estimated Total</span>
                <span className="tabular-nums">{formatKes(totalEstimatedKes)}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleAddAllToCart}
                className="w-full py-2.5 px-4 text-xs font-bold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors"
              >
                Move All to Cart &amp; Checkout
              </button>
              <a
                href={savedWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Send Saved List on WhatsApp</span>
              </a>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
