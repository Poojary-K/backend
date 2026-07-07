'use strict';

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('chat_sessions', {
    session_id: 'id',
    member_id: {
      type: 'integer',
      notNull: true,
      references: 'members',
      referencesConstraintName: 'chat_sessions_member_id_fkey',
      onDelete: 'CASCADE',
    },
    title: { type: 'varchar(200)', notNull: true, default: 'New chat' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    archived_at: { type: 'timestamptz', notNull: false },
  });
  // Fast lookup of a member's active sessions, newest first.
  pgm.createIndex('chat_sessions', ['member_id', { name: 'updated_at', sort: 'DESC' }], {
    name: 'chat_sessions_member_updated_idx',
    where: 'archived_at IS NULL',
  });

  pgm.createTable('chat_messages', {
    message_id: 'id',
    session_id: {
      type: 'integer',
      notNull: true,
      references: 'chat_sessions',
      onDelete: 'CASCADE',
    },
    role: { type: 'varchar(20)', notNull: true },
    content: { type: 'text', notNull: true },
    tool_calls: { type: 'jsonb', notNull: false },
    tool_name: { type: 'varchar(100)', notNull: false },
    tool_call_id: { type: 'varchar(100)', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.addConstraint('chat_messages', 'chat_messages_role_check', {
    check: "role IN ('user', 'assistant', 'tool')",
  });
  pgm.createIndex('chat_messages', ['session_id', 'created_at'], {
    name: 'chat_messages_session_created_idx',
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('chat_messages');
  pgm.dropTable('chat_sessions');
};
