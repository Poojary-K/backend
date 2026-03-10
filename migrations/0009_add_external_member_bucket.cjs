'use strict';

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO members (name, email, phone, password, is_admin, email_verified, email_verified_at)
    SELECT 'External', NULL, NULL, '[EXTERNAL_MEMBER_DISABLED]', FALSE, TRUE, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (
      SELECT 1
      FROM members
      WHERE lower(name) = 'external' AND email IS NULL
    );
  `);

  pgm.sql(`
    WITH canonical AS (
      SELECT MIN(memberid) AS memberid
      FROM members
      WHERE lower(name) = 'external' AND email IS NULL
    ),
    duplicate_members AS (
      SELECT m.memberid
      FROM members m
      CROSS JOIN canonical c
      WHERE lower(m.name) = 'external'
        AND m.email IS NULL
        AND m.memberid <> c.memberid
    )
    UPDATE contributions
    SET memberid = (SELECT memberid FROM canonical)
    WHERE memberid IN (SELECT memberid FROM duplicate_members);
  `);

  pgm.sql(`
    DELETE FROM members
    WHERE memberid IN (
      SELECT m.memberid
      FROM members m
      JOIN (
        SELECT MIN(memberid) AS memberid
        FROM members
        WHERE lower(name) = 'external' AND email IS NULL
      ) canonical ON TRUE
      WHERE lower(m.name) = 'external'
        AND m.email IS NULL
        AND m.memberid <> canonical.memberid
    );
  `);

  pgm.createIndex('members', 'name', {
    name: 'members_external_singleton_idx',
    unique: true,
    where: `email IS NULL AND lower(name) = 'external'`,
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropIndex('members', 'name', {
    name: 'members_external_singleton_idx',
    ifExists: true,
  });
};
