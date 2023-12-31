import { container, singleton } from 'tsyringe';
import * as mysql from 'mysql2/promise';
import DbConnector from './interfaces/db-connector.interface';
import LoggerService from '../app/services/logger.service';

@singleton()
export default class MysqlConnector implements DbConnector {

    private connectionPool: mysql.Pool;
    private loggerService: LoggerService;

    constructor() {
        this.connectionPool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: false,
            connectionLimit: 100,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 30000
        });

        this.loggerService = container.resolve(LoggerService);
    }

    async getConnection(): Promise<any> {
        try {
            return [await this.connectionPool.getConnection(), true];
        } catch(error) {
            try {
                return [await mysql.createConnection({
                    host: process.env.DB_HOST,
                    user: process.env.DB_USER,
                    password: process.env.DB_PASSWORD,
                    database: process.env.DB_NAME
                }), false];
            } catch(error: any) {
                this.loggerService.error('DB: Failed to create new connection, reason: ' + error?.message);
                return [null, false];
            }
        }
    }
}