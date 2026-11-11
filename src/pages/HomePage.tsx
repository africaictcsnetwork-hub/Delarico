import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  MessageCircle,
  Phone,
  Search,
  Share2,
  SlidersHorizontal,
  Tag,
  Zap,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
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
    `Hello ${settings.businessName}, I want to order building materials online.`,
    settings.whatsappNumber
  );

  return (
    <div className="bg-slate-50 min-h-screen font-sans pb-16">
      {/* 1. COMPACT JUMIA-STYLE TOP SHOPPING STRIP (Categories + Quick Deal Banner + Direct Actions) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* Left: Department List */}
          <aside className="hidden lg:block lg:col-span-3 bg-white border border-slate-200 rounded-xl p-2.5">
            <div className="px-2 py-1.5 text-xs font-bold text-navy-900 border-b border-slate-100 uppercase tracking-wide">
              Categories
            </div>
            <ul className="mt-1 space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => jumpToCategory('all', 'deals')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors text-left ${
                    quickFilter === 'deals'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Top Deals</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </li>
              {categories.map((cat) => {
                const count = activeProducts.filter((p) => p.categoryId === cat.id).length;
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => jumpToCategory(cat.id, 'all')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors text-left ${
                        selectedCategory === cat.id && quickFilter !== 'deals'
                          ? 'bg-navy-900 text-white font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
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
          </aside>

          {/* Center: Clean Sales Banner (No Long Story / No Giant Hero Text) */}
          <div className="lg:col-span-6 bg-navy-900 text-white border border-navy-800 rounded-xl p-5 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-gold-400 uppercase tracking-wider">
                Siaya Hardware &amp; Building Materials Yard
              </span>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">
                Quality Cement, Steel, Timber, Mabati &amp; Tools at Direct Yard Prices
              </h1>
              <p className="text-xs text-slate-300">
                Direct sale online · Fast site delivery across Siaya &amp; Western Kenya.
              </p>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => jumpToCategory('all', 'all')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors whitespace-nowrap"
              >
                <span>Shop All Items</span>
              </button>
              <button
                type="button"
                onClick={() => jumpToCategory('all', 'deals')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors whitespace-nowrap"
              >
                <span>View Deals</span>
              </button>
              {activePromo && (
                <button
                  type="button"
                  onClick={() => applyPromoCode(activePromo.code)}
                  className="text-xs text-gold-300 hover:text-white underline font-semibold ml-1"
                >
                  Code: {activePromo.code}
                </button>
              )}
            </div>
          </div>

          {/* Right: Quick Buy & Fast Order Bar */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase">Direct Order</span>
                <p className="text-xs font-semibold text-navy-900 mt-0.5">Call or WhatsApp</p>
                <p className="text-xs font-bold text-slate-800 tabular-nums">{settings.whatsappNumber}</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                <a
                  href={directWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`tel:${settings.whatsappNumber}`}
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-semibold text-navy-900 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call</span>
                </a>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-royal-700 uppercase">Sell &amp; Earn</span>
                <p className="text-xs font-semibold text-navy-900 mt-0.5">3%–5% Commission</p>
                <p className="text-[11px] text-slate-500">Free to join · Paid via M-Pesa</p>
              </div>
              <Link
                to="/affiliates"
                className="mt-2.5 inline-flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Join Free</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Category Quick Scroll */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 lg:hidden">
          <button
            type="button"
            onClick={() => jumpToCategory('all', 'all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 ${
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 ${
              quickFilter === 'deals'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-amber-800 border-amber-200'
            }`}
          >
            Hot Deals
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => jumpToCategory(cat.id, 'all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 ${
                selectedCategory === cat.id && quickFilter !== 'deals'
                  ? 'bg-navy-900 text-white border-navy-900'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* 2. FLASH / DISCOUNTED DEALS ROW */}
      {dealProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-amber-600 px-4 py-2.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                  Today&apos;s Discounted Yard Deals
                </h2>
              </div>
              <button
                type="button"
                onClick={() => jumpToCategory('all', 'deals')}
                className="text-xs font-semibold underline text-white hover:text-amber-100"
              >
                See All Deals
              </button>
            </div>

            <div className="p-3.5 sm:p-4 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {dealProducts.map((product) => (
                <ProductCard key={product.id} product={product} eager />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. PURE DIRECT-TO-SALE PRODUCT MARKETPLACE (JUMIA STYLE) */}
      <section ref={catalogSectionRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-navy-900">
                {selectedCategory === 'all'
                  ? quickFilter === 'deals'
                    ? 'Yard Deals & Promotions'
                    : quickFilter === 'bestsellers'
                    ? 'Best Sellers'
                    : 'Products For Sale'
                  : categories.find((c) => c.id === selectedCategory)?.name || 'Products'}
              </h2>
              <p className="text-xs text-slate-500 tabular-nums">
                {filteredProducts.length} items available · In stock in Siaya
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-royal-600"
                />
              </div>

              <div className="inline-flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Sort products"
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
                >
                  <option value="popular">Best Sellers</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="savings">Biggest Discount</option>
                </select>
              </div>
            </div>
          </div>

          {/* 1-Tap Category Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setQuickFilter('all');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                selectedCategory === 'all' && quickFilter === 'all'
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Items ({activeProducts.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setQuickFilter('bestsellers');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                quickFilter === 'deals'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Discounts
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setQuickFilter('all');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                  selectedCategory === cat.id && quickFilter === 'all'
                    ? 'bg-navy-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Clean 4-Column Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-700">No products matched.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setQuickFilter('all');
                  setLocalSearch('');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-navy-900 rounded-lg"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
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
