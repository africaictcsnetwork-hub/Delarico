import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  MessageCircle,
  Phone,
  Search,
  Share2,
  SlidersHorizontal,
  Tag,
  Truck,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { HERO_YARD_VISUAL } from '../utils/productVisuals';
import { buildWhatsAppUrl, formatKes } from '../utils/whatsapp';

type SortOption = 'popular' | 'price_asc' | 'price_desc' | 'savings';

export const HomePage: React.FC = () => {
  const { categories, products, promotions, settings, applyPromoCode } = useStore();
  const catalogSectionRef = useRef<HTMLElement | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'deals' | 'bestsellers'>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const dealProducts = useMemo(
    () =>
      activeProducts
        .filter((p) => p.onPromotion || p.compareAtPriceKes > p.priceKes)
        .slice(0, 4),
    [activeProducts]
  );

  const filteredProducts = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    const list = activeProducts.filter((p) => {
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (quickFilter === 'deals' && !p.onPromotion && !(p.compareAtPriceKes > p.priceKes)) {
        return false;
      }
      if (quickFilter === 'bestsellers' && !p.bestSeller) return false;
      if (q) {
        const hay = `${p.name} ${p.categoryName} ${p.brand} ${p.sku} ${p.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'price_asc') {
      return [...list].sort((a, b) => a.priceKes - b.priceKes);
    }
    if (sortBy === 'price_desc') {
      return [...list].sort((a, b) => b.priceKes - a.priceKes);
    }
    if (sortBy === 'savings') {
      return [...list].sort((a, b) => {
        const sa = Math.max(0, a.compareAtPriceKes - a.priceKes);
        const sb = Math.max(0, b.compareAtPriceKes - b.priceKes);
        return sb - sa;
      });
    }
    return [...list].sort((a, b) => Number(b.bestSeller) - Number(a.bestSeller));
  }, [activeProducts, selectedCategory, quickFilter, localSearch, sortBy]);

  const jumpToCategory = (catId: string, filterMode: 'all' | 'deals' | 'bestsellers' = 'all') => {
    setSelectedCategory(catId);
    setQuickFilter(filterMode);
    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activePromo = promotions[0];
  const directWaUrl = buildWhatsAppUrl(
    `Hello ${settings.businessName}, I want to place an order from your online store. Please assist with stock and delivery.`,
    settings.whatsappNumber
  );

  return (
    <div className="bg-slate-50 min-h-screen font-sans pb-16">
      {/* 1. DIRECT-TO-SALE MARKETPLACE SHOWCASE (Departments + Main Deal Banner + Direct Order / Affiliate Cards) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left Column: Instant Department Sidebar */}
          <aside className="hidden lg:flex lg:col-span-3 bg-white border border-slate-200 rounded-xl p-3 flex-col justify-between">
            <div>
              <div className="px-2.5 py-1.5 text-xs font-bold text-navy-900 border-b border-slate-100 mb-1">
                Shop by Department
              </div>
              <ul className="space-y-0.5">
                <li>
                  <button
                    type="button"
                    onClick={() => jumpToCategory('all', 'deals')}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 rounded-lg transition-colors text-left"
                  >
                    <span>Today&apos;s Yard Deals</span>
                    <ChevronRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  </button>
                </li>
                {categories.map((cat) => {
                  const count = activeProducts.filter((p) => p.categoryId === cat.id).length;
                  return (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onClick={() => jumpToCategory(cat.id, 'all')}
                        className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                          selectedCategory === cat.id
                            ? 'bg-navy-900 text-white font-semibold'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-navy-900'
                        }`}
                      >
                        <span className="truncate pr-2">{cat.name}</span>
                        <span
                          className={`text-[11px] tabular-nums ${
                            selectedCategory === cat.id ? 'text-gold-400' : 'text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 px-2.5 text-[11px] text-slate-500 flex items-center gap-2">
              <Truck className="w-4 h-4 text-royal-700 shrink-0" />
              <span>
                Free Siaya delivery above{' '}
                <strong className="text-navy-900 tabular-nums">
                  {formatKes(settings.freeDeliveryThresholdKes)}
                </strong>
              </span>
            </div>
          </aside>

          {/* Center Column: High-Impact Direct Sales Banner */}
          <div className="lg:col-span-6 relative rounded-xl overflow-hidden bg-navy-900 border border-navy-800 flex flex-col justify-between min-h-[300px] sm:min-h-[340px]">
            <ResilientImage
              src={HERO_YARD_VISUAL}
              alt="Delarico Building Materials & Hardware Yard in Siaya"
              className="absolute inset-0 w-full h-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy-900/85 to-navy-900/45" />

            <div className="relative p-6 sm:p-8 flex flex-col justify-between flex-1">
              <div className="space-y-3 max-w-lg">
                <p className="text-xs font-semibold text-gold-400 tracking-wide">
                  Siaya Wholesale &amp; Retail Yard · Direct Factory Prices
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight text-balance">
                  Genuine Cement, Mabati, Timber &amp; Hardware — Order Online Today
                </h1>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Buy retail or unlock instant bulk contractor rates. Pay via M-Pesa (
                  <span className="font-semibold text-white tabular-nums">
                    {settings.mpesaPaybillNumber}
                  </span>
                  ) or Cash on Site Delivery.
                </p>
              </div>

              <div className="pt-6 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => jumpToCategory('all', 'all')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors whitespace-nowrap"
                  >
                    <span>Shop All Products</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <Link
                    to="/request-quote"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-white/10 border border-white/25 rounded-lg hover:bg-white/20 transition-colors whitespace-nowrap"
                  >
                    <span>Bulk BOQ Quote</span>
                  </Link>
                </div>

                {activePromo && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200 pt-1">
                    <Tag className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                    <span>
                      Promo Code <strong className="text-gold-400">{activePromo.code}</strong>:{' '}
                      {activePromo.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => applyPromoCode(activePromo.code)}
                      className="underline font-semibold text-white hover:text-gold-300 ml-1"
                    >
                      Apply Code
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Instant Order Desk + Free Affiliate Earn 3-5% Card */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {/* Direct Phone / WhatsApp Sales Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-1">Fast Order Desk</p>
                <h2 className="text-sm font-bold text-navy-900">Order by Call or WhatsApp</h2>
                <p className="text-xs text-slate-600 mt-1">
                  Speak directly with our Siaya yard dispatch team for instant loading.
                </p>
                <p className="text-sm font-bold text-navy-900 tabular-nums mt-2">
                  {settings.whatsappNumber}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <a
                  href={directWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`tel:${settings.whatsappNumber}`}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-navy-900 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Now</span>
                </a>
              </div>
            </div>

            {/* Sell & Earn 3-5% Affiliate Card */}
            <div className="bg-navy-900 text-white border border-navy-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-gold-400 mb-1">Free Affiliate Program</p>
                <h2 className="text-sm font-bold text-white">Sell &amp; Earn 3%–5% Commission</h2>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Register for free, share product links with fundis &amp; builders, and get paid via M-Pesa.
                </p>
              </div>
              <Link
                to="/affiliates"
                className="mt-3 inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Join Free &amp; Start Selling</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Quick Category Strip */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 lg:hidden">
          <button
            type="button"
            onClick={() => jumpToCategory('all', 'all')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 ${
              selectedCategory === 'all' && quickFilter === 'all'
                ? 'bg-navy-900 text-white border-navy-900'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            All Products
          </button>
          <button
            type="button"
            onClick={() => jumpToCategory('all', 'deals')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 ${
              quickFilter === 'deals'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-amber-800 border-amber-200'
            }`}
          >
            Yard Deals
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => jumpToCategory(cat.id, 'all')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-navy-900 text-white border-navy-900'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* 2. TOP YARD DEALS & SAVINGS ROW */}
      {dealProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-navy-900 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-white">
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-gold-400 shrink-0" />
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Hot Yard Deals &amp; Contractor Discounts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => jumpToCategory('all', 'deals')}
                className="text-xs font-semibold text-gold-400 hover:text-gold-300 inline-flex items-center gap-1"
              >
                <span>See All Deals</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {dealProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. FULL DIRECT-TO-SALE PRODUCT CATALOGUE */}
      <section ref={catalogSectionRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5">
          {/* Header + Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-navy-900">
                {selectedCategory === 'all'
                  ? quickFilter === 'deals'
                    ? 'Discounted Yard Deals'
                    : quickFilter === 'bestsellers'
                    ? 'Best-Selling Building Materials'
                    : 'Shop All Kenyan Building Materials & Hardware'
                  : categories.find((c) => c.id === selectedCategory)?.name || 'Products'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Showing {filteredProducts.length} ready-to-dispatch items · Click Buy Now for instant checkout
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:flex-initial sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Filter items (e.g. Cement, Mabati)..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-royal-600"
                />
              </div>

              <div className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Sort products"
                  className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-royal-600"
                >
                  <option value="popular">Sort: Best Selling</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="savings">Biggest Discount</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interactive Department Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setQuickFilter('all');
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === 'all' && quickFilter === 'all'
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({activeProducts.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setQuickFilter('bestsellers');
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                quickFilter === 'bestsellers'
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Best Sellers
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setQuickFilter('deals');
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                quickFilter === 'deals'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Promotions
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setQuickFilter('all');
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-navy-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* 4-Column Direct-to-Sale Marketplace Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                No products matched your filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setQuickFilter('all');
                  setLocalSearch('');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg"
              >
                Show All Products
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
