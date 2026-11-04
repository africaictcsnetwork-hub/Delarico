import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import {
  collection,
  CollectionReference,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  getFirestore,
  query,
  QueryConstraint,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_STORE_SETTINGS,
  INITIAL_BRANCHES,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_PROMOTIONS,
} from './src/data/seedCatalog';
import { normalizeKenyanPhone } from './src/utils/whatsapp';

const firebaseConfig = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8')
);

const firebaseApp = initializeApp(firebaseConfig, 'delarico-server');
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const AUTH_SALT = 'dlr_stealth_auth_v2_8f3c19a7';
const EXEC_SESSION_DIGEST = '4ad5705c64d099da7d331b065df28f9f49fa936584c434f328ae589d810acf4c';
const TOKEN_HMAC_SECRET = 'dlr_hmac_tok_v2_7b94e1c26a80f35d91e4b2c7058a6d3f';
const SERVER_WRITE_SEAL = '9f4c2b8e17a65d30c84b1e729a53f6d0418c7b2e5a9163d4f08b2c7e19a45d63';
const SERVER_VAULT_KEY = '3e8a1d74c29b50f6814e2a9c7d53b08f62419c8e3a75d1b4902f6c8a3e71d54b';

interface SessionTokenPayload {
  uid: string;
  phone: string;
  displayName: string;
  email: string;
  role: 'customer' | 'admin';
  exp: number;
}

interface AuthedRequest extends Request {
  session?: SessionTokenPayload;
}

function signSessionToken(payload: Omit<SessionTokenPayload, 'exp'>): string {
  const fullPayload: SessionTokenPayload = {
    ...payload,
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_HMAC_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(rawToken?: string): SessionTokenPayload | null {
  if (!rawToken || !rawToken.includes('.')) return null;
  const [encoded, sig] = rawToken.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', TOKEN_HMAC_SECRET).update(encoded).digest('base64url');
  if (
    sig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionTokenPayload;
    if (!parsed.uid || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractBearer(req: Request): SessionTokenPayload | null {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return verifySessionToken(header.slice(7).trim());
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const session = extractBearer(req);
  if (!session) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  req.session = session;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const session = extractBearer(req);
  if (!session || session.role !== 'admin') {
    res.status(403).json({ error: 'Not authorized.' });
    return;
  }
  req.session = session;
  next();
}

function matchesExecCredentials(normalizedPhone: string, rawPassword: string): boolean {
  const candidates = [rawPassword, rawPassword.trim()];
  const targetBuf = Buffer.from(EXEC_SESSION_DIGEST, 'hex');
  for (const pwd of candidates) {
    const digestHex = crypto
      .createHash('sha256')
      .update(`${AUTH_SALT}:${normalizedPhone}:${pwd}`)
      .digest('hex');
    const candidateBuf = Buffer.from(digestHex, 'hex');
    if (candidateBuf.length === targetBuf.length && crypto.timingSafeEqual(candidateBuf, targetBuf)) {
      return true;
    }
  }
  return false;
}

type GatedWriteOp =
  | { type: 'set'; ref: DocumentReference; gateKey: string; data: Record<string, unknown> }
  | { type: 'update'; ref: DocumentReference; gateKey: string; data: Record<string, unknown> }
  | { type: 'delete'; ref: DocumentReference; gateKey: string };

async function commitGatedOps(ops: GatedWriteOp[]): Promise<void> {
  const CHUNK_SIZE = 4;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const slice = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    const now = serverTimestamp();
    for (const op of slice) {
      const ticketRef = doc(db, 'writeTickets', op.gateKey);
      batch.set(ticketRef, {
        seal: SERVER_WRITE_SEAL,
        targetPath: op.ref.path.slice(0, 200),
        authorizedAt: now,
      });
      if (op.type === 'set') {
        batch.set(op.ref, op.data);
      } else if (op.type === 'update') {
        batch.update(op.ref, op.data);
      } else {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

function sanitizeClientDoc<T extends Record<string, unknown>>(id: string, raw: Record<string, unknown>): T {
  const cleaned: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'vaultKey' || k === 'passwordHash' || k === 'passwordSalt') continue;
    if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
      cleaned[k] = (v as { toDate: () => Date }).toDate().toISOString();
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned as T;
}

async function queryVaultDocs<T extends Record<string, unknown>>(
  colRef: CollectionReference,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(colRef, where('vaultKey', '==', SERVER_VAULT_KEY), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => sanitizeClientDoc<T>(d.id, d.data() as Record<string, unknown>));
}

function makeAccountIdFromPhone(normalizedPhone: string): string {
  return `acct_${normalizedPhone.replace(/[^0-9]/g, '')}`;
}

async function loadUserBundle(session: SessionTokenPayload) {
  const usersList = await queryVaultDocs<Record<string, unknown>>(
    collection(db, 'users'),
    where('uid', '==', session.uid)
  );
  const profile =
    usersList[0] ||
    ({
      uid: session.uid,
      displayName: session.displayName,
      accountType: 'individual',
      companyName: '',
      registrationRef: '',
      loyaltyPoints: 0,
      wholesaleApproved: session.role === 'admin',
      favouriteProductIds: [],
    } as Record<string, unknown>);

  const privList = await queryVaultDocs<Record<string, unknown>>(
    collection(db, 'users', session.uid, 'private'),
    where('uid', '==', session.uid)
  );
  const contact =
    privList[0] ||
    ({
      uid: session.uid,
      email: session.email,
      phone: session.phone,
      defaultCounty: 'Siaya',
      defaultTown: 'Siaya Town',
      defaultStreetAddress: '',
    } as Record<string, unknown>);

  const addresses = await queryVaultDocs<Record<string, unknown>>(
    collection(db, 'users', session.uid, 'addresses'),
    where('uid', '==', session.uid)
  );

  return {
    user: {
      uid: session.uid,
      displayName: String(profile.displayName || session.displayName),
      phone: String(contact.phone || session.phone),
      email: String(contact.email || session.email),
      isAdmin: session.role === 'admin',
    },
    profile,
    contact,
    addresses,
  };
}

async function syncCatalogToFirestore(force = false): Promise<void> {
  try {
    if (!force) {
      const settingsSnap = await getDoc(doc(db, 'settings', 'corporate'));
      const sampleProdSnap = await getDoc(doc(db, 'products', 'prod-cement-425n'));
      const settingsData = settingsSnap.data();
      const prodData = sampleProdSnap.data();
      const hasUpdatedPhone = settingsData?.whatsappNumber === '+254 706 824489';
      const hasRealPhotos =
        Array.isArray(prodData?.images) &&
        typeof prodData.images[0] === 'string' &&
        prodData.images[0].startsWith('/assets/materials/');

      if (hasUpdatedPhone && hasRealPhotos) {
        return;
      }
    }

    const now = serverTimestamp();

    // 1. Settings
    await commitGatedOps([
      {
        type: 'set',
        ref: doc(db, 'settings', 'corporate'),
        gateKey: 'set_corporate',
        data: {
          ...DEFAULT_STORE_SETTINGS,
          updatedAt: now,
        },
      },
    ]);

    // 2. Categories first (products validate category existence)
    const catOps: GatedWriteOp[] = [];
    for (const cat of INITIAL_CATEGORIES) {
      const { id, ...rest } = cat;
      const ref = doc(db, 'categories', id);
      const snap = await getDoc(ref);
      catOps.push(
        snap.exists()
          ? { type: 'update', ref, gateKey: `cat_${id}`, data: { ...rest, updatedAt: now } }
          : { type: 'set', ref, gateKey: `cat_${id}`, data: { ...rest, createdAt: now, updatedAt: now } }
      );
    }
    await commitGatedOps(catOps);

    // 3. Products
    const prodOps: GatedWriteOp[] = [];
    for (const prod of INITIAL_PRODUCTS) {
      const { id, ...rest } = prod;
      const ref = doc(db, 'products', id);
      const snap = await getDoc(ref);
      prodOps.push(
        snap.exists()
          ? { type: 'update', ref, gateKey: `prod_${id}`, data: { ...rest, updatedAt: now } }
          : { type: 'set', ref, gateKey: `prod_${id}`, data: { ...rest, createdAt: now, updatedAt: now } }
      );
    }
    await commitGatedOps(prodOps);

    // 4. Promotions & Branches
    const miscOps: GatedWriteOp[] = [];
    for (const promo of INITIAL_PROMOTIONS) {
      const { id, ...rest } = promo;
      const ref = doc(db, 'promotions', id);
      const snap = await getDoc(ref);
      miscOps.push(
        snap.exists()
          ? { type: 'update', ref, gateKey: `promo_${id}`, data: { ...rest, updatedAt: now } }
          : { type: 'set', ref, gateKey: `promo_${id}`, data: { ...rest, createdAt: now, updatedAt: now } }
      );
    }
    for (const branch of INITIAL_BRANCHES) {
      const { id, ...rest } = branch;
      const ref = doc(db, 'branches', id);
      const snap = await getDoc(ref);
      miscOps.push(
        snap.exists()
          ? { type: 'update', ref, gateKey: `branch_${id}`, data: { ...rest, updatedAt: now } }
          : { type: 'set', ref, gateKey: `branch_${id}`, data: { ...rest, createdAt: now, updatedAt: now } }
      );
    }
    await commitGatedOps(miscOps);
    console.log('[DELARICO] Live Firestore catalogue synchronized with real Kenyan materials & +254 706 824489.');
  } catch (err) {
    console.error('[DELARICO] Startup catalog sync warning:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // =========================================================================
  // Unified Phone + Password Authentication (Stealth Admin Detection)
  // =========================================================================
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const rawPhone = String(req.body?.phone || '');
      const password = String(req.body?.password || '');
      const normalizedPhone = normalizeKenyanPhone(rawPhone);

      if (!normalizedPhone || normalizedPhone.length < 8 || !password) {
        res.status(400).json({ error: 'Please enter a valid phone number and password.' });
        return;
      }

      // Automatic stealth detection for executive credentials
      if (matchesExecCredentials(normalizedPhone, password)) {
        const execUid = 'usr_executive_01';
        const existingExec = await queryVaultDocs<Record<string, unknown>>(
          collection(db, 'users'),
          where('uid', '==', execUid)
        );
        if (existingExec.length === 0) {
          const now = serverTimestamp();
          await commitGatedOps([
            {
              type: 'set',
              ref: doc(db, 'users', execUid),
              gateKey: `usr_${execUid}`,
              data: {
                uid: execUid,
                displayName: 'Delarico Operations',
                accountType: 'contractor',
                companyName: 'DELARICO MERCHANDISE & SUPPLIES',
                registrationRef: 'HQ-SIAYA',
                loyaltyPoints: 0,
                wholesaleApproved: false,
                favouriteProductIds: [],
                vaultKey: SERVER_VAULT_KEY,
                createdAt: now,
                updatedAt: now,
              },
            },
            {
              type: 'set',
              ref: doc(db, 'users', execUid, 'private', 'contact'),
              gateKey: `usrpriv_${execUid}_contact`,
              data: {
                uid: execUid,
                email: 'info@delarico.co.ke',
                phone: '+254 706 824489',
                defaultCounty: 'Siaya',
                defaultTown: 'Siaya Town',
                defaultStreetAddress: 'Along Siaya–Kisumu Highway',
                vaultKey: SERVER_VAULT_KEY,
                updatedAt: now,
              },
            },
          ]);
        }

        const token = signSessionToken({
          uid: execUid,
          phone: '+254 706 824489',
          displayName: 'Delarico Operations',
          email: 'info@delarico.co.ke',
          role: 'admin',
        });

        const payload = verifySessionToken(token)!;
        const bundle = await loadUserBundle(payload);
        res.json({ token, ...bundle });
        return;
      }

      // Standard customer phone + password login
      const acctSnap = await getDocs(
        query(
          collection(db, 'authAccounts'),
          where('vaultKey', '==', SERVER_VAULT_KEY),
          where('normalizedPhone', '==', normalizedPhone)
        )
      );

      if (acctSnap.empty) {
        res.status(401).json({ error: 'Invalid phone number or password.' });
        return;
      }

      const acctData = acctSnap.docs[0].data() as {
        uid: string;
        passwordSalt: string;
        passwordHash: string;
      };

      const computedHash = crypto
        .scryptSync(password, acctData.passwordSalt, 64)
        .toString('hex');

      const hashBuf = Buffer.from(acctData.passwordHash, 'hex');
      const candBuf = Buffer.from(computedHash, 'hex');
      if (hashBuf.length !== candBuf.length || !crypto.timingSafeEqual(hashBuf, candBuf)) {
        res.status(401).json({ error: 'Invalid phone number or password.' });
        return;
      }

      const sessionDraft: Omit<SessionTokenPayload, 'exp'> = {
        uid: acctData.uid,
        phone: normalizedPhone,
        displayName: 'Customer',
        email: 'customer@delarico.co.ke',
        role: 'customer',
      };
      const tempToken = signSessionToken(sessionDraft);
      const bundle = await loadUserBundle(verifySessionToken(tempToken)!);
      const finalToken = signSessionToken({
        uid: acctData.uid,
        phone: bundle.user.phone,
        displayName: bundle.user.displayName,
        email: bundle.user.email,
        role: 'customer',
      });

      res.json({ token: finalToken, ...bundle });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
    }
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const displayName = String(req.body?.displayName || '').trim().slice(0, 120);
      const rawPhone = String(req.body?.phone || '');
      const password = String(req.body?.password || '');
      const email = String(req.body?.email || 'customer@delarico.co.ke').trim().slice(0, 254) || 'customer@delarico.co.ke';
      const accountTypeRaw = String(req.body?.accountType || 'individual');
      const accountType = ['individual', 'contractor', 'institution'].includes(accountTypeRaw)
        ? accountTypeRaw
        : 'individual';
      const companyName = String(req.body?.companyName || '').trim().slice(0, 160);
      const registrationRef = String(req.body?.registrationRef || '').trim().slice(0, 80);

      const normalizedPhone = normalizeKenyanPhone(rawPhone);
      if (!displayName || displayName.length < 2) {
        res.status(400).json({ error: 'Please enter your full name.' });
        return;
      }
      if (!normalizedPhone || normalizedPhone.length < 10) {
        res.status(400).json({ error: 'Please enter a valid Kenyan phone number.' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters.' });
        return;
      }

      // If someone enters executive credentials on register tab, log them in seamlessly
      if (matchesExecCredentials(normalizedPhone, password)) {
        const token = signSessionToken({
          uid: 'usr_executive_01',
          phone: '+254 706 824489',
          displayName: 'Delarico Operations',
          email: 'info@delarico.co.ke',
          role: 'admin',
        });
        const bundle = await loadUserBundle(verifySessionToken(token)!);
        res.json({ token, ...bundle });
        return;
      }

      // Prevent registering reserved executive number
      const execPhoneCheck = crypto
        .createHash('sha256')
        .update(`${AUTH_SALT}:phone:${normalizedPhone}`)
        .digest('hex');
      const reservedPhoneDigest = crypto
        .createHash('sha256')
        .update(`${AUTH_SALT}:phone:+254706824489`)
        .digest('hex');
      if (execPhoneCheck === reservedPhoneDigest) {
        res.status(400).json({ error: 'This phone number is already registered. Please sign in instead.' });
        return;
      }

      const existingSnap = await getDocs(
        query(
          collection(db, 'authAccounts'),
          where('vaultKey', '==', SERVER_VAULT_KEY),
          where('normalizedPhone', '==', normalizedPhone)
        )
      );
      if (!existingSnap.empty) {
        res.status(400).json({ error: 'An account with this phone number already exists. Please sign in.' });
        return;
      }

      const accountId = makeAccountIdFromPhone(normalizedPhone);
      const uid = `usr_${crypto.randomBytes(8).toString('hex')}`;
      const passwordSalt = crypto.randomBytes(16).toString('hex');
      const passwordHash = crypto.scryptSync(password, passwordSalt, 64).toString('hex');
      const now = serverTimestamp();

      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'authAccounts', accountId),
          gateKey: `auth_${accountId}`,
          data: {
            uid,
            normalizedPhone,
            passwordSalt,
            passwordHash,
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
            updatedAt: now,
          },
        },
        {
          type: 'set',
          ref: doc(db, 'users', uid),
          gateKey: `usr_${uid}`,
          data: {
            uid,
            displayName,
            accountType,
            companyName,
            registrationRef,
            loyaltyPoints: 0,
            wholesaleApproved: false,
            favouriteProductIds: [],
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
            updatedAt: now,
          },
        },
        {
          type: 'set',
          ref: doc(db, 'users', uid, 'private', 'contact'),
          gateKey: `usrpriv_${uid}_contact`,
          data: {
            uid,
            email,
            phone: normalizedPhone,
            defaultCounty: 'Siaya',
            defaultTown: 'Siaya Town',
            defaultStreetAddress: '',
            vaultKey: SERVER_VAULT_KEY,
            updatedAt: now,
          },
        },
      ]);

      const token = signSessionToken({
        uid,
        phone: normalizedPhone,
        displayName,
        email,
        role: 'customer',
      });
      const bundle = await loadUserBundle(verifySessionToken(token)!);
      res.json({ token, ...bundle });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Could not create account right now. Please try again.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const bundle = await loadUserBundle(req.session!);
      res.json(bundle);
    } catch (err) {
      console.error('Session load error:', err);
      res.status(500).json({ error: 'Failed to load account session.' });
    }
  });

  // =========================================================================
  // Customer Portal Endpoints
  // =========================================================================
  app.get('/api/customer/dashboard', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const [bundle, orders, quotations, enquiries] = await Promise.all([
        loadUserBundle(req.session!),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'orders'), where('customerId', '==', uid)),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'quotations'), where('customerId', '==', uid)),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'enquiries'), where('customerId', '==', uid)),
      ]);
      res.json({
        ...bundle,
        orders,
        quotations,
        enquiries,
      });
    } catch (err) {
      console.error('Customer dashboard error:', err);
      res.status(500).json({ error: 'Failed to load customer records.' });
    }
  });

  app.put('/api/customer/profile', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const displayName = String(req.body?.displayName || req.session!.displayName).trim().slice(0, 120);
      const accountTypeRaw = String(req.body?.accountType || 'individual');
      const accountType = ['individual', 'contractor', 'institution'].includes(accountTypeRaw)
        ? accountTypeRaw
        : 'individual';
      const companyName = String(req.body?.companyName || '').trim().slice(0, 160);
      const registrationRef = String(req.body?.registrationRef || '').trim().slice(0, 80);
      const phone = String(req.body?.phone || req.session!.phone).trim().slice(0, 30);
      const email = String(req.body?.email || req.session!.email || 'customer@delarico.co.ke').trim().slice(0, 254);
      const defaultCounty = String(req.body?.defaultCounty || 'Siaya').trim().slice(0, 80);
      const defaultTown = String(req.body?.defaultTown || 'Siaya Town').trim().slice(0, 80);
      const defaultStreetAddress = String(req.body?.defaultStreetAddress || '').trim().slice(0, 250);

      const now = serverTimestamp();
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'users', uid),
          gateKey: `usr_${uid}`,
          data: {
            displayName,
            accountType,
            companyName,
            registrationRef,
            updatedAt: now,
          },
        },
        {
          type: 'update',
          ref: doc(db, 'users', uid, 'private', 'contact'),
          gateKey: `usrpriv_${uid}_contact`,
          data: {
            email,
            phone,
            defaultCounty,
            defaultTown,
            defaultStreetAddress,
            updatedAt: now,
          },
        },
      ]);

      const bundle = await loadUserBundle(req.session!);
      res.json(bundle);
    } catch (err) {
      console.error('Update profile error:', err);
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  app.put('/api/customer/favourites', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const rawIds = Array.isArray(req.body?.favouriteProductIds) ? req.body.favouriteProductIds : [];
      const favouriteProductIds = rawIds
        .map((id: unknown) => String(id).trim())
        .filter((id: string) => id.length > 0 && id.length <= 128)
        .slice(0, 50);

      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'users', uid),
          gateKey: `usr_${uid}`,
          data: {
            favouriteProductIds,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ favouriteProductIds });
    } catch (err) {
      console.error('Update favourites error:', err);
      res.status(500).json({ error: 'Failed to update saved items.' });
    }
  });

  app.post('/api/customer/addresses', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const addrRef = doc(collection(db, 'users', uid, 'addresses'));
      const now = serverTimestamp();
      const payload = {
        uid,
        label: String(req.body?.label || 'Site Address').trim().slice(0, 60),
        recipientName: String(req.body?.recipientName || req.session!.displayName).trim().slice(0, 120),
        phone: String(req.body?.phone || req.session!.phone).trim().slice(0, 30),
        county: String(req.body?.county || 'Siaya').trim().slice(0, 80),
        town: String(req.body?.town || 'Siaya Town').trim().slice(0, 80),
        streetDetails: String(req.body?.streetDetails || '').trim().slice(0, 250),
        isDefault: Boolean(req.body?.isDefault),
        vaultKey: SERVER_VAULT_KEY,
        createdAt: now,
        updatedAt: now,
      };
      await commitGatedOps([
        {
          type: 'set',
          ref: addrRef,
          gateKey: `usraddr_${addrRef.id}`,
          data: payload,
        },
      ]);
      const addresses = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'users', uid, 'addresses'),
        where('uid', '==', uid)
      );
      res.json({ addresses });
    } catch (err) {
      console.error('Add address error:', err);
      res.status(500).json({ error: 'Failed to save delivery address.' });
    }
  });

  app.delete('/api/customer/addresses/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const addressId = String(req.params.id);
      await commitGatedOps([
        {
          type: 'delete',
          ref: doc(db, 'users', uid, 'addresses', addressId),
          gateKey: `usraddr_${addressId}`,
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete address error:', err);
      res.status(500).json({ error: 'Failed to delete address.' });
    }
  });

  app.post('/api/customer/orders', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const itemsInput = Array.isArray(req.body?.items) ? req.body.items : [];
      if (itemsInput.length === 0) {
        res.status(400).json({ error: 'Order must contain at least one item.' });
        return;
      }

      const orderRef = doc(collection(db, 'orders'));
      const orderNumber = `DLR-${Date.now().toString().slice(-6)}`;
      const now = serverTimestamp();

      const orderData = {
        orderNumber,
        customerId: uid,
        customerName: String(req.body?.customerName || req.session!.displayName).trim().slice(0, 120),
        customerPhone: String(req.body?.customerPhone || req.session!.phone).trim().slice(0, 30),
        customerEmail: String(req.body?.customerEmail || req.session!.email || 'customer@delarico.co.ke').trim().slice(0, 254),
        accountType: ['individual', 'contractor', 'institution'].includes(req.body?.accountType)
          ? req.body.accountType
          : 'individual',
        branchId: String(req.body?.branchId || 'branch-siaya-hq').slice(0, 128),
        deliveryCounty: String(req.body?.deliveryCounty || 'Siaya').trim().slice(0, 80),
        deliveryTown: String(req.body?.deliveryTown || 'Siaya Town').trim().slice(0, 80),
        deliveryAddress: String(req.body?.deliveryAddress || 'Siaya Yard').trim().slice(0, 300),
        deliveryMethod: ['pickup', 'local_siaya', 'regional_nyanza', 'countrywide_freight'].includes(req.body?.deliveryMethod)
          ? req.body.deliveryMethod
          : 'local_siaya',
        subtotalKes: Math.max(0, Number(req.body?.subtotalKes || 0)),
        discountKes: Math.max(0, Number(req.body?.discountKes || 0)),
        promoCode: String(req.body?.promoCode || '').trim().slice(0, 40),
        deliveryFeeKes: Math.max(0, Number(req.body?.deliveryFeeKes || 0)),
        totalKes: Math.max(0, Number(req.body?.totalKes || 0)),
        itemCount: itemsInput.length,
        paymentMethod: ['mpesa_stk', 'mpesa_paybill', 'mpesa_till', 'bank_transfer', 'cod'].includes(req.body?.paymentMethod)
          ? req.body.paymentMethod
          : 'mpesa_paybill',
        paymentReference: String(req.body?.paymentReference || '').trim().slice(0, 100),
        // CRITICAL: Never auto-mark as paid without manual admin verification
        paymentStatus: 'pending_verification',
        orderStatus: 'pending',
        notes: String(req.body?.notes || '').trim().slice(0, 1000),
        vaultKey: SERVER_VAULT_KEY,
        createdAt: now,
        updatedAt: now,
      };

      // Step 1: Commit parent order document first so subcollection exists() rule passes
      await commitGatedOps([
        {
          type: 'set',
          ref: orderRef,
          gateKey: `ord_${orderRef.id}`,
          data: orderData,
        },
      ]);

      // Step 2: Commit order items in chunks of <= 4
      const itemOps: GatedWriteOp[] = [];
      const confirmedItems: Array<Record<string, unknown>> = [];

      itemsInput.forEach((rawItem: Record<string, unknown>, idx: number) => {
        const itemId = `item_${idx + 1}`;
        const itemRef = doc(db, 'orders', orderRef.id, 'items', itemId);
        const itemPayload = {
          orderId: orderRef.id,
          customerId: uid,
          productId: String(rawItem.productId || '').slice(0, 128),
          productName: String(rawItem.productName || 'Material').slice(0, 160),
          sku: String(rawItem.sku || 'DLR-ITEM').slice(0, 64),
          unit: String(rawItem.unit || 'Piece').slice(0, 40),
          quantity: Math.max(1, Number(rawItem.quantity || 1)),
          unitPriceKes: Math.max(0, Number(rawItem.unitPriceKes || 0)),
          lineTotalKes: Math.max(0, Number(rawItem.lineTotalKes || 0)),
          vaultKey: SERVER_VAULT_KEY,
          createdAt: now,
        };
        itemOps.push({
          type: 'set',
          ref: itemRef,
          gateKey: `orditem_${orderRef.id}_${itemId}`,
          data: itemPayload,
        });
        const { vaultKey: _vk, ...cleanItem } = itemPayload;
        confirmedItems.push({
          id: itemId,
          ...cleanItem,
          createdAt: new Date().toISOString(),
        });
      });

      await commitGatedOps(itemOps);

      if (req.body?.saveNewAddress && orderData.deliveryMethod !== 'pickup') {
        const addrRef = doc(collection(db, 'users', uid, 'addresses'));
        await commitGatedOps([
          {
            type: 'set',
            ref: addrRef,
            gateKey: `usraddr_${addrRef.id}`,
            data: {
              uid,
              label: `${orderData.deliveryTown} Site`.slice(0, 60),
              recipientName: orderData.customerName,
              phone: orderData.customerPhone,
              county: orderData.deliveryCounty,
              town: orderData.deliveryTown,
              streetDetails: orderData.deliveryAddress.slice(0, 250),
              isDefault: false,
              vaultKey: SERVER_VAULT_KEY,
              createdAt: now,
              updatedAt: now,
            },
          },
        ]);
      }

      const { vaultKey: _ovk, ...cleanOrder } = orderData;
      res.json({
        order: {
          id: orderRef.id,
          ...cleanOrder,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        items: confirmedItems,
      });
    } catch (err) {
      console.error('Create order error:', err);
      res.status(500).json({ error: 'Could not place order right now. Please try again.' });
    }
  });

  app.get('/api/customer/orders/:id/items', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const orderId = String(req.params.id);
      const items = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'orders', orderId, 'items'),
        where('customerId', '==', uid)
      );
      res.json({ items });
    } catch (err) {
      console.error('Fetch order items error:', err);
      res.status(500).json({ error: 'Failed to load invoice items.' });
    }
  });

  app.patch('/api/customer/orders/:id/payment-ref', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const orderId = String(req.params.id);
      const orders = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'orders'),
        where('customerId', '==', uid)
      );
      const found = orders.find((o) => o.id === orderId);
      if (!found) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      const paymentReference = String(req.body?.paymentReference || '').trim().toUpperCase().slice(0, 100);
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'orders', orderId),
          gateKey: `ord_${orderId}`,
          data: {
            paymentReference,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, paymentReference });
    } catch (err) {
      console.error('Save payment ref error:', err);
      res.status(500).json({ error: 'Failed to save payment reference.' });
    }
  });

  app.patch('/api/customer/orders/:id/cancel', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const orderId = String(req.params.id);
      const orders = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'orders'),
        where('customerId', '==', uid)
      );
      const found = orders.find((o) => o.id === orderId);
      if (!found || found.orderStatus !== 'pending') {
        res.status(400).json({ error: 'Only pending orders can be cancelled.' });
        return;
      }
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'orders', orderId),
          gateKey: `ord_${orderId}`,
          data: {
            orderStatus: 'cancelled',
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Cancel order error:', err);
      res.status(500).json({ error: 'Failed to cancel order.' });
    }
  });

  app.post('/api/customer/quotations', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const itemsInput = Array.isArray(req.body?.items) ? req.body.items : [];
      if (itemsInput.length === 0) {
        res.status(400).json({ error: 'Please include at least one material item.' });
        return;
      }

      const quoteRef = doc(collection(db, 'quotations'));
      const quoteNumber = `QT-${Date.now().toString().slice(-6)}`;
      const now = serverTimestamp();

      await commitGatedOps([
        {
          type: 'set',
          ref: quoteRef,
          gateKey: `qt_${quoteRef.id}`,
          data: {
            quoteNumber,
            customerId: uid,
            contactName: String(req.body?.contactName || req.session!.displayName).trim().slice(0, 120),
            companyName: String(req.body?.companyName || '').trim().slice(0, 160),
            phone: String(req.body?.phone || req.session!.phone).trim().slice(0, 30),
            email: String(req.body?.email || req.session!.email || 'client@delarico.co.ke').trim().slice(0, 254),
            deliveryLocation: String(req.body?.deliveryLocation || 'Siaya').trim().slice(0, 250),
            projectType: String(req.body?.projectType || 'Residential Construction').trim().slice(0, 100),
            instructions: String(req.body?.instructions || '').trim().slice(0, 1500),
            itemCount: itemsInput.length,
            estimatedSubtotalKes: Math.max(0, Number(req.body?.estimatedSubtotalKes || 0)),
            quotedTotalKes: 0,
            adminResponseNotes: '',
            validUntil: '',
            status: 'submitted',
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);

      const itemOps: GatedWriteOp[] = itemsInput.map((rawItem: Record<string, unknown>, idx: number) => {
        const itemId = `qitem_${idx + 1}`;
        return {
          type: 'set',
          ref: doc(db, 'quotations', quoteRef.id, 'items', itemId),
          gateKey: `qtitem_${quoteRef.id}_${itemId}`,
          data: {
            quotationId: quoteRef.id,
            customerId: uid,
            productId: String(rawItem.productId || '').slice(0, 128),
            productName: String(rawItem.productName || 'Material').slice(0, 160),
            unit: String(rawItem.unit || 'Piece').slice(0, 40),
            quantity: Math.max(1, Number(rawItem.quantity || 1)),
            unitPriceKes: Math.max(0, Number(rawItem.unitPriceKes || 0)),
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
          },
        };
      });

      await commitGatedOps(itemOps);
      res.json({ quoteNumber, id: quoteRef.id });
    } catch (err) {
      console.error('Submit quotation error:', err);
      res.status(500).json({ error: 'Failed to submit quotation request.' });
    }
  });

  app.patch('/api/customer/quotations/:id/decision', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const quoteId = String(req.params.id);
      const decision = req.body?.decision === 'accepted' ? 'accepted' : 'declined';
      const quotes = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'quotations'),
        where('customerId', '==', uid)
      );
      const found = quotes.find((q) => q.id === quoteId);
      if (!found) {
        res.status(404).json({ error: 'Quotation not found.' });
        return;
      }
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'quotations', quoteId),
          gateKey: `qt_${quoteId}`,
          data: {
            status: decision,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, status: decision });
    } catch (err) {
      console.error('Quotation decision error:', err);
      res.status(500).json({ error: 'Failed to update quotation decision.' });
    }
  });

  // Supports both signed-in customers and public guest enquiries
  app.post('/api/customer/enquiries', async (req: Request, res: Response) => {
    try {
      const session = extractBearer(req);
      const customerId = session ? session.uid : 'guest_visitor';
      const enquiryRef = doc(collection(db, 'enquiries'));
      const now = serverTimestamp();

      const enquiryTypeRaw = String(req.body?.enquiryType || 'general');
      const enquiryType = ['general', 'bulk_sourcing', 'supplier_partnership', 'contractor_onboarding'].includes(
        enquiryTypeRaw
      )
        ? enquiryTypeRaw
        : 'general';

      await commitGatedOps([
        {
          type: 'set',
          ref: enquiryRef,
          gateKey: `enq_${enquiryRef.id}`,
          data: {
            customerId,
            enquiryType,
            name: String(req.body?.name || session?.displayName || 'Visitor').trim().slice(0, 120),
            companyName: String(req.body?.companyName || '').trim().slice(0, 160),
            phone: String(req.body?.phone || session?.phone || '+254 706 824489').trim().slice(0, 30),
            email: String(req.body?.email || session?.email || 'info@delarico.co.ke').trim().slice(0, 254),
            subject: String(req.body?.subject || 'Website Enquiry').trim().slice(0, 160),
            message: String(req.body?.message || '').trim().slice(0, 2000),
            status: 'open',
            adminReply: '',
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      res.json({ ok: true, id: enquiryRef.id });
    } catch (err) {
      console.error('Create enquiry error:', err);
      res.status(500).json({ error: 'Failed to submit enquiry.' });
    }
  });

  app.post('/api/customer/reviews', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const session = req.session!;
      const revRef = doc(collection(db, 'reviews'));
      const now = serverTimestamp();
      const rating = Math.min(5, Math.max(1, Number(req.body?.rating || 5)));

      await commitGatedOps([
        {
          type: 'set',
          ref: revRef,
          gateKey: `rev_${revRef.id}`,
          data: {
            productId: String(req.body?.productId || '').slice(0, 128),
            productName: String(req.body?.productName || 'Product').trim().slice(0, 160),
            customerId: session.uid,
            customerName: String(req.body?.customerName || session.displayName || 'Customer').trim().slice(0, 120),
            rating,
            title: String(req.body?.title || '').trim().slice(0, 120),
            comment: String(req.body?.comment || '').trim().slice(0, 1500),
            verifiedBuyer: false,
            status: 'published',
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      res.json({ ok: true, id: revRef.id });
    } catch (err) {
      console.error('Create review error:', err);
      res.status(500).json({ error: 'Failed to publish review.' });
    }
  });

  // =========================================================================
  // Protected Operations Console Endpoints (Admin Only)
  // =========================================================================
  app.get('/api/ops/bootstrap', requireAdmin, async (_req: AuthedRequest, res: Response) => {
    try {
      const [orders, quotations, customers, enquiries, stockMovements] = await Promise.all([
        queryVaultDocs<Record<string, unknown>>(collection(db, 'orders')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'quotations')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'users')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'enquiries')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'stockMovements')),
      ]);
      res.json({
        orders,
        quotations,
        customers,
        enquiries,
        stockMovements,
      });
    } catch (err) {
      console.error('Ops bootstrap error:', err);
      res.status(500).json({ error: 'Failed to load operations data.' });
    }
  });

  app.get('/api/ops/orders/:id/items', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const orderId = String(req.params.id);
      const items = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'orders', orderId, 'items')
      );
      res.json({ items });
    } catch (err) {
      console.error('Ops order items error:', err);
      res.status(500).json({ error: 'Failed to load order items.' });
    }
  });

  app.patch('/api/ops/orders/:id/payment', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const orderId = String(req.params.id);
      const nextPaymentStatus = String(req.body?.paymentStatus || 'pending_verification');
      if (!['pending_verification', 'verified_paid', 'failed', 'refunded'].includes(nextPaymentStatus)) {
        res.status(400).json({ error: 'Invalid payment status.' });
        return;
      }

      const orders = await queryVaultDocs<Record<string, unknown>>(collection(db, 'orders'));
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }

      const nextOrderStatus =
        nextPaymentStatus === 'verified_paid' && order.orderStatus === 'pending'
          ? 'confirmed'
          : String(order.orderStatus);

      const now = serverTimestamp();
      const ops: GatedWriteOp[] = [
        {
          type: 'update',
          ref: doc(db, 'orders', orderId),
          gateKey: `ord_${orderId}`,
          data: {
            paymentStatus: nextPaymentStatus,
            orderStatus: nextOrderStatus,
            updatedAt: now,
          },
        },
      ];

      if (nextPaymentStatus === 'verified_paid' && order.paymentStatus !== 'verified_paid') {
        const customerId = String(order.customerId);
        const customers = await queryVaultDocs<Record<string, unknown>>(
          collection(db, 'users'),
          where('uid', '==', customerId)
        );
        if (customers[0]) {
          const settingsSnap = await getDoc(doc(db, 'settings', 'corporate'));
          const ptsPer1000 = Number(settingsSnap.data()?.loyaltyPointsPer1000Kes ?? 10);
          const earned = Math.floor(Number(order.totalKes || 0) / 1000) * ptsPer1000;
          ops.push({
            type: 'update',
            ref: doc(db, 'users', customerId),
            gateKey: `usr_${customerId}`,
            data: {
              loyaltyPoints: Number(customers[0].loyaltyPoints || 0) + earned,
              updatedAt: now,
            },
          });
        }

        const items = await queryVaultDocs<Record<string, unknown>>(
          collection(db, 'orders', orderId, 'items')
        );
        for (const item of items) {
          const productId = String(item.productId || '');
          if (!productId) continue;
          const prodRef = doc(db, 'products', productId);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const pData = prodSnap.data();
            const prevStock = Number(pData.stockQty || 0);
            const qty = Number(item.quantity || 0);
            const newStock = Math.max(0, prevStock - qty);
            const movRef = doc(collection(db, 'stockMovements'));
            ops.push(
              {
                type: 'update',
                ref: prodRef,
                gateKey: `prod_${productId}`,
                data: {
                  stockQty: newStock,
                  updatedAt: now,
                },
              },
              {
                type: 'set',
                ref: movRef,
                gateKey: `stk_${movRef.id}`,
                data: {
                  productId,
                  productName: String(pData.name || item.productName || 'Material').slice(0, 160),
                  sku: String(pData.sku || item.sku || 'DLR').slice(0, 64),
                  movementType: 'sale',
                  quantityDelta: -qty,
                  previousStock: prevStock,
                  newStock,
                  reason: `Verified Order #${order.orderNumber}`.slice(0, 300),
                  performedByUid: req.session!.uid,
                  vaultKey: SERVER_VAULT_KEY,
                  createdAt: now,
                },
              }
            );
          }
        }
      }

      await commitGatedOps(ops);
      res.json({ ok: true, paymentStatus: nextPaymentStatus, orderStatus: nextOrderStatus });
    } catch (err) {
      console.error('Verify payment error:', err);
      res.status(500).json({ error: 'Failed to update payment status.' });
    }
  });

  app.patch('/api/ops/orders/:id/status', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const orderId = String(req.params.id);
      const orderStatus = String(req.body?.orderStatus || 'pending');
      if (!['pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled'].includes(orderStatus)) {
        res.status(400).json({ error: 'Invalid order status.' });
        return;
      }
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'orders', orderId),
          gateKey: `ord_${orderId}`,
          data: {
            orderStatus,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, orderStatus });
    } catch (err) {
      console.error('Update order status error:', err);
      res.status(500).json({ error: 'Failed to update order status.' });
    }
  });

  app.post('/api/ops/products', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const prodId = String(req.body?.id || `prod-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const now = serverTimestamp();
      const { id: _ignore, ...payload } = req.body as Record<string, unknown>;
      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'products', prodId),
          gateKey: `prod_${prodId}`,
          data: {
            ...payload,
            isActive: true,
            ratingAvg: Number(payload.ratingAvg ?? 5.0),
            reviewCount: Number(payload.reviewCount ?? 0),
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      res.json({ ok: true, id: prodId });
    } catch (err) {
      console.error('Create product error:', err);
      res.status(500).json({ error: 'Failed to create product.' });
    }
  });

  app.put('/api/ops/products/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const prodId = String(req.params.id);
      const { id: _ignore, createdAt: _ca, ...payload } = req.body as Record<string, unknown>;
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'products', prodId),
          gateKey: `prod_${prodId}`,
          data: {
            ...payload,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Update product error:', err);
      res.status(500).json({ error: 'Failed to update product.' });
    }
  });

  app.delete('/api/ops/products/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const prodId = String(req.params.id);
      await commitGatedOps([
        {
          type: 'delete',
          ref: doc(db, 'products', prodId),
          gateKey: `prod_${prodId}`,
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete product error:', err);
      res.status(500).json({ error: 'Failed to delete product.' });
    }
  });

  app.post('/api/ops/categories', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const catId = String(req.body?.id || `cat-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const now = serverTimestamp();
      const { id: _ignore, ...payload } = req.body as Record<string, unknown>;
      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'categories', catId),
          gateKey: `cat_${catId}`,
          data: {
            ...payload,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      res.json({ ok: true, id: catId });
    } catch (err) {
      console.error('Create category error:', err);
      res.status(500).json({ error: 'Failed to create category.' });
    }
  });

  app.post('/api/ops/stock-movements', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const productId = String(req.body?.productId || '');
      const movementType = ['restock', 'adjustment', 'return', 'sale'].includes(req.body?.movementType)
        ? req.body.movementType
        : 'restock';
      const rawDelta = Number(req.body?.quantityDelta || 0);
      const signedDelta = movementType === 'adjustment' ? rawDelta : Math.abs(rawDelta);
      const reason = String(req.body?.reason || 'Yard stock update').trim().slice(0, 300);

      const prodRef = doc(db, 'products', productId);
      const prodSnap = await getDoc(prodRef);
      if (!prodSnap.exists()) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      const pData = prodSnap.data();
      const previousStock = Number(pData.stockQty || 0);
      const newStock = Math.max(0, previousStock + signedDelta);
      const movRef = doc(collection(db, 'stockMovements'));
      const now = serverTimestamp();

      await commitGatedOps([
        {
          type: 'update',
          ref: prodRef,
          gateKey: `prod_${productId}`,
          data: {
            stockQty: newStock,
            updatedAt: now,
          },
        },
        {
          type: 'set',
          ref: movRef,
          gateKey: `stk_${movRef.id}`,
          data: {
            productId,
            productName: String(pData.name || 'Material').slice(0, 160),
            sku: String(pData.sku || 'DLR').slice(0, 64),
            movementType,
            quantityDelta: signedDelta,
            previousStock,
            newStock,
            reason,
            performedByUid: req.session!.uid,
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
          },
        },
      ]);
      res.json({ ok: true, newStock });
    } catch (err) {
      console.error('Stock movement error:', err);
      res.status(500).json({ error: 'Failed to post stock movement.' });
    }
  });

  app.get('/api/ops/quotations/:id/items', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const quoteId = String(req.params.id);
      const items = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'quotations', quoteId, 'items')
      );
      res.json({ items });
    } catch (err) {
      console.error('Load quote items error:', err);
      res.status(500).json({ error: 'Failed to load quotation items.' });
    }
  });

  app.patch('/api/ops/quotations/:id/respond', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const quoteId = String(req.params.id);
      const quotedTotalKes = Math.max(0, Number(req.body?.quotedTotalKes || 0));
      const adminResponseNotes = String(req.body?.adminResponseNotes || '').trim().slice(0, 1500);
      const validUntil = String(req.body?.validUntil || '14 Days').trim().slice(0, 40);

      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'quotations', quoteId),
          gateKey: `qt_${quoteId}`,
          data: {
            quotedTotalKes,
            adminResponseNotes,
            validUntil,
            status: 'quoted',
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Respond quotation error:', err);
      res.status(500).json({ error: 'Failed to dispatch quotation offer.' });
    }
  });

  app.patch('/api/ops/customers/:uid/wholesale', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const targetUid = String(req.params.uid);
      const wholesaleApproved = Boolean(req.body?.wholesaleApproved);
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'users', targetUid),
          gateKey: `usr_${targetUid}`,
          data: {
            wholesaleApproved,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, wholesaleApproved });
    } catch (err) {
      console.error('Toggle wholesale error:', err);
      res.status(500).json({ error: 'Failed to update customer wholesale status.' });
    }
  });

  app.patch('/api/ops/enquiries/:id/reply', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const enqId = String(req.params.id);
      const adminReply = String(req.body?.adminReply || '').trim().slice(0, 1500);
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'enquiries', enqId),
          gateKey: `enq_${enqId}`,
          data: {
            adminReply,
            status: 'resolved',
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Reply enquiry error:', err);
      res.status(500).json({ error: 'Failed to send reply.' });
    }
  });

  app.post('/api/ops/promotions', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const promoId = String(req.body?.id || `promo-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const now = serverTimestamp();
      const { id: _ignore, ...payload } = req.body as Record<string, unknown>;
      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'promotions', promoId),
          gateKey: `promo_${promoId}`,
          data: {
            ...payload,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      res.json({ ok: true, id: promoId });
    } catch (err) {
      console.error('Create promo error:', err);
      res.status(500).json({ error: 'Failed to create promotion.' });
    }
  });

  app.post('/api/ops/branches', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const branchId = String(req.body?.id || `branch-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const now = serverTimestamp();
      const { id: _ignore, ...payload } = req.body as Record<string, unknown>;
      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'branches', branchId),
          gateKey: `branch_${branchId}`,
          data: {
            ...payload,
            isHeadquarters: false,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      res.json({ ok: true, id: branchId });
    } catch (err) {
      console.error('Create branch error:', err);
      res.status(500).json({ error: 'Failed to create branch.' });
    }
  });

  app.put('/api/ops/settings', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const { updatedAt: _ua, ...payload } = req.body as Record<string, unknown>;
      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'settings', 'corporate'),
          gateKey: 'set_corporate',
          data: {
            ...payload,
            isPublic: true,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Update settings error:', err);
      res.status(500).json({ error: 'Failed to save settings.' });
    }
  });

  app.post('/api/ops/seed', requireAdmin, async (_req: AuthedRequest, res: Response) => {
    try {
      await syncCatalogToFirestore(true);
      res.json({ ok: true });
    } catch (err) {
      console.error('Manual seed error:', err);
      res.status(500).json({ error: 'Failed to synchronize catalogue.' });
    }
  });

  // Vite middleware for development; static dist serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DELARICO] Server running on http://localhost:${PORT}`);
    void syncCatalogToFirestore(false);
  });
}

void startServer();
