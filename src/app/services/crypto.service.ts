
import { autoInjectable } from 'tsyringe';
import * as crypto from "crypto";

@autoInjectable()
export default class CryptoService {

    generateSHA1Hash(data: string) {
        return crypto.createHash('sha1').update(data, 'utf8').digest('hex');
    }
}