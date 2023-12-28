import "reflect-metadata";
import { createServer, Server } from 'http';
import WebSocket from 'ws';
import { container } from 'tsyringe';

import DbConnector from './dbal/interfaces/db-connector.interface';
import MysqlConnector from "./dbal/mysql.connector";
import SocketEventHandler from "./app/event-handlers/socket-event.handler";
import RabbitMqService from "./app/services/rabbit-mq.service";

class AgroCityWebsocketServer {

    private server: Server | undefined;
    private webSocketServer: WebSocket.Server | undefined;
   
    private socketEventHandler: SocketEventHandler;
    
    private rabbitMqService: RabbitMqService;
    private dbConnector: DbConnector;

    private checkBrokenClientsInterval: any;

    public async initialize() {
        try {
            this.socketEventHandler = container.resolve(SocketEventHandler);
            this.rabbitMqService = container.resolve(RabbitMqService);

            this.server = createServer();
            this.webSocketServer = new WebSocket.Server({ noServer: true });

            this.dbConnector = new MysqlConnector();
            this.rabbitMqService.connect();
        } catch (exception) {
            console.log(exception);
        }
    }

    public async processMain() {
        this.server?.on('upgrade', async (request, socket, head) => {
            this.webSocketServer?.handleUpgrade(request, socket, head, async (webSocket: WebSocket) => {
                const [success, username] = await this.socketEventHandler.handleUpgrade(request, socket, head);

                if (!success) {
                    socket?.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket?.destroy();
                    return;
                }

                this.webSocketServer?.emit('connection', webSocket, username);
            });
        });

        this.webSocketServer?.on('connection', async (webSocket: any, username: string) => {
            await this.socketEventHandler.handleConnection(webSocket, username, this.dbConnector);
        });

        this.webSocketServer?.on('error', (error: any) => {
            this.socketEventHandler.handleError(error);
        });

        if (this.checkBrokenClientsInterval) {
            clearInterval(this.checkBrokenClientsInterval);
        }

        this.checkBrokenClientsInterval = setInterval(() => {
            this.webSocketServer?.clients.forEach((ws: any) => {
                if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
                    console.log('REMOVING BROKEN CLIENT: ', ws.uid);
                    ws.terminate();
                }
            });
        }, 5000);
    }

    public listen() {
        this.server?.listen(process.env.WEBSOCKET_SERVER_PORT, () => {
            console.log('WEBSOCKET SERVER STARTED LISTENING!');
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
