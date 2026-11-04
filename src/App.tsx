/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ComparePage } from './pages/ComparePage';
import { CheckoutPage } from './pages/CheckoutPage';
import { QuotationPage } from './pages/QuotationPage';
import { AboutPage, ContactPage, PartnershipsPage, ServicesPage } from './pages/CorporatePages';
import { AccountPage } from './pages/AccountPage';
import { AffiliatePage } from './pages/AffiliatePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

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
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<CatalogPage />} />
            <Route path="/product/:slug" element={<ProductDetailPage />} />
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
        </Layout>
      </StoreProvider>
    </BrowserRouter>
  );
}
