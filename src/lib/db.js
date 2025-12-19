import mysql from 'mysql2/promise';

// Database SSL configuration
const sslConfig = process.env.NODE_ENV === 'production'
    ? (process.env.DB_SSL_CA
        ? {
            rejectUnauthorized: true,
            ca: process.env.DB_SSL_CA
        }
        : { rejectUnauthorized: true })
    : false; // Disable SSL in development for easier local setup

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nfc_discount_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: sslConfig
});

export default pool;
