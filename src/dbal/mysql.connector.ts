import dotenv from 'dotenv';
import { singleton } from 'tsyringe';
import * as mysql from 'mysql2/promise';

@singleton()
export default class MysqlConnector {

    private connectionConfig: mysql.ConnectionOptions;

    constructor() {
        dotenv.config();

        this.connectionConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectionLimit: 50
        };
    }

    async createPool() {
        return mysql.createPool(this.connectionConfig);
    }
}