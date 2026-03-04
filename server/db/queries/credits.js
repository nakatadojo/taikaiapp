const pool = require('../pool');

/**
 * Get credit balance for a user.
 */
async function getBalance(userId) {
  const result = await pool.query(
    'SELECT credit_balance FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.credit_balance || 0;
}

/**
 * Add credits to a user's balance (atomic with transaction log).
 * Returns the new balance.
 */
async function addCredits(userId, amount, type, description, { tournamentId, registrationId, stripeSessionId } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Increment balance
    const userResult = await client.query(
      'UPDATE users SET credit_balance = credit_balance + $1 WHERE id = $2 RETURNING credit_balance',
      [amount, userId]
    );
    const newBalance = userResult.rows[0].credit_balance;

    // Log transaction
    await client.query(
      `INSERT INTO credit_transactions
        (user_id, amount, balance_after, type, description, tournament_id, registration_id, stripe_session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, amount, newBalance, type, description,
       tournamentId || null, registrationId || null, stripeSessionId || null]
    );

    await client.query('COMMIT');
    return newBalance;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Deduct credits (1 per competitor) when registration is confirmed.
 * Returns { success, newBalance } or { success: false, error }.
 */
async function deductForRegistration(directorUserId, competitorCount, tournamentId, registrationIds, description) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the user row for update to prevent race conditions
    const userResult = await client.query(
      'SELECT credit_balance FROM users WHERE id = $1 FOR UPDATE',
      [directorUserId]
    );
    const currentBalance = userResult.rows[0]?.credit_balance || 0;

    if (currentBalance < competitorCount) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `Insufficient credits. Need ${competitorCount}, have ${currentBalance}.`,
        balance: currentBalance,
      };
    }

    // Deduct
    const newBalance = currentBalance - competitorCount;
    await client.query(
      'UPDATE users SET credit_balance = $1 WHERE id = $2',
      [newBalance, directorUserId]
    );

    // Log one transaction per competitor/registration
    for (let i = 0; i < registrationIds.length; i++) {
      const balanceAfter = currentBalance - (i + 1);
      await client.query(
        `INSERT INTO credit_transactions
          (user_id, amount, balance_after, type, description, tournament_id, registration_id)
         VALUES ($1, $2, $3, 'usage', $4, $5, $6)`,
        [directorUserId, -1, balanceAfter, description || 'Registration credit usage', tournamentId, registrationIds[i]]
      );
    }

    await client.query('COMMIT');
    return { success: true, newBalance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Refund a credit when registration is cancelled.
 */
async function refundCredit(directorUserId, tournamentId, registrationId, description) {
  return addCredits(directorUserId, 1, 'refund', description || 'Registration credit refund', {
    tournamentId,
    registrationId,
  });
}

/**
 * Get transaction history for a user.
 */
async function getTransactions(userId, { limit = 50, offset = 0 } = {}) {
  const result = await pool.query(
    `SELECT ct.*,
            t.name AS tournament_name
     FROM credit_transactions ct
     LEFT JOIN tournaments t ON t.id = ct.tournament_id
     WHERE ct.user_id = $1
     ORDER BY ct.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

/**
 * Check if a director has enough credits for a registration.
 */
async function hasEnoughCredits(directorUserId, requiredCredits) {
  const balance = await getBalance(directorUserId);
  return balance >= requiredCredits;
}

module.exports = {
  getBalance,
  addCredits,
  deductForRegistration,
  refundCredit,
  getTransactions,
  hasEnoughCredits,
};
