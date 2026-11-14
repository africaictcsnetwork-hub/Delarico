import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Layers,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Share2,
  Star,
  Tag,
  Trash2,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { OFFICIAL_LOGO_PATH } from '../firebase';
import { useStore } from '../context/StoreContext';
import {
  AffiliateProfile,
  AffiliateReferral,
  CustomerAdminRecord,
  CustomerEnquiry,
  NewsletterSubscriber,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductReview,
  QuotationItem,
  QuotationRequest,
  StockMovement,
  StoreSettings,
} from '../types';
import { InvoiceModal } from '../components/InvoiceModal';
import { ResilientImage } from '../components/ResilientImage';
import { formatKes } from '../utils/whatsapp';
import {
  compressImageFileToDataUrl,
  createProductGallery,
  HERO_YARD_VISUAL,
  VisualMotif,
} from '../utils/productVisuals';

type AdminSection =
  | 'analytics'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'quotations'
  | 'customers'
  | 'affiliates'
  | 'promotions'
  | 'reviews'
  | 'newsletter'
  | 'financials'
  | 'branches';

function downloadCsv(filename: string, rows: string[][]) {
  const csvContent = rows
    .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toTimestampDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate();
  }
  return null;
}

function sortNewest<T extends { createdAt?: unknown }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const da = toTimestampDate(a.createdAt)?.getTime() ?? 0;
    const db = toTimestampDate(b.createdAt)?.getTime() ?? 0;
    return db - da;
  });
}

export const AdminDashboardPage: React.FC = () => {
  const {
    user,
    authReady,
    isAdmin,
    products,
    categories,
    promotions,
    branches,
    settings,
    apiFetch,
    logout,
    notify,
  } = useStore();

  const [section, setSection] = useState<AdminSection>('analytics');
  const [loadingOps, setLoadingOps] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Operations Collections loaded via /api/ops/bootstrap
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotations, setQuotations] = useState<QuotationRequest[]>([]);
  const [customers, setCustomers] = useState<CustomerAdminRecord[]>([]);
  const [enquiries, setEnquiries] = useState<CustomerEnquiry[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateProfile[]>([]);
  const [affiliateReferrals, setAffiliateReferrals] = useState<AffiliateReferral[]>([]);
  const [newsletterSubscribers, setNewsletterSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [adminReviews, setAdminReviews] = useState<ProductReview[]>([]);
  const [allCatalogProducts, setAllCatalogProducts] = useState<Product[]>([]);

  // Inline Quick Edit & Search State
  const [prodSearch, setProdSearch] = useState('');
  const [quickEdits, setQuickEdits] = useState<
    Record<
      string,
      { priceKes: number; wholesalePriceKes: number; compareAtPriceKes: number; stockQty: number; isActive: boolean }
    >
  >({});
  const [savingQuickId, setSavingQuickId] = useState<string | null>(null);
  const [confirmDeleteProdId, setConfirmDeleteProdId] = useState<string | null>(null);

  // Customer Edit & Search State
  const [custSearch, setCustSearch] = useState('');
  const [editingCustomerUid, setEditingCustomerUid] = useState<string | null>(null);
  const [custEditForm, setCustEditForm] = useState<{
    displayName: string;
    accountType: 'individual' | 'contractor' | 'institution';
    companyName: string;
    registrationRef: string;
    phone: string;
    email: string;
    defaultCounty: string;
    defaultTown: string;
    loyaltyPoints: number;
    wholesaleApproved: boolean;
  }>({
    displayName: '',
    accountType: 'individual',
    companyName: '',
    registrationRef: '',
    phone: '',
    email: '',
    defaultCounty: 'Siaya',
    defaultTown: 'Siaya Town',
    loyaltyPoints: 0,
    wholesaleApproved: false,
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [confirmDeleteCustUid, setConfirmDeleteCustUid] = useState<string | null>(null);

  // Newsletter & Reviews Search
  const [newsletterSearch, setNewsletterSearch] = useState('');
  const [reviewSearch, setReviewSearch] = useState('');

  // Invoice Modal
  const [invoiceTarget, setInvoiceTarget] = useState<{ order: Order; items: OrderItem[] } | null>(
    null
  );

  // Product Form State
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('cat-building-materials');
  const [prodUnit, setProdUnit] = useState('Piece');
  const [prodBrand, setProdBrand] = useState('KEBS Certified Kenya');
  const [prodDimensions, setProdDimensions] = useState('Standard Yard Size');
  const [prodWeightKg, setProdWeightKg] = useState(10);
  const [prodPrice, setProdPrice] = useState(1000);
  const [prodWholesalePrice, setProdWholesalePrice] = useState(920);
  const [prodMinWholesaleQty, setProdMinWholesaleQty] = useState(20);
  const [prodCompareAtPrice, setProdCompareAtPrice] = useState(0);
  const [prodStockQty, setProdStockQty] = useState(100);
  const [prodLowThreshold, setProdLowThreshold] = useState(15);
  const [prodFeatured, setProdFeatured] = useState(true);
  const [prodBestSeller, setProdBestSeller] = useState(false);
  const [prodSpecialOffer, setProdSpecialOffer] = useState(false);
  const [prodIsActive, setProdIsActive] = useState(true);
  const [prodDescription, setProdDescription] = useState('');
  const [prodSpecsText, setProdSpecsText] = useState('KEBS Certified · Factory-Fresh Yard Stock');
  const [prodMotif, setProdMotif] = useState<VisualMotif>('cement');
  const [prodUploadedImages, setProdUploadedImages] = useState<string[]>([]);
  const [savingProduct, setSavingProduct] = useState(false);

  // New Category Form
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Stock Movement Form
  const [stockProdId, setStockProdId] = useState('');
  const [stockDelta, setStockDelta] = useState(50);
  const [stockType, setStockType] = useState<'restock' | 'adjustment' | 'return'>('restock');
  const [stockReason, setStockReason] = useState('Scheduled supplier delivery to Siaya Yard');

  // Quotation Response State
  const [quoteAmounts, setQuoteAmounts] = useState<Record<string, number>>({});
  const [quoteNotes, setQuoteNotes] = useState<Record<string, string>>({});
  const [quoteValidUntil, setQuoteValidUntil] = useState<Record<string, string>>({});
  const [expandedQuoteItems, setExpandedQuoteItems] = useState<Record<string, QuotationItem[]>>({});

  // Enquiry Reply State
  const [enquiryReplies, setEnquiryReplies] = useState<Record<string, string>>({});

  // Promotion Form State
  const [promoCode, setPromoCode] = useState('');
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoType, setPromoType] = useState<'percentage' | 'fixed_kes'>('percentage');
  const [promoValue, setPromoValue] = useState(5);
  const [promoMinOrder, setPromoMinOrder] = useState(25000);

  // Branch Form State
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchCounty, setBranchCounty] = useState('Kisumu');
  const [branchTown, setBranchTown] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchZones, setBranchZones] = useState('Town CBD, Surrounding Estates');

  // Corporate Settings Form State
  const [settingsForm, setSettingsForm] = useState<StoreSettings>(settings);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  const loadOpsData = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoadingOps(true);
    try {
      const data = await apiFetch<{
        orders: Order[];
        quotations: QuotationRequest[];
        customers: CustomerAdminRecord[];
        enquiries: CustomerEnquiry[];
        stockMovements: StockMovement[];
        affiliates?: AffiliateProfile[];
        affiliateReferrals?: AffiliateReferral[];
        newsletterSubscribers?: NewsletterSubscriber[];
        reviews?: ProductReview[];
        allProducts?: Product[];
      }>('/api/ops/bootstrap');
      setOrders(sortNewest(data.orders || []));
      setQuotations(sortNewest(data.quotations || []));
      setCustomers(sortNewest(data.customers || []));
      setEnquiries(sortNewest(data.enquiries || []));
      setStockMovements(sortNewest(data.stockMovements || []));
      setAffiliates(sortNewest(data.affiliates || []));
      setAffiliateReferrals(sortNewest(data.affiliateReferrals || []));
      setNewsletterSubscribers(sortNewest(data.newsletterSubscribers || []));
      setAdminReviews(sortNewest(data.reviews || []));
      if (Array.isArray(data.allProducts) && data.allProducts.length > 0) {
        setAllCatalogProducts(data.allProducts);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load management records.', 'error');
    } finally {
      setLoadingOps(false);
    }
  }, [user, isAdmin, apiFetch, notify]);

  useEffect(() => {
    if (user && isAdmin) {
      void loadOpsData();
    }
  }, [user, isAdmin, loadOpsData]);

  // Analytics Computations
  const analytics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    const activeOrders = orders.filter((o) => o.orderStatus !== 'cancelled');
    const verifiedOrders = activeOrders.filter((o) => o.paymentStatus === 'verified_paid');
    const unpaidOrders = activeOrders.filter((o) => o.paymentStatus === 'pending_verification');

    let dailySales = 0;
    let weeklySales = 0;
    let monthlySales = 0;
    let totalVerifiedRevenue = 0;

    verifiedOrders.forEach((o) => {
      totalVerifiedRevenue += o.totalKes;
      const dt = toTimestampDate(o.createdAt)?.getTime() ?? now.getTime();
      if (dt >= startOfToday) dailySales += o.totalKes;
      if (dt >= sevenDaysAgo) weeklySales += o.totalKes;
      if (dt >= thirtyDaysAgo) monthlySales += o.totalKes;
    });

    const outstandingKes = unpaidOrders.reduce((s, o) => s + o.totalKes, 0);
    const lowStockProducts = products.filter((p) => p.stockQty <= p.lowStockThreshold);

    return {
      dailySales,
      weeklySales,
      monthlySales,
      totalVerifiedRevenue,
      outstandingKes,
      totalOrders: orders.length,
      unpaidCount: unpaidOrders.length,
      lowStockProducts,
    };
  }, [orders, products]);

  // Wait quietly for session check; silently redirect non-admins to normal /account sign-in
  if (!authReady) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-slate-50">
        <div className="text-sm font-medium text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/account?redirect=/portal/workspace" replace />;
  }

  // Action Handlers
  const handleManualSeed = async () => {
    setSeeding(true);
    try {
      await apiFetch('/api/ops/seed', { method: 'POST' });
      notify('Catalogue synchronized with live Firestore.', 'success');
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Catalogue sync failed.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleOpenOrderInvoice = async (order: Order) => {
    try {
      const res = await apiFetch<{ items: OrderItem[] }>(`/api/ops/orders/${order.id}/items`);
      setInvoiceTarget({ order, items: res.items || [] });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load order items.', 'error');
    }
  };

  const handleVerifyPayment = async (order: Order, nextPaymentStatus: PaymentStatus) => {
    try {
      await apiFetch(`/api/ops/orders/${order.id}/payment`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentStatus: nextPaymentStatus }),
      });
      notify(
        `Order #${order.orderNumber} payment marked as ${nextPaymentStatus.replace('_', ' ')}.`,
        'success'
      );
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update payment status.', 'error');
    }
  };

  const handleUpdateOrderStatus = async (order: Order, nextStatus: OrderStatus) => {
    try {
      await apiFetch(`/api/ops/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ orderStatus: nextStatus }),
      });
      notify(`Order #${order.orderNumber} updated to ${nextStatus}.`, 'success');
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update order status.', 'error');
    }
  };

  const handleImageFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    try {
      const files: File[] = Array.from(fileList).slice(0, 4);
      const compressed = await Promise.all(
        files.map((file: File) => compressImageFileToDataUrl(file))
      );
      setProdUploadedImages((prev) => [...prev, ...compressed].slice(0, 5));
      notify(`${compressed.length} product photo(s) prepared.`, 'success');
    } catch {
      notify('Could not process selected image file.', 'error');
    }
  };

  const managedProducts = useMemo(() => {
    return allCatalogProducts.length > 0 ? allCatalogProducts : products;
  }, [allCatalogProducts, products]);

  const filteredManagedProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    if (!q) return managedProducts;
    return managedProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
    );
  }, [managedProducts, prodSearch]);

  const filteredCustomers = useMemo(() => {
    const q = custSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.displayName || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.companyName || '').toLowerCase().includes(q)
    );
  }, [customers, custSearch]);

  const filteredReviews = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    if (!q) return adminReviews;
    return adminReviews.filter(
      (r) =>
        (r.productName || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.comment || '').toLowerCase().includes(q)
    );
  }, [adminReviews, reviewSearch]);

  const filteredSubscribers = useMemo(() => {
    const q = newsletterSearch.trim().toLowerCase();
    if (!q) return newsletterSubscribers;
    return newsletterSubscribers.filter((s) => (s.email || '').toLowerCase().includes(q));
  }, [newsletterSubscribers, newsletterSearch]);

  const resetProductForm = () => {
    setEditingProductId(null);
    setProdName('');
    setProdSku('');
    setProdUnit('Piece');
    setProdPrice(1000);
    setProdWholesalePrice(920);
    setProdMinWholesaleQty(20);
    setProdCompareAtPrice(0);
    setProdStockQty(100);
    setProdLowThreshold(15);
    setProdFeatured(true);
    setProdBestSeller(false);
    setProdSpecialOffer(false);
    setProdIsActive(true);
    setProdBrand('KEBS Certified Kenya');
    setProdDimensions('Standard Yard Size');
    setProdWeightKg(10);
    setProdDescription('');
    setProdSpecsText('KEBS Certified · Factory-Fresh Yard Stock');
    setProdUploadedImages([]);
  };

  const populateProductForEdit = (p: Product) => {
    setEditingProductId(p.id);
    setProdName(p.name);
    setProdSku(p.sku);
    setProdCategoryId(p.categoryId);
    setProdUnit(p.unit);
    setProdBrand(p.brand || 'Delarico');
    setProdDimensions(p.dimensions || 'Standard');
    setProdWeightKg(p.weightKg || 1);
    setProdPrice(p.priceKes);
    setProdWholesalePrice(p.wholesalePriceKes);
    setProdMinWholesaleQty(p.minWholesaleQty);
    setProdCompareAtPrice(p.compareAtPriceKes);
    setProdStockQty(p.stockQty);
    setProdLowThreshold(p.lowStockThreshold);
    setProdFeatured(p.featured);
    setProdBestSeller(p.bestSeller);
    setProdSpecialOffer(p.onPromotion);
    setProdIsActive(p.isActive !== false);
    setProdDescription(p.description);
    setProdSpecsText(p.specSummary || '');
    setProdUploadedImages(p.images || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || !prodSku.trim()) {
      notify('Product name and SKU are required.', 'error');
      return;
    }
    setSavingProduct(true);
    const cat = categories.find((c) => c.id === prodCategoryId) || categories[0];
    const specSummary =
      prodSpecsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' · ')
        .slice(0, 300) || 'KEBS Certified Yard Stock';

    const images =
      prodUploadedImages.length > 0 ? prodUploadedImages : createProductGallery(prodMotif);

    const slug = prodName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const rawDesc = prodDescription.trim() || prodName.trim();
    const safeDesc = (
      rawDesc.length >= 10 ? rawDesc : `${rawDesc} — Genuine yard supply from Delarico Kenya.`
    ).slice(0, 2000);

    const payload = {
      name: prodName.trim().slice(0, 160),
      slug: (slug || `item-${Date.now()}`).slice(0, 160),
      sku: prodSku.trim().toUpperCase().slice(0, 64),
      categoryId: cat.id,
      categoryName: cat.name,
      description: safeDesc,
      specSummary,
      dimensions: (prodDimensions.trim() || 'Standard').slice(0, 120),
      brand: (prodBrand.trim() || 'KEBS Certified').slice(0, 100),
      unit: (prodUnit.trim() || 'Piece').slice(0, 40),
      priceKes: Math.max(0, Number(prodPrice)),
      wholesalePriceKes: Math.max(0, Number(prodWholesalePrice)),
      minWholesaleQty: Math.max(1, Number(prodMinWholesaleQty)),
      compareAtPriceKes: Math.max(0, Number(prodCompareAtPrice)),
      stockQty: Math.max(0, Number(prodStockQty)),
      lowStockThreshold: Math.max(0, Number(prodLowThreshold)),
      weightKg: Math.max(0.1, Number(prodWeightKg || 1)),
      images,
      featured: prodFeatured,
      bestSeller: prodBestSeller,
      onPromotion: prodSpecialOffer,
      promoLabel: prodSpecialOffer ? 'Special Yard Offer' : '',
      isActive: prodIsActive,
    };

    try {
      if (editingProductId) {
        await apiFetch(`/api/ops/products/${editingProductId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        notify(`Updated ${payload.name}.`, 'success');
      } else {
        const prodId = `prod-${slug.slice(0, 32)}-${Date.now().toString().slice(-4)}`;
        await apiFetch('/api/ops/products', {
          method: 'POST',
          body: JSON.stringify({
            id: prodId,
            ...payload,
            ratingAvg: 5.0,
            reviewCount: 0,
          }),
        });
        notify(`Added ${payload.name} to catalogue.`, 'success');
      }
      resetProductForm();
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save product.', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleSaveQuickProduct = async (p: Product) => {
    const draft = quickEdits[p.id];
    if (!draft) return;
    setSavingQuickId(p.id);
    try {
      await apiFetch(`/api/ops/products/${p.id}/quick`, {
        method: 'PATCH',
        body: JSON.stringify(draft),
      });
      notify(`Updated pricing & stock for ${p.name}.`, 'success');
      setQuickEdits((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Quick update failed.', 'error');
    } finally {
      setSavingQuickId(null);
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    try {
      await apiFetch(`/api/ops/products/${prod.id}`, { method: 'DELETE' });
      setConfirmDeleteProdId(null);
      notify(`Removed ${prod.name} from catalogue.`, 'info');
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete product.', 'error');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const slug = catName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const id = `cat-${slug.slice(0, 28)}-${Date.now().toString().slice(-3)}`;
    try {
      await apiFetch('/api/ops/categories', {
        method: 'POST',
        body: JSON.stringify({
          id,
          name: catName.trim(),
          slug,
          description:
            catDesc.trim() || `${catName.trim()} supplied by Delarico Merchandise & Supplies.`,
          imageUrl: HERO_YARD_VISUAL,
          sortOrder: categories.length + 1,
        }),
      });
      setCatName('');
      setCatDesc('');
      notify(`Category "${catName.trim()}" created.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create category.', 'error');
    }
  };

  const handleRecordStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProduct = products.find((p) => p.id === (stockProdId || products[0]?.id));
    if (!targetProduct) return;
    try {
      await apiFetch('/api/ops/stock-movements', {
        method: 'POST',
        body: JSON.stringify({
          productId: targetProduct.id,
          movementType: stockType,
          quantityDelta: Number(stockDelta),
          reason: stockReason.trim() || 'Yard stock adjustment',
        }),
      });
      notify(`Updated ${targetProduct.name} stock.`, 'success');
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not post stock movement.', 'error');
    }
  };

  const handleLoadQuoteItems = async (quoteId: string) => {
    if (expandedQuoteItems[quoteId]) return;
    try {
      const res = await apiFetch<{ items: QuotationItem[] }>(`/api/ops/quotations/${quoteId}/items`);
      setExpandedQuoteItems((prev) => ({ ...prev, [quoteId]: res.items || [] }));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not load quotation items.', 'error');
    }
  };

  const handleRespondQuotation = async (quote: QuotationRequest) => {
    const quotedTotalKes = Number(quoteAmounts[quote.id] ?? quote.estimatedSubtotalKes);
    const adminResponseNotes = (
      quoteNotes[quote.id] ??
      'Wholesale trade discount applied. Ready for dispatch from Siaya Yard upon confirmation.'
    ).trim();
    const validUntil = (quoteValidUntil[quote.id] ?? '14 Days').trim();
    try {
      await apiFetch(`/api/ops/quotations/${quote.id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({
          quotedTotalKes,
          adminResponseNotes,
          validUntil,
        }),
      });
      notify(`Quotation #${quote.quoteNumber} sent to customer.`, 'success');
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not send quotation response.', 'error');
    }
  };

  const handleToggleWholesaleCustomer = async (cust: CustomerAdminRecord) => {
    try {
      await apiFetch(`/api/ops/customers/${cust.uid}/wholesale`, {
        method: 'PATCH',
        body: JSON.stringify({ wholesaleApproved: !cust.wholesaleApproved }),
      });
      notify(
        `${cust.displayName} wholesale access ${!cust.wholesaleApproved ? 'approved' : 'revoked'}.`,
        'success'
      );
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update customer status.', 'error');
    }
  };

  const openEditCustomer = (cust: CustomerAdminRecord) => {
    setEditingCustomerUid(cust.uid);
    setCustEditForm({
      displayName: cust.displayName || '',
      accountType: cust.accountType || 'individual',
      companyName: cust.companyName || '',
      registrationRef: cust.registrationRef || '',
      phone: cust.phone || '',
      email: cust.email || '',
      defaultCounty: cust.defaultCounty || 'Siaya',
      defaultTown: cust.defaultTown || 'Siaya Town',
      loyaltyPoints: cust.loyaltyPoints || 0,
      wholesaleApproved: Boolean(cust.wholesaleApproved),
    });
  };

  const handleSaveCustomerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomerUid) return;
    setSavingCustomer(true);
    try {
      await apiFetch(`/api/ops/customers/${editingCustomerUid}`, {
        method: 'PATCH',
        body: JSON.stringify(custEditForm),
      });
      notify(`Saved changes to ${custEditForm.displayName}.`, 'success');
      setEditingCustomerUid(null);
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update customer account.', 'error');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = async (uid: string, name: string) => {
    try {
      await apiFetch(`/api/ops/customers/${uid}`, { method: 'DELETE' });
      setConfirmDeleteCustUid(null);
      if (editingCustomerUid === uid) setEditingCustomerUid(null);
      notify(`Removed account "${name}".`, 'info');
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not remove customer account.', 'error');
    }
  };

  const handleReplyEnquiry = async (enq: CustomerEnquiry) => {
    const reply = (enquiryReplies[enq.id] ?? enq.adminReply).trim();
    if (!reply) return;
    try {
      await apiFetch(`/api/ops/enquiries/${enq.id}/reply`, {
        method: 'PATCH',
        body: JSON.stringify({ adminReply: reply }),
      });
      notify(`Reply sent to ${enq.name}.`, 'success');
      await loadOpsData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not send reply.', 'error');
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = promoCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode || !promoTitle.trim()) return;
    const id = `promo-${cleanCode.toLowerCase()}`;
    try {
      await apiFetch('/api/ops/promotions', {
        method: 'POST',
        body: JSON.stringify({
          id,
          code: cleanCode,
          title: promoTitle.trim(),
          description: promoDesc.trim() || promoTitle.trim(),
          discountType: promoType,
          discountValue: Number(promoValue),
          minOrderKes: Number(promoMinOrder),
          expiresAt: '2026-12-31',
        }),
      });
      setPromoCode('');
      setPromoTitle('');
      setPromoDesc('');
      notify(`Promotion ${cleanCode} published.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create promotion.', 'error');
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim() || !branchCode.trim() || !branchTown.trim()) return;
    const cleanId = `branch-${branchCode
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')}`;
    try {
      await apiFetch('/api/ops/branches', {
        method: 'POST',
        body: JSON.stringify({
          id: cleanId,
          name: branchName.trim(),
          code: branchCode.trim().toUpperCase(),
          county: branchCounty.trim(),
          town: branchTown.trim(),
          address: branchAddress.trim() || `${branchTown.trim()} Yard`,
          phone: settings.whatsappNumber,
          managerName: 'Branch Operations Manager',
          deliveryZones: (branchZones.trim() || 'Town CBD, Surrounding Estates').slice(0, 300),
        }),
      });
      setBranchName('');
      setBranchCode('');
      setBranchTown('');
      setBranchAddress('');
      notify(`Branch "${branchName.trim()}" added.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not add branch.', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/ops/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsForm),
      });
      notify('Corporate & payment settings updated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save corporate settings.', 'error');
    }
  };

  const navItems: Array<{ id: AdminSection; label: string; icon: React.ElementType; count?: number }> =
    [
      { id: 'analytics', label: 'Overview & Analytics', icon: BarChart3 },
      { id: 'orders', label: 'Orders', icon: Package, count: orders.length },
      { id: 'products', label: 'Products & Prices', icon: Layers, count: managedProducts.length },
      {
        id: 'inventory',
        label: 'Inventory & Alerts',
        icon: AlertTriangle,
        count: analytics.lowStockProducts.length,
      },
      { id: 'quotations', label: 'Quotations', icon: FileText, count: quotations.length },
      {
        id: 'customers',
        label: 'Accounts & Enquiries',
        icon: Users,
        count: customers.length + enquiries.length,
      },
      {
        id: 'affiliates',
        label: 'Affiliates (3–5%)',
        icon: Share2,
        count: affiliates.length,
      },
      { id: 'promotions', label: 'Promotions', icon: Tag, count: promotions.length },
      { id: 'reviews', label: 'Reviews Moderation', icon: Star, count: adminReviews.length },
      {
        id: 'newsletter',
        label: 'Newsletter List',
        icon: Mail,
        count: newsletterSubscribers.filter((s) => s.status === 'subscribed').length,
      },
      { id: 'financials', label: 'Financials & Invoices', icon: Wallet },
      { id: 'branches', label: 'Branches & Settings', icon: Building2, count: branches.length },
    ];

  return (
    <div className="bg-slate-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Management Header */}
        <div className="bg-navy-900 rounded-2xl p-6 text-white mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="bg-white rounded-lg p-1.5 shadow-xs">
              <img src={OFFICIAL_LOGO_PATH} alt="DELARICO" className="h-9 w-9 object-contain" />
            </span>
            <div>
              <div className="text-xs font-medium text-gold-400">
                Delarico Merchandise &amp; Supplies · Management Console
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                Operations, Sales &amp; Inventory Dashboard
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Storefront</span>
            </Link>
            <button
              type="button"
              onClick={() => void loadOpsData()}
              disabled={loadingOps}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOps ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => void handleManualSeed()}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              <span>{seeding ? 'Syncing...' : 'Sync Default Catalogue'}</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Low Stock Alert Strip */}
        {analytics.lowStockProducts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Stock Alert:</strong> {analytics.lowStockProducts.length} product(s) are at
                or below minimum yard threshold (
                {analytics.lowStockProducts.map((p) => `${p.name}: ${p.stockQty}`).join(', ')}).
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSection('inventory')}
              className="text-xs font-semibold text-amber-900 underline"
            >
              Restock Now
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Sidebar Navigation */}
          <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-navy-900 text-white'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-navy-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.count !== undefined && (
                    <span
                      className={`text-xs tabular-nums ${
                        active ? 'text-gold-400' : 'text-slate-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Main Workspace Column */}
          <div className="lg:col-span-9 space-y-6">
            {/* 1. ANALYTICS */}
            {section === 'analytics' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="text-xs text-slate-500">Verified Revenue (Total)</div>
                    <div className="text-xl font-bold tabular-nums text-navy-900 mt-1">
                      {formatKes(analytics.totalVerifiedRevenue)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 tabular-nums">
                      Today: {formatKes(analytics.dailySales)}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="text-xs text-slate-500">30-Day Sales</div>
                    <div className="text-xl font-bold tabular-nums text-slate-900 mt-1">
                      {formatKes(analytics.monthlySales)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 tabular-nums">
                      7-Day: {formatKes(analytics.weeklySales)}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="text-xs text-slate-500">Pending Payment Verification</div>
                    <div className="text-xl font-bold tabular-nums text-amber-700 mt-1">
                      {formatKes(analytics.outstandingKes)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {analytics.unpaidCount} order(s) awaiting confirmation
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="text-xs text-slate-500">Catalogue &amp; Customers</div>
                    <div className="text-xl font-bold tabular-nums text-slate-900 mt-1">
                      {products.length} SKUs
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {customers.length} registered accounts · {orders.length} orders
                    </div>
                  </div>
                </div>

                {/* Top Moving Materials */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Best-Selling &amp; Featured Materials Performance
                    </h2>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv('delarico-catalogue-report.csv', [
                          [
                            'SKU',
                            'Product Name',
                            'Category',
                            'Retail KES',
                            'Wholesale KES',
                            'Stock Qty',
                          ],
                          ...products.map((p) => [
                            p.sku,
                            p.name,
                            p.categoryName,
                            String(p.priceKes),
                            String(p.wholesalePriceKes),
                            String(p.stockQty),
                          ]),
                        ])
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2.5 pr-4 font-semibold">Material</th>
                          <th className="py-2.5 px-3 font-semibold">Category</th>
                          <th className="py-2.5 px-3 font-semibold">Retail</th>
                          <th className="py-2.5 px-3 font-semibold">Wholesale</th>
                          <th className="py-2.5 pl-3 font-semibold text-right">Yard Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.slice(0, 8).map((p) => (
                          <tr key={p.id}>
                            <td className="py-3 pr-4 font-semibold text-slate-900">{p.name}</td>
                            <td className="py-3 px-3 text-slate-600">{p.categoryName}</td>
                            <td className="py-3 px-3 tabular-nums text-slate-900">
                              {formatKes(p.priceKes)}
                            </td>
                            <td className="py-3 px-3 tabular-nums text-emerald-800">
                              {formatKes(p.wholesalePriceKes)}
                            </td>
                            <td className="py-3 pl-3 tabular-nums text-right font-semibold">
                              {p.stockQty} {p.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. ORDER MANAGEMENT */}
            {section === 'orders' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Customer Order &amp; Dispatch Management
                    </h2>
                    <p className="text-xs text-slate-500">
                      Verify M-Pesa/bank payments ({settings.whatsappNumber}), deduct stock, and
                      update delivery stages.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv('delarico-orders.csv', [
                        [
                          'Order #',
                          'Customer',
                          'Phone',
                          'Town',
                          'Total KES',
                          'Payment Method',
                          'Payment Ref',
                          'Payment Status',
                          'Order Status',
                        ],
                        ...orders.map((o) => [
                          o.orderNumber,
                          o.customerName,
                          o.customerPhone,
                          o.deliveryTown,
                          String(o.totalKes),
                          o.paymentMethod,
                          o.paymentReference,
                          o.paymentStatus,
                          o.orderStatus,
                        ]),
                      ])
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Orders CSV</span>
                  </button>
                </div>

                {orders.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No customer orders yet.</p>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              #{order.orderNumber} · {order.customerName}{' '}
                              <span className="text-xs font-normal text-slate-500">
                                ({order.accountType})
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {order.customerPhone} · {order.deliveryTown}, {order.deliveryCounty} ·{' '}
                              {order.deliveryMethod.replace('_', ' ')}
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              Payment: <strong className="uppercase">{order.paymentMethod}</strong> ·
                              Ref: <strong>{order.paymentReference || 'Awaiting code'}</strong>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold tabular-nums text-navy-900">
                              {formatKes(order.totalKes)}
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleOpenOrderInvoice(order)}
                              className="text-xs font-semibold text-royal-700 hover:underline mt-1"
                            >
                              Open Invoice / Receipt
                            </button>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-slate-600">Payment:</label>
                            <select
                              value={order.paymentStatus}
                              onChange={(e) =>
                                void handleVerifyPayment(order, e.target.value as PaymentStatus)
                              }
                              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium"
                            >
                              <option value="pending_verification">Pending Verification</option>
                              <option value="verified_paid">
                                Verified Paid (Deduct Stock + Award Loyalty)
                              </option>
                              <option value="failed">Failed</option>
                              <option value="refunded">Refunded</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-slate-600">
                              Delivery Stage:
                            </label>
                            <select
                              value={order.orderStatus}
                              onChange={(e) =>
                                void handleUpdateOrderStatus(order, e.target.value as OrderStatus)
                              }
                              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium"
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="processing">Yard Loading</option>
                              <option value="dispatched">Dispatched / In Transit</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. PRODUCT & CATEGORY MANAGEMENT */}
            {section === 'products' && (
              <div className="space-y-6">
                <form
                  onSubmit={handleSaveProduct}
                  className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      {editingProductId ? 'Edit Product Listing' : 'Add New Product to Catalogue'}
                    </h2>
                    {editingProductId && (
                      <button
                        type="button"
                        onClick={resetProductForm}
                        className="text-xs font-semibold text-slate-600 hover:underline"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={prodName}
                        onChange={(e) => setProdName(e.target.value)}
                        placeholder="e.g. Bamburi PowerPlus 42.5N Cement (50kg)"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        SKU Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={prodSku}
                        onChange={(e) => setProdSku(e.target.value)}
                        placeholder="DLR-BLD-210"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Category
                      </label>
                      <select
                        value={prodCategoryId}
                        onChange={(e) => setProdCategoryId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Selling Unit
                      </label>
                      <input
                        type="text"
                        value={prodUnit}
                        onChange={(e) => setProdUnit(e.target.value)}
                        placeholder="50kg Bag / Sheet / Piece"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Default Photo Preset (if no upload)
                      </label>
                      <select
                        value={prodMotif}
                        onChange={(e) => setProdMotif(e.target.value as VisualMotif)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="cement">Cement Bags</option>
                        <option value="mabati">Box Profile Mabati</option>
                        <option value="rebar">Twisted Y12/Y16 Steel Rebar</option>
                        <option value="timber">Treated Structural Timber</option>
                        <option value="plywood">Marine Plywood</option>
                        <option value="door_mahogany">Hardwood Panel Door</option>
                        <option value="window_casement">Steel Casement Window</option>
                        <option value="water_tank">5,000L Water Tank</option>
                        <option value="wheelbarrow">Heavy-Duty Wheelbarrow</option>
                        <option value="brc_mesh">BRC Welded Mesh</option>
                        <option value="drill">Cordless Hammer Drill</option>
                        <option value="lockset">Mortice Lockset</option>
                        <option value="paint_bucket">20L Weatherguard Paint</option>
                        <option value="ppe_bundle">Contractor PPE Kit</option>
                        <option value="solar_floodlight">Solar Floodlight</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Retail KES
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={prodPrice}
                        onChange={(e) => setProdPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Wholesale KES
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={prodWholesalePrice}
                        onChange={(e) => setProdWholesalePrice(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Compare-At KES
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={prodCompareAtPrice}
                        onChange={(e) => setProdCompareAtPrice(Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Min Bulk Qty
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={prodMinWholesaleQty}
                        onChange={(e) => setProdMinWholesaleQty(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Stock Qty
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={prodStockQty}
                        onChange={(e) => setProdStockQty(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Low Alert Qty
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={prodLowThreshold}
                        onChange={(e) => setProdLowThreshold(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Brand / Manufacturer
                      </label>
                      <input
                        type="text"
                        value={prodBrand}
                        onChange={(e) => setProdBrand(e.target.value)}
                        placeholder="e.g. Bamburi Cement / Devki Steel"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Dimensions / Gauge
                      </label>
                      <input
                        type="text"
                        value={prodDimensions}
                        onChange={(e) => setProdDimensions(e.target.value)}
                        placeholder="e.g. 50kg Bag / 3m x 28 Gauge"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Detailed Description
                      </label>
                      <textarea
                        rows={3}
                        value={prodDescription}
                        onChange={(e) => setProdDescription(e.target.value)}
                        placeholder="Describe material grade, durability, and recommended construction application..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Specifications (Key: Value per line)
                      </label>
                      <textarea
                        rows={3}
                        value={prodSpecsText}
                        onChange={(e) => setProdSpecsText(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Multi-image uploader */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-800">
                          Product Photographs (Upload up to 5 images)
                        </div>
                        <div className="text-xs text-slate-500">
                          Photos are automatically optimized for fast loading.
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-navy-900 bg-white border border-slate-300 rounded-lg cursor-pointer hover:border-royal-600">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Photos</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageFilesSelected}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {prodUploadedImages.length > 0 && (
                      <div className="flex items-center gap-3 flex-wrap">
                        {prodUploadedImages.map((img, i) => (
                          <div
                            key={i}
                            className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-white"
                          >
                            <ResilientImage
                              src={img}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setProdUploadedImages((prev) => prev.filter((_, idx) => idx !== i))
                              }
                              className="absolute top-0.5 right-0.5 bg-navy-950/80 text-white text-[10px] px-1 rounded"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="flex flex-wrap items-center gap-5 text-xs text-slate-700">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prodFeatured}
                          onChange={(e) => setProdFeatured(e.target.checked)}
                        />
                        <span>Featured Product</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prodBestSeller}
                          onChange={(e) => setProdBestSeller(e.target.checked)}
                        />
                        <span>Best-Seller</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prodSpecialOffer}
                          onChange={(e) => setProdSpecialOffer(e.target.checked)}
                        />
                        <span>Special Offer</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-emerald-800">
                        <input
                          type="checkbox"
                          checked={prodIsActive}
                          onChange={(e) => setProdIsActive(e.target.checked)}
                        />
                        <span>Visible on Storefront</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={savingProduct}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {savingProduct
                          ? 'Saving...'
                          : editingProductId
                            ? 'Update Product'
                            : 'Publish Product'}
                      </span>
                    </button>
                  </div>
                </form>

                {/* Add New Category */}
                <form
                  onSubmit={handleAddCategory}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-end gap-3"
                >
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      New Category Name
                    </label>
                    <input
                      type="text"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="e.g. Plumbing & Sanitaryware"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      placeholder="Pipes, fittings, tanks, and accessories"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-navy-900 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 whitespace-nowrap"
                  >
                    + Add Category
                  </button>
                </form>

                {/* Existing Categories List */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="font-display text-sm font-bold text-slate-900 mb-3">
                    Active Categories ({categories.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <div
                        key={c.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/ops/categories/${c.id}`, { method: 'DELETE' });
                              notify(`Category "${c.name}" deleted.`, 'info');
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600"
                          title={`Delete ${c.name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Existing Products Quick-Price & Catalogue Table */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900">
                        Catalogue Prices, Stock &amp; Full Editing ({filteredManagedProducts.length} / {managedProducts.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Adjust Retail, Wholesale, Compare-At prices or yard stock inline and click Save, or open full edit.
                      </p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={prodSearch}
                        onChange={(e) => setProdSearch(e.target.value)}
                        placeholder="Search name, SKU, category..."
                        className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {filteredManagedProducts.map((p) => {
                      const draft = quickEdits[p.id] ?? {
                        priceKes: p.priceKes,
                        wholesalePriceKes: p.wholesalePriceKes,
                        compareAtPriceKes: p.compareAtPriceKes,
                        stockQty: p.stockQty,
                        isActive: p.isActive !== false,
                      };
                      const dirty = Boolean(quickEdits[p.id]);
                      return (
                        <div key={p.id} className="py-3.5 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                <ResilientImage
                                  src={p.images[0] || ''}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-2">
                                  <span>{p.name}</span>
                                  {p.isActive === false && (
                                    <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                                      Hidden
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {p.sku} · {p.categoryName} · Unit: {p.unit}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {dirty && (
                                <button
                                  type="button"
                                  disabled={savingQuickId === p.id}
                                  onClick={() => void handleSaveQuickProduct(p)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 disabled:opacity-50"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  <span>{savingQuickId === p.id ? 'Saving...' : 'Save'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => populateProductForEdit(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-royal-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                                title="Edit Full Product"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Full Edit</span>
                              </button>
                              {confirmDeleteProdId === p.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteProduct(p)}
                                    className="px-2.5 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteProdId(null)}
                                    className="px-2 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteProdId(p.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600"
                                  title="Delete Product"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pl-0 sm:pl-14">
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500">
                                Retail KES
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={draft.priceKes}
                                onChange={(e) =>
                                  setQuickEdits((prev) => ({
                                    ...prev,
                                    [p.id]: { ...draft, priceKes: Number(e.target.value) },
                                  }))
                                }
                                className="w-full px-2.5 py-1 text-xs tabular-nums border border-slate-300 rounded-md"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500">
                                Wholesale KES
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={draft.wholesalePriceKes}
                                onChange={(e) =>
                                  setQuickEdits((prev) => ({
                                    ...prev,
                                    [p.id]: { ...draft, wholesalePriceKes: Number(e.target.value) },
                                  }))
                                }
                                className="w-full px-2.5 py-1 text-xs tabular-nums border border-slate-300 rounded-md"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500">
                                Compare-At KES
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={draft.compareAtPriceKes}
                                onChange={(e) =>
                                  setQuickEdits((prev) => ({
                                    ...prev,
                                    [p.id]: { ...draft, compareAtPriceKes: Number(e.target.value) },
                                  }))
                                }
                                className="w-full px-2.5 py-1 text-xs tabular-nums border border-slate-300 rounded-md"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500">
                                Stock ({p.unit})
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={draft.stockQty}
                                onChange={(e) =>
                                  setQuickEdits((prev) => ({
                                    ...prev,
                                    [p.id]: { ...draft, stockQty: Number(e.target.value) },
                                  }))
                                }
                                className="w-full px-2.5 py-1 text-xs tabular-nums border border-slate-300 rounded-md"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setQuickEdits((prev) => ({
                                    ...prev,
                                    [p.id]: { ...draft, isActive: !draft.isActive },
                                  }))
                                }
                                className={`w-full py-1 px-2 text-xs font-semibold rounded-md border ${
                                  draft.isActive
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-300'
                                }`}
                              >
                                {draft.isActive ? 'Listed: Active' : 'Listed: Hidden'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 4. INVENTORY & STOCK MOVEMENTS */}
            {section === 'inventory' && (
              <div className="space-y-6">
                <form
                  onSubmit={handleRecordStockMovement}
                  className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
                >
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Record Yard Stock Restock or Adjustment
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Material
                      </label>
                      <select
                        value={stockProdId || products[0]?.id || ''}
                        onChange={(e) => setStockProdId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Current: {p.stockQty})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Movement Type
                      </label>
                      <select
                        value={stockType}
                        onChange={(e) =>
                          setStockType(e.target.value as 'restock' | 'adjustment' | 'return')
                        }
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="restock">Supplier Restock (+)</option>
                        <option value="return">Customer Return (+)</option>
                        <option value="adjustment">Audit Adjustment (+/-)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Quantity Delta
                      </label>
                      <input
                        type="number"
                        value={stockDelta}
                        onChange={(e) => setStockDelta(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={stockReason}
                      onChange={(e) => setStockReason(e.target.value)}
                      placeholder="Delivery note / supplier batch reference"
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700 whitespace-nowrap"
                    >
                      Post Stock Movement
                    </button>
                  </div>
                </form>

                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Recent Stock Movement Ledger
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv('delarico-inventory-report.csv', [
                          [
                            'SKU',
                            'Material',
                            'Stock Qty',
                            'Low Alert Threshold',
                            'Unit',
                            'Status',
                          ],
                          ...products.map((p) => [
                            p.sku,
                            p.name,
                            String(p.stockQty),
                            String(p.lowStockThreshold),
                            p.unit,
                            p.stockQty <= p.lowStockThreshold ? 'LOW STOCK' : 'HEALTHY',
                          ]),
                        ])
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Inventory Report CSV</span>
                    </button>
                  </div>
                  {stockMovements.length === 0 ? (
                    <p className="text-xs text-slate-500">No stock movements logged yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {stockMovements.slice(0, 20).map((m) => (
                        <div
                          key={m.id}
                          className="py-2.5 flex items-center justify-between gap-3"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{m.productName}</span>
                            <span className="text-slate-500"> · {m.reason}</span>
                          </div>
                          <div className="tabular-nums font-semibold">
                            <span
                              className={
                                m.quantityDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }
                            >
                              {m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                            </span>{' '}
                            <span className="text-slate-400">({m.newStock})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. QUOTATIONS MANAGEMENT */}
            {section === 'quotations' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Contractor &amp; Bulk Quotation Requests
                </h2>
                {quotations.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    No quotation requests submitted yet.
                  </p>
                ) : (
                  quotations.map((q) => (
                    <div key={q.id} className="border border-slate-200 rounded-xl p-5 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            #{q.quoteNumber} · {q.contactName}{' '}
                            {q.companyName ? `(${q.companyName})` : ''}
                          </div>
                          <div className="text-xs text-slate-500">
                            {q.phone} · {q.email} · Delivery: {q.deliveryLocation}
                          </div>
                        </div>
                        <span className="text-xs font-semibold capitalize text-royal-700">
                          Status: {q.status}
                        </span>
                      </div>
                      {q.instructions && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                          {q.instructions}
                        </p>
                      )}
                      <div>
                        <button
                          type="button"
                          onClick={() => void handleLoadQuoteItems(q.id)}
                          className="text-xs font-semibold text-royal-700 hover:underline"
                        >
                          View Requested Materials ({q.itemCount} items · Est.{' '}
                          {formatKes(q.estimatedSubtotalKes)})
                        </button>
                        {expandedQuoteItems[q.id] && (
                          <div className="mt-2 space-y-1 text-xs text-slate-700 pl-3 border-l border-slate-200">
                            {expandedQuoteItems[q.id].map((it) => (
                              <div key={it.id}>
                                {it.productName} — <strong>{it.quantity}</strong> {it.unit} (Ref:{' '}
                                {formatKes(it.unitPriceKes)})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Official Quoted KES
                          </label>
                          <input
                            type="number"
                            value={
                              quoteAmounts[q.id] ?? (q.quotedTotalKes || q.estimatedSubtotalKes)
                            }
                            onChange={(e) =>
                              setQuoteAmounts((prev) => ({
                                ...prev,
                                [q.id]: Number(e.target.value),
                              }))
                            }
                            className="w-full px-3 py-1.5 text-xs tabular-nums border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Validity
                          </label>
                          <input
                            type="text"
                            value={quoteValidUntil[q.id] ?? (q.validUntil || '14 Days')}
                            onChange={(e) =>
                              setQuoteValidUntil((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Terms / Delivery Note
                          </label>
                          <input
                            type="text"
                            value={quoteNotes[q.id] ?? q.adminResponseNotes}
                            onChange={(e) =>
                              setQuoteNotes((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            placeholder="Includes delivery to site"
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRespondQuotation(q)}
                          className="px-4 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700"
                        >
                          Send Official Quote
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 6. CUSTOMERS & ENQUIRIES */}
            {section === 'customers' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-bold text-slate-900">
                        Registered Accounts, Contractors &amp; Wholesale Control ({customers.length})
                      </h2>
                      <p className="text-xs text-slate-500">
                        View customer contact numbers, approve wholesale pricing tiers, adjust loyalty points, or edit/remove accounts.
                      </p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={custSearch}
                        onChange={(e) => setCustSearch(e.target.value)}
                        placeholder="Search name, phone, email..."
                        className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {filteredCustomers.length === 0 ? (
                    <p className="text-xs text-slate-500">No matching customer accounts found.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredCustomers.map((c) => (
                        <div key={c.uid} className="py-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-2">
                                <span>{c.displayName}</span>
                                <span className="text-xs font-normal text-slate-500 capitalize">
                                  · {c.accountType}
                                </span>
                                {c.uid === 'usr_executive_01' && (
                                  <span className="text-[10px] font-semibold text-royal-700 bg-royal-50 px-1.5 py-0.5 rounded">
                                    Primary Operations Account
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-600 tabular-nums">
                                {c.phone ? `Phone: ${c.phone}` : 'No phone'}
                                {c.email ? ` · ${c.email}` : ''}
                                {c.defaultTown ? ` · ${c.defaultTown}, ${c.defaultCounty || 'Kenya'}` : ''}
                              </div>
                              <div className="text-xs text-slate-500">
                                {c.companyName ? `${c.companyName} · ` : ''}
                                {c.registrationRef ? `Ref: ${c.registrationRef} · ` : ''}
                                Loyalty: <strong>{c.loyaltyPoints} pts</strong>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleToggleWholesaleCustomer(c)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                                  c.wholesaleApproved
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-royal-600'
                                }`}
                              >
                                {c.wholesaleApproved
                                  ? '✓ Wholesale Tier'
                                  : 'Approve Wholesale'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  editingCustomerUid === c.uid
                                    ? setEditingCustomerUid(null)
                                    : openEditCustomer(c)
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-navy-900 bg-white border border-slate-200 rounded-lg hover:border-royal-600"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{editingCustomerUid === c.uid ? 'Close' : 'Edit'}</span>
                              </button>
                              {c.uid !== 'usr_executive_01' &&
                                (confirmDeleteCustUid === c.uid ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteCustomer(c.uid, c.displayName)}
                                      className="px-2.5 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-lg"
                                    >
                                      Confirm Delete
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteCustUid(null)}
                                      className="px-2 py-1.5 text-xs text-slate-600"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteCustUid(c.uid)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600"
                                    title="Delete Account"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ))}
                            </div>
                          </div>

                          {editingCustomerUid === c.uid && (
                            <form
                              onSubmit={handleSaveCustomerEdit}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                                    Full Name
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={custEditForm.displayName}
                                    onChange={(e) =>
                                      setCustEditForm({ ...custEditForm, displayName: e.target.value })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                                    Account Type
                                  </label>
                                  <select
                                    value={custEditForm.accountType}
                                    onChange={(e) =>
                                      setCustEditForm({
                                        ...custEditForm,
                                        accountType: e.target.value as 'individual' | 'contractor' | 'institution',
                                      })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  >
                                    <option value="individual">Individual</option>
                                    <option value="contractor">Contractor</option>
                                    <option value="institution">Institution</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                                    Loyalty Points
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={custEditForm.loyaltyPoints}
                                    onChange={(e) =>
                                      setCustEditForm({
                                        ...custEditForm,
                                        loyaltyPoints: Number(e.target.value),
                                      })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs tabular-nums bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                                    Phone Number
                                  </label>
                                  <input
                                    type="text"
                                    value={custEditForm.phone}
                                    onChange={(e) =>
                                      setCustEditForm({ ...custEditForm, phone: e.target.value })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                                    Email
                                  </label>
                                  <input
                                    type="email"
                                    value={custEditForm.email}
                                    onChange={(e) =>
                                      setCustEditForm({ ...custEditForm, email: e.target.value })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                                    Company / Contractor Firm
                                  </label>
                                  <input
                                    type="text"
                                    value={custEditForm.companyName}
                                    onChange={(e) =>
                                      setCustEditForm({ ...custEditForm, companyName: e.target.value })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                                    County
                                  </label>
                                  <input
                                    type="text"
                                    value={custEditForm.defaultCounty}
                                    onChange={(e) =>
                                      setCustEditForm({ ...custEditForm, defaultCounty: e.target.value })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                                    Town / Delivery Zone
                                  </label>
                                  <input
                                    type="text"
                                    value={custEditForm.defaultTown}
                                    onChange={(e) =>
                                      setCustEditForm({ ...custEditForm, defaultTown: e.target.value })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div className="flex items-end">
                                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer pb-1.5">
                                    <input
                                      type="checkbox"
                                      checked={custEditForm.wholesaleApproved}
                                      onChange={(e) =>
                                        setCustEditForm({
                                          ...custEditForm,
                                          wholesaleApproved: e.target.checked,
                                        })
                                      }
                                    />
                                    <span>Wholesale Tier Approved</span>
                                  </label>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingCustomerUid(null)}
                                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={savingCustomer}
                                  className="px-4 py-1.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700 disabled:opacity-50"
                                >
                                  {savingCustomer ? 'Saving...' : 'Save Account Changes'}
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-royal-700" />
                    <span>Customer &amp; Supplier Partnership Enquiries ({enquiries.length})</span>
                  </h3>
                  {enquiries.map((enq) => (
                    <div key={enq.id} className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">
                          {enq.subject} — {enq.name} ({enq.phone})
                        </span>
                        <span className="font-semibold capitalize text-royal-700">
                          {enq.enquiryType.replace('_', ' ')} · {enq.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{enq.message}</p>
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={enquiryReplies[enq.id] ?? enq.adminReply}
                          onChange={(e) =>
                            setEnquiryReplies((prev) => ({ ...prev, [enq.id]: e.target.value }))
                          }
                          placeholder="Write official response..."
                          className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => void handleReplyEnquiry(enq)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-navy-900 rounded-lg"
                        >
                          Send Reply
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. PROMOTIONS */}
            {section === 'promotions' && (
              <div className="space-y-6">
                <form
                  onSubmit={handleCreatePromo}
                  className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
                >
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Create Promotional Discount Campaign
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Promo Code
                      </label>
                      <input
                        type="text"
                        required
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="FUNDIPRO10"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Campaign Title
                      </label>
                      <input
                        type="text"
                        required
                        value={promoTitle}
                        onChange={(e) => setPromoTitle(e.target.value)}
                        placeholder="Seasonal Roofing & Timber Rebate"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Discount Type
                      </label>
                      <select
                        value={promoType}
                        onChange={(e) => setPromoType(e.target.value as 'percentage' | 'fixed_kes')}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed_kes">Fixed Amount (KES)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Discount Value
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={promoValue}
                        onChange={(e) => setPromoValue(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Minimum Order (KES)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={promoMinOrder}
                        onChange={(e) => setPromoMinOrder(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700"
                  >
                    Publish Promotional Code
                  </button>
                </form>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Active Promotional Campaigns ({promotions.length})
                  </h3>
                  {promotions.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0 text-xs"
                    >
                      <div>
                        <span className="font-bold text-navy-900">{p.code}</span> — {p.title}
                        <div className="tabular-nums text-slate-500 mt-0.5">
                          {p.discountType === 'percentage'
                            ? `${p.discountValue}% OFF`
                            : `${formatKes(p.discountValue)} OFF`}{' '}
                          (Min {formatKes(p.minOrderKes)})
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/ops/promotions/${p.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ isActive: !p.isActive }),
                              });
                              notify(
                                `${p.code} ${p.isActive ? 'paused' : 'activated'}.`,
                                'info'
                              );
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Update failed.', 'error');
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md border font-semibold ${
                            p.isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}
                        >
                          {p.isActive ? 'Active' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/ops/promotions/${p.id}`, { method: 'DELETE' });
                              notify(`Deleted promo ${p.code}.`, 'info');
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                          title="Delete Promo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7B. REVIEWS MODERATION */}
            {section === 'reviews' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Customer Ratings &amp; Reviews Moderation ({adminReviews.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Publish, hide, verify buyers, or delete customer reviews; product star averages recalculate automatically.
                    </p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                      placeholder="Search product or reviewer..."
                      className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                {filteredReviews.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No customer reviews found.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredReviews.map((rev) => (
                      <div key={rev.id} className="py-3.5 flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 max-w-xl">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-navy-900">{rev.productName}</span>
                            <span className="text-gold-600 font-bold">{'★'.repeat(rev.rating)} ({rev.rating}/5)</span>
                            {rev.status === 'hidden' && (
                              <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                                Hidden
                              </span>
                            )}
                            {rev.verifiedBuyer && (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                Verified Buyer
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-800">{rev.title}</div>
                          <p className="text-xs text-slate-600">{rev.comment}</p>
                          <div className="text-[11px] text-slate-400">By {rev.customerName}</div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/ops/reviews/${rev.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    status: rev.status === 'published' ? 'hidden' : 'published',
                                    verifiedBuyer: rev.verifiedBuyer,
                                  }),
                                });
                                await loadOpsData();
                                notify('Updated review visibility.', 'success');
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Update failed.', 'error');
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                          >
                            {rev.status === 'published' ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Hide</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Publish</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/ops/reviews/${rev.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    status: rev.status,
                                    verifiedBuyer: !rev.verifiedBuyer,
                                  }),
                                });
                                await loadOpsData();
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Update failed.', 'error');
                              }
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold text-royal-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                          >
                            {rev.verifiedBuyer ? 'Unverify' : 'Verify Buyer'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/ops/reviews/${rev.id}`, { method: 'DELETE' });
                                await loadOpsData();
                                notify('Review removed.', 'info');
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600"
                            title="Delete Review"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 7C. NEWSLETTER SUBSCRIBERS */}
            {section === 'newsletter' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Privacy-Compliant Newsletter Subscribers ({newsletterSubscribers.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Opted-in marketing emails recorded with explicit Kenya Data Protection Act consent metadata.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={newsletterSearch}
                        onChange={(e) => setNewsletterSearch(e.target.value)}
                        placeholder="Search subscriber email..."
                        className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv('delarico-newsletter-subscribers.csv', [
                          ['Email', 'Status', 'Consent Accepted', 'Policy Version', 'Source'],
                          ...newsletterSubscribers.map((s) => [
                            s.email,
                            s.status,
                            s.consentAccepted ? 'YES' : 'NO',
                            s.consentPolicyVersion,
                            s.source,
                          ]),
                        ])
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {filteredSubscribers.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    No newsletter subscribers recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredSubscribers.map((sub) => (
                      <div
                        key={sub.id}
                        className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{sub.email}</div>
                          <div className="text-slate-500 mt-0.5">
                            Consent: <strong>{sub.consentPolicyVersion}</strong> · Source: {sub.source}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const nextStatus = sub.status === 'subscribed' ? 'unsubscribed' : 'subscribed';
                              try {
                                await apiFetch(`/api/ops/newsletter/${sub.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: nextStatus }),
                                });
                                await loadOpsData();
                                notify(`${sub.email} marked as ${nextStatus}.`, 'info');
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Update failed.', 'error');
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg border font-semibold ${
                              sub.status === 'subscribed'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}
                          >
                            {sub.status === 'subscribed' ? 'Subscribed' : 'Unsubscribed'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/ops/newsletter/${sub.id}`, { method: 'DELETE' });
                                await loadOpsData();
                                notify(`Removed ${sub.email} from newsletter list.`, 'info');
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600"
                            title="Delete Subscriber"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 8. FINANCIAL MANAGEMENT */}
            {section === 'financials' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Financial Ledger, Invoices &amp; Transaction Reconciliation
                    </h2>
                    <p className="text-xs text-slate-500">
                      Monitor paid vs pending orders, generate digital invoices/receipts, and export
                      accounting CSVs.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv('delarico-financial-ledger.csv', [
                        [
                          'Order Number',
                          'Customer',
                          'Subtotal KES',
                          'Discount KES',
                          'Delivery KES',
                          'Total KES',
                          'Payment Method',
                          'Reference',
                          'Status',
                        ],
                        ...orders.map((o) => [
                          o.orderNumber,
                          o.customerName,
                          String(o.subtotalKes),
                          String(o.discountKes),
                          String(o.deliveryFeeKes),
                          String(o.totalKes),
                          o.paymentMethod,
                          o.paymentReference,
                          o.paymentStatus,
                        ]),
                      ])
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Financial Report CSV</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="text-xs text-emerald-800">Verified Paid Receipts</div>
                    <div className="text-lg font-bold tabular-nums text-emerald-950 mt-1">
                      {formatKes(analytics.totalVerifiedRevenue)}
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="text-xs text-amber-800">Unverified / Outstanding Invoices</div>
                    <div className="text-lg font-bold tabular-nums text-amber-950 mt-1">
                      {formatKes(analytics.outstandingKes)}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-xs text-slate-600">Official Payment &amp; Contact Line</div>
                    <div className="text-sm font-bold text-slate-900 mt-1">
                      M-Pesa: {settings.whatsappNumber}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2.5 pr-3">Invoice #</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Method &amp; Ref</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 pl-3 text-right">Document</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td className="py-3 pr-3 font-semibold text-slate-900">
                            {o.orderNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-700">{o.customerName}</td>
                          <td className="py-3 px-3 text-slate-600">
                            {o.paymentMethod.toUpperCase()} ({o.paymentReference || 'N/A'})
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`font-semibold ${
                                o.paymentStatus === 'verified_paid'
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {o.paymentStatus === 'verified_paid' ? 'PAID' : 'UNPAID'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold tabular-nums">
                            {formatKes(o.totalKes)}
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <button
                              type="button"
                              onClick={() => void handleOpenOrderInvoice(o)}
                              className="text-royal-700 font-semibold hover:underline"
                            >
                              Open PDF/Print
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 9. BRANCH EXPANSION & SETTINGS */}
            {section === 'branches' && (
              <div className="space-y-6">
                <form
                  onSubmit={handleSaveSettings}
                  className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-royal-700" />
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Corporate Contact, Delivery Fees &amp; Payment Settings
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Official Phone, WhatsApp &amp; M-Pesa
                      </label>
                      <input
                        type="text"
                        value={settingsForm.whatsappNumber}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, whatsappNumber: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        M-Pesa Payment Number
                      </label>
                      <input
                        type="text"
                        value={settingsForm.mpesaPaybillNumber}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            mpesaPaybillNumber: e.target.value,
                            mpesaTillNumber: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Free Siaya Delivery Threshold (KES)
                      </label>
                      <input
                        type="number"
                        value={settingsForm.freeDeliveryThresholdKes}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            freeDeliveryThresholdKes: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Corporate Settings</span>
                  </button>
                </form>

                <form
                  onSubmit={handleCreateBranch}
                  className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
                >
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Multi-Branch Yard Expansion
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="Branch Name (e.g. Kisumu Regional Yard)"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={branchCode}
                      onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                      placeholder="Code (e.g. KSM-03)"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={branchCounty}
                      onChange={(e) => setBranchCounty(e.target.value)}
                      placeholder="County (e.g. Kisumu)"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={branchTown}
                      onChange={(e) => setBranchTown(e.target.value)}
                      placeholder="Town"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={branchAddress}
                      onChange={(e) => setBranchAddress(e.target.value)}
                      placeholder="Yard Physical Address"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={branchZones}
                      onChange={(e) => setBranchZones(e.target.value)}
                      placeholder="Delivery Zones (comma separated)"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-royal-700"
                  >
                    + Register New Branch Yard
                  </button>

                  <div className="pt-4 border-t border-slate-100 divide-y divide-slate-100 text-xs">
                    {branches.map((b) => (
                      <div key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-slate-900">{b.name}</span> ({b.code}) —{' '}
                          {b.town}, {b.county}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-500">
                            {b.isHeadquarters ? 'Headquarters' : 'Regional Yard'}
                          </span>
                          {!b.isHeadquarters && b.id !== 'branch-siaya-hq' && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await apiFetch(`/api/ops/branches/${b.id}`, { method: 'DELETE' });
                                  notify(`Removed branch ${b.name}.`, 'info');
                                } catch (err) {
                                  notify(err instanceof Error ? err.message : 'Could not delete branch.', 'error');
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600"
                              title={`Remove ${b.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </form>
              </div>
            )}

            {/* 10. AFFILIATE PARTNERS & COMMISSION PAYOUTS */}
            {section === 'affiliates' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-bold text-slate-900">
                        Affiliate Sales Network (3%–5% Commission)
                      </h2>
                      <p className="text-xs text-slate-500">
                        Monitor affiliate clicks, referred orders, base commission tiers (3%–5%), and settle M-Pesa payouts.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv('delarico-affiliates.csv', [
                          [
                            'Name',
                            'Code',
                            'M-Pesa Phone',
                            'Base Rate %',
                            'Clicks',
                            'Referrals',
                            'Sales KES',
                            'Pending KES',
                            'Available KES',
                            'Paid KES',
                            'Payout Requested',
                          ],
                          ...affiliates.map((a) => [
                            a.displayName,
                            a.affiliateCode,
                            a.mpesaPhone,
                            String(a.commissionRatePct),
                            String(a.totalClicks),
                            String(a.totalReferrals),
                            String(a.totalSalesKes),
                            String(a.pendingCommissionKes),
                            String(a.availableCommissionKes),
                            String(a.paidCommissionKes),
                            a.payoutRequested ? 'YES' : 'NO',
                          ]),
                        ])
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Affiliates CSV</span>
                    </button>
                  </div>

                  {affiliates.length === 0 ? (
                    <p className="text-sm text-slate-500 py-8 text-center">
                      No affiliate partners enrolled yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {affiliates.map((aff) => (
                        <div
                          key={aff.uid}
                          className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="text-sm font-bold text-slate-900">
                              {aff.displayName}{' '}
                              <span className="font-mono text-xs text-royal-700 ml-1">
                                ({aff.affiliateCode})
                              </span>
                              {aff.payoutRequested && (
                                <span className="ml-2 text-xs font-semibold text-amber-700">
                                  · M-Pesa Payout Requested
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums">
                              M-Pesa: <strong>{aff.mpesaPhone || 'Not set'}</strong> · Clicks:{' '}
                              {aff.totalClicks} · Orders: {aff.totalReferrals} · Sales:{' '}
                              {formatKes(aff.totalSalesKes)}
                            </div>
                            <div className="text-xs text-slate-600 tabular-nums">
                              Pending: <strong className="text-amber-700">{formatKes(aff.pendingCommissionKes)}</strong>{' '}
                              · Available:{' '}
                              <strong className="text-emerald-700">{formatKes(aff.availableCommissionKes)}</strong>{' '}
                              · Paid Out:{' '}
                              <strong className="text-royal-700">{formatKes(aff.paidCommissionKes)}</strong>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <select
                              value={aff.commissionRatePct}
                              onChange={async (e) => {
                                const nextRate = Number(e.target.value);
                                try {
                                  await apiFetch(`/api/ops/affiliates/${aff.uid}/rate`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ commissionRatePct: nextRate }),
                                  });
                                  await loadOpsData();
                                  notify(`Updated ${aff.displayName} base rate to ${nextRate}%.`, 'success');
                                } catch (err) {
                                  notify(err instanceof Error ? err.message : 'Failed to update rate.', 'error');
                                }
                              }}
                              className="px-2.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                            >
                              <option value={3}>Base Tier: 3%</option>
                              <option value={4}>Silver Tier: 4%</option>
                              <option value={5}>VIP Tier: 5%</option>
                            </select>

                            <button
                              type="button"
                              disabled={aff.availableCommissionKes <= 0}
                              onClick={async () => {
                                try {
                                  await apiFetch(`/api/ops/affiliates/${aff.uid}/settle`, {
                                    method: 'PATCH',
                                  });
                                  await loadOpsData();
                                  notify(
                                    `Marked ${formatKes(aff.availableCommissionKes)} M-Pesa payout settled for ${aff.displayName}.`,
                                    'success'
                                  );
                                } catch (err) {
                                  notify(err instanceof Error ? err.message : 'Payout settlement failed.', 'error');
                                }
                              }}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400"
                            >
                              Settle M-Pesa ({formatKes(aff.availableCommissionKes)})
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {affiliateReferrals.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Referred Orders Ledger ({affiliateReferrals.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2 pr-3 font-semibold">Order #</th>
                            <th className="py-2 px-3 font-semibold">Affiliate Code</th>
                            <th className="py-2 px-3 font-semibold">Order Value</th>
                            <th className="py-2 px-3 font-semibold">Commission</th>
                            <th className="py-2 pl-3 font-semibold text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {affiliateReferrals.map((r) => (
                            <tr key={r.id}>
                              <td className="py-2.5 pr-3 font-semibold tabular-nums">#{r.orderNumber}</td>
                              <td className="py-2.5 px-3 font-mono text-royal-700">{r.affiliateCode}</td>
                              <td className="py-2.5 px-3 tabular-nums">{formatKes(r.orderTotalKes)}</td>
                              <td className="py-2.5 px-3 font-bold text-emerald-700 tabular-nums">
                                {formatKes(r.commissionKes)} ({r.commissionRatePct}%)
                              </td>
                              <td className="py-2.5 pl-3 text-right capitalize font-medium">{r.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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
