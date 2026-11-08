# Investment Purchase Tracker PA2

Student name: Rumi Lewandowski 
ID: 0818983

## Setup
1. Install the class-supported Node.js and npm.
2. Run `npm install express better-sqlite3 express-session argon2 dotenv`.
3. Copy `.env.example` to `.env`; set a new random SESSION_SECRET (at least 32 characters).
4. Run `npm start`; visit http://localhost:3000.
5. Run `npm test` after implementing validation. Initial test failure is expected.

The schema is initialized at startup. Use only fictional accounts and purchases.
Complete the explanations requested in START_HERE.html, list known limitations,
and include your Git repository URL or git-log.txt. Add the Node version you tested.

Do not submit .env, database files, node_modules, or .git.

---

## Technical Explanations

### 1. Request-Response Path (Add Purchase Action)
- Browser Event: Clicking the "Add Purchase" submit button triggers a DOM submit event listener in `public/script.js`.
- Request: JavaScript intercepts the form submit, converts dollars to integer cents (`Math.round(dollars * 100)`), and sends a `POST /api/purchases` request via `fetch()` containing JSON data (`name`, `quantity`, `unitPriceCents`, `categoryId`), session cookies, and the `X-CSRF-Token` header.
- Middleware: Express parses JSON with `express.json()` and passes control to authentication and CSRF middleware to confirm `req.session.userId` exists and validate the CSRF token.
- Route: `POST /api/purchases` in `server.js` receives the payload and passes it to `validatePurchase()` to verify types, ranges, and category constraints.
- SQL Execution: The route executes a parameterized query using `better-sqlite3`:
  `INSERT INTO purchases (name, quantity, unit_price_cents, category_id, owner_id) VALUES (?, ?, ?, ?, ?)`
- Response: The server calculates total cost (`quantity * unit_price_cents`) and sends an HTTP `201 Created` status with the newly created purchase JSON object.
- UI Refresh: The client receives the 201 response, fetches the updated authoritative purchases list via `GET /api/purchases`, recalculates totals, clears form inputs, and renders the table safely using `textContent`.

### 2. Roles of Node.js, npm, and package-lock.json
- Node.js: The asynchronous, event-driven JavaScript runtime environment executing code on the server.
- npm: The package manager used to install and manage third-party modules (Express, SQLite, Argon2).
- package-lock.json: Automatically tracks the exact versions of all installed packages and sub-dependencies to ensure reproducible builds across environments.

### 3. Asynchronous Promises in Express
The `async`/`await` syntax handles promises asynchronously. When an `async` route handler pauses at `await` (such as database queries or Argon2 hashing), Node.js releases the single-threaded event loop to handle other incoming network requests simultaneously. It waits for operations to complete without blocking or stopping the server for other users.

### 4. Database Schema: Constraints and SQL vs. NoSQL Comparison
- Constraints: The schema enforces a primary key (`purchases.id`), two foreign keys (`purchases.owner_id` -> `users.id` and `purchases.category_id` -> `categories.id`), and a CHECK constraint (`quantity > 0` and `unit_price_cents >= 0`).
- Relational vs. NoSQL Comparison: Relational storage is ideal here because it guarantees referential integrity between users, categories, and purchases using foreign keys. In a document-style NoSQL database (like MongoDB), records might be stored as nested documents inside a single user document. While NoSQL offers fast single-document reads without JOINs, it introduces data redundancy and risks inconsistency—such as requiring manual updates across embedded documents when a category name changes, or lacking schema-level foreign key enforcement.

---

## Environment & Submission Details

- Node Version Tested: Node.js v20.18.0 (npm v10.8.2)
- Git Log / Repository: Included in `git-log.txt`

## Known Limitations
- Session Storage: Uses default `MemoryStore`, which resets session logins when the server process stops or restarts (database records persist in SQLite).
- HTTPS / Deployment: Configured with `secure: false` cookies for local HTTP development only (`localhost:3000`).
