import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  Truck,
  Zap,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { buildProductEnquiryMessage, buildWhatsAppUrl, formatKes } from '../utils/whatsapp';
import { ResilientImage } from '../components/ResilientImage';
import { ProductCard } from '../components/ProductCard';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const reviewsSectionRef = useRef<HTMLDivElement | null>(null);

  const {
    user,
    userProfile,
    products,
    reviews,
    settings,
    addToCart,
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
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Compute live reviews & dynamic stars for this product
  const productReviews = useMemo(
    () => (product ? reviews.filter((r) => r.productId === product.id) : []),
    [reviews, product]
  );

  const { effectiveRating, totalReviewCount, ratingBreakdown } = useMemo(() => {
    if (!product) {
      return { effectiveRating: 5.0, totalReviewCount: 0, ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    }
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    productReviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
      breakdown[star] = (breakdown[star] || 0) + 1;
    });

    if (productReviews.length > 0) {
      const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
      const avg = Number((sum / productReviews.length).toFixed(1));
      return {
        effectiveRating: avg,
        totalReviewCount: productReviews.length,
        ratingBreakdown: breakdown,
      };
    }

    // Default to catalog baseline rating
    const baseAvg = product.ratingAvg || 4.9;
    const baseCount = product.reviewCount || 12;
    return {
      effectiveRating: baseAvg,
      totalReviewCount: baseCount,
      ratingBreakdown: breakdown,
    };
  }, [product, productReviews]);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4 font-sans">
        <h1 className="text-2xl font-bold text-navy-900">Product Not Found</h1>
        <p className="text-sm text-slate-600">
          The requested construction item could not be found or may have been updated.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Store</span>
        </Link>
      </div>
    );
  }

  const effectiveUnitPrice = getEffectiveUnitPrice(product, quantity);
  const isWholesaleApplied = effectiveUnitPrice < product.priceKes;
  const lineTotal = effectiveUnitPrice * quantity;
  const isFav = favouriteIds.includes(product.id);
  const isCompared = compareIds.includes(product.id);

  const relatedProducts = products
    .filter((p) => p.isActive && p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 4);

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
      notify('Please enter a review title and details (at least 5 characters).', 'error');
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
      notify('Thank you! Your star rating & review have been submitted.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to publish review.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const scrollToReviews = () => {
    reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10 font-sans">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/" className="hover:text-navy-900">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-navy-900">Products</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium truncate max-w-[260px]">{product.name}</span>
      </nav>

      {/* Contiguous Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Gallery Left */}
        <div className="lg:col-span-7 space-y-3">
          <div className="aspect-[4/3] bg-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            <ResilientImage
              src={product.images[selectedImageIdx] || product.images[0]}
              alt={`${product.name} — view ${selectedImageIdx + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2.5">
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

        {/* Purchase & Specification Module Right */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 p-5 sm:p-6 bg-white border border-slate-200 rounded-xl space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{product.brand} · {product.sku}</span>
              <span className={product.stockQty > 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                {product.stockQty > 0 ? `${product.stockQty.toLocaleString()} in stock` : 'Out of stock'}
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-navy-900 leading-snug">
              {product.name}
            </h1>

            {/* Interactive Star Rating Indicator */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-0.5 text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(effectiveRating)
                        ? 'fill-current text-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-navy-900 tabular-nums">
                {effectiveRating.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <button
                type="button"
                onClick={scrollToReviews}
                className="text-xs text-royal-700 hover:underline font-medium"
              >
                {totalReviewCount} {totalReviewCount === 1 ? 'Rating' : 'Ratings & Reviews'}
              </button>
            </div>
          </div>

          {/* Pricing Block */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
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

            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200 text-slate-600">
              <span>Wholesale ({product.minWholesaleQty}+ {product.unit}s):</span>
              <span className="font-bold text-emerald-700 tabular-nums">
                {formatKes(product.wholesalePriceKes)}
              </span>
            </div>
            {isWholesaleApplied && (
              <p className="text-xs font-semibold text-emerald-700">Wholesale pricing applied!</p>
            )}
          </div>

          {/* Quantity Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Quantity</span>
              <span className="text-slate-600 tabular-nums">
                Total: <strong className="text-navy-900">{formatKes(lineTotal)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 text-slate-700 hover:bg-slate-100"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, product.stockQty)}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="w-14 text-center text-xs font-semibold tabular-nums focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(Math.max(1, product.stockQty), q + 1))}
                  className="px-3 py-2 text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setQuantity(product.minWholesaleQty)}
                className="px-2.5 py-2 text-xs font-medium text-royal-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
              >
                Bulk ({product.minWholesaleQty}+)
              </button>
            </div>
          </div>

          {/* Buy Buttons */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  addToCart(product, quantity);
                  navigate('/checkout');
                }}
                disabled={product.stockQty <= 0}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 disabled:bg-slate-200 transition-colors"
              >
                <Zap className="w-4 h-4" />
                <span>Buy Now</span>
              </button>
              <button
                type="button"
                onClick={() => addToCart(product, quantity)}
                disabled={product.stockQty <= 0}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 disabled:bg-slate-300 transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add to Cart</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
              >
                <MessageCircle className="w-4 h-4 text-emerald-700" />
                <span>WhatsApp Order</span>
              </a>
              <button
                type="button"
                onClick={() => toggleFavourite(product.id)}
                className={`inline-flex items-center justify-center py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                  isFav
                    ? 'bg-navy-900 text-gold-400 border-navy-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* Quick Dispatch Info */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
            <Truck className="w-4 h-4 text-royal-700 shrink-0" />
            <span>Fast site delivery from Siaya Yard or direct yard collection</span>
          </div>
        </div>
      </div>

      {/* Product Specifications & Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-navy-900">Product Specifications &amp; Quality Notes</h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{product.description}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-500 block">Dimensions</span>
            <span className="font-semibold text-navy-900">{product.dimensions}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-500 block">Unit Weight</span>
            <span className="font-semibold text-navy-900 tabular-nums">{product.weightKg} kg</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-500 block">Compliance</span>
            <span className="font-semibold text-navy-900">{product.specSummary}</span>
          </div>
        </div>
      </div>

      {/* Interactive Star Rating & Customer Feedback Section */}
      <div ref={reviewsSectionRef} className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 space-y-6">
        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy-900">
              Customer Feedback &amp; Star Ratings
            </h2>
            <p className="text-xs text-slate-500">
              Verified reviews from builders, contractors &amp; site owners
            </p>
          </div>

          {/* Overall Rating Badge */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-900 tabular-nums leading-none">
                {effectiveRating.toFixed(1)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">out of 5</div>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <div className="flex items-center gap-0.5 text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      s <= Math.round(effectiveRating) ? 'fill-current' : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-slate-600 block mt-0.5 tabular-nums">
                {totalReviewCount} verified ratings
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Star Breakdown + Existing Reviews */}
          <div className="lg:col-span-7 space-y-4">
            {/* Star Distribution Bars */}
            <div className="space-y-1.5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              {[5, 4, 3, 2, 1].map((starNum) => {
                const count = ratingBreakdown[starNum as 1 | 2 | 3 | 4 | 5] || 0;
                const pct =
                  productReviews.length > 0
                    ? Math.round((count / productReviews.length) * 100)
                    : starNum === 5
                    ? 85
                    : starNum === 4
                    ? 15
                    : 0;

                return (
                  <div key={starNum} className="flex items-center gap-2 text-slate-600">
                    <span className="w-10 tabular-nums font-medium flex items-center gap-1">
                      <span>{starNum}</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    </span>
                    <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11px] tabular-nums text-slate-500">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Reviews List */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wide">
                Recent Reviews ({productReviews.length})
              </h3>
              {productReviews.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                  No written reviews yet for this product. Be the first to leave a review below!
                </div>
              ) : (
                productReviews.map((rev) => (
                  <div key={rev.id} className="p-4 border border-slate-200 rounded-lg space-y-1.5 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i <= rev.rating ? 'fill-current' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{rev.customerName}</span>
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-navy-900">{rev.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Leave Feedback / Star-Rating Form */}
          <div className="lg:col-span-5">
            <form
              onSubmit={handleReviewSubmit}
              className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5"
            >
              <div>
                <h3 className="text-sm font-bold text-navy-900">Leave Your Star Feedback</h3>
                <p className="text-[11px] text-slate-500">Rate this product and share your experience</p>
              </div>

              {/* Interactive Star Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Rating *
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const active = (hoverRating || rating) >= starValue;
                    return (
                      <button
                        key={starValue}
                        type="button"
                        onClick={() => setRating(starValue)}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(0)}
                        aria-label={`Rate ${starValue} stars`}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            active ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                          }`}
                        />
                      </button>
                    );
                  })}
                  <span className="ml-2 text-xs font-bold text-navy-900">
                    {rating === 5
                      ? '5 Stars (Excellent)'
                      : rating === 4
                      ? '4 Stars (Very Good)'
                      : rating === 3
                      ? '3 Stars (Average)'
                      : rating === 2
                      ? '2 Stars (Fair)'
                      : '1 Star (Poor)'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Headline / Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="e.g. Strong grade cement, loaded fast at Siaya yard"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-royal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Feedback &amp; Site Experience *
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={1500}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Tell other builders about quality, packaging, and performance on your construction site..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-royal-600"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 disabled:opacity-50 transition-colors"
              >
                {user ? (
                  submittingReview ? 'Submitting...' : 'Submit Star Rating & Review'
                ) : (
                  'Sign In to Submit Review'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-base font-bold text-navy-900">More in {product.categoryName}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
