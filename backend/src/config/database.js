import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'meal_planner_db',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
};

console.log(`📡 Attempting to connect to DB at ${dbConfig.host}:${dbConfig.port}...`);

const pool = mysql.createPool(dbConfig);

// Test the connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

export default pool;
