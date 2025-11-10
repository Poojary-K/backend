'use strict';

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  // Add amount column to causes (nullable for backward compatibility)
  pgm.addColumn('causes', {
    amount: { type: 'numeric(12,2)' },
  });

  // If targetamount exists, seed amount from targetamount when amount is null
  pgm.sql(`
    UPDATE causes
    SET amount = COALESCE(amount, targetamount)
    WHERE amount IS NULL
  `);

  // Update view to use causes.amount as total donations
  pgm.sql(`
    CREATE OR REPLACE VIEW fundstatusview AS
    SELECT 
      COALESCE(SUM(c.amount), 0) AS totalcontributions,
      COALESCE(SUM(cs.amount), 0) AS totaldonations,
      COALESCE(SUM(c.amount), 0) - COALESCE(SUM(cs.amount), 0) AS availablefunds
    FROM contributions c
    FULL OUTER JOIN causes cs ON TRUE
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  // Revert view to targetamount
  pgm.sql(`
    CREATE OR REPLACE VIEW fundstatusview AS
    SELECT 
      COALESCE(SUM(c.amount), 0) AS totalcontributions,
      COALESCE(SUM(cs.targetamount), 0) AS totaldonations,
      COALESCE(SUM(c.amount), 0) - COALESCE(SUM(cs.targetamount), 0) AS availablefunds
    FROM contributions c
    FULL OUTER JOIN causes cs ON TRUE
  `);
  // Drop amount column
  pgm.dropColumn('causes', 'amount');
};

