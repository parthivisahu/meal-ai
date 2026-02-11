import pool from './database.js';

const setupCartDB = async () => {
  try {
    console.log('Setting up cart tables...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_attempts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        meal_plan_id INT NOT NULL,
        platform VARCHAR(50) NOT NULL,
        items_added INT DEFAULT 0,
        items_failed INT DEFAULT 0,
        status ENUM('pending_payment', 'completed', 'failed', 'cancelled') DEFAULT 'pending_payment',
        total_amount DECIMAL(10, 2) DEFAULT NULL,
        order_id VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE,
        INDEX idx_user_orders (user_id, created_at),
        INDEX idx_platform (platform),
        INDEX idx_status (status)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_attempt_id INT NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        quantity VARCHAR(50) DEFAULT '1 unit',
        price DECIMAL(10, 2) DEFAULT NULL,
        added_to_cart BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_attempt_id) REFERENCES order_attempts(id) ON DELETE CASCADE,
        INDEX idx_order_items (order_attempt_id)
      );
    `);

    console.log('✅ Cart tables created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to setup cart tables:', error);
    process.exit(1);
  }
};

setupCartDB();
