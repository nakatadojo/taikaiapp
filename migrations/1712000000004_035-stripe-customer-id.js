exports.up = (pgm) => {
  pgm.addColumns('users', {
    stripe_customer_id: { type: 'varchar(255)', default: null },
  });
  pgm.createIndex('users', 'stripe_customer_id', {
    name: 'idx_users_stripe_customer_id',
    where: 'stripe_customer_id IS NOT NULL',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('users', 'stripe_customer_id', { name: 'idx_users_stripe_customer_id' });
  pgm.dropColumns('users', ['stripe_customer_id']);
};
