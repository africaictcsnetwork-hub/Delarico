import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  Compass,
  Handshake,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { OFFICIAL_LOGO_PATH } from '../firebase';
import { useStore } from '../context/StoreContext';
import { EnquiryType } from '../types';
import { buildWhatsAppUrl } from '../utils/whatsapp';

export const AboutPage: React.FC = () => {
  const { settings, branches } = useStore();

  const coreValues = [
    {
      title: 'Uncompromising Material Quality',
      desc: 'Every bag of Bamburi or Simba cement, Devki steel bar, treated timber length, and mabati sheet meets strict KEBS structural specifications.',
    },
    {
      title: 'Integrity & Transparent Pricing',
      desc: 'Honest weights, true sheet gauges, accurate timber running-foot tallying, and clear retail/wholesale invoicing with zero hidden charges.',
    },
    {
      title: 'Customer & Contractor Partnership',
      desc: 'Whether supplying a single mahogany door to a homeowner or 500 bags of cement to an institutional contractor, every client receives dedicated support.',
    },
    {
      title: 'Dependable Regional Logistics',
      desc: 'Punctual yard loading and coordinated site delivery across Siaya County, the Lake Victoria Basin, and Western Kenya.',
    },
  ];

  return (
    <div className="space-y-16 pb-16 font-sans">
      {/* Corporate Banner */}
      <section className="bg-navy-900 text-white py-14 border-b border-gold-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <p className="text-xs font-semibold text-gold-400">Corporate Profile · Siaya, Kenya</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{settings.businessName}</h1>
            <p className="text-lg text-gold-400 font-medium">{settings.tagline}</p>
            <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
              Established in Siaya, Kenya to deliver trusted Kenyan building materials, seasoned structural
              timber, architectural joinery, and general hardware supplies across Western Kenya and beyond.
            </p>
          </div>
          <div className="lg:col-span-4 flex lg:justify-end">
            <div className="bg-white p-6 rounded-xl border-2 border-gold-500 shadow-lg">
              <img
                src={OFFICIAL_LOGO_PATH}
                alt="DELARICO Official Corporate Crest"
                className="w-36 h-36 object-contain mx-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Company Background & Mission/Vision */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-2xl font-bold text-navy-900">Company Background &amp; Commitment to Quality</h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>{settings.businessName}</strong> was founded to solve the everyday challenges faced by
            builders, diaspora homeowners, fundis, engineers, and public institutions in Western Kenya:
            inconsistent material grades, fragmented sourcing across multiple small shops, and delayed site
            deliveries.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            From our flagship supply yard in Siaya Town—supported by distribution depots in Bondo and
            Ugunja—we consolidate six comprehensive supply departments under one roof. Our direct factory
            partnerships guarantee genuine Bamburi &amp; Simba cement, KEBS BS 4449 steel reinforcement,
            pressure-treated highland timber, solid mahogany doors, water tanks, and industrial tools at
            fair wholesale and retail prices.
          </p>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-navy-900 font-bold text-base">
              <Compass className="w-5 h-5 text-royal-700" />
              <h3>Our Mission</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              To empower residential builders, commercial contractors, and institutions with certified,
              durable building materials, transparent digital ordering, and dependable site delivery.
            </p>
          </div>

          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-navy-900 font-bold text-base">
              <Award className="w-5 h-5 text-gold-600" />
              <h3>Our Vision</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              To be Kenya’s most trusted physical and online building materials, timber, and hardware
              supplier—recognized for genuine quality and customer trust.
            </p>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <h2 className="text-2xl font-bold text-navy-900">Core Corporate Values</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {coreValues.map((val, i) => (
            <div key={val.title} className="p-6 bg-white border border-slate-200 rounded-xl space-y-2">
              <p className="text-xs font-bold text-gold-600">0{i + 1}.</p>
              <h3 className="text-base font-bold text-navy-900">{val.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{val.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Branch Network */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <h2 className="text-2xl font-bold text-navy-900">Yards, Depots &amp; Delivery Coverage</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <div key={branch.id} className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <p className="text-xs text-royal-700 font-semibold">
                {branch.code} {branch.isHeadquarters ? '· HEADQUARTERS' : '· REGIONAL DEPOT'}
              </p>
              <h3 className="text-base font-bold text-navy-900">{branch.name}</h3>
              <p className="text-xs text-slate-600">{branch.address}</p>
              <p className="text-xs text-slate-700 font-medium tabular-nums">Tel: {branch.phone}</p>
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                <strong>Coverage:</strong> {branch.deliveryZones}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export const ServicesPage: React.FC = () => {
  const { settings } = useStore();

  const services = [
    {
      num: '01',
      title: 'Wholesale & Retail Material Supply',
      desc: 'Flexible supply from single-bag homeowner purchases to full-lorry wholesale consignments for hardware retailers and civil contractors.',
    },
    {
      num: '02',
      title: 'Seasoned & Pressure-Treated Timber Supply',
      desc: 'Kiln-dried CCA-treated structural cypress (4x2, 3x2, 2x2), pine rafters (6x2), fascia boards, and 18mm phenolic film-faced marine shuttering plywood.',
    },
    {
      num: '03',
      title: 'Structural Building Materials Supply',
      desc: 'Direct factory consignments of Class 32.5R & 42.5N Portland cement, BS 4449 deformed steel bars (Y8–Y25), BRC mesh, and true-gauge Alu-Zinc mabati.',
    },
    {
      num: '04',
      title: 'Industrial Hardware & Power Tools',
      desc: 'Cordless brushless hammer drills, angle grinders, Union mortise locks, fasteners, plumbing fittings, and master site toolkits.',
    },
    {
      num: '05',
      title: 'Solid Hardwood Doors & Steel Windows',
      desc: 'Solid seasoned mahogany panel doors, engineered flush doors, and heavy-gauge Z-section steel casement windows with integrated burglar-proof grilles.',
    },
    {
      num: '06',
      title: 'Specialized Construction Material Sourcing',
      desc: 'Custom procurement of structural steel sections, institutional sanitaryware, solar floodlights, water tanks, and exterior weatherproof coatings.',
    },
    {
      num: '07',
      title: 'Bulk Institutional & Diaspora Project Packages',
      desc: 'Milestone-based material scheduling, phased deliveries, and verified digital invoicing for schools, hospitals, county projects, and diaspora home builders.',
    },
    {
      num: '08',
      title: 'Tracked Lorry & Site Offloading Delivery',
      desc: 'Prompt road haulage from Siaya HQ, Bondo, and Ugunja yards straight to your site with coordinated offloading.',
    },
  ];

  const waServiceUrl = buildWhatsAppUrl(
    `Hello ${settings.businessName}, I would like to enquire about your wholesale supply and site delivery services.`,
    settings.whatsappNumber
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14 font-sans">
      <div className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold text-royal-700">End-to-End Construction Supply</p>
        <h1 className="text-3xl font-bold text-navy-900">Corporate &amp; Project Services</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          From initial Bill of Quantities (BOQ) pricing to phased site delivery, {settings.businessName}{' '}
          operates as your dependable supply partner across Kenya.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((srv) => (
          <div key={srv.num} className="p-6 bg-white border border-slate-200 rounded-xl space-y-2.5">
            <span className="text-xs font-bold text-gold-600">{srv.num}.</span>
            <h2 className="text-lg font-bold text-navy-900">{srv.title}</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{srv.desc}</p>
          </div>
        ))}
      </div>

      <div className="p-8 bg-navy-900 text-white rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold">Planning a Home, Commercial, or Institutional Build?</h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Submit your material list for wholesale rates or chat directly with our Siaya sales desk on {settings.whatsappNumber}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Link
            to="/request-quote"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400"
          >
            <span>Request Project Quote</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <a
            href={waServiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp {settings.whatsappNumber}</span>
          </a>
        </div>
      </div>
    </div>
  );
};

interface EnquiryFormBlockProps {
  defaultType: EnquiryType;
  heading: string;
  subheading: string;
}

const EnquiryFormBlock: React.FC<EnquiryFormBlockProps> = ({ defaultType, heading, subheading }) => {
  const { user, authToken, userProfile, userContact, settings, notify } = useStore();
  const [enquiryType, setEnquiryType] = useState<EnquiryType>(defaultType);
  const [name, setName] = useState(userProfile?.displayName || '');
  const [companyName, setCompanyName] = useState(userProfile?.companyName || '');
  const [phone, setPhone] = useState(userContact?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const waEnquiryUrl = buildWhatsAppUrl(
    [
      `Hello ${settings.businessName},`,
      `Enquiry Type: ${enquiryType.replace(/_/g, ' ').toUpperCase()}`,
      `Name: ${name || 'Visitor'}${companyName ? ` (${companyName})` : ''}`,
      `Phone: ${phone}`,
      `Subject: ${subject}`,
      `Message: ${message}`,
    ].join('\n'),
    settings.whatsappNumber
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const res = await fetch('/api/customer/enquiries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          enquiryType,
          name: name.trim(),
          companyName: companyName.trim(),
          phone: phone.trim(),
          email: email.trim() || 'info@delarico.co.ke',
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        throw new Error('Could not send message right now.');
      }
      setSubmitted(true);
      setSubject('');
      setMessage('');
      notify('Thank you! Your message has been received by our Siaya team.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to send message.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 sm:p-7 bg-white border border-slate-200 rounded-xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-navy-900">{heading}</h2>
        <p className="text-xs text-slate-600 mt-0.5">{subheading}</p>
      </div>

      {submitted && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Message received! Our sales &amp; operations team will get back to you promptly.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
          <select
            value={enquiryType}
            onChange={(e) => setEnquiryType(e.target.value as EnquiryType)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
          >
            <option value="general">General Customer Enquiry</option>
            <option value="bulk_sourcing">Bulk Project Sourcing</option>
            <option value="contractor_onboarding">Contractor Account Onboarding</option>
            <option value="supplier_partnership">Manufacturer / Supplier Partnership</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
          <input
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Organization (Optional)</label>
          <input
            type="text"
            maxLength={160}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Phone / WhatsApp *</label>
          <input
            type="tel"
            required
            maxLength={30}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0712 345 678"
            className="w-full px-3 py-2 text-xs tabular-nums border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
          <input
            type="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
        <input
          type="text"
          required
          maxLength={160}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="How can our Siaya team assist you?"
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Message *</label>
        <textarea
          rows={4}
          required
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Provide product specs, quantities, partnership details, or delivery requirements..."
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="py-2.5 px-4 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 disabled:opacity-50"
        >
          {submitting ? 'Sending Message...' : 'Send Message'}
        </button>
        <a
          href={waEnquiryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Chat on WhatsApp ({settings.whatsappNumber})</span>
        </a>
      </div>
    </form>
  );
};

export const PartnershipsPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-5 space-y-5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-royal-700">
            <Handshake className="w-4 h-4" />
            <span>Manufacturer &amp; Distributor Portal</span>
          </div>
          <h1 className="text-3xl font-bold text-navy-900">Supplier Partnership Portal</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            DELARICO MERCHANDISE &amp; SUPPLIES partners with certified East African and international
            cement mills, steel rolling mills, sustainable highland sawmills, paint manufacturers, and
            tool brands seeking reliable regional distribution across Siaya and Western Kenya.
          </p>
          <div className="space-y-3 text-xs text-slate-700">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
              <span>KEBS / ISO Quality Compliance &amp; Mill Test Certificates mandatory for structural lines.</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
              <Building2 className="w-4 h-4 text-royal-700 shrink-0 mt-0.5" />
              <span>High-volume warehouse reception in Siaya Town, Bondo, and Ugunja yards.</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
              <Truck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>Prompt corporate settlement and transparent inventory movement reporting.</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <EnquiryFormBlock
            defaultType="supplier_partnership"
            heading="Submit Manufacturer / Distributorship Proposal"
            subheading="Provide your product lines, KEBS certification status, MOQ, and trade settlement terms."
          />
        </div>
      </div>
    </div>
  );
};

export const ContactPage: React.FC = () => {
  const { settings } = useStore();
  const waDirect = buildWhatsAppUrl(
    `Hello ${settings.businessName}, I am reaching out from your Contact Us page.`,
    settings.whatsappNumber
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 font-sans">
      <div className="pb-6 border-b border-slate-200">
        <p className="text-xs font-semibold text-royal-700 mb-1">Headquarters &amp; Customer Desk</p>
        <h1 className="text-3xl font-bold text-navy-900">Contact {settings.businessName}</h1>
        <p className="text-sm text-slate-600 mt-1">
          Reach our Siaya sales, quotation, payment, and dispatch team by phone, WhatsApp, email, or in person.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Direct Contact Channels & Map */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 bg-navy-900 text-white rounded-xl space-y-4">
            <h2 className="text-base font-bold text-gold-400">Official Corporate Directory</h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Flagship Location</p>
                  <p className="text-slate-300">{settings.location}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Phone, WhatsApp &amp; M-Pesa Payment Line</p>
                  <a href={`tel:${settings.whatsappNumber}`} className="text-slate-200 hover:text-gold-400 font-semibold tabular-nums block">
                    {settings.whatsappNumber}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Corporate Email &amp; Web</p>
                  <a href={`mailto:${settings.email}`} className="text-slate-200 hover:text-gold-400 block">
                    {settings.email}
                  </a>
                  <span className="text-slate-400">{settings.website}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <a
                href={waDirect}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Us</span>
              </a>
              <a
                href={`tel:${settings.whatsappNumber}`}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold bg-gold-500 text-navy-950 rounded-lg hover:bg-gold-400"
              >
                <Phone className="w-4 h-4" />
                <span>Call Now</span>
              </a>
            </div>
          </div>

          {/* Interactive Google Map of Siaya, Kenya */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-navy-900">
              Siaya, Kenya — Yard &amp; Dispatch Location Map
            </div>
            <iframe
              title="DELARICO MERCHANDISE & SUPPLIES — Siaya, Kenya"
              src="https://www.google.com/maps?q=Siaya,Kenya&output=embed"
              className="w-full h-64 border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-7">
          <EnquiryFormBlock
            defaultType="general"
            heading="Send Us a Direct Message"
            subheading="Enquire about material stock, bulk site deliveries, contractor accounts, or custom orders."
          />
        </div>
      </div>
    </div>
  );
};
