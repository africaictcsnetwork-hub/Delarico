import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Check, Heart, MessageCircle, Minus, Plus, ShoppingBag, Star } from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { buildProductEnquiryMessage, buildWhatsAppUrl, formatKes } from '../utils/whatsapp';
import { ResilientImage } from './ResilientImage';

interface ProductCardProps {
  product: Product;
  eager?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, eager = false }) => {
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const {
    addToCart,
    compareIds,
    toggleCompare,
    favouriteIds,
    toggleFavourite,
    getEffectiveUnitPrice,
    reviews,
    settings,
  } = useStore();

  const isCompared = compareIds.includes(product.id);
  const isFav = favouriteIds.includes(product.id);
  const displayPrice = getEffectiveUnitPrice(product, quantity);

  const liveReviews = reviews.filter((r) => r.productId === product.id);
  const displayRatingAvg =
    liveReviews.length > 0
      ? Number((liveReviews.reduce((s, r) => s + r.rating, 0) / liveReviews.length).toFixed(1))
      : product.ratingAvg || 4.8;
  const displayReviewCount =
    liveReviews.length > 0 ? liveReviews.length : product.reviewCount || 12;
  const savingsPct =
    product.compareAtPriceKes > displayPrice
      ? Math.round(((product.compareAtPriceKes - displayPrice) / product.compareAtPriceKes) * 100)
      : 0;

  const waUrl = buildWhatsAppUrl(
    buildProductEnquiryMessage(product, quantity, displayPrice),
    settings.whatsappNumber
  );

  const handleAddToCart = () => {
    if (product.stockQty <= 0) return;
    addToCart(product, quantity);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <article className="group flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
      {/* 4:3 Real Kenyan Product Photograph */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        <Link to={`/product/${product.slug}`} className="block w-full h-full">
          <ResilientImage
            src={product.images[0]}
            alt={product.name}
            fallbackLabel={product.name}
            eager={eager}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </Link>

        {/* Functional Quick Actions (Save + Compare) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleFavourite(product.id)}
            aria-label={isFav ? 'Remove from favourites' : 'Save to favourites'}
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors shadow-xs ${
              isFav
                ? 'bg-navy-900 text-gold-400 border-navy-900'
                : 'bg-white/95 text-slate-700 border-slate-200 hover:text-navy-900'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => toggleCompare(product.id)}
            aria-label="Compare specifications"
            title="Compare specifications"
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors shadow-xs ${
              isCompared
                ? 'bg-royal-700 text-white border-royal-700'
                : 'bg-white/95 text-slate-700 border-slate-200 hover:text-navy-900'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Direct-to-Sale Purchase Details */}
      <div className="flex flex-col flex-1 p-4">
        {/* Clean unboxed metadata */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 mb-1">
          <span className="truncate max-w-[140px]">{product.categoryName}</span>
          <span aria-hidden="true">·</span>
          <span className={product.stockQty > 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
            {product.stockQty > 0 ? `${product.stockQty.toLocaleString()} in stock` : 'Out of stock'}
          </span>
          {savingsPct > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-700 font-semibold tabular-nums">Save {savingsPct}%</span>
            </>
          )}
        </div>

        <Link
          to={`/product/${product.slug}`}
          className="text-sm sm:text-base font-semibold text-slate-900 hover:text-royal-700 transition-colors line-clamp-2 mb-1 leading-snug"
        >
          {product.name}
        </Link>

        {/* Rating & Review Feedback */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="flex items-center text-amber-500">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="ml-1 text-xs font-semibold text-slate-800 tabular-nums">
              {displayRatingAvg.toFixed(1)}
            </span>
          </div>
          <span className="text-xs text-slate-400 tabular-nums">
            ({displayReviewCount})
          </span>
        </div>

        <p className="text-xs text-slate-500 line-clamp-1 mb-2.5">
          {product.brand} · {product.unit}
        </p>

        {/* Pricing & Direct Add to Cart Controls */}
        <div className="mt-auto pt-2.5 border-t border-slate-100">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-navy-900 tabular-nums">
                {formatKes(displayPrice)}
              </span>
              {product.compareAtPriceKes > displayPrice && (
                <span className="text-xs text-slate-400 line-through tabular-nums">
                  {formatKes(product.compareAtPriceKes)}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-emerald-700 font-medium tabular-nums mb-2.5">
            Bulk ({product.minWholesaleQty}+): {formatKes(product.wholesalePriceKes)} / {product.unit}
          </p>

          {/* Jumia Quantity Selector */}
          <div className="flex items-center justify-between gap-2 mb-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <span className="text-[11px] font-semibold text-slate-600 pl-1">Qty:</span>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1 || product.stockQty <= 0}
                aria-label={`Decrease quantity for ${product.name}`}
                className="w-7 h-6 flex items-center justify-center text-slate-600 hover:text-navy-900 hover:bg-slate-200 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                min={1}
                max={Math.max(1, product.stockQty)}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    setQuantity(Math.max(1, Math.min(product.stockQty, val)));
                  }
                }}
                aria-label="Quantity"
                className="w-10 text-center text-xs font-bold text-navy-900 bg-white border border-slate-200 rounded mx-1 py-0.5 focus:outline-none focus:border-royal-600"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(product.stockQty, q + 1))}
                disabled={quantity >= product.stockQty || product.stockQty <= 0}
                aria-label={`Increase quantity for ${product.name}`}
                className="w-7 h-6 flex items-center justify-center text-slate-600 hover:text-navy-900 hover:bg-slate-200 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Jumia Single Add to Cart Button */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={product.stockQty <= 0}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shadow-xs uppercase tracking-wide ${
                justAdded
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gold-500 hover:bg-gold-400 text-navy-950 disabled:bg-slate-200 disabled:text-slate-400'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Added ({quantity})</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                  <span>{product.stockQty <= 0 ? 'Out of Stock' : 'Add to Cart'}</span>
                </>
              )}
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Order ${product.name} on WhatsApp`}
              title="Order on WhatsApp"
              className="inline-flex items-center justify-center p-2.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shrink-0"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};
