exports.up = (pgm) => {
    // 1. Create friend_requests table
    pgm.createTable('friend_requests', {
        id: 'id',
        sender_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE',
        },
        receiver_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE',
        },
        status: {
            type: 'varchar(20)',
            notNull: true,
            default: 'pending',
            check: "status IN ('pending', 'accepted', 'rejected')",
        },
        created_at: {
            type: 'timestamp with time zone',
            default: pgm.func('current_timestamp'),
        },
        updated_at: {
            type: 'timestamp with time zone',
            default: pgm.func('current_timestamp'),
        },
    });

    // Unique constraint: prevent duplicate requests between same pair
    pgm.addConstraint('friend_requests', 'unique_request', {
        unique: ['sender_id', 'receiver_id']
    });

    pgm.createIndex('friend_requests', ['sender_id']);
    pgm.createIndex('friend_requests', ['receiver_id']);
    pgm.createIndex('friend_requests', ['status']);

    // 2. Create contacts table
    pgm.createTable('contacts', {
        id: 'id',
        user_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE',
        },
        contact_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE',
        },
        room_id: {
            type: 'integer',
            references: '"rooms"',
            onDelete: 'SET NULL',
        },
        created_at: {
            type: 'timestamp with time zone',
            default: pgm.func('current_timestamp'),
        },
    });

    // Unique constraint: user can't add same contact twice
    pgm.addConstraint('contacts', 'unique_contact', {
        unique: ['user_id', 'contact_id']
    });

    pgm.createIndex('contacts', ['user_id']);
};

exports.down = (pgm) => {
    pgm.dropTable('contacts');
    pgm.dropTable('friend_requests');
};
