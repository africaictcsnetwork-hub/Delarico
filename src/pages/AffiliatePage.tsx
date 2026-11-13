import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  MessageCircle,
  Search,
  Share2,
  Smartphone,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { AffiliateProfile, AffiliateReferral } from '../types';
import { ResilientImage } from '../components/ResilientImage';
import {
  buildAffiliateShareMessage,
  buildWhatsAppUrl,
  formatKes,
  getProductCommissionRatePct,
} from '../utils/whatsapp';

export const AffiliatePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    userContact,
    products,
    categories,
    settings,
    loginWithPhone,
    registerWithPhone,
    apiFetch,
    notify,
  } = useStore();

  const [affiliate, setAffiliate] = useState<AffiliateProfile | null>(null);
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);

  // Guest Quick Registration / Sign In State
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Logged-in M-Pesa phone input for 1-click activation
  const [payoutPhone, setPayoutPhone] = useState('');

  // Product Share Catalog Filter
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadAffiliateDashboard = useCallback(async () => {
    if (!user) {
      setAffiliate(null);
      setReferrals([]);
      return;
    }
    setLoadingProfile(true);
    try {
      const data = await apiFetch<{
        affiliate: AffiliateProfile | null;
        referrals: AffiliateReferral[];
      }>('/api/affiliates/me');
      setAffiliate(data.affiliate);
      setReferrals(data.referrals || []);
    } catch {
      // User may not have enrolled yet
    } finally {
      setLoadingProfile(false);
    }
  }, [user, apiFetch]);

  useEffect(() => {
    void loadAffiliateDashboard();
  }, [loadAffiliateDashboard]);

  useEffect(() => {
    if (userContact?.phone && !payoutPhone) {
      setPayoutPhone(userContact.phone);
    }
  }, [userContact, payoutPhone]);

  const handleEnrollLoggedIn = async (mpesaNumber?: string) => {
    setEnrolling(true);
    try {
      const res = await apiFetch<{ affiliate: AffiliateProfile }>('/api/affiliates/enroll', {
        method: 'POST',
        body: JSON.stringify({
          mpesaPhone: (mpesaNumber || payoutPhone || userContact?.phone || '').trim(),
        }),
      });
      setAffiliate(res.affiliate);
      notify(`Affiliate account active! Your code is ${res.affiliate.affiliateCode}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not activate affiliate account.', 'error');
    } finally {
      setEnrolling(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim().length < 7 || password.length < 4) {
      notify('Enter a valid M-Pesa phone number and a password (at least 4 characters).', 'error');
      return;
    }
    setSubmittingAuth(true);
    try {
      const sessionUser =
        authMode === 'register'
          ? await registerWithPhone({
              displayName: fullName.trim() || 'Affiliate Partner',
              phone: phone.trim(),
              password,
            })
          : await loginWithPhone(phone.trim(), password);

      if (!sessionUser) {
        setSubmittingAuth(false);
        return;
      }

      if (sessionUser.isAdmin) {
        navigate('/portal/workspace', { replace: true });
        return;
      }

      const enrollRes = await apiFetch<{ affiliate: AffiliateProfile }>('/api/affiliates/enroll', {
        method: 'POST',
        body: JSON.stringify({ mpesaPhone: phone.trim() }),
      });
      setAffiliate(enrollRes.affiliate);
      notify(
        `Welcome! Your free affiliate link (${enrollRes.affiliate.affiliateCode}) is ready to share.`,
        'success'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Registration failed.', 'error');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!affiliate) return;
    setRequestingPayout(true);
    try {
      await apiFetch('/api/affiliates/payout', {
        method: 'PATCH',
        body: JSON.stringify({ mpesaPhone: payoutPhone || affiliate.mpesaPhone }),
      });
      await loadAffiliateDashboard();
      notify(
        'M-Pesa payout requested! Our finance desk will disburse to your M-Pesa line shortly.',
        'success'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not request payout.', 'error');
    } finally {
      setRequestingPayout(false);
    }
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://delarico.co.ke';
  const storeReferralUrl = affiliate ? `${originUrl}/?ref=${affiliate.affiliateCode}` : `${originUrl}/`;

  const copyText = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      notify(`${label} copied! Share it on WhatsApp or social media.`, 'success');
      window.setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2500);
    } catch {
      notify('Unable to copy automatically — please select and copy the link.', 'info');
    }
  };

  const sellableProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products
      .filter((p) => p.isActive)
      .filter((p) => {
        if (selectedCat !== 'all' && p.categoryId !== selectedCat) return false;
        if (q && !`${p.name} ${p.categoryName} ${p.brand}`.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [products, selectedCat, searchTerm]);

  return (
    <div className="bg-slate-50 min-h-screen py-8 sm:py-10 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Hero + Free Registration / Active Referral Hub */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Program Pitch & 3-5% Commission Tiers */}
          <div className="lg:col-span-7 bg-navy-900 text-white rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-gold-400">
                Delarico Affiliate Sales Network · 100% Free to Join
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight text-balance">
                Sell Kenyan Building Materials &amp; Earn 3%–5% Cash Commission
              </h1>
              <p className="text-sm text-slate-200 leading-relaxed">
                Turn your WhatsApp Status, Facebook page, or contractor contacts into steady income.
                Register for free, share Delarico product links, and earn automatic commission on
                every verified order — paid straight to your M-Pesa.
              </p>
            </div>

            {/* Commission Structure Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-white/10 border border-white/15 rounded-xl p-4">
                <div className="text-2xl font-bold text-gold-400 tabular-nums">3%</div>
                <div className="text-xs font-semibold text-white mt-1">Heavy Structural</div>
                <p className="text-xs text-slate-300 mt-1">
                  Bamburi &amp; Simba Cement, Y12/Y16 Steel Bars, Box Profile Mabati
                </p>
              </div>
              <div className="bg-white/10 border border-white/15 rounded-xl p-4">
                <div className="text-2xl font-bold text-gold-400 tabular-nums">4%</div>
                <div className="text-xs font-semibold text-white mt-1">Timber, Doors &amp; Tanks</div>
                <p className="text-xs text-slate-300 mt-1">
                  Cypress Timber, Mahogany Doors, Steel Windows, 5,000L Water Tanks &amp; BRC Mesh
                </p>
              </div>
              <div className="bg-white/10 border border-white/15 rounded-xl p-4">
                <div className="text-2xl font-bold text-gold-400 tabular-nums">5%</div>
                <div className="text-xs font-semibold text-white mt-1">Hardware, Tools &amp; Solar</div>
                <p className="text-xs text-slate-300 mt-1">
                  Cordless Drills, Mortice Locks, Crown Weatherguard Paint, Solar Floodlights &amp; PPE
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-200">
              <div>
                <span className="font-bold text-gold-400">01. Register Free</span>
                <p className="text-slate-300 mt-0.5">Takes 15 seconds with your M-Pesa phone number.</p>
              </div>
              <div>
                <span className="font-bold text-gold-400">02. Share Links</span>
                <p className="text-slate-300 mt-0.5">Post any product link on WhatsApp, Facebook, or to fundis.</p>
              </div>
              <div>
                <span className="font-bold text-gold-400">03. M-Pesa Payout</span>
                <p className="text-slate-300 mt-0.5">Withdraw approved commissions directly to M-Pesa.</p>
              </div>
            </div>
          </div>

          {/* Right: Registration Card OR Active Affiliate Referral Link Card */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7">
            {!user ? (
              <form onSubmit={handleGuestSubmit} className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-navy-900">
                      {authMode === 'register' ? 'Register Free Affiliate Account' : 'Affiliate Sign In'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {authMode === 'register'
                        ? 'Zero fees. Get your referral link immediately.'
                        : 'Sign in with your phone number to view earnings.'}
                    </p>
                  </div>
                  <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className={`px-2.5 py-1 rounded-md font-semibold ${
                        authMode === 'register' ? 'bg-white text-navy-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Join Free
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className={`px-2.5 py-1 rounded-md font-semibold ${
                        authMode === 'login' ? 'bg-white text-navy-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Sign In
                    </button>
                  </div>
                </div>

                {authMode === 'register' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Kevin Omondi"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    M-Pesa Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={25}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0712 345 678"
                    className="w-full px-3.5 py-2.5 text-sm tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {authMode === 'register' ? 'Choose Password or 4-Digit PIN *' : 'Password *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      minLength={4}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 4 characters"
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 disabled:opacity-50 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {submittingAuth
                      ? 'Activating Account...'
                      : authMode === 'register'
                      ? 'Register Free & Get My Affiliate Link'
                      : 'Sign In to Affiliate Portal'}
                  </span>
                </button>
              </form>
            ) : loadingProfile ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Loading your affiliate dashboard...
              </div>
            ) : !affiliate ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-navy-900">
                  Activate Your Free Affiliate Link
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Signed in as <strong>{user.displayName}</strong>. Confirm your M-Pesa payout phone
                  number below to unlock your unique referral code immediately.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    M-Pesa Payout Number *
                  </label>
                  <input
                    type="tel"
                    value={payoutPhone}
                    onChange={(e) => setPayoutPhone(e.target.value)}
                    placeholder="e.g. 0712 345 678"
                    className="w-full px-3.5 py-2.5 text-sm tabular-nums border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="button"
                  disabled={enrolling}
                  onClick={() => void handleEnrollLoggedIn()}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 disabled:opacity-50"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{enrolling ? 'Activating...' : 'Activate Free Affiliate Account'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <p className="text-xs font-semibold text-emerald-700">Active Affiliate Partner</p>
                    <h2 className="text-lg font-bold text-navy-900">{affiliate.displayName}</h2>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Referral Code</div>
                    <div className="text-sm font-bold font-mono text-royal-700">
                      {affiliate.affiliateCode}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Main Storefront Referral Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={storeReferralUrl}
                      className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => void copyText(storeReferralUrl, 'main-link', 'Storefront referral link')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 shrink-0"
                    >
                      {copiedId === 'main-link' ? (
                        <Check className="w-3.5 h-3.5 text-gold-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === 'main-link' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] text-slate-500">Available M-Pesa Balance</div>
                    <div className="text-base font-bold text-emerald-700 tabular-nums mt-0.5">
                      {formatKes(affiliate.availableCommissionKes)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] text-slate-500">Pending Order Verification</div>
                    <div className="text-base font-bold text-amber-700 tabular-nums mt-0.5">
                      {formatKes(affiliate.pendingCommissionKes)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={
                      requestingPayout ||
                      affiliate.payoutRequested ||
                      affiliate.availableCommissionKes < 100
                    }
                    onClick={() => void handleRequestPayout()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 disabled:bg-slate-200 disabled:text-slate-500 transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>
                      {affiliate.payoutRequested
                        ? 'M-Pesa Payout Processing'
                        : 'Withdraw to M-Pesa'}
                    </span>
                  </button>
                  <a
                    href={buildWhatsAppUrl(
                      `Hello Delarico Merchandise! Shop genuine cement, mabati, timber & hardware at yard prices here: ${storeReferralUrl}`,
                      ''
                    ).replace('https://wa.me/254706824489', 'https://wa.me/')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Share on WhatsApp</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Earnings KPI Strip (Shown when enrolled) */}
        {affiliate && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Link Clicks</div>
              <div className="text-xl font-bold text-navy-900 tabular-nums mt-1">
                {affiliate.totalClicks.toLocaleString()}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Referred Orders</div>
              <div className="text-xl font-bold text-navy-900 tabular-nums mt-1">
                {affiliate.totalReferrals.toLocaleString()}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Sales Volume</div>
              <div className="text-xl font-bold text-navy-900 tabular-nums mt-1">
                {formatKes(affiliate.totalSalesKes)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Ready to Withdraw</div>
              <div className="text-xl font-bold text-emerald-700 tabular-nums mt-1">
                {formatKes(affiliate.availableCommissionKes)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-500">Total Paid Out</div>
              <div className="text-xl font-bold text-royal-700 tabular-nums mt-1">
                {formatKes(affiliate.paidCommissionKes)}
              </div>
            </div>
          </div>
        )}

        {/* Product-by-Product "Sell & Earn" Marketplace Catalog */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-royal-700" />
                <h2 className="text-lg font-bold text-navy-900">
                  Products to Sell — Instant Commission Calculator &amp; Share Links
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {affiliate
                  ? `Every link below automatically embeds your affiliate code (${affiliate.affiliateCode}).`
                  : 'Preview how much you earn per product — register free above to generate your personal links.'}
              </p>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products to promote..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCat('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                selectedCat === 'all'
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Products
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCat(c.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                  selectedCat === c.id
                    ? 'bg-navy-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sellableProducts.map((product) => {
              const ratePct = getProductCommissionRatePct(
                product.categoryId,
                affiliate?.commissionRatePct || 3
              );
              const unitEarnKes = Math.round((product.priceKes * ratePct) / 100);
              const bulkPackEarnKes = Math.round(
                (product.wholesalePriceKes * product.minWholesaleQty * ratePct) / 100
              );
              const productRefUrl = affiliate
                ? `${originUrl}/product/${product.slug}?ref=${affiliate.affiliateCode}`
                : `${originUrl}/product/${product.slug}`;
              const waPitch = buildAffiliateShareMessage(product, productRefUrl);
              const waShareHref = `https://wa.me/?text=${encodeURIComponent(waPitch)}`;

              return (
                <div
                  key={product.id}
                  className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white"
                >
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                    <ResilientImage
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <span className="truncate">{product.categoryName}</span>
                      <span>·</span>
                      <span className="font-semibold text-emerald-700 tabular-nums">
                        {ratePct}% Commission
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 mb-2">
                      {product.name}
                    </h3>

                    <div className="mt-auto pt-2.5 border-t border-slate-100 space-y-2">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-slate-500">Customer Price:</span>
                        <span className="font-bold text-navy-900 tabular-nums">
                          {formatKes(product.priceKes)} / {product.unit}
                        </span>
                      </div>
                      <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs">
                        <div className="flex items-center justify-between font-bold text-emerald-900 tabular-nums">
                          <span>You Earn ({ratePct}%):</span>
                          <span>{formatKes(unitEarnKes)} / {product.unit}</span>
                        </div>
                        <div className="text-[11px] text-emerald-700 mt-0.5 tabular-nums">
                          {product.minWholesaleQty} {product.unit}s order = {formatKes(bulkPackEarnKes)}
                        </div>
                      </div>

                      {affiliate ? (
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              void copyText(productRefUrl, product.id, `${product.name} link`)
                            }
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 whitespace-nowrap"
                          >
                            {copiedId === product.id ? (
                              <Check className="w-3.5 h-3.5 text-gold-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedId === product.id ? 'Copied' : 'Copy Link'}</span>
                          </button>
                          <a
                            href={waShareHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                          className="w-full py-2 px-3 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400"
                        >
                          Register Free Above to Sell
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Referred Orders History Ledger */}
        {affiliate && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-navy-900" />
                <h2 className="text-base font-bold text-navy-900">
                  Your Referred Sales &amp; Commission Ledger
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                Payout Line: <strong className="tabular-nums">{affiliate.mpesaPhone || settings.whatsappNumber}</strong>
              </span>
            </div>

            {referrals.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No referred orders yet. Share any product link above on WhatsApp or social media to earn your first 3%–5% commission!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 pr-4 font-semibold">Order #</th>
                      <th className="py-2.5 px-3 font-semibold">Order Amount</th>
                      <th className="py-2.5 px-3 font-semibold">Avg Rate</th>
                      <th className="py-2.5 px-3 font-semibold">Your Commission</th>
                      <th className="py-2.5 pl-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {referrals.map((ref) => (
                      <tr key={ref.id}>
                        <td className="py-3 pr-4 font-semibold text-navy-900 tabular-nums">
                          #{ref.orderNumber}
                        </td>
                        <td className="py-3 px-3 tabular-nums text-slate-700">
                          {formatKes(ref.orderTotalKes)}
                        </td>
                        <td className="py-3 px-3 tabular-nums text-slate-600">
                          {ref.commissionRatePct}%
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-700 tabular-nums">
                          {formatKes(ref.commissionKes)}
                        </td>
                        <td className="py-3 pl-3 text-right font-semibold capitalize">
                          <span
                            className={
                              ref.status === 'paid'
                                ? 'text-royal-700'
                                : ref.status === 'approved'
                                ? 'text-emerald-700'
                                : ref.status === 'cancelled'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }
                          >
                            {ref.status === 'pending'
                              ? 'Pending Verification'
                              : ref.status === 'approved'
                              ? 'Approved (Ready)'
                              : ref.status === 'paid'
                              ? 'Paid via M-Pesa'
                              : 'Cancelled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
