/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';

const CatalogPage = lazy(() =>
  import('./pages/CatalogPage').then((m) => ({ default: m.CatalogPage }))
);
const ProductDetailPage = lazy(() =>
  import('./pages/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage }))
);
const SavedItemsPage = lazy(() =>
  import('./pages/SavedItemsPage').then((m) => ({ default: m.SavedItemsPage }))
);
const ComparePage = lazy(() =>
  import('./pages/ComparePage').then((m) => ({ default: m.ComparePage }))
);
const CheckoutPage = lazy(() =>
  import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage }))
);
const QuotationPage = lazy(() =>
  import('./pages/QuotationPage').then((m) => ({ default: m.QuotationPage }))
);
const AboutPage = lazy(() =>
  import('./pages/CorporatePages').then((m) => ({ default: m.AboutPage }))
);
const ServicesPage = lazy(() =>
  import('./pages/CorporatePages').then((m) => ({ default: m.ServicesPage }))
);
const PartnershipsPage = lazy(() =>
  import('./pages/CorporatePages').then((m) => ({ default: m.PartnershipsPage }))
);
const ContactPage = lazy(() =>
  import('./pages/CorporatePages').then((m) => ({ default: m.ContactPage }))
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((m) => ({ default: m.AccountPage }))
);
const AffiliatePage = lazy(() =>
  import('./pages/AffiliatePage').then((m) => ({ default: m.AffiliatePage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);

const PageLoader: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
    <div className="flex items-center gap-3 text-xs font-semibold text-navy-900">
      <div className="w-4 h-4 rounded-full border-2 border-navy-900 border-t-transparent animate-spin" />
      <span>Loading...</span>
    </div>
  </div>
);

const RouteSeoAndReferralUpdater: React.FC = () => {
  const { pathname, search } = useLocation();
  const { captureAffiliateRef } = useStore();

  useEffect(() => {
    if (search) {
      const params = new URLSearchParams(search);
      const refCode = params.get('ref');
      if (refCode && refCode.trim().length >= 4) {
        captureAffiliateRef(refCode);
      }
    }
  }, [search, captureAffiliateRef]);

  useEffect(() => {
    const baseTitle = 'Delarico Merchandise & Supplies';
    const routeTitles: Record<string, string> = {
      '/': `${baseTitle} – Online Hardware, Cement, Mabati & Timber Store in Kenya`,
      '/products': `Shop Building Materials & Hardware | ${baseTitle}`,
      '/saved': `Saved Materials & Wishlist | ${baseTitle}`,
      '/wishlist': `Saved Materials & Wishlist | ${baseTitle}`,
      '/affiliates': `Affiliate Program – Earn 3%–5% Commission | ${baseTitle}`,
      '/compare': `Compare Material Specifications | ${baseTitle}`,
      '/checkout': `Checkout | ${baseTitle}`,
      '/request-quote': `Request Project Quotation (BOQ) | ${baseTitle}`,
      '/about': `About Us – Built on Quality. Driven by Trust. | ${baseTitle}`,
      '/services': `Wholesale & Site Delivery Services | ${baseTitle}`,
      '/partnerships': `Supplier Partnership Portal | ${baseTitle}`,
      '/contact': `Contact Us – Siaya, Kenya | ${baseTitle}`,
      '/account': `Sign In & Customer Account | ${baseTitle}`,
      '/portal/workspace': `Operations Workspace | ${baseTitle}`,
    };

    document.title =
      routeTitles[pathname] ||
      (pathname.startsWith('/product/')
        ? `Buy Online – Material Details & Pricing | ${baseTitle}`
        : `${baseTitle} – Built on Quality. Driven by Trust.`);
  }, [pathname]);

  return null;
};

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <RouteSeoAndReferralUpdater />
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<CatalogPage />} />
              <Route path="/product/:slug" element={<ProductDetailPage />} />
              <Route path="/saved" element={<SavedItemsPage />} />
              <Route path="/wishlist" element={<SavedItemsPage />} />
              <Route path="/affiliates" element={<AffiliatePage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/request-quote" element={<QuotationPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/partnerships" element={<PartnershipsPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/portal/workspace" element={<AdminDashboardPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </StoreProvider>
    </BrowserRouter>
  );
}
