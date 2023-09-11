import { autoInjectable } from 'tsyringe';
import mysql from 'mysql2/promise';
import fs from 'fs';
import moment from 'moment';

import { DeviceLog } from '../models/device-log';

@autoInjectable()
export default class DeviceService {

    getDeviceByUsernameAndPassword = async (connection: mysql.PoolConnection, username?: string, password?: string) => {
        return connection?.query('SELECT d.uid, uc.username FROM user_credentials uc JOIN devices d ON uc.device_id = d.id WHERE uc.username = ? AND uc.password = ?', [username, password]);
    }

    getDeviceConfigurationByUsername = async (connection: mysql.PoolConnection, username: string) => {
        return (await connection?.query('SELECT configuration FROM devices WHERE uid = ?', [username]))?.at(0);
    }

    updateDeviceConfigurationByUsername(connection: mysql.PoolConnection, username: string, configuration: string, updatedAt: string) {
        connection?.query('UPDATE devices SET configuration = ?, updated_at = ? WHERE uid = ?', [configuration, updatedAt, username]);
    }

    insertDeviceData(connection: mysql.PoolConnection, username: string, data: string, createdAt: number) {
        connection?.query('INSERT INTO tmp_device_data(device_uid, data, created_at) VALUES (?, ?, ?)', [username, data, createdAt]);
    }

    saveDeviceLog(deviceLog: DeviceLog) {
        try {
            const currentDateTime = moment();

            const directoryPath: string = `${process.cwd()}/${process.env.LOG_FILES_RELATIVE_PATH}/${deviceLog.device}`;
            const filePath: string = `${directoryPath}/${currentDateTime.format(process.env.DATE_FORMAT)}.log`;
            const logMessage: string = `${currentDateTime.format(process.env.DATE_TIME_FORMAT)} [${deviceLog.logLevel}] ${JSON.stringify(deviceLog.message)}\n`;

            console.log(directoryPath);

            if (!fs.existsSync(directoryPath)) {
                fs.mkdirSync(directoryPath, { recursive: true });
            }

            if (fs.existsSync(filePath)) {
                fs.appendFileSync(filePath, logMessage)
            } else {
                fs.writeFileSync(filePath, logMessage);
            }

            return true;
        } catch(error) {
            throw error;
        }
    }

    insertDeviceInfo(connection: mysql.PoolConnection, username: string, data: string, createdAt: string) {
        connection.query('INSERT INTO device_info(device_uid, message, created_at) VALUES (?, ?, ?)', [username, data, createdAt]);
    }

    insertDeviceStatus(connection: mysql.PoolConnection, username: string, data: string, createdAt: string) {
        connection.query('INSERT INTO device_status(device_uid, message, created_at) VALUES (?, ?, ?)', [username, data, createdAt])
    }
}