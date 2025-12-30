'use strict';

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('contribution_images', {
    imageid: 'id',
    contributionid: {
      type: 'integer',
      notNull: true,
      references: 'contributions',
      onDelete: 'CASCADE',
    },
    url: { type: 'text', notNull: true },
    createdat: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('contribution_images', 'contributionid');

  pgm.createTable('cause_images', {
    imageid: 'id',
    causeid: {
      type: 'integer',
      notNull: true,
      references: 'causes',
      onDelete: 'CASCADE',
    },
    url: { type: 'text', notNull: true },
    createdat: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('cause_images', 'causeid');
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('cause_images');
  pgm.dropTable('contribution_images');
};
