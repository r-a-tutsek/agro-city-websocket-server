import "reflect-metadata";
import { createServer, Server } from 'http';
import WebSocket from 'ws';
import { connect, Connection } from 'amqplib';
import { container } from 'tsyringe';
import mysql from 'mysql2/promise';
import moment from 'moment'
import dotenv from 'dotenv';

import MysqlConnector from './dbal/mysql.connector';
import CryptoService from "./app/services/crypto.service";
import CommonService from "./app/services/common.service";
import DeviceService from "./app/services/device.service";

class AgroCityWebsocketServer {

    private readonly rabbitMqHostUrl: string;

    private server: Server | undefined;
    private webSocketServer: WebSocket.Server | undefined;
   
    private connectionPool: mysql.Pool;
    private rabbitMqConnection: Connection;

    private mysqlConnector: MysqlConnector;
    private cryptoService: CryptoService;
    private deviceService: DeviceService;
    private commonService: CommonService;

    public constructor() {
        this.rabbitMqHostUrl = 'amqp://172.17.0.3';
    }

    public async initialize() {
        try {
            dotenv.config();

            this.mysqlConnector = container.resolve(MysqlConnector);
            this.cryptoService = container.resolve(CryptoService);
            this.deviceService = container.resolve(DeviceService);
            this.commonService = container.resolve(CommonService);

            this.server = createServer();
            this.webSocketServer = new WebSocket.Server({ noServer: true });

            this.connectionPool = await this.mysqlConnector.createPool();
            this.rabbitMqConnection = await connect(this.rabbitMqHostUrl);
        } catch (exception) {
            console.log(exception);
        }
    }

    public async processMain() {
        this.server?.on('upgrade', async (request, socket, head) => {
            this.webSocketServer?.handleUpgrade(request, socket, head, async (webSocket: WebSocket) => {
                const dbConnection = await this.connectionPool.getConnection();

                if (!request?.headers['user-agent'] || !request?.headers['authorization']) {
                    socket?.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket?.destroy();
                }

                const authHeaderParts = this.commonService.decodeBasicAuthHeader(request?.headers['authorization']);

                if (!authHeaderParts || !authHeaderParts?.username || !authHeaderParts?.password) {
                    socket?.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket?.destroy();
                    return;
                }

                const deviceType = this.commonService.decodeUserAgentHeader(request.headers['user-agent']);

                if (!deviceType) {
                    socket?.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket?.destroy();
                    return;
                }

                const device: any = await dbConnection.query('SELECT d.uid, uc.username FROM user_credentials uc JOIN devices d ON uc.device_id = d.id WHERE uc.username = ? AND uc.password = ?', [authHeaderParts?.username, authHeaderParts?.password]);

                if (!device) {
                    socket?.write('HTTP/1.1 404 Not Found\r\n\r\n');
                    socket?.destroy();
                    return;
                }

                dbConnection.release();
                
                this.webSocketServer?.emit('connection', webSocket, authHeaderParts.username);
            });
        });

        this.webSocketServer?.on('connection', async (webSocket: any, username: string) => {
            const dbConnection = await this.connectionPool.getConnection();

            const rabbitMqChannel = await this.rabbitMqConnection.createChannel();

            const deviceUid = this.cryptoService.generateSHA1Hash(username);

            await rabbitMqChannel?.assertQueue(deviceUid, { durable: true });

            webSocket.uid = deviceUid;
            webSocket.username = username;

            rabbitMqChannel?.consume(deviceUid, (message) => {
                if (message) {
                    console.log(message?.content.toString());

                    console.log(webSocket.username);
                    
                    webSocket.send(message?.content.toString());
                
                    rabbitMqChannel?.ack(message);
                }
            }).then(r => console.log(r));

            webSocket.on('message', (data: WebSocket.Data) => {
                try {
                    const dataIn = data?.toString();

                    console.log(dataIn);

                    if (dataIn) {
                        /*if (!process.env.AES128_SECURITY_KEY) {
                            throw 'Security key is missing in config!';
                        }*/
    
                        /*if (process.env.USE_ENCRYPTION && parseInt(process.env.USE_ENCRYPTION) === 1) {
                            dataIn = this.commonService.decrypt(Buffer.from(dataIn, 'base64'), process.env.AES128_SECURITY_KEY, 'utf8');
                        }*/
    
                        const decodedDataIn = this.commonService.tryJsonDecode(dataIn);

                        if (decodedDataIn && typeof decodedDataIn === 'object') {
                            const packageType = Object.keys(decodedDataIn).at(0) ?? '';

                            const packageParams = decodedDataIn[packageType] ?? [];

                            if (packageType.toLowerCase() === 'command') {
                                switch(packageParams) {
                                    case 'ConfigGet':
                                        this.deviceService.getDeviceConfigurationByUsername(dbConnection, webSocket.username).then((result: any) => {
                                            webSocket.send('{"Config":' + result?.at(0)?.configuration ?? '' + '}');
                                        });

                                        break;
                                    default:
                                        webSocket.send('COMMAND_NOT_IMPLEMENTED');
                                }
                            } else {
                                switch(packageType) {
                                    case 'Config':
                                        this.deviceService.updateDeviceConfigurationByUsername(
                                            dbConnection,
                                            webSocket.username,
                                            JSON.stringify(packageParams),
                                            moment().format(process.env.DATE_TIME_FORMAT_SQL)
                                        );

                                        break;
                                    case 'Data':
                                        this.deviceService.insertDeviceData(
                                            dbConnection,
                                            webSocket.username,
                                            JSON.stringify(packageParams),
                                            moment().unix()
                                        );

                                        break;
                                    case 'Log':
                                        this.deviceService.saveDeviceLog({
                                            device: webSocket.username,
                                            logLevel: (Object?.keys(packageParams)?.at(0) ?? '') as string,
                                            message: (Object?.values(packageParams)?.at(0) ?? '') as string,
                                        });

                                        break;
                                    case 'Info':
                                        this.deviceService.insertDeviceInfo(
                                            dbConnection,
                                            webSocket.username,
                                            JSON.stringify(packageParams),
                                            moment().format(process.env.DATE_TIME_FORMAT_SQL)
                                        );

                                        break;
                                    case 'Status':
                                        this.deviceService.insertDeviceStatus(
                                            dbConnection,
                                            webSocket.username,
                                            JSON.stringify(packageParams),
                                            moment().format(process.env.DATE_TIME_FORMAT_SQL)
                                        );

                                        break;
                                    default:
                                        webSocket.send('PACKET_TYPE_NOT_IMPLEMENTED');
                                }
                            }
                        }
                    }
                } catch(error) {
                    console.log(error);
                }
            });

            webSocket.on('close', async () => {
                console.log('Client disconnected');

                dbConnection.release();

                await rabbitMqChannel?.close();
            });

            webSocket.on('error', console.error);
        });

        this.webSocketServer?.on('error', (error: any) => {
            console.error('WebSocket error:', error);
        });
    }

    public listen() {
        this.server?.listen(8080, '0.0.0.0', () => {
            console.log('SERVER STARTED LISTENING!');
        });
    }
}

const agroCityWebsocketServer= new AgroCityWebsocketServer;

agroCityWebsocketServer.initialize().then(() => {
    agroCityWebsocketServer.processMain();
    agroCityWebsocketServer.listen();
}).catch((exception) => {
    console.log('Failed to initialize websocket server, reason: ', exception);
});
