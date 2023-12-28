import { autoInjectable } from 'tsyringe';
import fs from 'fs';
import moment from 'moment';

import { DeviceLog } from '../models/device-log';

@autoInjectable()
export default class DeviceService {

    saveDeviceLog(deviceLog: DeviceLog) {
        try {
            const currentDateTime = moment();

            const directoryPath: string = `${process.cwd()}/${process.env.LOG_FILES_RELATIVE_PATH}/${deviceLog.device}`;
            const filePath: string = `${directoryPath}/${currentDateTime.format(process.env.DATE_FORMAT)}.log`;
            const logMessage: string = `${currentDateTime.format(process.env.DATE_TIME_FORMAT)} [${deviceLog.logLevel}] ${JSON.stringify(deviceLog.message)}\n`;

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
}