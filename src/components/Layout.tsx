import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  ArrowRight,
  FileText,
  Heart,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { NAV_LOGO_PATH } from '../firebase';
import { useStore } from '../context/StoreContext';
import { buildCartEnquiryMessage, buildWhatsAppUrl, formatKes } from '../utils/whatsapp';
import { QuickSearchBar } from './QuickSearchBar';
import { ResilientImage } from './ResilientImage';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    isAdmin,
    userProfile,
    settings,
    categories,
    products,
    cart,
    isCartOpen,
    setIsCartOpen,
    addToCart,
    updateCartQty,
    removeFromCart,
    getEffectiveUnitPrice,
    cartSubtotalKes,
    cartDiscountKes,
    appliedPromo,
    applyPromoCode,
    removePromoCode,
    compareIds,
    favouriteIds,
    toggleFavourite,
    clearSavedItems,
    isWishlistOpen,
    setIsWishlistOpen,
    quoteDraft,
    addToQuoteDraft,
    toasts,
    dismissToast,
  } = useStore();

  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [promoInput, setPromoInput] = useState('');

  useEffect(() => {
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const savedProducts = products.filter((p) => p.isActive && favouriteIds.includes(p.id));

  const directWaUrl = buildWhatsAppUrl(
    `Hello ${settings.businessName}, I am visiting your website and would like assistance with building materials and pricing.`,
    settings.whatsappNumber
  );

  const cartWaUrl = buildWhatsAppUrl(
    buildCartEnquiryMessage(cart, cartSubtotalKes - cartDiscountKes),
    settings.whatsappNumber
  );

  const navLinks = [
    { label: 'Shop Deals', path: '/' },
    { label: 'All Categories', path: '/products' },
    { label: 'Sell & Earn (3–5%)', path: '/affiliates' },
    { label: 'Bulk Quote', path: '/request-quote' },
    { label: 'Contact', path: '/contact' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 font-sans">
      {/* Strict 3-Zone Corporate Top Bar (Navy Blue & Gold) */}
      <header className="no-print sticky top-0 z-30 bg-navy-900 border-b border-gold-500/30 text-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 lg:px-8 h-16">
          {/* Zone 1: Brand Wordmark + Official Uploaded Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <span className="bg-white rounded-md p-1 flex items-center justify-center shadow-xs">
              <img
                src={NAV_LOGO_PATH}
                alt="DELARICO Official Logo"
                loading="eager"
                decoding="async"
                className="h-8 w-8 object-contain"
              />
            </span>
            <span>DELARICO MERCHANDISE</span>
          </Link>

          {/* Zone 2: 5 Clean Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-200">
            {navLinks.map((item) => {
              const active =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'text-gold-400 border-gold-400'
                      : 'border-transparent hover:text-white hover:border-gold-400/60'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action (plus mobile menu toggle on small screens) */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/request-quote"
              className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors whitespace-nowrap shrink-0"
            >
              Request Quote{quoteDraft.length > 0 ? ` (${quoteDraft.length})` : ''}
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 text-slate-200 hover:text-white rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Expandable Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-navy-950 border-t border-slate-800 px-4 py-4 space-y-3">
            <div className="flex flex-col space-y-2">
              {navLinks.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="py-2 text-sm font-medium text-slate-200 hover:text-gold-400"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/saved"
                className="py-2 text-sm font-medium text-gold-400 hover:text-gold-300"
              >
                Saved Items ({favouriteIds.length})
              </Link>
              <Link
                to="/services"
                className="py-2 text-sm font-medium text-slate-200 hover:text-gold-400"
              >
                Wholesale &amp; Delivery Services
              </Link>
              <Link
                to="/about"
                className="py-2 text-sm font-medium text-slate-200 hover:text-gold-400"
              >
                About Delarico
              </Link>
              {user ? (
                <Link
                  to="/account"
                  className="py-2 text-sm font-medium text-slate-200 hover:text-gold-400"
                >
                  My Account
                </Link>
              ) : (
                <>
                  <Link
                    to="/account"
                    className="py-2 text-sm font-medium text-slate-200 hover:text-gold-400"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/account?mode=register"
                    className="py-2 text-sm font-medium text-slate-200 hover:text-gold-400"
                  >
                    Create Quick Account
                  </Link>
                </>
              )}
              <Link
                to="/partnerships"
                className="py-2 text-sm font-medium text-slate-200 hover:text-gold-400"
              >
                Supplier Partnerships
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Storefront Utility Toolbar (Quick Search, Saved Items, Compare, Account, Cart) */}
      <div className="no-print bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <QuickSearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

          <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setIsWishlistOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-slate-300 whitespace-nowrap shrink-0"
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  favouriteIds.length > 0 ? 'fill-gold-500 text-gold-500' : 'text-navy-900'
                }`}
              />
              <span>Saved ({favouriteIds.length})</span>
            </button>

            <Link
              to="/compare"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-slate-300 whitespace-nowrap shrink-0"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-royal-700" />
              <span>Compare ({compareIds.length})</span>
            </Link>

            {user ? (
              <Link
                to="/account"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg hover:border-slate-300 whitespace-nowrap shrink-0"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span className="max-w-[130px] truncate">
                  {userProfile?.displayName || user.displayName || 'My Account'}
                </span>
              </Link>
            ) : (
              <>
                <Link
                  to="/account"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg hover:border-royal-600 whitespace-nowrap shrink-0"
                >
                  <UserCheck className="w-3.5 h-3.5 text-navy-900" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/account?mode=register"
                  className="inline-flex items-center px-3 py-2 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 whitespace-nowrap shrink-0"
                >
                  <span>Create Account</span>
                </Link>
              </>
            )}

            {isAdmin && (
              <Link
                to="/portal/workspace"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-royal-700 rounded-lg hover:bg-royal-600 whitespace-nowrap shrink-0"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-gold-400" />
              <span className="tabular-nums">
                Cart ({totalCartItems}) · {formatKes(cartSubtotalKes - cartDiscountKes)}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Corporate Navy Blue & Gold Footer */}
      <footer className="no-print bg-navy-950 text-slate-300 border-t-2 border-gold-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-slate-800">
            {/* Brand & Identity */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-1.5 shrink-0">
                  <img
                    src={NAV_LOGO_PATH}
                    alt="DELARICO Logo"
                    loading="lazy"
                    decoding="async"
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{settings.businessName}</p>
                  <p className="text-xs text-gold-400 font-medium mt-0.5">{settings.tagline}</p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                Trusted wholesale and retail supplier of Bamburi &amp; Simba cement, Devki steel bars,
                pressure-treated cypress timber, Alu-Zinc mabati, hardwood doors, water tanks, and hardware across Siaya County and Western Kenya.
              </p>
              <div className="space-y-1.5 text-xs">
                <p className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                  <span>{settings.location}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                  <a href={`tel:${settings.whatsappNumber}`} className="hover:text-white font-semibold tabular-nums">
                    {settings.whatsappNumber}
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                  <a href={`mailto:${settings.email}`} className="hover:text-white">
                    {settings.email}
                  </a>
                </p>
              </div>
            </div>

            {/* Product Categories */}
            <div>
              <h3 className="text-xs font-semibold text-gold-400 tracking-wider uppercase mb-4">
                Material Categories
              </h3>
              <ul className="space-y-2.5 text-xs">
                {categories.slice(0, 6).map((cat) => (
                  <li key={cat.id}>
                    <Link
                      to={`/products?category=${encodeURIComponent(cat.id)}`}
                      className="text-slate-300 hover:text-white transition-colors"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Corporate & Trade Services */}
            <div>
              <h3 className="text-xs font-semibold text-gold-400 tracking-wider uppercase mb-4">
                Customer &amp; Trade Links
              </h3>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <Link to="/affiliates" className="text-gold-400 font-semibold hover:text-gold-300 transition-colors">
                    Affiliate Program — Earn 3%–5% Commission
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="hover:text-white transition-colors">
                    Company Profile &amp; Values
                  </Link>
                </li>
                <li>
                  <Link to="/services" className="hover:text-white transition-colors">
                    Wholesale &amp; Site Delivery Services
                  </Link>
                </li>
                <li>
                  <Link to="/request-quote" className="hover:text-white transition-colors">
                    Request Project Quotation (BOQ)
                  </Link>
                </li>
                <li>
                  <Link to="/account" className="hover:text-white transition-colors">
                    Customer &amp; Contractor Accounts
                  </Link>
                </li>
                <li>
                  <Link to="/partnerships" className="hover:text-white transition-colors">
                    Supplier Partnership Portal
                  </Link>
                </li>
              </ul>
            </div>

            {/* Payment & Dispatch Assurance */}
            <div>
              <h3 className="text-xs font-semibold text-gold-400 tracking-wider uppercase mb-4">
                Payments &amp; Yard Dispatch
              </h3>
              <div className="space-y-2 text-xs text-slate-400">
                <p>
                  M-Pesa Payment Line:{' '}
                  <span className="text-white font-semibold tabular-nums">{settings.mpesaPaybillNumber}</span>
                </p>
                <p>
                  WhatsApp &amp; Sales Desk:{' '}
                  <span className="text-white font-semibold tabular-nums">{settings.whatsappNumber}</span>
                </p>
                <p>
                  Recipient: <span className="text-white">{settings.bankAccountName}</span>
                </p>
                <p className="pt-2 text-slate-400">
                  Free local Siaya delivery on verified orders above{' '}
                  <span className="text-gold-400 font-semibold tabular-nums">
                    {formatKes(settings.freeDeliveryThresholdKes)}
                  </span>.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href={directWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Us</span>
                </a>
                <a
                  href={`tel:${settings.whatsappNumber}`}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call {settings.whatsappNumber}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Quiet Footer Bottom Line */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>
              © {new Date().getFullYear()} {settings.businessName}. All rights reserved. Siaya, Kenya.
            </p>
            <div className="flex items-center gap-5">
              <a
                href={directWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                WhatsApp
              </a>
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Facebook
              </a>
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                LinkedIn
              </a>
              <Link to="/contact" className="hover:text-white transition-colors">
                Siaya Yard Map
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Slide-Over Shopping Cart Drawer */}
      {isCartOpen && (
        <div className="no-print fixed inset-0 z-50 flex justify-end bg-slate-950/50">
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl border-l border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-navy-900 text-white">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-gold-400" />
                <h2 className="text-sm font-semibold">Shopping Cart ({totalCartItems})</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                aria-label="Close cart drawer"
                className="p-1 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-14 space-y-3">
                  <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-medium text-slate-700">Your material cart is empty.</p>
                  <p className="text-xs text-slate-500">
                    Browse Bamburi cement, Mabati roofing sheets, treated timber, doors, and hardware supplies.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      navigate('/products');
                    }}
                    className="mt-2 inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800"
                  >
                    Browse Materials
                  </button>
                </div>
              ) : (
                cart.map(({ product, quantity }) => {
                  const unitPrice = getEffectiveUnitPrice(product, quantity);
                  const isWholesaleApplied = unitPrice < product.priceKes;
                  return (
                    <div
                      key={product.id}
                      className="flex gap-3.5 pb-4 border-b border-slate-100"
                    >
                      <div className="w-18 h-18 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 shrink-0">
                        <ResilientImage
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/product/${product.slug}`}
                          onClick={() => setIsCartOpen(false)}
                          className="text-xs font-semibold text-slate-900 hover:text-royal-700 line-clamp-2"
                        >
                          {product.name}
                        </Link>
                        <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                          {formatKes(unitPrice)} / {product.unit}
                          {isWholesaleApplied ? ' · Wholesale Rate' : ''}
                        </p>

                        <div className="flex items-center justify-between mt-2.5">
                          <div className="inline-flex items-center border border-slate-200 rounded-lg">
                            <button
                              type="button"
                              onClick={() => updateCartQty(product.id, quantity - 1)}
                              aria-label="Decrease quantity"
                              className="p-1.5 text-slate-600 hover:text-slate-900"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={product.stockQty}
                              value={quantity}
                              onChange={(e) => updateCartQty(product.id, Number(e.target.value) || 1)}
                              className="w-12 text-center text-xs font-semibold tabular-nums focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => updateCartQty(product.id, quantity + 1)}
                              aria-label="Increase quantity"
                              className="p-1.5 text-slate-600 hover:text-slate-900"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-navy-900 tabular-nums">
                              {formatKes(unitPrice * quantity)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFromCart(product.id)}
                              aria-label="Remove item"
                              className="p-1 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
                {/* Promotional Code Input */}
                <div>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                      <span className="font-medium text-emerald-800">
                        Promo {appliedPromo.code} active (-{formatKes(cartDiscountKes)})
                      </span>
                      <button
                        type="button"
                        onClick={removePromoCode}
                        className="text-emerald-900 underline font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="Promo code (e.g. CONTRACTOR5)"
                        className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg uppercase focus:outline-none focus:border-royal-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (applyPromoCode(promoInput)) setPromoInput('');
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-navy-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Materials Subtotal</span>
                    <span className="tabular-nums font-medium">{formatKes(cartSubtotalKes)}</span>
                  </div>
                  {cartDiscountKes > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Promotional Discount</span>
                      <span className="tabular-nums font-medium">-{formatKes(cartDiscountKes)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-navy-900 pt-2 border-t border-slate-200">
                    <span>Estimated Total</span>
                    <span className="tabular-nums">
                      {formatKes(cartSubtotalKes - cartDiscountKes)}
                    </span>
                  </div>
                </div>

                {/* Primary & WhatsApp Checkout Actions */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      navigate('/checkout');
                    }}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors"
                  >
                    Proceed to Checkout
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={cartWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp Order</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        cart.forEach((c) => {
                          addToQuoteDraft(c.product, c.quantity);
                        });
                        setIsCartOpen(false);
                        navigate('/request-quote');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Bulk Quote</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-Over Saved Items / Wishlist Drawer */}
      {isWishlistOpen && (
        <div className="no-print fixed inset-0 z-50 flex justify-end bg-slate-950/50">
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl border-l border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-navy-900 text-white">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-gold-400 fill-gold-400" />
                <h2 className="text-sm font-semibold">Saved Materials ({savedProducts.length})</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsWishlistOpen(false)}
                aria-label="Close saved items drawer"
                className="p-1 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {savedProducts.length === 0 ? (
                <div className="text-center py-14 space-y-3">
                  <Heart className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-medium text-slate-700">No saved items yet.</p>
                  <p className="text-xs text-slate-500">
                    Tap the heart icon on any cement, mabati, timber, or steel item to bookmark it here for later.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsWishlistOpen(false);
                      navigate('/products');
                    }}
                    className="mt-2 inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800"
                  >
                    Browse Hardware Catalogue
                  </button>
                </div>
              ) : (
                savedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex gap-3.5 pb-4 border-b border-slate-100"
                  >
                    <Link
                      to={`/product/${product.slug}`}
                      onClick={() => setIsWishlistOpen(false)}
                      className="w-18 h-18 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 shrink-0"
                    >
                      <ResilientImage
                        src={product.images[0]}
                        alt={product.name}
                        eager
                        className="w-full h-full object-cover"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/product/${product.slug}`}
                        onClick={() => setIsWishlistOpen(false)}
                        className="text-xs font-semibold text-slate-900 hover:text-royal-700 line-clamp-2"
                      >
                        {product.name}
                      </Link>
                      <p className="text-xs font-bold text-navy-900 tabular-nums mt-0.5">
                        {formatKes(product.priceKes)}{' '}
                        <span className="font-normal text-slate-500">/ {product.unit}</span>
                      </p>

                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          type="button"
                          onClick={() => addToCart(product, 1)}
                          disabled={product.stockQty <= 0}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-navy-950 bg-gold-500 rounded-md hover:bg-gold-400 disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          <ShoppingBag className="w-3 h-3" />
                          <span>{product.stockQty <= 0 ? 'Out of Stock' : 'Add to Cart'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavourite(product.id)}
                          aria-label={`Remove ${product.name} from saved items`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {savedProducts.length > 0 && (
              <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    savedProducts.forEach((p) => {
                      if (p.stockQty > 0) addToCart(p, 1);
                    });
                    setIsWishlistOpen(false);
                    setIsCartOpen(true);
                  }}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors"
                >
                  Move All to Cart
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/saved"
                    onClick={() => setIsWishlistOpen(false)}
                    className="inline-flex items-center justify-center gap-1 py-2 px-3 text-xs font-semibold text-navy-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                  >
                    <span>Full Saved Page</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => clearSavedItems()}
                    className="inline-flex items-center justify-center gap-1 py-2 px-3 text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear List</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Official Floating WhatsApp Button (+254 706 824489) */}
      <a
        href={directWaUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Chat with DELARICO on WhatsApp (${settings.whatsappNumber})`}
        className="no-print fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-lg hover:bg-emerald-700 transition-transform duration-150 hover:-translate-y-0.5"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="hidden sm:inline">WhatsApp {settings.whatsappNumber}</span>
      </a>

      {/* Non-Blocking Toast Notifications */}
      {toasts.length > 0 && (
        <div className="no-print fixed bottom-18 right-5 z-50 flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-md border text-xs font-medium ${
                t.tone === 'error'
                  ? 'bg-red-50 text-red-900 border-red-200'
                  : t.tone === 'success'
                  ? 'bg-navy-900 text-white border-gold-500/50'
                  : 'bg-white text-slate-800 border-slate-200'
              }`}
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="opacity-70 hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
