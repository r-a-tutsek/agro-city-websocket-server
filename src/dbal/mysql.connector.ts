import { container, singleton } from 'tsyringe';
import * as mysql from 'mysql2/promise';
import DbConnector from './interfaces/db-connector.interface';
import LoggerService from '../app/services/logger.service';

@singleton()
export default class MysqlConnector implements DbConnector {

    private loggerService: LoggerService;

    constructor() {
        this.loggerService = container.resolve(LoggerService);
    }

    async getConnection(): Promise<mysql.Connection | null> {
        try {
            return await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME
            });
        } catch(error: any) {
            this.loggerService.error('DB: Failed to create new connection, reason: ' + error?.message);
            return null;
        }
    }
}