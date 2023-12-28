
import { IncomingMessage } from 'http';
import internal from 'stream';
import { autoInjectable } from 'tsyringe';
import CommonService from '../services/common.service';
import DeviceRepository from '../repositories/device.repository';
import CryptoService from '../services/crypto.service';
import DbConnector from '../../dbal/interfaces/db-connector.interface';
import WebSocket from 'ws';
import RabbitMqService from '../services/rabbit-mq.service';

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
                const dataIn = data?.toString();

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