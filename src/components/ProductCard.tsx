import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Heart, MessageCircle, ShoppingBag } from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { buildProductEnquiryMessage, buildWhatsAppUrl, formatKes } from '../utils/whatsapp';
import { ResilientImage } from './ResilientImage';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
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
  const waUrl = buildWhatsAppUrl(
    buildProductEnquiryMessage(product, 1, displayPrice),
    settings.whatsappNumber
  );

  return (
    <article className="group flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
      {/* 4:3 Real Product Photograph */}
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
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleFavourite(product.id)}
            aria-label={isFav ? 'Remove from favourites' : 'Save to favourites'}
            className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors shadow-xs ${
              isFav
                ? 'bg-navy-900 text-gold-400 border-navy-900'
                : 'bg-white/95 text-slate-700 border-slate-200 hover:text-navy-900'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => toggleCompare(product.id)}
            aria-label="Compare specifications"
            title="Compare specifications"
            className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors shadow-xs ${
              isCompared
                ? 'bg-royal-700 text-white border-royal-700'
                : 'bg-white/95 text-slate-700 border-slate-200 hover:text-navy-900'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contiguous Product Details */}
      <div className="flex flex-col flex-1 p-5">
        {/* Clean unboxed metadata */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 mb-1.5">
          <span>{product.categoryName}</span>
          <span aria-hidden="true">·</span>
          <span className={product.stockQty > 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
            {product.stockQty > 0 ? `${product.stockQty.toLocaleString()} in stock` : 'Out of stock'}
          </span>
        </div>

        <Link
          to={`/product/${product.slug}`}
          className="text-base font-semibold text-slate-900 hover:text-royal-700 transition-colors line-clamp-2 mb-1.5"
        >
          {product.name}
        </Link>

        <p className="text-xs text-slate-500 line-clamp-1 mb-2">
          {product.brand} · {product.dimensions}
        </p>

        {product.onPromotion && product.promoLabel && (
          <p className="text-xs font-semibold text-amber-700 mb-2">{product.promoLabel}</p>
        )}

        {/* Pricing Baseline */}
        <div className="mt-auto pt-3 border-t border-slate-100">
          <div className="flex items-baseline justify-between gap-2 mb-1">
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
            <span className="text-xs text-slate-500 whitespace-nowrap">per {product.unit}</span>
          </div>

          <p className="text-xs text-emerald-700 font-medium tabular-nums mb-4">
            Wholesale: {formatKes(product.wholesalePriceKes)} ({product.minWholesaleQty}+ {product.unit}s)
          </p>

          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => addToCart(product, 1)}
              disabled={product.stockQty <= 0}
              className="col-span-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 disabled:bg-slate-300 transition-colors whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Add to Cart</span>
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Enquire about ${product.name} on WhatsApp`}
              title="Order or enquire on WhatsApp"
              className="col-span-1 inline-flex items-center justify-center py-2.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};
