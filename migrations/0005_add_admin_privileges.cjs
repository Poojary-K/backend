'use strict';

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.addColumn('members', {
    is_admin: { type: 'boolean', notNull: true, default: false },
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropColumn('members', 'is_admin');
};





