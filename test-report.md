## PA2 Test Report — Investment Purchase Tracker

Student Name: Rumi Lewandowski
Date: November 8, 2026  

---

## Test Verification Checklist

1. Registration & Login Validation
Test: Register two users (A and B). Check duplicate emails (409), invalid passwords (400), and incorrect logins (401).
Status: Pass
Result: Duplicate emails triggered a 409 conflict. Bad logins returned a generic 401 error.

2. Auth & CSRF Protection
Test: Verify logged-out requests return 401, and missing/invalid CSRF tokens reject mutations with 403.
Status: Pass
Result: Unauthenticated requests blocked with 401. Invalid CSRF tokens rejected with 403 without data changes.

3. Purchase Creation & Totals (User A)
Test: Add Example Index Fund (qty 5, price $20.00) and Example Company (qty 3, price $15.50). Verify total.
Status: Pass
Result: Both purchases created successfully with a calculated total cost of $146.50.

4. Persistence & Server Restart
Test: Reload, restart the backend server, and log back in. Verify records and totals persist.
Status: Pass
Result: User records and totals persisted accurately from SQLite after server restart.

5. Update & Delete Operations
Test: Edit company quantity to 4 (expecting $162.00). Delete fund purchase (expecting 1 record, $62.00).
Status: Pass
Result: PUT updated quantity and total to $162.00. DELETE removed the record, leaving 1 item and $62.00.

6. User Isolation & Authorization
Test: As User B, verify no User A records show. Attempt direct PUT/DELETE calls on User A's items.
Status: Pass
Result: User B's dashboard was empty. Direct API calls returned 404 and left User A's data unmutated.

7. Robust Input Validation
Test: Test invalid inputs (blank names, quantity 1.5/0/10001, bad prices, unknown category).
Status: Pass
Result: All invalid inputs triggered 400 Bad Request errors without mutating database records.

8. XSS Safety & Duplicate Names
Test: Add a purchase named <b>Example</b>. Verify safe text rendering and duplicate name creation.
Status: Pass
Result: HTML tags rendered literally as text. Duplicate names created separate records with distinct IDs.

9. Connection Loss Handling
Test: Stop server and attempt a save. Verify connection error message, preserved inputs, and button reset.
Status: Pass
Result: Network error caught, message displayed, inputs retained, and button re-enabled.

10. Malformed JSON & Unknown Routes
Test: Send malformed JSON payloads and request an unknown API route.
Status: Pass
Result: Proper JSON error responses returned. Excluded folders verified.

---

## Evidence Summary
- Two-User Ownership Check: Verified via isolated session cookies and strict owner_id predicates.
- Database Persistence: Confirmed via SQLite storage with foreign key constraints enabled.