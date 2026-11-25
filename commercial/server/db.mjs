/** Beekeepy commercial QA store (SQLite / Node.js 22, local single-process only).
 *  This is a reconstruction, not the lost 2026-11-23 production database schema.
 *  Never imports or mutates hive/app_state data. */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export function openStore(filename = ':memory:') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS account (
      user_id TEXT PRIMARY KEY, email TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscription (
      user_id TEXT PRIMARY KEY REFERENCES account(user_id),
      stripe_subscription_id TEXT UNIQUE,
      stripe_customer_id TEXT,
      status TEXT NOT NULL DEFAULT 'none',
      price_id TEXT,
      approved_price INTEGER NOT NULL DEFAULT 0,
      period_end INTEGER,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      stripe_event_time INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS commerce_event (
      event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL,
      created INTEGER NOT NULL, received_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS commerce_order (
      order_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES account(user_id),
      stripe_session_id TEXT UNIQUE, stripe_payment_intent_id TEXT,
      amount INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'usd',
      status TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS refund_request (
      request_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES commerce_order(order_id),
      stripe_refund_id TEXT UNIQUE, amount INTEGER NOT NULL,
      state TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ticket (
      ticket_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES account(user_id),
      subject TEXT NOT NULL, message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      audit_id TEXT PRIMARY KEY, actor TEXT NOT NULL,
      action TEXT NOT NULL, object_id TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_session (
      token_hash TEXT PRIMARY KEY, csrf_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entitlement_outbox (
      user_id TEXT PRIMARY KEY REFERENCES account(user_id),
      stripe_event_id TEXT NOT NULL, required_plan TEXT NOT NULL,
      synced_at TEXT, last_error TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS system_control (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );`);
  const sql = (statement, ...params) => db.prepare(statement).run(...params);
  const get = (statement, ...params) => db.prepare(statement).get(...params);
  const all = (statement, ...params) => db.prepare(statement).all(...params);
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const val=fn(); db.exec('COMMIT'); return val; }
    catch(e) {db.exec('ROLLBACK'); throw e;}
  };
  const now = () => new Date().toISOString();
  const ensureAccount = (uid,email='') => {
    if (!/^[\w-]{5,128}$/.test(uid)) throw Error('Invalid user identity');
    sql('INSERT OR IGNORE INTO account (user_id,email,created_at) VALUES (?,?,?)',uid,String(email).slice(0,255),now());
    if(email) sql('UPDATE account SET email=? WHERE user_id=?',String(email).slice(0,255),uid);
  };
  const audit = (actor,action,objectId='') => sql('INSERT INTO audit VALUES (?,?,?,?,?)',randomUUID(),actor,action,objectId,now());
  function entitlement(uid, at=Math.floor(Date.now()/1000)) {
    const s=get('SELECT * FROM subscription WHERE user_id=?',uid);
    const active=!!s && ['active','trialing'].includes(s.status)
      && s.approved_price===1
      && /^sub_[A-Za-z0-9]+$/.test(s.stripe_subscription_id||'')
      && (!s.period_end || s.period_end > at);
    return {plan:active?'Pro':'Free',source:active?'stripe':'none',status:s?.status||'none',cancel_at_period_end:!!s?.cancel_at_period_end,period_end:s?.period_end||null};
  }
  return {db,sql,get,all,transaction,now,ensureAccount,audit,entitlement,close:()=>db.close()};
}

export function sha256(value) {return createHash('sha256').update(value).digest('hex');}
