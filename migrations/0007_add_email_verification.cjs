'use strict';

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.addColumns('members', {
    email_verified: { type: 'boolean', notNull: true, default: false },
    email_verified_at: { type: 'timestamp' },
    email_verification_token_hash: { type: 'text' },
    email_verification_expires_at: { type: 'timestamp' },
    email_verification_sent_at: { type: 'timestamp' },
  });

  // Soft enforcement: mark existing members as verified once.
  pgm.sql(`
    UPDATE members
    SET email_verified = TRUE,
        email_verified_at = CURRENT_TIMESTAMP;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropColumns('members', [
    'email_verified',
    'email_verified_at',
    'email_verification_token_hash',
    'email_verification_expires_at',
    'email_verification_sent_at',
  ]);
};
