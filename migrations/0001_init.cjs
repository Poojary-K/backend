'use strict';

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable(
    'members',
    {
      memberid: 'id',
      name: { type: 'varchar(100)', notNull: true },
      email: { type: 'varchar(100)', unique: true },
      phone: { type: 'varchar(15)' },
      password: { type: 'varchar(255)', notNull: true },
      joinedon: { type: 'date', default: pgm.func('CURRENT_DATE') },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'contributions',
    {
      contributionid: 'id',
      memberid: { type: 'integer', notNull: true, references: 'members(memberid)' },
      amount: { type: 'numeric(10,2)', notNull: true },
      contributeddate: { type: 'date', notNull: true },
      createdat: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'causes',
    {
      causeid: 'id',
      title: { type: 'varchar(150)', notNull: true },
      description: { type: 'text' },
      targetamount: { type: 'numeric(12,2)' },
      createdat: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    },
    { ifNotExists: true }
  );

  pgm.sql(`
    CREATE OR REPLACE VIEW fundstatusview AS
    SELECT 
      COALESCE(SUM(c.amount), 0) AS totalcontributions,
      COALESCE(SUM(cs.targetamount), 0) AS totaldonations,
      COALESCE(SUM(c.amount), 0) - COALESCE(SUM(cs.targetamount), 0) AS availablefunds
    FROM contributions c
    FULL OUTER JOIN causes cs ON TRUE
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql('DROP VIEW IF EXISTS fundstatusview');
  pgm.dropTable('contributions', { ifExists: true });
  pgm.dropTable('causes', { ifExists: true });
  pgm.dropTable('members', { ifExists: true });
};

