#!/usr/bin/env node

/**
 * CLI script to create the first admin user.
 * Usage: npm run create-admin -- --email admin@example.com --password YourPassword123
 *
 * Creates a user with email_verified = true and assigns the 'admin' role.
 * Optionally assigns additional roles with --roles competitor,coach
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../server/db/pool');
const userQueries = require('../server/db/queries/users');
const roleQueries = require('../server/db/queries/roles');

const BCRYPT_ROUNDS = 12;

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value) {
      parsed[key] = value;
    }
  }

  return parsed;
}

function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('at least one lowercase letter');
  if (!/\d/.test(password)) errors.push('at least one digit');
  return errors;
}

async function main() {
  const args = parseArgs();

  if (!args.email || !args.password) {
    console.error('Usage: npm run create-admin -- --email <email> --password <password> [--roles competitor,coach]');
    console.error('       --firstName and --lastName are optional (default: "Admin")');
    process.exit(1);
  }

  // Validate password strength
  const pwErrors = validatePassword(args.password);
  if (pwErrors.length > 0) {
    console.error('Password must have:', pwErrors.join(', '));
    process.exit(1);
  }

  try {
    // Check if user already exists
    const existing = await userQueries.findByEmail(args.email);
    if (existing) {
      // User exists — just add admin role
      console.log(`User ${args.email} already exists. Adding admin role...`);
      await roleQueries.addRole(existing.id, 'admin');
      console.log('✓ Admin role added successfully');
      await pool.end();
      process.exit(0);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(args.password, BCRYPT_ROUNDS);

    // Create user with email already verified
    const user = await userQueries.createVerified({
      email: args.email,
      passwordHash,
      firstName: args.firstName || 'Admin',
      lastName: args.lastName || 'User',
    });

    // Assign admin role
    const roles = ['admin'];

    // Add any additional roles specified
    if (args.roles) {
      const validRoles = ['competitor', 'coach', 'judge', 'assistant_coach'];
      const extraRoles = args.roles.split(',').filter(r => validRoles.includes(r.trim()));
      roles.push(...extraRoles);
    }

    await roleQueries.addRoles(user.id, roles);

    console.log(`\n✓ Admin user created successfully`);
    console.log(`  Email: ${user.email}`);
    console.log(`  ID:    ${user.id}`);
    console.log(`  Roles: ${roles.join(', ')}`);
    console.log(`  Email verified: yes (skip verification)\n`);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Failed to create admin:', err.message);
    await pool.end();
    process.exit(1);
  }
}

main();
