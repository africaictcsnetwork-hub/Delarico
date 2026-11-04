import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  FileText,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { buildProductEnquiryMessage, buildWhatsAppUrl, formatKes } from '../utils/whatsapp';
import { ResilientImage } from '../components/ResilientImage';
import { ProductCard } from '../components/ProductCard';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    user,
    userProfile,
    products,
    reviews,
    settings,
    addToCart,
    addToQuoteDraft,
    getEffectiveUnitPrice,
    compareIds,
    toggleCompare,
    favouriteIds,
    toggleFavourite,
    apiFetch,
    notify,
  } = useStore();

  const product = useMemo(
    () => products.find((p) => p.slug === slug || p.id === slug),
    [products, slug]
  );

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4 font-sans">
        <h1 className="text-2xl font-bold text-navy-900">Product Not Found</h1>
        <p className="text-sm text-slate-600">
          The requested construction item could not be found or may have been updated.
        </p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Catalogue</span>
        </Link>
      </div>
    );
  }

  const effectiveUnitPrice = getEffectiveUnitPrice(product, quantity);
  const isWholesaleApplied = effectiveUnitPrice < product.priceKes;
  const lineTotal = effectiveUnitPrice * quantity;
  const isFav = favouriteIds.includes(product.id);
  const isCompared = compareIds.includes(product.id);

  const productReviews = reviews.filter((r) => r.productId === product.id);
  const relatedProducts = products
    .filter((p) => p.isActive && p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 3);

  const waUrl = buildWhatsAppUrl(
    buildProductEnquiryMessage(product, quantity, effectiveUnitPrice),
    settings.whatsappNumber
  );

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate(`/account?redirect=${encodeURIComponent(`/product/${product.slug}`)}`);
      return;
    }
    if (reviewTitle.trim().length < 2 || reviewComment.trim().length < 5) {
      notify('Please enter a review title and detailed experience (at least 5 characters).', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      await apiFetch('/api/customer/reviews', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          customerName: userProfile?.displayName || user.displayName || 'Customer',
          rating,
          title: reviewTitle.trim(),
          comment: reviewComment.trim(),
        }),
      });
      setReviewTitle('');
      setReviewComment('');
      notify('Thank you! Your product review has been published.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to publish review.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16 font-sans">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/" className="hover:text-navy-900">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-navy-900">Shop Materials</Link>
        <span>/</span>
        <Link
          to={`/products?category=${encodeURIComponent(product.categoryId)}`}
          className="hover:text-navy-900"
        >
          {product.categoryName}
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium truncate max-w-[240px]">{product.name}</span>
      </nav>

      {/* Contiguous Purchase Module (Gallery Left + Purchase Module Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Multi-Photograph Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-[4/3] bg-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            <ResilientImage
              src={product.images[selectedImageIdx] || product.images[0]}
              alt={`${product.name} — view ${selectedImageIdx + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {product.images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`aspect-[4/3] rounded-lg overflow-hidden border-2 transition-colors ${
                    selectedImageIdx === idx ? 'border-navy-900' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <ResilientImage
                    src={imgUrl}
                    alt={`${product.name} thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sticky Purchase & Specification Module */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 p-6 sm:p-7 bg-white border border-slate-200 rounded-xl space-y-6">
          <div>
            <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500 mb-2">
              <span>{product.brand}</span>
              <span aria-hidden="true">·</span>
              <span>{product.sku}</span>
              <span aria-hidden="true">·</span>
              <span className={product.stockQty > 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                {product.stockQty > 0
                  ? `${product.stockQty.toLocaleString()} ${product.unit}s Available`
                  : 'Currently Out of Stock'}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-navy-900 leading-snug">
              {product.name}
            </h1>

            {product.onPromotion && product.promoLabel && (
              <p className="text-xs font-semibold text-amber-700 mt-1.5">{product.promoLabel}</p>
            )}
          </div>

          {/* Retail vs Wholesale Pricing Block */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-bold text-navy-900 tabular-nums">
                  {formatKes(effectiveUnitPrice)}
                </span>
                <span className="text-xs text-slate-500 ml-1.5">per {product.unit}</span>
              </div>
              {product.compareAtPriceKes > effectiveUnitPrice && (
                <span className="text-xs text-slate-400 line-through tabular-nums">
                  {formatKes(product.compareAtPriceKes)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
              <span className="text-slate-600">
                Wholesale Rate ({product.minWholesaleQty}+ {product.unit}s or Contractor Account):
              </span>
              <span className="font-bold text-emerald-700 tabular-nums">
                {formatKes(product.wholesalePriceKes)}
              </span>
            </div>
            {isWholesaleApplied && (
              <p className="text-xs font-semibold text-emerald-700">
                Wholesale trade tier active on your current selection!
              </p>
            )}
          </div>

          {/* Quantity Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="qty-input" className="font-semibold text-slate-700">
                Order Quantity ({product.unit}s)
              </label>
              <span className="text-slate-600 tabular-nums">
                Line Estimate: <strong className="text-navy-900">{formatKes(lineTotal)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3.5 py-2.5 text-slate-700 hover:bg-slate-100"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  id="qty-input"
                  type="number"
                  min={1}
                  max={Math.max(1, product.stockQty)}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 text-center text-sm font-semibold tabular-nums focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(Math.max(1, product.stockQty), q + 1))}
                  className="px-3.5 py-2.5 text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setQuantity(product.minWholesaleQty)}
                className="px-3 py-2.5 text-xs font-medium text-royal-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 whitespace-nowrap"
              >
                Set Bulk ({product.minWholesaleQty})
              </button>
            </div>
          </div>

          {/* Primary Purchase, Quotation & WhatsApp Actions */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => addToCart(product, quantity)}
              disabled={product.stockQty <= 0}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 disabled:bg-slate-300 transition-colors tabular-nums"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add to Cart — {formatKes(lineTotal)}</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  addToQuoteDraft(product, Math.max(quantity, product.minWholesaleQty));
                  navigate('/request-quote');
                }}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5 text-gold-400" />
                <span>Request Bulk Quote</span>
              </button>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 whitespace-nowrap"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Order</span>
              </a>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => toggleFavourite(product.id)}
                className="inline-flex items-center gap-1.5 hover:text-navy-900 font-medium"
              >
                <Heart className={`w-4 h-4 ${isFav ? 'fill-gold-500 text-gold-500' : ''}`} />
                <span>{isFav ? 'Saved in Favourites' : 'Save to Favourites'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleCompare(product.id)}
                className="inline-flex items-center gap-1.5 hover:text-navy-900 font-medium"
              >
                <ArrowLeftRight className="w-4 h-4 text-royal-700" />
                <span>{isCompared ? 'In Comparison Tray' : 'Compare Specs'}</span>
              </button>
            </div>
          </div>

          {/* Delivery Assurance */}
          <div className="pt-4 border-t border-slate-200 flex items-start gap-3 text-xs text-slate-600">
            <Truck className="w-4 h-4 text-navy-900 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">Siaya Yard Pickup &amp; Regional Site Delivery</p>
              <p>Same-day loading at Siaya HQ; scheduled lorry dispatch to Bondo, Ugunja, Kisumu, and Busia. Direct line: {settings.whatsappNumber}.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Description & Technical Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-10 border-t border-slate-200">
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-xl font-bold text-navy-900">Product Overview &amp; Site Application</h2>
          <p className="text-sm text-slate-700 leading-relaxed">{product.description}</p>
          <p className="text-sm font-medium text-slate-800">{product.specSummary}</p>
        </div>

        <div className="lg:col-span-5">
          <h2 className="text-xl font-bold text-navy-900 mb-4">Technical Specifications</h2>
          <dl className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="grid grid-cols-3 px-4 py-3 bg-slate-50">
              <dt className="font-semibold text-slate-600">SKU Code</dt>
              <dd className="col-span-2 text-slate-900 font-medium">{product.sku}</dd>
            </div>
            <div className="grid grid-cols-3 px-4 py-3 bg-white">
              <dt className="font-semibold text-slate-600">Dimensions</dt>
              <dd className="col-span-2 text-slate-900">{product.dimensions}</dd>
            </div>
            <div className="grid grid-cols-3 px-4 py-3 bg-slate-50">
              <dt className="font-semibold text-slate-600">Brand / Mill</dt>
              <dd className="col-span-2 text-slate-900">{product.brand}</dd>
            </div>
            <div className="grid grid-cols-3 px-4 py-3 bg-white">
              <dt className="font-semibold text-slate-600">Selling Unit</dt>
              <dd className="col-span-2 text-slate-900">{product.unit}</dd>
            </div>
            <div className="grid grid-cols-3 px-4 py-3 bg-slate-50">
              <dt className="font-semibold text-slate-600">Unit Weight</dt>
              <dd className="col-span-2 text-slate-900 tabular-nums">{product.weightKg} kg</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Customer Reviews & Review Submission */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-10 border-t border-slate-200">
        <div className="lg:col-span-7 space-y-5">
          <h2 className="text-xl font-bold text-navy-900">
            Customer &amp; Contractor Reviews ({productReviews.length})
          </h2>

          {productReviews.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              No written customer reviews yet for this item. Have you built with {product.name}? Share your site feedback on the right.
            </div>
          ) : (
            <div className="space-y-4">
              {productReviews.map((rev) => (
                <div key={rev.id} className="p-5 bg-white border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-gold-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'text-slate-300'}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-500">
                      {rev.customerName}
                      {rev.verifiedBuyer ? ' · Verified Buyer' : ''}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-navy-900">{rev.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <form
            onSubmit={handleReviewSubmit}
            className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4"
          >
            <h3 className="text-base font-bold text-navy-900">Write a Product Review</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rating</label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setRating(num)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      rating >= num
                        ? 'bg-navy-900 text-gold-400 border-navy-900'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {num} ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Review Title</label>
              <input
                type="text"
                required
                maxLength={120}
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="e.g. Genuine grade, fast delivery to site"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-royal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Site Experience</label>
              <textarea
                rows={3}
                required
                maxLength={1500}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share quality, delivery speed, and how the material performed on site..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-royal-600"
              />
            </div>
            <button
              type="submit"
              disabled={submittingReview}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 disabled:opacity-50"
            >
              {user ? (submittingReview ? 'Submitting...' : 'Publish Review') : 'Sign In to Write a Review'}
            </button>
          </form>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="pt-10 border-t border-slate-200 space-y-6">
          <h2 className="text-xl font-bold text-navy-900">Related {product.categoryName}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
