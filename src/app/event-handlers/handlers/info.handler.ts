import { autoInjectable } from "tsyringe";
import { MessageStrategy } from "../interfaces/message-strategy";
import moment from "moment";

@autoInjectable()
export class InfoHandler implements MessageStrategy {

    handle(webSocket: any, packageParams: any): void {
        webSocket.dbConnection.instance?.query('INSERT INTO device_info(device_uid, message, created_at) VALUES (?, ?, ?)', [webSocket.username, JSON.stringify(packageParams),  moment().format(process.env.DATE_TIME_FORMAT_SQL)]);
    }
}