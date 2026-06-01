exports.up = (pgm) => {
    // Rooms table updates
    pgm.addColumns('rooms', {
        type: {
            type: 'varchar(20)',
            default: 'direct',
            check: "type IN ('direct', 'group')", // 'group' represents a Space
        },
        description: {
            type: 'text',
        },
        tone: {
            type: 'varchar(20)',
            default: 'social', // 'social', 'focus', 'work', 'private'
        },
        settings: {
            type: 'jsonb',
            default: '{}', // For quiet hours, etc.
        },
        owner_id: {
            type: 'integer',
            references: '"users"',
            onDelete: 'SET NULL',
        },
    });

    // Messages table updates
    pgm.addColumns('messages', {
        is_pinned: {
            type: 'boolean',
            default: false,
        },
    });

    // Index for finding spaces by owner
    pgm.createIndex('rooms', 'owner_id');
    // Index for finding pinned messages in a room
    pgm.createIndex('messages', ['room_id', 'is_pinned']);
};

exports.down = (pgm) => {
    pgm.dropColumns('messages', ['is_pinned']);
    pgm.dropColumns('rooms', ['type', 'description', 'tone', 'settings', 'owner_id']);
};
