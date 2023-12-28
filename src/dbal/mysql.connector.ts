import dotenv from 'dotenv';
import { singleton } from 'tsyringe';
import * as mysql from 'mysql2/promise';
import DbConnector from './interfaces/db-connector.interface';

@singleton()
export default class MysqlConnector implements DbConnector {

    private connectionPool: mysql.Pool;

    constructor() {
        dotenv.config();

        this.connectionPool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: false,
            connectionLimit: 1,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 30000
        });
    }

    async getConnection(): Promise<any> {
        try {
            return [await this.connectionPool.getConnection(), true];
        } catch(error) {
            return [await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME
            }), false];
        }
    }

    async query(sql: string, values?: any[]): Promise<any> {
        const [connection, isPool] = await this.getConnection();

        try {
            const [results, fields] = await connection.query(sql, values);
            return results;
        } catch (error) {
            console.error('Error executing query:', error);
        } finally {
            connection.release();
        }
    }
}