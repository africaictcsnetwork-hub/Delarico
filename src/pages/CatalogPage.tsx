import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Filter, RotateCcw, Search } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';

export const CatalogPage: React.FC = () => {
  const { categories, products, compareIds } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedCategory = searchParams.get('category') || 'all';
  const initialQuery = searchParams.get('q') || '';

  const [queryText, setQueryText] = useState(initialQuery);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [promoOnly, setPromoOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'name_asc'>('featured');

  const filteredProducts = useMemo(() => {
    const q = (searchParams.get('q') || queryText).trim().toLowerCase();
    return products
      .filter((p) => p.isActive)
      .filter((p) => (selectedCategory === 'all' ? true : p.categoryId === selectedCategory))
      .filter((p) => (inStockOnly ? p.stockQty > 0 : true))
      .filter((p) => (promoOnly ? p.onPromotion : true))
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.specSummary.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.priceKes - b.priceKes;
        if (sortBy === 'price_desc') return b.priceKes - a.priceKes;
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        return Number(b.featured) - Number(a.featured) || Number(b.bestSeller) - Number(a.bestSeller);
      });
  }, [products, selectedCategory, inStockOnly, promoOnly, sortBy, queryText, searchParams]);

  const setCategoryFilter = (catId: string) => {
    const next = new URLSearchParams(searchParams);
    if (catId === 'all') {
      next.delete('category');
    } else {
      next.set('category', catId);
    }
    setSearchParams(next);
  };

  const resetFilters = () => {
    setQueryText('');
    setInStockOnly(false);
    setPromoOnly(false);
    setSortBy('featured');
    setSearchParams({});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-slate-200">
        <div>
          <p className="text-xs font-semibold text-royal-700 mb-1">Online Material Catalogue</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900">
            Kenyan Building Materials, Timber &amp; Hardware
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Retail and wholesale pricing in KES. Automatic bulk discount tiers apply on qualifying quantities.
          </p>
        </div>

        {compareIds.length > 0 && (
          <Link
            to="/compare"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-royal-700 rounded-lg hover:bg-royal-600 self-start whitespace-nowrap"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Compare Selected ({compareIds.length}/4)</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8">
        {/* Sidebar Filters */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-900">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter Materials</span>
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-navy-900"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Keyword Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Search Brand or Item
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={queryText}
                  onChange={(e) => {
                    setQueryText(e.target.value);
                    const next = new URLSearchParams(searchParams);
                    if (e.target.value.trim()) next.set('q', e.target.value);
                    else next.delete('q');
                    setSearchParams(next);
                  }}
                  placeholder="e.g. Bamburi, Mabati, Cypress..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-royal-600"
                />
              </div>
            </div>

            {/* Category Selector */}
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Categories</p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-navy-900 text-white'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  All Categories ({products.filter((p) => p.isActive).length})
                </button>
                {categories.map((cat) => {
                  const count = products.filter((p) => p.isActive && p.categoryId === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                        selectedCategory === cat.id
                          ? 'bg-navy-900 text-white'
                          : 'text-slate-700 hover:bg-slate-200/70'
                      }`}
                    >
                      <span className="truncate pr-2">{cat.name}</span>
                      <span className="text-[11px] opacity-75 tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded border-slate-300 text-navy-900"
                />
                <span>In-Stock Yard Items Only</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoOnly}
                  onChange={(e) => setPromoOnly(e.target.checked)}
                  className="rounded border-slate-300 text-navy-900"
                />
                <span>Special Offers &amp; Promotions</span>
              </label>
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <p className="text-xs text-slate-600">
              Showing <strong className="text-slate-900 tabular-nums">{filteredProducts.length}</strong>{' '}
              certified items
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-xs text-slate-600 whitespace-nowrap">
                Sort by:
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-royal-600"
              >
                <option value="featured">Featured &amp; Best-Selling</option>
                <option value="price_asc">Price: Low to High (KES)</option>
                <option value="price_desc">Price: High to Low (KES)</option>
                <option value="name_asc">Alphabetical (A–Z)</option>
              </select>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <p className="text-base font-semibold text-navy-900">
                No catalogue items match your current filter criteria.
              </p>
              <p className="text-xs text-slate-600">
                Try clearing filters or submit a custom sourcing quotation request for specialized materials.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg"
                >
                  Clear All Filters
                </button>
                <Link
                  to="/request-quote"
                  className="px-4 py-2 text-xs font-semibold text-navy-900 bg-white border border-slate-300 rounded-lg"
                >
                  Request Custom Sourcing
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
