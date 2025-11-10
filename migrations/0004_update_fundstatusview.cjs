'use strict';

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE VIEW fundstatusview AS
    SELECT
      COALESCE((SELECT SUM(amount) FROM contributions), 0) AS totalcontributions,
      COALESCE((SELECT SUM(amount) FROM causes), 0) AS totaldonations,
      COALESCE((SELECT SUM(amount) FROM contributions), 0)
        - COALESCE((SELECT SUM(amount) FROM causes), 0) AS availablefunds
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  // Revert to previous definition using causes.amount join form
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

