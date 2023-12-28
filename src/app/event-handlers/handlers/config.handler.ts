import { autoInjectable } from "tsyringe";
import { MessageStrategy } from "../interfaces/message-strategy";
import moment from "moment";

@autoInjectable()
export class ConfigHandler implements MessageStrategy {

    handle(webSocket: any, packageParams: any): void {
        webSocket.dbConnection.instance?.query('UPDATE devices SET configuration = ?, updated_at = ? WHERE uid = ?', [JSON.stringify(packageParams), moment().format(process.env.DATE_TIME_FORMAT_SQL), webSocket.username]);
    }
}