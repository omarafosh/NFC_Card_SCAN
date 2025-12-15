import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'nfc_discount_system',
        multipleStatements: true, // Needed to run the schema script
        ssl: {
            rejectUnauthorized: false
        }
    };

    console.log(`Connecting to MySQL at ${config.host} as ${config.user}...`);

    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('Connected to MySQL server.');

        // Read schema.sql
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema migration...');
        await connection.query(schemaSql);
        console.log('Database and tables created successfully.');

        console.log('Database initialized!');
        process.exit(0);

    } catch (err) {
        console.error('Database initialization failed:', err);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

initDb();
