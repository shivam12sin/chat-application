exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('users', {
        two_factor_enabled: { type: 'boolean', default: false },
        two_factor_method: { type: 'varchar(20)', default: null }, // 'totp' or 'email'
        two_factor_secret: { type: 'varchar(255)', default: null },
        two_factor_secret_expires_at: { type: 'timestamp', default: null },
        two_factor_backup_codes: { type: 'jsonb', default: '[]' }
    });
};

exports.down = pgm => {
    pgm.dropColumns('users', [
        'two_factor_enabled',
        'two_factor_method',
        'two_factor_secret',
        'two_factor_secret_expires_at',
        'two_factor_backup_codes'
    ]);
};
