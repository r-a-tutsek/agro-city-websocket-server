import { autoInjectable } from "tsyringe";
import { MessageStrategy } from "../interfaces/message-strategy";

@autoInjectable()
export class ConfigGetHandler implements MessageStrategy {

    async handle(webSocket: any, packageParams: any) {
        const result = (await webSocket.dbConnection.instance.query('SELECT configuration FROM devices WHERE uid = ?', [webSocket.username]))?.at(0);

        if (result) {
            webSocket.send('{"Config":' + (result?.at(0)?.configuration ?? '') + '}');
        }
    }
}