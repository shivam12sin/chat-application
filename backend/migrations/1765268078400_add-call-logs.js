exports.up = (pgm) => {
    pgm.createTable('call_logs', {
        id: 'id',
        room_id: {
            type: 'integer',
            references: '"rooms"',
            onDelete: 'SET NULL',
        },
        caller_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'SET NULL',
        },
        callee_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'SET NULL',
        },
        call_type: {
            type: 'varchar(10)',
            check: "call_type IN ('voice', 'video')",
        },
        status: {
            type: 'varchar(20)',
            check: "status IN ('missed', 'rejected', 'completed')",
        },
        started_at: {
            type: 'timestamp with time zone',
        },
        ended_at: {
            type: 'timestamp with time zone',
        },
        duration_seconds: {
            type: 'integer',
            default: 0,
        },
        created_at: {
            type: 'timestamp with time zone',
            default: pgm.func('current_timestamp'),
        },
    });

    pgm.createIndex('call_logs', ['room_id']);
    pgm.createIndex('call_logs', ['caller_id', 'callee_id']);
};

exports.down = (pgm) => {
    pgm.dropTable('call_logs');
};
