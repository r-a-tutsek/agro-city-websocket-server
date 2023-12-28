import { singleton } from 'tsyringe';
import winston, { Logger } from 'winston';
import 'winston-daily-rotate-file';

@singleton()
export default class LoggerService {

    private logger: Logger;

    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [
                new winston.transports.DailyRotateFile({
                    filename: 'logs/application/application-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '14d',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    ),
                }),
            ],
        });
    }

    public info(message: string): void {
        this.logger.info(message);
    }

    public warn(message: string): void {
        this.logger.warn(message);
    }

    public error(message: string): void {
        this.logger.error(message);
    }
}