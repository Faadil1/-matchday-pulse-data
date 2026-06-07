require('dotenv').config();
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// ── Match day window ──────────────────────────────────────────────────────────
// 6-hour window: 15:00–21:00 UTC on match day
const MATCH_START = new Date('2026-06-06T15:00:00.000Z');
const MATCH_END   = new Date('2026-06-06T21:00:00.000Z');

// Fraud window: 30-minute mid-stream spike (2.5 h in)
const FRAUD_START = new Date('2026-06-06T17:30:00.000Z');
const FRAUD_END   = new Date('2026-06-06T18:00:00.000Z');

// ── Constants ─────────────────────────────────────────────────────────────────
const ZONES      = ['Zone1', 'Zone2', 'Zone3', 'Zone4', 'Zone5', 'Zone6'];
const CATEGORIES = ['food', 'merch', 'transport', 'ticket_resale', 'hotel'];

const TOTAL_DOCS   = 5000;
const FRAUD_COUNT  = 300;
const NORMAL_COUNT = TOTAL_DOCS - FRAUD_COUNT;

// Three device fingerprints reused across all fraud transactions
const FRAUD_FINGERPRINTS = [
  crypto.randomBytes(16).toString('hex'),
  crypto.randomBytes(16).toString('hex'),
  crypto.randomBytes(16).toString('hex'),
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTimestamp(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomAmount() {
  const r = Math.random();
  if (r < 0.65) return +( 20 + Math.random() *  80).toFixed(2); // $20–$100
  if (r < 0.93) return +(100 + Math.random() * 200).toFixed(2); // $100–$300
  return              +(300 + Math.random() * 200).toFixed(2);   // $300–$500 (rare)
}

function randomFingerprint() {
  return crypto.randomBytes(16).toString('hex');
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Document builders ─────────────────────────────────────────────────────────
function makeNormal() {
  return {
    transactionId:     uuidv4(),
    timestamp:         randomTimestamp(MATCH_START, MATCH_END),
    amount:            randomAmount(),
    status:            Math.random() < 0.08 ? 'declined' : 'approved',
    zone:              pick(ZONES),
    merchantCategory:  pick(CATEGORIES),
    deviceFingerprint: randomFingerprint(),
    city:              'Toronto',
  };
}

function makeFraud() {
  return {
    transactionId:     uuidv4(),
    timestamp:         randomTimestamp(FRAUD_START, FRAUD_END),
    amount:            randomAmount(),
    // ~70% decline rate — hallmark of rapid card-testing / scalper bot activity
    status:            Math.random() < 0.70 ? 'declined' : 'approved',
    zone:              'Zone3',
    merchantCategory:  'ticket_resale',
    // Rotates among only 3 fingerprints — bots rarely cycle devices
    deviceFingerprint: pick(FRAUD_FINGERPRINTS),
    city:              'Toronto',
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not set. Copy .env.example → .env and fill it in.');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB.\n');

    const db  = client.db('matchday');
    const col = db.collection('transactions');

    // Drop and recreate for a clean slate
    await col.drop().catch(() => {});
    console.log('Collection dropped (if it existed). Generating documents…\n');

    // Build all documents in memory, then shuffle so fraud isn't at the end
    const docs = [];
    for (let i = 0; i < NORMAL_COUNT; i++) docs.push(makeNormal());
    for (let i = 0; i < FRAUD_COUNT;  i++) docs.push(makeFraud());
    shuffleInPlace(docs);

    // Insert in batches of 500
    const BATCH = 500;
    for (let i = 0; i < docs.length; i += BATCH) {
      await col.insertMany(docs.slice(i, i + BATCH));
      process.stdout.write(`\r  Inserted ${Math.min(i + BATCH, docs.length).toLocaleString()} / ${docs.length.toLocaleString()}`);
    }
    console.log('\n');

    // ── Summary ───────────────────────────────────────────────────────────────
    const [total, approved, declined] = await Promise.all([
      col.countDocuments(),
      col.countDocuments({ status: 'approved' }),
      col.countDocuments({ status: 'declined' }),
    ]);

    console.log('════════════════════════════════════════');
    console.log('  SEED SUMMARY');
    console.log('════════════════════════════════════════');
    console.log(`  Total:    ${total.toLocaleString()}`);
    console.log(`  Approved: ${approved.toLocaleString()} (${((approved / total) * 100).toFixed(1)}%)`);
    console.log(`  Declined: ${declined.toLocaleString()} (${((declined / total) * 100).toFixed(1)}%)`);

    console.log('\n  Count by zone:');
    for (const zone of ZONES) {
      const n = await col.countDocuments({ zone });
      console.log(`    ${zone}: ${n.toLocaleString()}`);
    }

    // Confirm the hidden anomaly is actually in the data
    const anomalyFilter = {
      zone:             'Zone3',
      merchantCategory: 'ticket_resale',
      timestamp:        { $gte: FRAUD_START, $lte: FRAUD_END },
    };
    const [aTotal, aDeclined] = await Promise.all([
      col.countDocuments(anomalyFilter),
      col.countDocuments({ ...anomalyFilter, status: 'declined' }),
    ]);

    const declinePct = ((aDeclined / aTotal) * 100).toFixed(1);
    const baselineExpected = Math.round(NORMAL_COUNT / ZONES.length / CATEGORIES.length / 12); // ~30-min slice

    console.log('\n════════════════════════════════════════');
    console.log('  HIDDEN FRAUD ANOMALY CONFIRMED');
    console.log('  Zone3 / ticket_resale / 17:30–18:00 UTC');
    console.log('════════════════════════════════════════');
    console.log(`  Volume:            ${aTotal} txns  (baseline ~${baselineExpected} expected in this slot)`);
    console.log(`  Decline rate:      ${declinePct}%  (baseline ~8%)`);
    console.log(`  Unique fingerprints reused: 3`);
    console.log(`    fp1: ${FRAUD_FINGERPRINTS[0]}`);
    console.log(`    fp2: ${FRAUD_FINGERPRINTS[1]}`);
    console.log(`    fp3: ${FRAUD_FINGERPRINTS[2]}`);
    console.log('\n  Signals for the agent to discover:');
    console.log('    1. 30-min transaction spike  (~23× above baseline volume)');
    console.log('    2. Decline rate jumps from ~8% → ~70%');
    console.log('    3. deviceFingerprint cardinality collapses to 3 values');

  } finally {
    await client.close();
    console.log('\nDone. Connection closed.');
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
