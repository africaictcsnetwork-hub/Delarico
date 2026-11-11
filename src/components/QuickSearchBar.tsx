import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Search, Tag, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatKes } from '../utils/whatsapp';
import { ResilientImage } from './ResilientImage';

interface QuickSearchBarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
}

const POPULAR_TERMS = [
  'Bamburi Cement',
  'Mabati G28',
  'Y12 Steel',
  'Cypress 4x2',
  'Water Tank',
  'Mahogany Door',
  'Wheelbarrow',
  'Weatherguard Paint',
];

export const QuickSearchBar: React.FC<QuickSearchBarProps> = ({
  searchTerm,
  setSearchTerm,
}) => {
  const navigate = useNavigate();
  const { products, categories, addToCart } = useStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const { matchedCategories, matchedProducts } = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      return { matchedCategories: [], matchedProducts: [] };
    }

    const cats = categories
      .filter((c) => c.isActive && c.name.toLowerCase().includes(q))
      .slice(0, 3);

    const prods = activeProducts
      .filter((p) => {
        const haystack =
          `${p.name} ${p.brand} ${p.categoryName} ${p.sku} ${p.specSummary} ${p.description}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const aName = a.name.toLowerCase().includes(q) ? 1 : 0;
        const bName = b.name.toLowerCase().includes(q) ? 1 : 0;
        if (bName !== aName) return bName - aName;
        return Number(b.bestSeller) - Number(a.bestSeller);
      })
      .slice(0, 6);

    return { matchedCategories: cats, matchedProducts: prods };
  }, [searchTerm, categories, activeProducts]);

  // Close on outside click
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Global keyboard shortcut: '/' or Ctrl+K to focus quick search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !isEditable)) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && matchedProducts[activeIndex]) {
      const target = matchedProducts[activeIndex];
      setIsOpen(false);
      navigate(`/product/${target.slug}`);
      return;
    }
    const q = searchTerm.trim();
    setIsOpen(false);
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!isOpen || matchedProducts.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % matchedProducts.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? matchedProducts.length - 1 : prev - 1));
    }
  };

  const trimmed = searchTerm.trim();

  return (
    <div ref={containerRef} className="flex-1 min-w-[220px] max-w-lg relative">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={searchTerm}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Quick search: Bamburi cement, Mabati G28, Cypress 4x2, Y12 steel..."
          aria-label="Quick search materials"
          className="w-full pl-10 pr-16 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-royal-600 shadow-2xs"
        />
        {trimmed ? (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            /
          </kbd>
        )}
      </form>

      {/* Live Quick Search Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {!trimmed ? (
            <div className="p-3.5 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Popular Yard Searches
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_TERMS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setSearchTerm(term);
                      setActiveIndex(-1);
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-navy-900 bg-slate-100 hover:bg-gold-500 hover:text-navy-950 rounded-md transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : matchedProducts.length === 0 && matchedCategories.length === 0 ? (
            <div className="p-5 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                No materials matched &ldquo;{searchTerm}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/request-quote');
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-royal-700 hover:underline"
              >
                <span>Request custom sourcing quote</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
              {matchedCategories.length > 0 && (
                <div className="px-3 py-2 bg-slate-50 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 mr-1">Categories:</span>
                  {matchedCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        navigate(`/products?category=${encodeURIComponent(cat.id)}`);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-royal-700 bg-white border border-slate-200 rounded-md hover:border-royal-600"
                    >
                      <Tag className="w-3 h-3" />
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="divide-y divide-slate-100">
                {matchedProducts.map((product, idx) => (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${
                      idx === activeIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        navigate(`/product/${product.slug}`);
                      }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                        <ResilientImage
                          src={product.images[0]}
                          alt={product.name}
                          eager
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {product.name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{product.categoryName}</span>
                          <span>·</span>
                          <span className="font-bold text-navy-900 tabular-nums">
                            {formatKes(product.priceKes)}
                          </span>
                          <span>/ {product.unit}</span>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => addToCart(product, 1)}
                      disabled={product.stockQty <= 0}
                      title="Quick Add to Cart"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-navy-950 bg-gold-500 rounded-md hover:bg-gold-400 disabled:bg-slate-200 disabled:text-slate-400 shrink-0 whitespace-nowrap"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Cart</span>
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate(`/products?q=${encodeURIComponent(trimmed)}`);
                }}
                className="w-full px-4 py-2.5 text-xs font-semibold text-royal-700 bg-slate-50 hover:bg-slate-100 flex items-center justify-center gap-1.5"
              >
                <span>View all search results for &ldquo;{trimmed}&rdquo;</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
