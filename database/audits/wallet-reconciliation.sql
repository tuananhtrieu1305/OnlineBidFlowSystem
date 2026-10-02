-- Read-only report. Select the intended database with the mysql client; never source init.sql here.
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION READ ONLY;
SELECT DATABASE() AS database_name, UTC_TIMESTAMP(6) AS read_at;
SELECT COUNT(*) AS system_wallet_count FROM wallets WHERE wallet_type='SYSTEM';

-- All snapshots and deltas. Available difference may mean an undocumented opening balance.
SELECT w.id,w.user_id,w.wallet_type,w.available_balance,w.locked_balance,
 COALESCE(SUM(t.available_delta),0) AS ledger_available,
 COALESCE(SUM(t.locked_delta),0) AS ledger_locked,
 CAST(w.available_balance AS DECIMAL(30,0))-COALESCE(SUM(t.available_delta),0) AS available_difference,
 CAST(w.locked_balance AS DECIMAL(30,0))-COALESCE(SUM(t.locked_delta),0) AS locked_difference
FROM wallets w LEFT JOIN coin_transactions t ON t.wallet_id=w.id
GROUP BY w.id,w.user_id,w.wallet_type,w.available_balance,w.locked_balance ORDER BY w.id;

SELECT u.id,u.role,COUNT(w.id) AS personal_wallet_count
FROM users u LEFT JOIN wallets w ON w.user_id=u.id AND w.wallet_type='USER'
GROUP BY u.id,u.role HAVING (u.role='USER' AND COUNT(w.id)<>1) OR (u.role='ADMIN' AND COUNT(w.id)>0);

SELECT wallet_id,auction_id,SUM(locked_delta) AS held
FROM coin_transactions GROUP BY wallet_id,auction_id
HAVING SUM(locked_delta)<0 OR (auction_id IS NULL AND SUM(locked_delta)<>0);

-- Historical holds left in a closed auction.
SELECT t.wallet_id,t.auction_id,a.status,SUM(t.locked_delta) AS held
FROM coin_transactions t JOIN auctions a ON a.id=t.auction_id
WHERE a.status IN ('SOLD','UNSOLD') GROUP BY t.wallet_id,t.auction_id,a.status
HAVING SUM(t.locked_delta)<>0;

-- Check delta shapes against the current service contract, without changing any rows.
SELECT t.id,t.wallet_id,t.auction_id,t.transaction_type,t.available_delta,t.locked_delta
FROM coin_transactions t JOIN wallets w ON w.id=t.wallet_id
WHERE NOT (
 (t.transaction_type='DEPOSIT' AND w.wallet_type='USER' AND t.auction_id IS NULL AND t.available_delta>0 AND t.locked_delta=0)
 OR (t.transaction_type='LOCK' AND w.wallet_type='USER' AND t.auction_id IS NOT NULL AND t.available_delta<0 AND t.locked_delta>0 AND CAST(t.available_delta AS DECIMAL(30,0))+t.locked_delta=0)
 OR (t.transaction_type='UNLOCK' AND w.wallet_type='USER' AND t.auction_id IS NOT NULL AND t.available_delta>0 AND t.locked_delta<0 AND CAST(t.available_delta AS DECIMAL(30,0))+t.locked_delta=0)
 OR (t.transaction_type='PAYMENT' AND t.auction_id IS NOT NULL AND ((w.wallet_type='SYSTEM' AND t.available_delta>0 AND t.locked_delta=0) OR (w.wallet_type='USER' AND t.available_delta=0 AND t.locked_delta<0)))
);

-- Aggregate once per auction to avoid multiplying ledger rows by joining bids/participants.
SELECT a.id,a.status,a.winner_user_id,a.winning_price,
 COUNT(t.id) AS payment_rows,
 COALESCE(SUM(CASE WHEN w.wallet_type='SYSTEM' THEN t.available_delta ELSE 0 END),0) AS system_received,
 COALESCE(SUM(CASE WHEN w.user_id=a.winner_user_id THEN -CAST(t.locked_delta AS DECIMAL(30,0)) ELSE 0 END),0) AS winner_paid,
 COALESCE(SUM(CAST(t.available_delta AS DECIMAL(30,0))+t.locked_delta),0) AS payment_net
FROM auctions a LEFT JOIN coin_transactions t ON t.auction_id=a.id AND t.transaction_type='PAYMENT'
LEFT JOIN wallets w ON w.id=t.wallet_id
GROUP BY a.id,a.status,a.winner_user_id,a.winning_price
HAVING (a.status='SOLD' AND (payment_rows<>2 OR system_received<>a.winning_price OR winner_paid<>a.winning_price OR payment_net<>0))
 OR (a.status<>'SOLD' AND payment_rows<>0);

SELECT w.id,w.user_id,w.wallet_type
FROM wallets w LEFT JOIN users u ON u.id=w.user_id
WHERE (w.wallet_type='SYSTEM' AND w.user_id IS NOT NULL)
 OR (w.wallet_type='USER' AND (u.id IS NULL OR u.role<>'USER'));
COMMIT;
