import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  MessageCircle,
  Phone,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { OFFICIAL_LOGO_PATH } from '../firebase';
import { useStore } from '../context/StoreContext';
import { HERO_YARD_VISUAL } from '../utils/productVisuals';
import { buildWhatsAppUrl, formatKes } from '../utils/whatsapp';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';

export const HomePage: React.FC = () => {
  const { categories, products, promotions, settings } = useStore();
  const [collectionTab, setCollectionTab] = useState<'featured' | 'bestsellers' | 'promotions'>('featured');

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const displayedProducts = useMemo(() => {
    if (collectionTab === 'bestsellers') {
      return activeProducts.filter((p) => p.bestSeller).slice(0, 6);
    }
    if (collectionTab === 'promotions') {
      return activeProducts.filter((p) => p.onPromotion).slice(0, 6);
    }
    const feat = activeProducts.filter((p) => p.featured);
    return (feat.length > 0 ? feat : activeProducts).slice(0, 6);
  }, [activeProducts, collectionTab]);

  const heroWaUrl = buildWhatsAppUrl(
    `Hello ${settings.businessName}, I would like to enquire about building materials and site delivery in Siaya.`,
    settings.whatsappNumber
  );

  const testimonials = [
    {
      quote:
        'Ordering Bamburi PowerPlus 42.5N cement, Devki Y12 deformed steel bars, and treated cypress rafters from Delarico cut our site waiting time in Siaya Town from four days to same-day yard dispatch.',
      author: 'Eng. Otieno Odhiambo',
      role: 'Lead Civil Engineer',
      organization: 'Lake Basin Structural Builders Ltd, Siaya',
    },
    {
      quote:
        'Every consignment of Gauge 28 Box Profile mabati and solid mahogany panel doors arrived true to specification with clear invoices. Their wholesale contractor rates saved us 11% on our Bondo classroom wing.',
      author: 'Grace Anyango',
      role: 'Procurement Director',
      organization: 'West Nyanza Institutional Contractors',
    },
    {
      quote:
        'Building our family home in Ugunja while working in Nairobi was stress-free. Delarico confirmed our M-Pesa payment promptly and delivered cement, BRC mesh, and a 5,000L Kentank straight to our foreman.',
      author: 'David Ouma',
      role: 'Homeowner & Developer',
      organization: 'Ugunja Residential Project',
    },
  ];

  return (
    <div className="font-sans">
      {/* 1. Welcoming Hero Section with Real Yard Photography */}
      <section className="bg-navy-900 text-white border-b border-gold-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            {/* Left Copy & Clear Actions */}
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="flex items-center flex-wrap gap-2 text-xs sm:text-sm font-medium text-gold-400">
                <span>Siaya, Kenya</span>
                <span aria-hidden="true">·</span>
                <span>Built on Quality. Driven by Trust.</span>
              </div>

              <h1
                className="font-display font-bold tracking-tight text-white leading-[1.14]"
                style={{ fontSize: 'clamp(2.15rem, 3.6vw, 3.35rem)', textWrap: 'balance' }}
              >
                Genuine Kenyan Building Materials, Timber &amp; Hardware Delivered to Your Site
              </h1>

              <p className="text-base text-slate-200 leading-relaxed max-w-xl">
                Shop KEBS-certified Bamburi &amp; Simba cement, Devki steel bars, Maisha Alu-Zinc mabati,
                pressure-treated cypress timber, mahogany doors, water tanks, and site tools from{' '}
                <strong className="text-white font-semibold">{settings.businessName}</strong>—at transparent
                retail and wholesale prices.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors whitespace-nowrap shadow-sm"
                >
                  <span>Shop Materials</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/request-quote"
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold text-white bg-navy-800 border border-slate-700 rounded-lg hover:border-gold-400 transition-colors whitespace-nowrap"
                >
                  <FileText className="w-4 h-4 text-gold-400" />
                  <span>Request Bulk Quote</span>
                </Link>
                <a
                  href={heroWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Us</span>
                </a>
              </div>

              <div className="pt-1 flex items-center flex-wrap gap-4 text-xs sm:text-sm text-slate-300">
                <a
                  href={`tel:${settings.whatsappNumber}`}
                  className="inline-flex items-center gap-1.5 text-white hover:text-gold-400 font-semibold tabular-nums"
                >
                  <Phone className="w-4 h-4 text-gold-400" />
                  <span>Call / M-Pesa: {settings.whatsappNumber}</span>
                </a>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>Open Mon–Sat in Siaya, Bondo &amp; Ugunja</span>
              </div>
            </div>

            {/* Right Real Kenyan Hardware Yard Photograph */}
            <div className="lg:col-span-6 flex">
              <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/80 bg-navy-950 shadow-xl">
                <ResilientImage
                  src={HERO_YARD_VISUAL}
                  alt="DELARICO Building Materials, Cement, Timber & Mabati Supply Yard in Siaya, Kenya"
                  className="w-full h-full object-cover min-h-[300px] lg:min-h-[380px]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/95 via-navy-950/60 to-transparent p-5 pt-14">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-white rounded-lg p-1.5 shrink-0 shadow-sm">
                        <img src={OFFICIAL_LOGO_PATH} alt="DELARICO Crest" className="w-9 h-9 object-contain" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Fast Loading &amp; Tracked Lorry Delivery</p>
                        <p className="text-xs text-slate-200">Siaya Town HQ · Bondo Depot · Ugunja Yard</p>
                      </div>
                    </div>
                    <Link
                      to="/products"
                      className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-gold-400 hover:text-gold-300 whitespace-nowrap"
                    >
                      <span>Browse Stock</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Customer Assurance Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12 pt-8 border-t border-slate-800">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gold-400 tabular-nums">
                100% KEBS
              </p>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Genuine Kenyan Mill Brands &amp; True Sheet Gauges
              </p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-white">
                Same-Day
              </p>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Yard Loading &amp; Site Dispatch Across Siaya County
              </p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-white">
                Wholesale Rates
              </p>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Automatic Bulk Discounts for Fundis &amp; Contractors
              </p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gold-400 tabular-nums">
                {formatKes(settings.freeDeliveryThresholdKes)}
              </p>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Free Local Siaya Delivery on Qualifying Orders
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Visual Shop by Category Grid (Real Kenyan Material Photos) */}
      <section className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-9">
            <div>
              <p className="text-xs font-semibold text-royal-700 mb-1">Shop by Department</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">
                Everything You Need from Foundation to Roofing
              </h2>
            </div>
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal-700 hover:text-navy-900 whitespace-nowrap"
            >
              <span>View All Materials</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => {
              const count = activeProducts.filter((p) => p.categoryId === cat.id).length;
              return (
                <Link
                  key={cat.id}
                  to={`/products?category=${encodeURIComponent(cat.id)}`}
                  className="group flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-royal-600 hover:shadow-md transition-all duration-150"
                >
                  <div className="aspect-[16/10] bg-slate-100 overflow-hidden relative">
                    <ResilientImage
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-navy-900 group-hover:text-royal-700 transition-colors">
                          {cat.name}
                        </h3>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-royal-700 shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mt-1.5 leading-relaxed">
                        {cat.description}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-royal-700 mt-3 pt-3 border-t border-slate-100 tabular-nums">
                      Browse {count} stocked items
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Featured Kenyan Materials, Best-Sellers & Special Offers */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs font-semibold text-royal-700 mb-1">In-Stock Yard Catalogue</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">
                Popular Building Materials &amp; Hardware
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Order online for fast site delivery or yard pickup, or tap the WhatsApp button on any item.
              </p>
            </div>

            {/* Interactive Segmented Filter Tabs */}
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setCollectionTab('featured')}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  collectionTab === 'featured'
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Featured Materials
              </button>
              <button
                type="button"
                onClick={() => setCollectionTab('bestsellers')}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  collectionTab === 'bestsellers'
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Best-Sellers
              </button>
              <button
                type="button"
                onClick={() => setCollectionTab('promotions')}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  collectionTab === 'promotions'
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Special Offers
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {displayedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Active Trade Promotional Vouchers */}
          {promotions.length > 0 && (
            <div className="mt-12 p-6 bg-navy-900 text-white rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <p className="text-xs font-semibold text-gold-400 mb-1">Current Builder &amp; Seasonal Offers</p>
                <h3 className="text-lg font-bold">
                  {promotions[0].title} — {promotions[0].description}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {promotions.slice(0, 3).map((promo) => (
                  <div
                    key={promo.id}
                    className="px-3.5 py-2 bg-navy-800 border border-gold-500/40 rounded-lg text-xs"
                  >
                    <span className="font-bold text-gold-400">{promo.code}</span>
                    <span className="text-slate-200 ml-2 tabular-nums">
                      {promo.discountType === 'percentage'
                        ? `${promo.discountValue}% OFF`
                        : `${formatKes(promo.discountValue)} OFF`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 text-center">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors"
            >
              <span>Explore Full {activeProducts.length}-Item Catalogue</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Why Builders Choose Delarico + Real Client Testimonials */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-semibold text-royal-700">Why Choose Delarico</p>
              <h2
                className="text-2xl sm:text-3xl font-bold text-navy-900"
                style={{ textWrap: 'balance' }}
              >
                Reliable Building Supply for Homeowners, Fundis &amp; Contractors
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Based in Siaya, Kenya, DELARICO MERCHANDISE &amp; SUPPLIES connects you directly to
                trusted Kenyan manufacturers—eliminating middleman markups, undersized timber, and
                site delivery delays whether you are roofing a home or managing a county project.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <Link
                  to="/request-quote"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400"
                >
                  <span>Get a Free BOQ Quote</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  to="/account"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-navy-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  <span>Create Customer / Contractor Account</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-2">
                <ShieldCheck className="w-6 h-6 text-gold-600" />
                <h3 className="text-base font-semibold text-navy-900">Genuine Brands &amp; Full Weight</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Factory-sealed Bamburi &amp; Simba cement, true Gauge 28 &amp; 30 Alu-Zinc mabati, and
                  straight kiln-dried CCA treated structural timber.
                </p>
              </div>
              <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-2">
                <Building2 className="w-6 h-6 text-royal-700" />
                <h3 className="text-base font-semibold text-navy-900">Automatic Wholesale Pricing</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Save automatically when ordering bulk quantities, or register a contractor/institution
                  account for trade rates across your entire build.
                </p>
              </div>
              <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-2">
                <Truck className="w-6 h-6 text-royal-700" />
                <h3 className="text-base font-semibold text-navy-900">Prompt Site Delivery</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Scheduled lorry dispatch from Siaya Town, Bondo, and Ugunja depots directly to your
                  site across Nyanza and Western Kenya.
                </p>
              </div>
              <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-2">
                <CheckCircle2 className="w-6 h-6 text-gold-600" />
                <h3 className="text-base font-semibold text-navy-900">Easy M-Pesa &amp; Digital Receipts</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Simple payment via {settings.whatsappNumber} with instant proforma invoices, verified
                  receipts, and real-time order tracking—ideal for local and diaspora builders.
                </p>
              </div>
            </div>
          </div>

          {/* Attributable Testimonials */}
          <div className="pt-10 border-t border-slate-200">
            <div className="mb-8">
              <p className="text-xs font-semibold text-royal-700 mb-1">Customer Feedback</p>
              <h2 className="text-2xl font-bold text-navy-900">Trusted by Builders Across Siaya &amp; Beyond</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((item) => (
                <blockquote
                  key={item.author}
                  className="p-6 bg-white border border-slate-200 rounded-xl flex flex-col justify-between"
                >
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-6">
                    “{item.quote}”
                  </p>
                  <footer className="pt-4 border-t border-slate-100">
                    <p className="text-sm font-semibold text-navy-900">{item.author}</p>
                    <p className="text-xs text-slate-500">
                      {item.role} · {item.organization}
                    </p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
