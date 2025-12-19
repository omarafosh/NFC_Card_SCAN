import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function updateSchema() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'nfc_discount_system',
        multipleStatements: true,
        ssl: { rejectUnauthorized: false }
    };

    console.log(`Connecting to database...`);
    let connection;

    try {
        connection = await mysql.createConnection(config);
        console.log('Connected.');

        // 1. Create Settings Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_name VARCHAR(50) NOT NULL UNIQUE,
                value VARCHAR(255) NOT NULL,
                description VARCHAR(255),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        console.log('Checked table: settings');

        // Insert Default Settings if empty
        const [settings] = await connection.query('SELECT * FROM settings');
        if (settings.length === 0) {
            await connection.query(`
                INSERT INTO settings (key_name, value, description) VALUES 
                ('currency_symbol', 'SAR', 'Currency Symbol displayed in UI'),
                ('points_ratio', '10', 'Amount spent to earn 1 point (e.g. 10 = 1 point per 10 currency units)')
            `);
            console.log('Inserted default settings.');
        }

        // 2. Create Tiers Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tiers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                min_points INT NOT NULL,
                multiplier DECIMAL(3, 2) DEFAULT 1.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Checked table: tiers');

        // 3. Create Points Ledger
        await connection.query(`
            CREATE TABLE IF NOT EXISTS points_ledger (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                transaction_id INT,
                admin_id INT,
                points INT NOT NULL,
                reason VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Checked table: points_ledger');

        // 4. Update Discounts Table (Add Columns safely)
        try {
            await connection.query(`ALTER TABLE discounts ADD COLUMN start_date DATETIME AFTER points_required;`);
            console.log('Added start_date to discounts');
        } catch (e) { /* Ignore if exists */ }

        try {
            await connection.query(`ALTER TABLE discounts ADD COLUMN end_date DATETIME AFTER start_date;`);
            console.log('Added end_date to discounts');
        } catch (e) { /* Ignore if exists */ }

        // 5. Update Transactions Table
        try {
            await connection.query(`ALTER TABLE transactions ADD COLUMN points_earned INT DEFAULT 0 AFTER amount_after;`);
            console.log('Added points_earned to transactions');
        } catch (e) { /* Ignore if exists */ }

        console.log('Schema update complete!');
        process.exit(0);

    } catch (err) {
        console.error('Update failed:', err);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

updateSchema();
