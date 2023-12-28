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

@autoInjectable()
export default class SocketEventHandler {

    constructor(
        private commonService: CommonService,
        private cryptoService: CryptoService,
        private rabbitMqService: RabbitMqService,
        private deviceRepository: DeviceRepository
    ) {}

    async handleUpgrade(request: IncomingMessage, socket: internal.Duplex, head: Buffer): Promise<[boolean] | [boolean, string]> {
        if (!request?.headers['user-agent'] || !request?.headers['authorization']) {
            return [false];
        }

        const authHeaderParts = this.commonService.decodeBasicAuthHeader(request?.headers['authorization']);

        if (!authHeaderParts || !authHeaderParts?.username || !authHeaderParts?.password) {
            return [false];
        }

        const deviceType = this.commonService.decodeUserAgentHeader(request.headers['user-agent']);

        if (!deviceType) {
            return [false];
        }

        const device: any = await this.deviceRepository.getDeviceByUsernameAndPassword(authHeaderParts.username, authHeaderParts.password);

        if (!device || device.length === 0) {
            return [false];
        }

        return [true, authHeaderParts.username];
    }

    async handleConnection(webSocket: any, username: string, dbConnector: DbConnector) {
        const deviceUid = this.cryptoService.generateSHA1Hash(username);
        const [dbConnection, isPool] = await dbConnector.getConnection();

        webSocket.uid = deviceUid;
        webSocket.username = username;
        webSocket.dbConnection = { instance: dbConnection, isPool: isPool };
        webSocket.rabbitMqChannel = this.rabbitMqService.createChannel(deviceUid, (message: string) => webSocket.send(message));

        webSocket.rabbitMqChannel?.waitForConnect().then(function() {
            console.log('Listening for RABBIT MQ messages!');
        });

        webSocket.on('message', (data: WebSocket.Data) => {
            console.log('RECEIVING MESSAGE!');

            try {
                let dataIn = data?.toString();

                if (dataIn) {
                    /*if (!process.env.AES128_SECURITY_KEY) {
                        throw 'Security key is missing in config!';
                    }

                    if (process.env.USE_ENCRYPTION && parseInt(process.env.USE_ENCRYPTION) === 1) {
                        dataIn = this.commonService.decrypt(Buffer.from(dataIn, 'base64'), process.env.AES128_SECURITY_KEY, 'utf8');
                    }*/

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
                            webSocket.send('COMMAND_NOT_IMPLEMENTED');
                            return;
                        }

                        new MessageEventHandler(messageClass).handle(webSocket, packageParams);
                    }
                }

                console.log('MESSAGE RECEIVED: ', dataIn);
            } catch(error) {
                console.log(error);
            }
        });

        webSocket.on('close', async () => {
            if (webSocket?.dbConnection) {
                // Instanceof does not want to work for some reason, so this is forced...
                if (webSocket?.dbConnection.isPool) {
                    webSocket.dbConnection.instance.release();
                } else {
                    webSocket.dbConnection.instance.end();
                }
            }

            if (webSocket?.rabbitMqChannel) {
                webSocket.rabbitMqChannel.close();
            }
        });

        webSocket.on('error', (error: any) => {
            console.log('Socket error:', error.message);
            webSocket.terminate();
        });
    }

    handleError(error: any) {
        console.error('Webocket server error: ', error);
    }
}