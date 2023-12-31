
import { autoInjectable } from 'tsyringe';
import MysqlConnector from '../../dbal/mysql.connector';

@autoInjectable()
export default class DeviceRepository {

    private dbConnector: MysqlConnector;

    constructor() {
        this.dbConnector = new MysqlConnector();
    }

    getDeviceByUsernameAndPassword = async (username?: string, password?: string) => {
        const [connection, isPool] = await this.dbConnector.getConnection();

        const result = connection.query('SELECT d.uid, uc.username FROM user_credentials uc JOIN devices d ON uc.device_id = d.id WHERE uc.username = ? AND uc.password = ?', [username, password]);

        if (isPool) {
            connection.release();
        }

        return result;
    }
}