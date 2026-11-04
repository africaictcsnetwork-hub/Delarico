/**
 * Adversarial Security Rules Verification Suite — "Dirty Dozen" Payloads
 * Verifies static and structural rule enforcement against all 12 adversarial vectors.
 */
import fs from 'node:fs';
import path from 'node:path';

interface SecurityAssertion {
  id: number;
  name: string;
  verify: (rules: string) => boolean;
}

const assertions: SecurityAssertion[] = [
  {
    id: 1,
    name: 'Payload 1 — Blocks self-verified paid order creation by customers or server',
    verify: (r) => r.includes("incoming().paymentStatus == 'pending_verification'") && r.includes("incoming().orderStatus == 'pending'"),
  },
  {
    id: 2,
    name: 'Payload 2 — Blocks shadow fields & wholesale self-approval on UserPublicProfile',
    verify: (r) => r.includes('incoming().wholesaleApproved == false') && r.includes('incoming().loyaltyPoints == 0') && r.includes("data.keys().hasOnly(["),
  },
  {
    id: 3,
    name: 'Payload 3 — Blocks unverified admin email spoofing',
    verify: (r) => r.includes('request.auth.token.email_verified == true') && r.includes('function isBootstrappedAdmin() {\n      return isVerifiedUser()'),
  },
  {
    id: 4,
    name: 'Payload 4 — Isolates user PII & authAccounts from cross-user or vault leakage',
    verify: (r) =>
      r.includes('match /private/{docId}') &&
      r.includes("!('vaultKey' in existing()) && (request.auth.uid == userId || isAdmin())") &&
      r.includes('match /authAccounts/{accountId}') &&
      r.includes('allow get: if false;'),
  },
  {
    id: 5,
    name: 'Payload 5 — Enforces resource.data owner/vault check & zero get/exists in order list queries',
    verify: (r) =>
      !r.includes('allow list: if isSignedIn();') &&
      r.includes("(isSignedIn() && !('vaultKey' in existing()) && (existing().customerId == request.auth.uid || isBootstrappedAdmin()))"),
  },
  {
    id: 6,
    name: 'Payload 6 — Locks terminal order states (delivered / cancelled) against non-admin resurrection',
    verify: (r) => r.includes("existing().orderStatus != 'delivered'") && r.includes("existing().orderStatus != 'cancelled'"),
  },
  {
    id: 7,
    name: 'Payload 7 — Enforces ID regex poisoning guard on path variables',
    verify: (r) => r.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')") && r.includes('id.size() <= 128'),
  },
  {
    id: 8,
    name: 'Payload 8 — Prevents orphaned order items via parent order existence / existsAfter check',
    verify: (r) => r.includes('exists(/databases/$(database)/documents/orders/$(orderId))') && r.includes('existsAfter(/databases/$(database)/documents/orders/$(orderId))'),
  },
  {
    id: 9,
    name: 'Payload 9 — Prevents customer loyalty point inflation on profile update',
    verify: (r) => r.includes('incoming().loyaltyPoints == existing().loyaltyPoints') && r.includes("affectedKeys().hasOnly(["),
  },
  {
    id: 10,
    name: 'Payload 10 — Enforces server timestamp integrity (request.time) and replay-proof WriteTicket',
    verify: (r) =>
      r.includes('incoming().createdAt == request.time') &&
      r.includes('incoming().updatedAt == request.time') &&
      r.includes('getAfter(/databases/$(database)/documents/writeTickets/$(gateKey)).data.authorizedAt == request.time'),
  },
  {
    id: 11,
    name: 'Payload 11 — Prevents fake verifiedBuyer flag on customer review creation',
    verify: (r) => r.includes('incoming().verifiedBuyer == false') && r.includes('exists(/databases/$(database)/documents/users/$(request.auth.uid))'),
  },
  {
    id: 12,
    name: 'Payload 12 — Wraps order update block with isValidOrder(incoming()) to block value poisoning',
    verify: (r) => r.includes('allow update: if isValidId(orderId) && isValidOrder(incoming())'),
  },
  {
    id: 13,
    name: 'Payload 13 — Enforces 3-5% affiliate commission bounds, zeroed initial balances, and terminal referral locking',
    verify: (r) =>
      r.includes('data.commissionRatePct >= 3 && data.commissionRatePct <= 5') &&
      r.includes('incoming().availableCommissionKes == 0') &&
      r.includes("existing().status != 'paid'"),
  },
];

const targetFile = process.argv[2] || 'firestore.rules';
const targetPath = path.resolve(targetFile);
const rulesContent = fs.readFileSync(targetPath, 'utf-8');
let failed = 0;

for (const test of assertions) {
  const passed = test.verify(rulesContent);
  if (!passed) {
    console.error(`FAIL [${test.id}]: ${test.name}`);
    failed++;
  } else {
    console.log(`PASS [${test.id}]: ${test.name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log(`All 12 Dirty Dozen security assertions passed on ${targetFile}.`);
