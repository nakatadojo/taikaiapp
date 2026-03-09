exports.up = async (pgm) => {
  pgm.addColumn('tournaments', {
    currency: {
      type: 'varchar(3)',
      default: "'USD'",
      notNull: true,
    },
    weight_unit: {
      type: 'varchar(3)',
      default: "'kg'",
      notNull: true,
    },
  });
};

exports.down = async (pgm) => {
  pgm.dropColumn('tournaments', ['currency', 'weight_unit']);
};
