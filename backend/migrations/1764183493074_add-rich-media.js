exports.up = (pgm) => {
    // 1. Update messages table to support new types
    // We need to drop the existing check constraint and add a new one
    pgm.dropConstraint('messages', 'messages_message_type_check');
    pgm.addConstraint('messages', 'messages_message_type_check', {
        check: "message_type IN ('text', 'image', 'video', 'audio', 'file', 'poll', 'location', 'sticker', 'gif', 'youtube', 'system')"
    });

    // 2. Create poll_votes table
    pgm.createTable('poll_votes', {
        id: 'id',
        poll_id: {
            type: 'uuid',
            notNull: true,
            references: '"messages"',
            onDelete: 'CASCADE',
        },
        user_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE',
        },
        option_index: {
            type: 'integer',
            notNull: true,
        },
        created_at: {
            type: 'timestamp with time zone',
            default: pgm.func('current_timestamp'),
        },
    });

    // Add unique constraint to prevent multiple votes per user per poll (for single choice)
    // For multiple choice, we'll handle logic in application or allow multiple rows
    // Let's enforce unique(poll_id, user_id, option_index) to prevent duplicate votes for same option
    pgm.addConstraint('poll_votes', 'unique_poll_vote', {
        unique: ['poll_id', 'user_id', 'option_index']
    });

    // Index for counting votes
    pgm.createIndex('poll_votes', ['poll_id', 'option_index']);
};

exports.down = (pgm) => {
    pgm.dropTable('poll_votes');
    pgm.dropConstraint('messages', 'messages_message_type_check');
    pgm.addConstraint('messages', 'messages_message_type_check', {
        check: "message_type IN ('text', 'image', 'file', 'system')"
    });
};
