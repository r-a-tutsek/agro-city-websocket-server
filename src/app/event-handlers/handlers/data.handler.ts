import { autoInjectable } from "tsyringe";
import { MessageStrategy } from "../interfaces/message-strategy";
import moment from "moment";

@autoInjectable()
export class DataHandler implements MessageStrategy {

    handle(webSocket: any, packageParams: any): void {
        webSocket.dbConnection.instance?.query('INSERT INTO tmp_device_data(device_uid, data, created_at) VALUES (?, ?, ?)', [webSocket.username, JSON.stringify(packageParams), moment().unix()]);
    }
}