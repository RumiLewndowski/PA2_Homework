require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const argon2 = require('argon2');
const fs = require('node:fs');
const path = require('node:path');
const {configureSecurity,requireAuth} = require('./security');
const {validatePurchase} = require('./validation');
const app=express();
const db=new Database(path.join(__dirname,'tracker.db'));
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
app.use(express.json({limit:'16kb'}));
configureSecurity(app);
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const todo = res => res.status(501).json({error:'Complete this numbered step'});

// S1: Implement GET /api/health -> {ok:true}.
app.get('/api/health',(req,res)=>res.json({ok:true}));

// S2: Validate credentials. Normalize only email. Query duplicate email safely.
// await argon2.hash(password,{type:argon2.argon2id}); insert email/hash; return 201 {id,email}.
// Catch uniqueness conflicts as 409, without leaking SQL or hashes.
app.post('/api/register', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    const hashedPassword = await argon2.hash(password, { type: argon2.argon2id });
    const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
    const result = stmt.run(normalizedEmail, hashedPassword);
    
    return res.status(201).json({ id: result.lastInsertRowid, email: normalizedEmail });
  } catch (err) {
    // Check for SQLite unique constraint violation code (SQLITE_CONSTRAINT_UNIQUE)
    if (err.code === 'SQLITE_CONSTRAINT' || (err.message && err.message.includes('UNIQUE'))) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw err; // Let asyncRoute error handler deal with unexpected issues
  }
}));

// S3: SELECT by normalized email; await argon2.verify(storedHash,password).
// Invalid credentials -> generic 401. Regenerate, set userId, save, then respond.
// Promise wrappers: await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
// Use the same pattern for session.save. Do not keep the old CSRF token after regeneration.
app.post('/api/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const stmt = db.prepare('SELECT id, password_hash FROM users WHERE email = ?');
  const user = stmt.get(normalizedEmail);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = await argon2.verify(user.password_hash, password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Session regeneration pattern
  await new Promise((resolve, reject) => 
    req.session.regenerate(err => err ? reject(err) : resolve())
  );

  // Clear old CSRF token if present
  delete req.session.csrfToken;

  req.session.userId = user.id;

  // Session save pattern
  await new Promise((resolve, reject) => 
    req.session.save(err => err ? reject(err) : resolve())
  );

  return res.json({ ok: true, id: user.id, email: normalizedEmail });
}));
 app.get('/api/me', requireAuth, (req, res) => {
  // S4: Return only the session user's {id,email}.
  const stmt = db.prepare('SELECT id, email FROM users WHERE id = ?');
  const user = stmt.get(req.session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ id: user.id, email: user.email });
});
 app.post('/api/logout', requireAuth, (req, res, next) => {
  // S5: destroy session; forward an error if needed; clear sid with path '/'; return {ok:true}.
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('sid', { path: '/' }); // Changed from 'connect.sid' to 'sid'
    return res.json({ ok: true });
  });
});
  app.get('/api/categories', requireAuth, (req, res) => {
  // S6: SELECT id,name FROM categories ORDER BY id, using all().
  const categories = db.prepare('SELECT id, name FROM categories ORDER BY id').all();
  return res.json(categories);
});

// S7: Write a reusable SELECT with JOIN purchases to categories, aliases matching
// the API fields, and calculated quantity*unit_price_cents AS costCents.
const getPurchasesStmt = db.prepare(`
  SELECT 
    p.id, 
    p.name, 
    p.quantity, 
    p.unit_price_cents AS unitPriceCents, 
    (p.quantity * p.unit_price_cents) AS costCents,
    p.category_id AS categoryId,
    c.name AS categoryName
  FROM purchases p
  JOIN categories c ON p.category_id = c.id
  WHERE p.owner_id = ?
  ORDER BY p.id ASC
`);

app.get('/api/purchases', requireAuth, (req, res) => {
  // S8: return all owned records in ascending ID order.
  const purchases = getPurchasesStmt.all(req.session.userId);
  return res.json(purchases);
});
// A reusable statement to get a single purchase by ID and owner
const getPurchaseByIdStmt = db.prepare(`
  SELECT 
    p.id, 
    p.name, 
    p.quantity, 
    p.unit_price_cents AS unitPriceCents, 
    (p.quantity * p.unit_price_cents) AS costCents,
    p.category_id AS categoryId,
    c.name AS categoryName
  FROM purchases p
  JOIN categories c ON p.category_id = c.id
  WHERE p.id = ? AND p.owner_id = ?
`);

app.post('/api/purchases', requireAuth, (req, res) => {
  // S9: read category IDs, validatePurchase, INSERT with req.session.userId.
  // Use result.lastInsertRowid to SELECT the created joined record; return 201.
  const validation = validatePurchase(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { name, quantity, unitPriceCents, categoryId } = validation.sanitized;

  // Verify category exists
  const categoryExists = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
  if (!categoryExists) {
    return res.status(400).json({ error: 'Invalid category ID' });
  }

  const insertStmt = db.prepare(`
    INSERT INTO purchases (owner_id, category_id, name, quantity, unit_price_cents)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const result = insertStmt.run(req.session.userId, categoryId, name, quantity, unitPriceCents);
  const newPurchase = getPurchaseByIdStmt.get(result.lastInsertRowid, req.session.userId);

  return res.status(201).json(newPurchase);
});
const updatePurchaseStmt = db.prepare(`
  UPDATE purchases 
  SET category_id = ?, name = ?, quantity = ?, unit_price_cents = ?
  WHERE id = ? AND owner_id = ?
`);

app.put('/api/purchases/:id', requireAuth, (req, res) => {
  // S10: validate positive integer path ID; lookup using ID AND owner_id.
  // 404 if not owned/found. Validate all editable fields, then UPDATE with both predicates.
  // SELECT and return the updated joined record.
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid purchase ID' });
  }

  // Check if purchase exists and belongs to the user
  const existing = getPurchaseByIdStmt.get(id, req.session.userId);
  if (!existing) {
    return res.status(404).json({ error: 'Purchase not found' });
  }

  const validation = validatePurchase(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { name, quantity, unitPriceCents, categoryId } = validation.sanitized;

  // Verify category exists
  const categoryExists = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
  if (!categoryExists) {
    return res.status(400).json({ error: 'Invalid category ID' });
  }

  updatePurchaseStmt.run(categoryId, name, quantity, unitPriceCents, id, req.session.userId);

  const updatedPurchase = getPurchaseByIdStmt.get(id, req.session.userId);
  return res.json(updatedPurchase);
});
const deletePurchaseStmt = db.prepare(`
  DELETE FROM purchases WHERE id = ? AND owner_id = ?
`);

app.delete('/api/purchases/:id', requireAuth, (req, res) => {
  // S11: validate path ID; DELETE WHERE id=? AND owner_id=?.
  // Check result.changes: 0 -> 404; otherwise {ok:true}.
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid purchase ID' });
  }

  const result = deletePurchaseStmt.run(id, req.session.userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Purchase not found' });
  }

  return res.json({ ok: true });
});
