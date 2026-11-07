import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Heart, MessageCircle, ShoppingBag, Star, Zap } from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { buildProductEnquiryMessage, buildWhatsAppUrl, formatKes } from '../utils/whatsapp';
import { ResilientImage } from './ResilientImage';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const {
    addToCart,
    compareIds,
    toggleCompare,
    favouriteIds,
    toggleFavourite,
    getEffectiveUnitPrice,
    settings,
  } = useStore();

  const isCompared = compareIds.includes(product.id);
  const isFav = favouriteIds.includes(product.id);
  const displayPrice = getEffectiveUnitPrice(product, 1);
  const savingsPct =
    product.compareAtPriceKes > displayPrice
      ? Math.round(((product.compareAtPriceKes - displayPrice) / product.compareAtPriceKes) * 100)
      : 0;

  const waUrl = buildWhatsAppUrl(
    buildProductEnquiryMessage(product, 1, displayPrice),
    settings.whatsappNumber
  );

  const handleBuyNow = () => {
    if (product.stockQty <= 0) return;
    addToCart(product, 1);
    navigate('/checkout');
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
              {(product.ratingAvg || 4.8).toFixed(1)}
            </span>
          </div>
          <span className="text-xs text-slate-400 tabular-nums">
            ({product.reviewCount || 12})
          </span>
        </div>

        <p className="text-xs text-slate-500 line-clamp-1 mb-2.5">
          {product.brand} · {product.unit}
        </p>

        {/* Pricing & Direct Buy Controls */}
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

          <p className="text-xs text-emerald-700 font-medium tabular-nums mb-3">
            Bulk ({product.minWholesaleQty}+): {formatKes(product.wholesalePriceKes)} / {product.unit}
          </p>

          <div className="grid grid-cols-12 gap-1.5">
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={product.stockQty <= 0}
              className="col-span-6 inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 disabled:bg-slate-200 disabled:text-slate-400 transition-colors whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>Buy Now</span>
            </button>
            <button
              type="button"
              onClick={() => addToCart(product, 1)}
              disabled={product.stockQty <= 0}
              title="Add to Cart"
              className="col-span-4 inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 disabled:bg-slate-300 transition-colors whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span>Cart</span>
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Order ${product.name} on WhatsApp`}
              title="Order on WhatsApp"
              className="col-span-2 inline-flex items-center justify-center py-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};
