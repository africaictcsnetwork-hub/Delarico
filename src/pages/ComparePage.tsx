import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatKes } from '../utils/whatsapp';
import { ResilientImage } from '../components/ResilientImage';

export const ComparePage: React.FC = () => {
  const { products, compareIds, toggleCompare, clearCompare, addToCart, addToQuoteDraft } = useStore();

  const comparedProducts = useMemo(
    () => compareIds.map((id) => products.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [compareIds, products]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-semibold text-royal-700 mb-1">Specification Comparison</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900">Compare Building Materials</h1>
          <p className="text-sm text-slate-600 mt-1">
            Evaluate retail rates, wholesale bulk thresholds, dimensions, and KEBS grades side by side.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {comparedProducts.length > 0 && (
            <button
              type="button"
              onClick={clearCompare}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Products</span>
          </Link>
        </div>
      </div>

      {comparedProducts.length === 0 ? (
        <div className="p-14 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <p className="text-base font-semibold text-navy-900">No products selected for comparison yet.</p>
          <p className="text-xs text-slate-600">
            Click the comparison arrows on up to 4 product cards in the catalogue to inspect specifications side by side.
          </p>
          <Link
            to="/products"
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Browse Product Catalogue</span>
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
          <table className="w-full min-w-[720px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-4 w-48 font-semibold text-slate-600 align-top">Attribute</th>
                {comparedProducts.map((product) => (
                  <th key={product.id} className="p-4 align-top border-l border-slate-200">
                    <div className="relative space-y-3">
                      <button
                        type="button"
                        onClick={() => toggleCompare(product.id)}
                        aria-label="Remove from comparison"
                        className="absolute top-1 right-1 p-1 bg-white/90 border border-slate-200 rounded-md text-slate-500 hover:text-red-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="aspect-[4/3] rounded-lg overflow-hidden bg-white border border-slate-200">
                        <ResilientImage
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Link
                        to={`/product/${product.slug}`}
                        className="block text-sm font-bold text-navy-900 hover:text-royal-700"
                      >
                        {product.name}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">SKU &amp; Category</td>
                {comparedProducts.map((p) => (
                  <td key={p.id} className="p-4 border-l border-slate-200">
                    <span className="font-semibold text-slate-900">{p.sku}</span> · {p.categoryName}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Retail Price (KES)</td>
                {comparedProducts.map((p) => (
                  <td key={p.id} className="p-4 border-l border-slate-200 text-sm font-bold text-navy-900 tabular-nums">
                    {formatKes(p.priceKes)} / {p.unit}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Wholesale Rate</td>
                {comparedProducts.map((p) => (
                  <td key={p.id} className="p-4 border-l border-slate-200 text-emerald-700 font-semibold tabular-nums">
                    {formatKes(p.wholesalePriceKes)} ({p.minWholesaleQty}+ {p.unit}s)
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Yard Stock</td>
                {comparedProducts.map((p) => (
                  <td key={p.id} className="p-4 border-l border-slate-200 tabular-nums">
                    {p.stockQty > 0 ? `${p.stockQty.toLocaleString()} ${p.unit}s` : 'Out of Stock'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Dimensions</td>
                {comparedProducts.map((p) => (
                  <td key={p.id} className="p-4 border-l border-slate-200 text-slate-800">{p.dimensions}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Brand / Standard</td>
                {comparedProducts.map((p) => (
                  <td key={p.id} className="p-4 border-l border-slate-200 text-slate-800">{p.brand}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Unit Weight</td>
                {comparedProducts.map((p) => (
                  <td key={p.id} className="p-4 border-l border-slate-200 tabular-nums">{p.weightKg} kg</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Specification Notes</td>
                {comparedProducts.map((p) => (
                  <td key={p.id} className="p-4 border-l border-slate-200 text-slate-600 leading-relaxed">
                    {p.specSummary}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Actions</td>
                {comparedProducts.map((p) => (
                  <td key={p.id} className="p-4 border-l border-slate-200 space-y-2">
                    <button
                      type="button"
                      onClick={() => addToCart(p, 1)}
                      disabled={p.stockQty <= 0}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-navy-900 text-white font-semibold rounded-lg hover:bg-navy-800 disabled:bg-slate-300"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Add to Cart</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addToQuoteDraft(p, p.minWholesaleQty)}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Add to Bulk Quote</span>
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
