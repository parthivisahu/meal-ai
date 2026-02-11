import pool from './src/config/database.js';

async function testConnection() {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    console.log('✅ Database test successful:', rows[0].result);
    
    const [tables] = await pool.query('SHOW TABLES');
    console.log('📊 Available tables:', tables);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    process.exit(1);
  }
}

testConnection();