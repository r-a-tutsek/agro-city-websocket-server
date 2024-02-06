import { IncomingMessage } from 'http';
import internal from 'stream';
import { autoInjectable } from 'tsyringe';
import CommonService from '../services/common.service';
import DeviceRepository from '../repositories/device.repository';
import CryptoService from '../services/crypto.service';
import DbConnector from '../../dbal/interfaces/db-connector.interface';
import WebSocket from 'ws';
import RabbitMqService from '../services/rabbit-mq.service';
import MessageEventHandler from './message-event.handler';
import { ConfigGetHandler, ConfigHandler, DataHandler, InfoHandler, LogHandler, StatusHandler } from './handlers';
import LoggerService from '../services/logger.service';

@autoInjectable()
export default class SocketEventHandler {

    constructor(
        private commonService: CommonService,
        private cryptoService: CryptoService,
        private rabbitMqService: RabbitMqService,
        private loggerService: LoggerService,
        private deviceRepository: DeviceRepository,
    ) {}

    async handleUpgrade(request: IncomingMessage, socket: internal.Duplex, head: Buffer): Promise<[boolean] | [boolean, string]> {
        this.loggerService.info('UPGRADE: Started handle upgrade.');

        if (!request?.headers['user-agent'] || !request?.headers['authorization']) {
            this.loggerService.warn('UPGRADE: Failed, missing user-agent or authorization headers.');
            return [false];
        }

        const authHeaderParts = this.commonService.decodeBasicAuthHeader(request?.headers['authorization']);

        if (!authHeaderParts || !authHeaderParts?.username || !authHeaderParts?.password) {
            this.loggerService.warn('UPGRADE: Failed, decoded header parts username or password is empty.');
            return [false];
        }

        const deviceType = this.commonService.decodeUserAgentHeader(request.headers['user-agent']);

        if (!deviceType) {
            this.loggerService.warn('UPGRADE: Failed, decoded user-agent header device type is empty.');
            return [false];
        }

        const device: any = await this.deviceRepository.getDeviceByUsernameAndPassword(authHeaderParts.username, authHeaderParts.password);

        if (!device || device.length === 0) {
            this.loggerService.warn('UPGRADE: Device was not found with the following username: ' + authHeaderParts.username + '.');
            return [false] ;
        }

        this.loggerService.info('UPGRADE: Verification passed for username: ' + authHeaderParts.username);

        return [true, authHeaderParts.username];
    }

    async handleConnection(webSocket: any, username: string, dbConnector: DbConnector) {
        const deviceUid = this.cryptoService.generateSHA1Hash(username);
        const dbConnection = await dbConnector.getConnection();

        if (!dbConnection) {
            webSocket.send('TOO_MANY_CONNECTIONS');
            webSocket.terminate();
            return;
        }

        webSocket.uid = deviceUid;
        webSocket.username = username;
        webSocket.dbConnection = dbConnection;
        webSocket.rabbitMqChannel = this.rabbitMqService.createChannel(deviceUid, (message: string) => {
            if (!process.env.OUTPUT_AES128_SECURITY_KEY) {
                throw 'Output Security key is missing in config!';
            }

            webSocket.send(process.env.ENCRYPT_OUTPUT && parseInt(process.env.ENCRYPT_OUTPUT) === 1 ? this.commonService.encrypt(message, process.env.OUTPUT_AES128_SECURITY_KEY, 'utf8') : message);
        });

        webSocket.rabbitMqChannel?.waitForConnect().then(() => {
            this.loggerService.info('RABBITMQ: Started Channel and listening messages for username: ' + webSocket?.username + ', on Channel: ' + webSocket?.uid);
        });

        webSocket.on('message', (data: WebSocket.Data) => {
            try {
                let dataIn = data?.toString();

                if (!dataIn) {
                    this.loggerService.info('WEBSOCKET: Empty message received for username: ' + webSocket?.username);
                    return;
                }

                if (!process.env.INPUT_AES128_SECURITY_KEY) {
                    throw 'Input Security key is missing in config!';
                }

                if (process.env.DECRYPT_INPUT && parseInt(process.env.DECRYPT_INPUT) === 1) {
                    dataIn = this.commonService.decrypt(Buffer.from(dataIn, 'base64'), process.env.INPUT_AES128_SECURITY_KEY, 'utf8');
                }

                const decodedDataIn = this.commonService.tryJsonDecode(dataIn);

                if (decodedDataIn && typeof decodedDataIn === 'object') {
                    const packageType = Object.keys(decodedDataIn).at(0) ?? '';

                    const packageParams = decodedDataIn[packageType] ?? [];
                    
                    const messageClassName: any = (packageType.toLowerCase() === 'command' ? packageParams : packageType) + 'Handler';

                    const classMap: { [key: string]: any } = {
                        ConfigGetHandler,
                        ConfigHandler,
                        DataHandler,
                        LogHandler,
                        InfoHandler,
                        StatusHandler
                    };

                    const messageClass = Object.keys(classMap).includes(messageClassName) ? new classMap[messageClassName] : null;

                    if (!messageClass) {
                        this.loggerService.error('WEBSOCKET: Command / Package Type handling is not implemented: ' + messageClassName);
                        webSocket.send('COMMAND_NOT_IMPLEMENTED');
                        return;
                    }

                    new MessageEventHandler(messageClass).handle(webSocket, packageParams);

                    this.loggerService.info('WEBSOCKET: Message handled.');
                }
            } catch(error: any) {
                this.loggerService.error('WEBSOCKET: An error occurred while receiving message through socket: ' + error.message);
            }
        });

        webSocket.on('close', async () => {
            if (webSocket?.dbConnection) {
                webSocket.dbConnection.end();

                this.loggerService.warn('WEBSOCKET: Closed Websocket DB Connection for username: ' + webSocket?.username);
            }

            if (webSocket?.rabbitMqChannel) {
                webSocket.rabbitMqChannel.close();

                this.loggerService.warn('WEBSOCKET: Closed Websocket Rabbit MQ channel for username: ' + webSocket?.username);
            }

            this.loggerService.warn('WEBSOCKET: Closing Websocket connection for username: ' + webSocket?.username);
        });

        webSocket.on('error', (error: any) => {
            this.loggerService.error('WEBSOCKET: An error occurred in a connected Websocket, terminating: ' + error.message);
            webSocket.terminate();
        });
    }

    handleError(error: any) {
        this.loggerService.error('WEBSOCKET SERVER: An error occurred in the Websocket Server: ' + error.message);
    }
}