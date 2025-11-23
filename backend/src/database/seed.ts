import pool from '../config/database';
import bcrypt from 'bcrypt';

async function seed() {
  try {
    console.log('Starting database seeding...');

    // Check if seed data already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@test.com']
    );

    if (existingUser.rows.length > 0) {
      console.log('Seed data already exists. Skipping seeding.');
      console.log('\nTest credentials:');
      console.log('Admin: admin@test.com / password123');
      console.log('Member: member@test.com / password123');
      process.exit(0);
      return;
    }

    // Create a test organization
    const orgResult = await pool.query(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
      ['Test Organization']
    );
    const orgId = orgResult.rows[0].id;

    // Create test users
    const passwordHash = await bcrypt.hash('password123', 10);

    const user1Result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
      ['admin@test.com', passwordHash, 'Admin User']
    );
    const user1Id = user1Result.rows[0].id;

    const user2Result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
      ['member@test.com', passwordHash, 'Member User']
    );
    const user2Id = user2Result.rows[0].id;

    // Add users to organization
    await pool.query(
      'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)',
      [orgId, user1Id, 'admin']
    );
    await pool.query(
      'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)',
      [orgId, user2Id, 'member']
    );

    // Create a sample task
    const taskResult = await pool.query(
      `INSERT INTO tasks (organization_id, title, details, assigned_user_id, created_by_id, start_date, end_date, schedule_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        orgId,
        'Complete Project Setup',
        'Set up the initial project structure and database',
        user2Id,
        user1Id,
        new Date(),
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        'one_time',
        'in_progress'
      ]
    );
    const taskId = taskResult.rows[0].id;

    // Add task requirements
    await pool.query(
      'INSERT INTO task_requirements (task_id, description, order_index) VALUES ($1, $2, $3)',
      [taskId, 'Initialize backend project', 0]
    );
    await pool.query(
      'INSERT INTO task_requirements (task_id, description, order_index) VALUES ($1, $2, $3)',
      [taskId, 'Set up database schema', 1]
    );
    await pool.query(
      'INSERT INTO task_requirements (task_id, description, order_index) VALUES ($1, $2, $3)',
      [taskId, 'Create API endpoints', 2]
    );

    console.log('Database seeding completed successfully!');
    console.log('\nTest credentials:');
    console.log('Admin: admin@test.com / password123');
    console.log('Member: member@test.com / password123');

    process.exit(0);
  } catch (error) {
    console.error('Database seeding failed:', error);
    process.exit(1);
  }
}

seed();
