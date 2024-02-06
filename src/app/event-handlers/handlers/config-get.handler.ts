import { autoInjectable } from "tsyringe";
import { MessageStrategy } from "../interfaces/message-strategy";
import CommonService from "../../services/common.service";

@autoInjectable()
export class ConfigGetHandler implements MessageStrategy {

    constructor(private commonService: CommonService) {}

    async handle(webSocket: any, packageParams: any) {
        const result = (await webSocket.dbConnection.query('SELECT configuration FROM devices WHERE uid = ?', [webSocket.username]))?.at(0);

        if (result) {
            const response = '{"Config":' + (result?.at(0)?.configuration ?? '') + '}';

            if (!process.env.OUTPUT_AES128_SECURITY_KEY) {
                throw 'Output Security key is missing in config!';
            }

            webSocket.send(process.env.ENCRYPT_OUTPUT ? this.commonService.encrypt(response, process.env.OUTPUT_AES128_SECURITY_KEY, 'utf8') : response);
        }
    }
}