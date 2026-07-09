'use strict';

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('chat_pending_tasks', {
    pending_id: 'id',
    session_id: {
      type: 'integer',
      notNull: true,
      references: 'chat_sessions',
      onDelete: 'CASCADE',
    },
    member_id: {
      type: 'integer',
      notNull: true,
      references: 'members',
      onDelete: 'CASCADE',
    },
    action_type: { type: 'varchar(50)', notNull: true },
    payload: { type: 'jsonb', notNull: true },
    summary: { type: 'text', notNull: true },
    status: { type: 'varchar(30)', notNull: true, default: 'awaiting_confirmation' },
    expires_at: { type: 'timestamptz', notNull: true },
    executed_at: { type: 'timestamptz', notNull: false },
    result: { type: 'jsonb', notNull: false },
    superseded_by: {
      type: 'integer',
      notNull: false,
      references: 'chat_pending_tasks',
      onDelete: 'SET NULL',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('chat_pending_tasks', 'chat_pending_tasks_status_check', {
    check: "status IN ('awaiting_confirmation', 'confirmed', 'executed', 'rejected', 'superseded', 'expired', 'failed')",
  });

  // At most one active pending task per session.
  pgm.createIndex('chat_pending_tasks', 'session_id', {
    name: 'chat_pending_tasks_one_active_per_session_idx',
    unique: true,
    where: "status = 'awaiting_confirmation'",
  });

  pgm.createIndex('chat_pending_tasks', [{ name: 'member_id' }, { name: 'created_at', sort: 'DESC' }], {
    name: 'chat_pending_tasks_member_created_idx',
  });

  pgm.createIndex('chat_pending_tasks', ['session_id', 'status'], {
    name: 'chat_pending_tasks_session_status_idx',
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('chat_pending_tasks');
};
