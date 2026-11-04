import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Heart,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
  UserCheck,
} from 'lucide-react';
import { OFFICIAL_LOGO_PATH } from '../firebase';
import { useStore } from '../context/StoreContext';
import {
  AccountType,
  CustomerEnquiry,
  DeliveryAddress,
  Order,
  OrderItem,
  QuotationRequest,
} from '../types';
import { ProductCard } from '../components/ProductCard';
import { InvoiceModal } from '../components/InvoiceModal';
import { buildOrderFollowUpMessage, buildWhatsAppUrl, formatKes } from '../utils/whatsapp';

type AccountTab = 'orders' | 'quotations' | 'profile' | 'addresses' | 'favourites' | 'enquiries';

const ORDER_STEPS: Array<{ key: Order['orderStatus']; label: string }> = [
  { key: 'pending', label: 'Order Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Yard Loading' },
  { key: 'dispatched', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

function sortNewest<T extends { createdAt?: unknown }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const da = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
    const db = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
    return db - da;
  });
}

export const AccountPage: React.FC = () => {
  const {
    user,
    authReady,
    isAdmin,
    userProfile,
    userContact,
    addresses,
    setAddresses,
    products,
    settings,
    favouriteIds,
    loginWithPhone,
    registerWithPhone,
    refreshAccountSession,
    apiFetch,
    logout,
    notify,
  } = useStore();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect') || '';
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';

  // Auth form state (Sign In vs Quick Create Account)
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialMode);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showOptionalBusiness, setShowOptionalBusiness] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regAccountType, setRegAccountType] = useState<AccountType>('individual');
  const [regCompany, setRegCompany] = useState('');
  const [regRef, setRegRef] = useState('');

  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'register') setAuthMode('register');
    else if (modeParam === 'login') setAuthMode('login');
  }, [searchParams]);

  // Signed-in Customer Portal state
  const [activeTab, setActiveTab] = useState<AccountTab>('orders');
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotations, setQuotations] = useState<QuotationRequest[]>([]);
  const [enquiries, setEnquiries] = useState<CustomerEnquiry[]>([]);
  const [invoiceTarget, setInvoiceTarget] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [paymentRefEdits, setPaymentRefEdits] = useState<Record<string, string>>({});

  // Profile edit state
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [companyName, setCompanyName] = useState('');
  const [registrationRef, setRegistrationRef] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [defaultCounty, setDefaultCounty] = useState('Siaya');
  const [defaultTown, setDefaultTown] = useState('Siaya Town');
  const [defaultStreet, setDefaultStreet] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // New address form state
  const [addrLabel, setAddrLabel] = useState('Main Construction Site');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrCounty, setAddrCounty] = useState('Siaya');
  const [addrTown, setAddrTown] = useState('Siaya Town');
  const [addrStreet, setAddrStreet] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || user?.displayName || '');
      setAccountType(userProfile.accountType || 'individual');
      setCompanyName(userProfile.companyName || '');
      setRegistrationRef(userProfile.registrationRef || '');
    }
    if (userContact) {
      setPhone(userContact.phone || user?.phone || '');
      setEmail(userContact.email || user?.email || '');
      setDefaultCounty(userContact.defaultCounty || 'Siaya');
      setDefaultTown(userContact.defaultTown || 'Siaya Town');
      setDefaultStreet(userContact.defaultStreetAddress || '');
      setAddrRecipient((prev) => prev || userProfile?.displayName || user?.displayName || '');
      setAddrPhone((prev) => prev || userContact.phone || user?.phone || '');
    }
  }, [userProfile, userContact, user]);

  const loadCustomerDashboard = useCallback(async () => {
    if (!user) return;
    setLoadingPortal(true);
    try {
      const data = await apiFetch<{
        orders: Order[];
        quotations: QuotationRequest[];
        enquiries: CustomerEnquiry[];
        addresses: DeliveryAddress[];
      }>('/api/customer/dashboard');
      setOrders(sortNewest(data.orders || []));
      setQuotations(sortNewest(data.quotations || []));
      setEnquiries(sortNewest(data.enquiries || []));
      if (Array.isArray(data.addresses)) {
        setAddresses(data.addresses);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load account records.', 'error');
    } finally {
      setLoadingPortal(false);
    }
  }, [user, apiFetch, setAddresses, notify]);

  useEffect(() => {
    if (user) {
      void loadCustomerDashboard();
    } else {
      setOrders([]);
      setQuotations([]);
      setEnquiries([]);
    }
  }, [user, loadCustomerDashboard]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone.trim() || !loginPassword) {
      notify('Please enter your phone number and password.', 'error');
      return;
    }
    setAuthSubmitting(true);
    try {
      const loggedIn = await loginWithPhone(loginPhone.trim(), loginPassword);
      if (!loggedIn) return;
      if (loggedIn.isAdmin) {
        navigate('/portal/workspace', { replace: true });
        return;
      }
      if (redirectParam && redirectParam.startsWith('/')) {
        navigate(redirectParam, { replace: true });
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regPhone.trim() || !regPassword) {
      notify('Please complete your name, phone number, and password.', 'error');
      return;
    }
    setAuthSubmitting(true);
    try {
      const registered = await registerWithPhone({
        displayName: regName.trim(),
        phone: regPhone.trim(),
        password: regPassword,
        email: regEmail.trim() || undefined,
        accountType: regAccountType,
        companyName: regCompany.trim(),
        registrationRef: regRef.trim(),
      });
      if (!registered) return;
      if (registered.isAdmin) {
        navigate('/portal/workspace', { replace: true });
        return;
      }
      if (redirectParam && redirectParam.startsWith('/')) {
        navigate(redirectParam, { replace: true });
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleOpenInvoice = async (order: Order) => {
    try {
      const res = await apiFetch<{ items: OrderItem[] }>(`/api/customer/orders/${order.id}/items`);
      setInvoiceTarget({ order, items: res.items || [] });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load invoice items.', 'error');
    }
  };

  const handleSavePaymentRef = async (order: Order) => {
    const nextRef = (paymentRefEdits[order.id] ?? order.paymentReference).trim();
    if (!nextRef) {
      notify('Please enter a valid M-Pesa or bank transaction code.', 'error');
      return;
    }
    try {
      await apiFetch(`/api/customer/orders/${order.id}/payment-ref`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentReference: nextRef }),
      });
      notify('Payment reference saved for verification.', 'success');
      void loadCustomerDashboard();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update payment reference.', 'error');
    }
  };

  const handleCancelOrder = async (order: Order) => {
    if (order.orderStatus !== 'pending') return;
    try {
      await apiFetch(`/api/customer/orders/${order.id}/cancel`, {
        method: 'PATCH',
      });
      notify(`Order #${order.orderNumber} cancelled.`, 'info');
      void loadCustomerDashboard();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to cancel order.', 'error');
    }
  };

  const handleQuotationDecision = async (quote: QuotationRequest, decision: 'accepted' | 'declined') => {
    try {
      await apiFetch(`/api/customer/quotations/${quote.id}/decision`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      notify(`Quotation #${quote.quoteNumber} marked as ${decision}.`, 'success');
      void loadCustomerDashboard();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to update quotation response.', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await apiFetch('/api/customer/profile', {
        method: 'PUT',
        body: JSON.stringify({
          displayName: displayName.trim() || user.displayName,
          accountType,
          companyName: companyName.trim(),
          registrationRef: registrationRef.trim(),
          phone: phone.trim(),
          email: email.trim(),
          defaultCounty: defaultCounty.trim() || 'Siaya',
          defaultTown: defaultTown.trim() || 'Siaya Town',
          defaultStreetAddress: defaultStreet.trim(),
        }),
      });
      await refreshAccountSession();
      notify('Profile and contractor details updated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!addrRecipient.trim() || !addrPhone.trim() || !addrStreet.trim()) {
      notify('Please complete recipient name, phone, and site landmark details.', 'error');
      return;
    }
    setSavingAddress(true);
    try {
      const res = await apiFetch<{ addresses: DeliveryAddress[] }>('/api/customer/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label: addrLabel.trim() || 'Site Address',
          recipientName: addrRecipient.trim(),
          phone: addrPhone.trim(),
          county: addrCounty.trim() || 'Siaya',
          town: addrTown.trim() || 'Siaya Town',
          streetDetails: addrStreet.trim(),
          isDefault: addresses.length === 0,
        }),
      });
      if (Array.isArray(res.addresses)) {
        setAddresses(res.addresses);
      }
      setAddrStreet('');
      notify('Delivery site address saved.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save delivery address.', 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!user) return;
    try {
      await apiFetch(`/api/customer/addresses/${id}`, {
        method: 'DELETE',
      });
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      notify('Address removed.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not remove address.', 'error');
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-slate-50">
        <div className="text-sm font-medium text-slate-500">Loading your account...</div>
      </div>
    );
  }

  // Unified Sign In & Registration Screen (Phone Number + Password)
  if (!user) {
    return (
      <div className="bg-slate-50 min-h-[75vh] py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Brand & Customer Benefits Column */}
            <div className="lg:col-span-5 bg-navy-900 text-white rounded-2xl p-8 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-3 mb-6">
                  <span className="bg-white rounded-lg p-1.5 shadow-xs">
                    <img
                      src={OFFICIAL_LOGO_PATH}
                      alt="DELARICO Logo"
                      className="h-10 w-10 object-contain"
                    />
                  </span>
                  <div>
                    <div className="text-base font-bold tracking-tight text-white">
                      DELARICO MERCHANDISE
                    </div>
                    <div className="text-xs text-gold-400">Built on Quality. Driven by Trust.</div>
                  </div>
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight mb-4">
                  Customer &amp; Contractor Account
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed mb-8">
                  Sign in with your phone number and password to place orders, track site deliveries,
                  download official receipts, and manage project quotations.
                </p>

                <div className="space-y-4 text-sm text-slate-200 border-t border-white/10 pt-6">
                  <div>
                    <div className="font-semibold text-white">Real-Time Order Tracking</div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Follow your materials from yard loading in Siaya to delivery at your site.
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold text-white">Digital Invoices &amp; Receipts</div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Download printable KES proforma invoices and verified receipts anytime.
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold text-white">Contractor &amp; Bulk Trade Rates</div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Register as an individual homeowner, contractor, or institution for wholesale pricing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 text-xs text-slate-300">
                <div>Need immediate order help?</div>
                <a
                  href={`tel:${settings.whatsappNumber.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-gold-400 hover:text-gold-300 mt-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call or WhatsApp {settings.whatsappNumber}</span>
                </a>
              </div>
            </div>

            {/* Right Sign In / Create Account Form */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    authMode === 'login'
                      ? 'bg-white text-navy-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    authMode === 'register'
                      ? 'bg-white text-navy-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {authMode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Welcome Back</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Enter your registered phone number and password to continue.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      placeholder="e.g. 0712 345 678"
                      className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-4 pr-11 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full py-3 px-6 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700 transition-colors disabled:opacity-50"
                  >
                    {authSubmitting ? 'Signing In...' : 'Sign In'}
                  </button>

                  <p className="text-xs text-center text-slate-500 pt-2">
                    New to Delarico Merchandise &amp; Supplies?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className="font-semibold text-royal-700 hover:underline"
                    >
                      Create your account
                    </button>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Quick 10-Second Account</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Just enter your name, phone number, and a simple password or 4-digit PIN.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Jane Onyango"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="e.g. 0712 345 678"
                      className="w-full px-3.5 py-2.5 text-sm tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Create Password or PIN *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={4}
                        autoComplete="new-password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="At least 4 characters (e.g. 4-digit PIN)"
                        className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowOptionalBusiness((v) => !v)}
                      className="text-xs font-semibold text-royal-700 hover:text-navy-900"
                    >
                      {showOptionalBusiness
                        ? '− Hide optional contractor / company details'
                        : '+ Buying for a contractor, company, or school? (Optional)'}
                    </button>

                    {showOptionalBusiness && (
                      <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Account Type
                            </label>
                            <select
                              value={regAccountType}
                              onChange={(e) => setRegAccountType(e.target.value as AccountType)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                            >
                              <option value="individual">Individual Homebuilder</option>
                              <option value="contractor">Contractor / Builder</option>
                              <option value="institution">School / Institution / NGO</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Email (Optional)
                            </label>
                            <input
                              type="email"
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="you@example.com"
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                            />
                          </div>
                        </div>

                        {regAccountType !== 'individual' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                Company / Institution Name
                              </label>
                              <input
                                type="text"
                                value={regCompany}
                                onChange={(e) => setRegCompany(e.target.value)}
                                placeholder="Organization name"
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                NCA / Ref (Optional)
                              </label>
                              <input
                                type="text"
                                value={regRef}
                                onChange={(e) => setRegRef(e.target.value)}
                                placeholder="e.g. NCA-6"
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full py-3 px-6 text-sm font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors disabled:opacity-50"
                  >
                    {authSubmitting ? 'Creating Account...' : 'Create Account'}
                  </button>

                  <p className="text-xs text-center text-slate-500 pt-1">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="font-semibold text-royal-700 hover:underline"
                    >
                      Sign In
                    </button>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const favouriteProducts = products.filter((p) => favouriteIds.includes(p.id));

  return (
    <div className="bg-slate-50 min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Account Header */}
        <div className="bg-navy-900 rounded-2xl p-6 sm:p-8 text-white mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="text-xs text-gold-400 font-medium mb-1">
              {userProfile?.accountType === 'contractor'
                ? 'Contractor Trade Account'
                : userProfile?.accountType === 'institution'
                  ? 'Institutional Account'
                  : 'Personal Customer Account'}
              {userProfile?.wholesaleApproved ? ' · Wholesale Tier Approved' : ''}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              {userProfile?.displayName || user.displayName || 'Valued Customer'}
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              {userContact?.phone || user.phone}
              {userProfile?.companyName ? ` · ${userProfile.companyName}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-navy-950/80 border border-slate-800 rounded-xl px-5 py-3">
              <div className="flex items-center gap-1.5 text-xs text-gold-400 font-medium">
                <Award className="w-4 h-4" />
                <span>Delarico Loyalty Points</span>
              </div>
              <div className="text-xl font-bold tabular-nums text-white mt-0.5">
                {(userProfile?.loyaltyPoints ?? 0).toLocaleString()} pts
              </div>
            </div>

            {isAdmin && (
              <Link
                to="/portal/workspace"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors"
              >
                Open Dashboard
              </Link>
            )}

            <button
              type="button"
              onClick={() => void loadCustomerDashboard()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPortal ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1.5 bg-white border border-slate-200 rounded-xl mb-8 overflow-x-auto">
          {[
            { id: 'orders', label: `Orders & Tracking (${orders.length})`, icon: Package },
            { id: 'quotations', label: `Quotations (${quotations.length})`, icon: FileText },
            { id: 'profile', label: 'Profile & Contractor Info', icon: UserCheck },
            { id: 'addresses', label: `Site Addresses (${addresses.length})`, icon: MapPin },
            { id: 'favourites', label: `Saved Items (${favouriteProducts.length})`, icon: Heart },
            { id: 'enquiries', label: `Enquiries (${enquiries.length})`, icon: MessageCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as AccountTab)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-navy-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Orders & Delivery Tracking */}
        {activeTab === 'orders' && (
          <div className="space-y-5">
            {orders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-slate-900 mb-2">No orders placed yet</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Browse our Kenyan construction materials catalogue to place your first order.
                </p>
                <Link
                  to="/products"
                  className="inline-flex items-center px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700"
                >
                  Shop Materials
                </Link>
              </div>
            ) : (
              orders.map((order) => {
                const currentStepIndex = ORDER_STEPS.findIndex((s) => s.key === order.orderStatus);
                const orderWaUrl = buildWhatsAppUrl(
                  buildOrderFollowUpMessage(order),
                  settings.whatsappNumber
                );

                return (
                  <div
                    key={order.id}
                    className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">
                          <span>Order #{order.orderNumber}</span>
                          <span className="mx-1.5">·</span>
                          <span>{order.itemCount} item(s)</span>
                          <span className="mx-1.5">·</span>
                          <span>
                            {order.deliveryTown}, {order.deliveryCounty}
                          </span>
                        </div>
                        <div className="text-lg font-bold tabular-nums text-slate-900">
                          {formatKes(order.totalKes)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`text-xs font-semibold ${
                            order.paymentStatus === 'verified_paid'
                              ? 'text-emerald-700'
                              : order.paymentStatus === 'failed'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {order.paymentStatus === 'verified_paid'
                            ? 'Payment Verified'
                            : 'Payment Pending Verification'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <button
                          type="button"
                          onClick={() => void handleOpenInvoice(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-navy-900 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Invoice / Receipt</span>
                        </button>
                        <a
                          href={orderWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp Dispatch</span>
                        </a>
                        {order.orderStatus === 'pending' && (
                          <button
                            type="button"
                            onClick={() => void handleCancelOrder(order)}
                            className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Order Tracking Timeline */}
                    {order.orderStatus === 'cancelled' ? (
                      <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                        This order was cancelled.
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-3">
                          <Truck className="w-4 h-4 text-royal-700" />
                          <span>Delivery Progress</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {ORDER_STEPS.map((step, idx) => {
                            const completed = currentStepIndex >= idx;
                            return (
                              <div
                                key={step.key}
                                className={`p-3 rounded-xl border text-xs ${
                                  completed
                                    ? 'bg-navy-900 text-white border-navy-900'
                                    : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}
                              >
                                <div className="font-semibold flex items-center justify-between">
                                  <span>0{idx + 1}</span>
                                  {completed && <CheckCircle2 className="w-3.5 h-3.5 text-gold-400" />}
                                </div>
                                <div className="mt-1 font-medium">{step.label}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Submit / Update M-Pesa Reference */}
                    {order.paymentStatus === 'pending_verification' &&
                      order.orderStatus !== 'cancelled' && (
                        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs text-slate-600">
                            Paid via M-Pesa ({settings.whatsappNumber})? Submit or update your
                            transaction code:
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={paymentRefEdits[order.id] ?? order.paymentReference}
                              onChange={(e) =>
                                setPaymentRefEdits((prev) => ({
                                  ...prev,
                                  [order.id]: e.target.value.toUpperCase(),
                                }))
                              }
                              placeholder="M-Pesa Code e.g. QKA82M91LP"
                              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-royal-600"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSavePaymentRef(order)}
                              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-royal-700 rounded-lg hover:bg-royal-600"
                            >
                              Save Code
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Quotations */}
        {activeTab === 'quotations' && (
          <div className="space-y-4">
            {quotations.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-slate-900 mb-2">No quotation requests yet</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Submit a Bill of Quantities or material list for wholesale project pricing.
                </p>
                <Link
                  to="/request-quote"
                  className="inline-flex items-center px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700"
                >
                  Request a Quotation
                </Link>
              </div>
            ) : (
              quotations.map((q) => (
                <div key={q.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">
                        <span>Quote #{q.quoteNumber}</span>
                        <span className="mx-1.5">·</span>
                        <span>{q.projectType}</span>
                        <span className="mx-1.5">·</span>
                        <span>{q.deliveryLocation}</span>
                      </div>
                      <div className="text-base font-bold text-slate-900">
                        {q.itemCount} Material Line(s) · Est.{' '}
                        <span className="tabular-nums">{formatKes(q.estimatedSubtotalKes)}</span>
                      </div>
                    </div>
                    <div className="text-xs font-semibold capitalize text-royal-700">
                      Status: {q.status.replace('_', ' ')}
                    </div>
                  </div>

                  {q.quotedTotalKes > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50 rounded-xl p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          Official Delarico Quoted Total (Valid until {q.validUntil || '14 Days'}):
                        </span>
                        <span className="text-lg font-bold tabular-nums text-navy-900">
                          {formatKes(q.quotedTotalKes)}
                        </span>
                      </div>
                      {q.adminResponseNotes && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {q.adminResponseNotes}
                        </p>
                      )}
                      {q.status === 'quoted' && (
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => void handleQuotationDecision(q, 'accepted')}
                            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600"
                          >
                            Accept Quotation
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleQuotationDecision(q, 'declined')}
                            className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:text-rose-700"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Profile & Contractor Registration */}
        {activeTab === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-3xl space-y-6"
          >
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Account Profile &amp; Contractor Registration
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Register as a Contractor or Institution to apply for wholesale trade pricing on bulk
                orders.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Account Category
                </label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as AccountType)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                >
                  <option value="individual">Individual Homebuilder</option>
                  <option value="contractor">Contractor / Construction Company</option>
                  <option value="institution">School / Hospital / Institution</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Company or Institution Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Optional for individuals"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  NCA / Business Reg. Reference
                </label>
                <input
                  type="text"
                  value={registrationRef}
                  onChange={(e) => setRegistrationRef(e.target.value)}
                  placeholder="e.g. NCA-6 / CPR-2022"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Phone / M-Pesa Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0712 345 678"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Default County
                </label>
                <input
                  type="text"
                  value={defaultCounty}
                  onChange={(e) => setDefaultCounty(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Default Town
                </label>
                <input
                  type="text"
                  value={defaultTown}
                  onChange={(e) => setDefaultTown(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Default Delivery Site Landmark
                </label>
                <input
                  type="text"
                  value={defaultStreet}
                  onChange={(e) => setDefaultStreet(e.target.value)}
                  placeholder="Road, estate, or site landmark"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-royal-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-3 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700 transition-colors disabled:opacity-50"
            >
              {savingProfile ? 'Saving Changes...' : 'Save Account Profile'}
            </button>
          </form>
        )}

        {/* Tab 4: Delivery Site Addresses */}
        {activeTab === 'addresses' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-4">
              {addresses.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                  No saved delivery site addresses yet. Add your construction site on the right.
                </div>
              ) : (
                addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">{addr.label}</div>
                      <div className="text-xs text-slate-600 mt-1">
                        {addr.recipientName} · {addr.phone}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {addr.streetDetails}, {addr.town}, {addr.county} County
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAddress(addr.id)}
                      className="p-2 text-slate-400 hover:text-rose-600"
                      aria-label="Delete address"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleAddAddress}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-900">Add Delivery Site Address</h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Site Label</label>
                <input
                  type="text"
                  required
                  value={addrLabel}
                  onChange={(e) => setAddrLabel(e.target.value)}
                  placeholder="e.g. Bondo Residential Site"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Site Contact
                  </label>
                  <input
                    type="text"
                    required
                    value={addrRecipient}
                    onChange={(e) => setAddrRecipient(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">County</label>
                  <input
                    type="text"
                    required
                    value={addrCounty}
                    onChange={(e) => setAddrCounty(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Town</label>
                  <input
                    type="text"
                    required
                    value={addrTown}
                    onChange={(e) => setAddrTown(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Road / Site Landmark
                </label>
                <input
                  type="text"
                  required
                  value={addrStreet}
                  onChange={(e) => setAddrStreet(e.target.value)}
                  placeholder="Directions for delivery lorry"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={savingAddress}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{savingAddress ? 'Saving...' : 'Save Site Address'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 5: Saved / Favourite Products */}
        {activeTab === 'favourites' && (
          <div>
            {favouriteProducts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <Heart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-slate-900 mb-2">No saved materials yet</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Bookmark frequently ordered construction supplies for quick reordering.
                </p>
                <Link
                  to="/products"
                  className="inline-flex items-center px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700"
                >
                  Explore Catalogue
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {favouriteProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Enquiries */}
        {activeTab === 'enquiries' && (
          <div className="space-y-4">
            {enquiries.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-600">
                You have not submitted any enquiries yet. Visit{' '}
                <Link to="/contact" className="text-royal-700 font-semibold hover:underline">
                  Contact Us
                </Link>{' '}
                for assistance.
              </div>
            ) : (
              enquiries.map((enq) => (
                <div key={enq.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-slate-900">{enq.subject}</span>
                    <span className="text-xs font-semibold capitalize text-royal-700">
                      {enq.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{enq.message}</p>
                  {enq.adminReply && (
                    <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50 rounded-xl p-3.5 text-xs text-slate-700">
                      <span className="font-semibold text-navy-900">Delarico Response: </span>
                      {enq.adminReply}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {invoiceTarget && (
        <InvoiceModal
          order={invoiceTarget.order}
          items={invoiceTarget.items}
          settings={settings}
          onClose={() => setInvoiceTarget(null)}
        />
      )}
    </div>
  );
};
