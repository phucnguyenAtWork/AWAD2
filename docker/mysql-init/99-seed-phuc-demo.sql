-- ═════════════════════════════════════════════════════════════════════
-- Demo seed for user d69ade6c-076c-4079-b7cc-29962437f570 (phone 0377968239)
-- Role: Student, income 40M VND/month (25M parental + 15M salary)
-- Seeds Feb + March 2026 income and expenses so MoM + anomaly detection
-- have real signal. Leaves April (existing) untouched, only adds budgets.
--
-- Idempotent on preferences/budgets (upserts). Transactions use UUID() so
-- re-running will duplicate — run once per fresh reseed.
-- ═════════════════════════════════════════════════════════════════════

USE finance_fina;

SET @userId = 'd69ade6c-076c-4079-b7cc-29962437f570';
SET @acctId = (SELECT id FROM accounts WHERE user_id = @userId LIMIT 1);

SET @catFood     = (SELECT id FROM categories WHERE name = 'Food'     LIMIT 1);
SET @catGrocery  = (SELECT id FROM categories WHERE name = 'Grocery'  LIMIT 1);
SET @catBill     = (SELECT id FROM categories WHERE name = 'Bill'     LIMIT 1);
SET @catShopping = (SELECT id FROM categories WHERE name = 'Shopping' LIMIT 1);
SET @catOther    = (SELECT id FROM categories WHERE name = 'Other'    LIMIT 1);

-- ─── Budget preferences (55/30/15 — a student leaning toward needs) ──
INSERT INTO budget_preferences (id, user_id, needs_pct, wants_pct, savings_pct)
VALUES (UUID(), @userId, 55, 30, 15)
ON DUPLICATE KEY UPDATE needs_pct = 55, wants_pct = 30, savings_pct = 15, updated_at = NOW();

-- Visible budgets read by the Budget UI and FINA.
DELETE FROM budgets WHERE account_id = @acctId;
INSERT INTO budgets (id, account_id, category_id, amount_limit, period, alert_threshold, start_date, end_date) VALUES
  (UUID(), @acctId, @catFood,     3000000, 'MONTHLY', 0.80, '2026-04-01', '2026-04-30'),
  (UUID(), @acctId, @catGrocery,  2000000, 'MONTHLY', 0.80, '2026-04-01', '2026-04-30'),
  (UUID(), @acctId, @catBill,     3000000, 'MONTHLY', 0.80, '2026-04-01', '2026-04-30'),
  (UUID(), @acctId, @catShopping, 2500000, 'MONTHLY', 0.80, '2026-04-01', '2026-04-30');

-- ─── INCOME: Feb + Mar 2026 ──────────────────────────────────────────
INSERT INTO transactions (id, user_id, type, amount, currency, description, category_id, occurred_at) VALUES
  (UUID(), @userId, 'INCOME', 25000000, 'VND', 'parental income',         NULL, '2026-02-01 09:00:00'),
  (UUID(), @userId, 'INCOME', 15000000, 'VND', 'part-time salary',        NULL, '2026-02-15 09:00:00'),
  (UUID(), @userId, 'INCOME', 25000000, 'VND', 'parental income',         NULL, '2026-03-01 09:00:00'),
  (UUID(), @userId, 'INCOME', 15000000, 'VND', 'part-time salary',        NULL, '2026-03-15 09:00:00');

-- ─── EXPENSES: February 2026 (baseline month) ───────────────────────
INSERT INTO transactions (id, user_id, type, amount, currency, description, category_id, essential, occurred_at) VALUES
  -- Food (~2.57M)
  (UUID(), @userId, 'EXPENSE',    55000, 'VND', 'Pho lunch',              @catFood, 0, '2026-02-03 12:15:00'),
  (UUID(), @userId, 'EXPENSE',    65000, 'VND', 'Highlands coffee',       @catFood, 0, '2026-02-05 09:20:00'),
  (UUID(), @userId, 'EXPENSE',   380000, 'VND', 'Dinner with classmates', @catFood, 0, '2026-02-07 19:30:00'),
  (UUID(), @userId, 'EXPENSE',    70000, 'VND', 'Bun bo lunch',           @catFood, 0, '2026-02-10 12:05:00'),
  (UUID(), @userId, 'EXPENSE',    85000, 'VND', 'Cafe + banh',            @catFood, 0, '2026-02-12 15:40:00'),
  (UUID(), @userId, 'EXPENSE',   650000, 'VND', 'Valentine dinner',       @catFood, 0, '2026-02-14 19:00:00'),
  (UUID(), @userId, 'EXPENSE',    60000, 'VND', 'Com tam lunch',          @catFood, 0, '2026-02-17 12:30:00'),
  (UUID(), @userId, 'EXPENSE',    55000, 'VND', 'Coffee',                 @catFood, 0, '2026-02-19 10:15:00'),
  (UUID(), @userId, 'EXPENSE',   450000, 'VND', 'Sushi dinner',           @catFood, 0, '2026-02-22 19:45:00'),
  (UUID(), @userId, 'EXPENSE',    75000, 'VND', 'Lunch',                  @catFood, 0, '2026-02-25 12:10:00'),
  (UUID(), @userId, 'EXPENSE',   580000, 'VND', 'Hotpot dinner',          @catFood, 0, '2026-02-27 19:30:00'),
  (UUID(), @userId, 'EXPENSE',    45000, 'VND', 'Coffee',                 @catFood, 0, '2026-02-28 09:00:00'),
  -- Grocery (~1.53M)
  (UUID(), @userId, 'EXPENSE',   420000, 'VND', 'VinMart weekly',         @catGrocery, 1, '2026-02-04 17:30:00'),
  (UUID(), @userId, 'EXPENSE',   380000, 'VND', 'VinMart weekly',         @catGrocery, 1, '2026-02-11 17:45:00'),
  (UUID(), @userId, 'EXPENSE',   450000, 'VND', 'Coopmart weekly',        @catGrocery, 1, '2026-02-18 18:00:00'),
  (UUID(), @userId, 'EXPENSE',   280000, 'VND', 'Big C top-up',           @catGrocery, 1, '2026-02-25 18:10:00'),
  -- Bill (~2.84M)
  (UUID(), @userId, 'EXPENSE',  2000000, 'VND', 'Monthly rent',           @catBill, 1, '2026-02-01 10:00:00'),
  (UUID(), @userId, 'EXPENSE',   220000, 'VND', 'Viettel internet',       @catBill, 1, '2026-02-05 11:00:00'),
  (UUID(), @userId, 'EXPENSE',   150000, 'VND', 'Mobile plan',            @catBill, 1, '2026-02-10 11:00:00'),
  (UUID(), @userId, 'EXPENSE',   320000, 'VND', 'Electricity + water',    @catBill, 1, '2026-02-20 14:00:00'),
  (UUID(), @userId, 'EXPENSE',   150000, 'VND', 'Gym membership',         @catBill, 0, '2026-02-28 10:00:00'),
  -- Shopping (~1.5M — normal month)
  (UUID(), @userId, 'EXPENSE',   850000, 'VND', 'Clothes from Zara',      @catShopping, 0, '2026-02-08 15:20:00'),
  (UUID(), @userId, 'EXPENSE',   650000, 'VND', 'New sneakers',           @catShopping, 0, '2026-02-20 16:40:00'),
  -- Other (~165k)
  (UUID(), @userId, 'EXPENSE',   120000, 'VND', 'Grab to airport',        @catOther, 0, '2026-02-15 07:30:00'),
  (UUID(), @userId, 'EXPENSE',    45000, 'VND', 'Grab',                   @catOther, 0, '2026-02-26 20:00:00');

-- ─── EXPENSES: March 2026 (shopping spike + food uptick — creates MoM + anomaly) ──
INSERT INTO transactions (id, user_id, type, amount, currency, description, category_id, essential, occurred_at) VALUES
  -- Food (~3.29M, +28% MoM)
  (UUID(), @userId, 'EXPENSE',    65000, 'VND', 'Lunch',                  @catFood, 0, '2026-03-02 12:10:00'),
  (UUID(), @userId, 'EXPENSE',    70000, 'VND', 'Coffee',                 @catFood, 0, '2026-03-04 09:15:00'),
  (UUID(), @userId, 'EXPENSE',   850000, 'VND', 'Friends birthday dinner',@catFood, 0, '2026-03-06 19:30:00'),
  (UUID(), @userId, 'EXPENSE',   250000, 'VND', 'Lunch with classmates',  @catFood, 0, '2026-03-09 12:00:00'),
  (UUID(), @userId, 'EXPENSE',    95000, 'VND', 'Coffee + snack',         @catFood, 0, '2026-03-11 15:20:00'),
  (UUID(), @userId, 'EXPENSE',   480000, 'VND', 'Nice dinner',            @catFood, 0, '2026-03-14 19:40:00'),
  (UUID(), @userId, 'EXPENSE',    80000, 'VND', 'Lunch',                  @catFood, 0, '2026-03-17 12:20:00'),
  (UUID(), @userId, 'EXPENSE',    60000, 'VND', 'Coffee',                 @catFood, 0, '2026-03-20 10:00:00'),
  (UUID(), @userId, 'EXPENSE',   550000, 'VND', 'Sushi date',             @catFood, 0, '2026-03-23 19:30:00'),
  (UUID(), @userId, 'EXPENSE',    70000, 'VND', 'Lunch',                  @catFood, 0, '2026-03-27 12:00:00'),
  (UUID(), @userId, 'EXPENSE',   720000, 'VND', 'Farewell dinner',        @catFood, 0, '2026-03-30 19:00:00'),
  -- Grocery (~1.66M)
  (UUID(), @userId, 'EXPENSE',   420000, 'VND', 'Weekly grocery',         @catGrocery, 1, '2026-03-03 17:30:00'),
  (UUID(), @userId, 'EXPENSE',   390000, 'VND', 'Weekly grocery',         @catGrocery, 1, '2026-03-10 17:45:00'),
  (UUID(), @userId, 'EXPENSE',   440000, 'VND', 'Weekly grocery',         @catGrocery, 1, '2026-03-17 18:00:00'),
  (UUID(), @userId, 'EXPENSE',   410000, 'VND', 'Weekly grocery',         @catGrocery, 1, '2026-03-24 18:10:00'),
  -- Bill (~3.04M — electricity bumped up for summer)
  (UUID(), @userId, 'EXPENSE',  2000000, 'VND', 'Monthly rent',           @catBill, 1, '2026-03-01 10:00:00'),
  (UUID(), @userId, 'EXPENSE',   220000, 'VND', 'Viettel internet',       @catBill, 1, '2026-03-05 11:00:00'),
  (UUID(), @userId, 'EXPENSE',   150000, 'VND', 'Mobile plan',            @catBill, 1, '2026-03-10 11:00:00'),
  (UUID(), @userId, 'EXPENSE',   520000, 'VND', 'Electricity (summer)',   @catBill, 1, '2026-03-20 14:00:00'),
  (UUID(), @userId, 'EXPENSE',   150000, 'VND', 'Gym membership',         @catBill, 0, '2026-03-28 10:00:00'),
  -- Shopping (~3.7M — ANOMALY vs Feb 1.5M, 2.5x average)
  (UUID(), @userId, 'EXPENSE',  1200000, 'VND', 'Laptop bag + accessories',@catShopping, 0, '2026-03-06 16:00:00'),
  (UUID(), @userId, 'EXPENSE',  1850000, 'VND', 'Clothes shopping spree', @catShopping, 0, '2026-03-12 14:30:00'),
  (UUID(), @userId, 'EXPENSE',   650000, 'VND', 'Headphones',             @catShopping, 0, '2026-03-22 15:10:00'),
  -- Other (~290k)
  (UUID(), @userId, 'EXPENSE',    85000, 'VND', 'Grab',                   @catOther, 0, '2026-03-07 18:30:00'),
  (UUID(), @userId, 'EXPENSE',   110000, 'VND', 'Taxi',                   @catOther, 0, '2026-03-14 22:15:00'),
  (UUID(), @userId, 'EXPENSE',    95000, 'VND', 'Grab',                   @catOther, 0, '2026-03-22 21:00:00');

-- ─── Verify counts ────────────────────────────────────────────────────
SELECT DATE_FORMAT(occurred_at, '%Y-%m') AS month,
       type,
       COUNT(*) AS tx_count,
       FORMAT(SUM(amount), 0) AS total_vnd
FROM transactions
WHERE user_id = 'd69ade6c-076c-4079-b7cc-29962437f570'
GROUP BY month, type
ORDER BY month, type;
