'use strict';

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  // Remove targetamount from causes; view already uses amount
  pgm.dropColumn('causes', 'targetamount', { ifExists: true });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  // Re-add targetamount (nullable) if needed on rollback
  pgm.addColumn('causes', {
    targetamount: { type: 'numeric(12,2)' },
  });
};

