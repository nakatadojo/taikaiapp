exports.up = (pgm) => {
  pgm.addColumns('users', {
    timezone: { type: 'varchar(100)', default: 'America/New_York' },
  });
  pgm.addColumns('tournaments', {
    timezone: { type: 'varchar(100)', default: 'America/New_York' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('tournaments', ['timezone']);
  pgm.dropColumns('users', ['timezone']);
};
