exports.up = (pgm) => {
    pgm.addConstraint('users', 'users_username_key', {
        unique: ['username'],
    });
};

exports.down = (pgm) => {
    pgm.dropConstraint('users', 'users_username_key');
};
