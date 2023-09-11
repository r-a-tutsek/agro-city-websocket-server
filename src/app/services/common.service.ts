
import { autoInjectable } from 'tsyringe';
import * as base64 from 'base-64';
import * as crypto from 'crypto';

@autoInjectable()
export default class CommonService {

    decodeBasicAuthHeader(authorizationHeader: string | undefined) {
        try {
            if (!authorizationHeader) {
                return null;
            }
            
            const authorization = (authorizationHeader.split(' '))?.pop();
            
            if (!authorization) {
                return null;
            }
            
            const auth = base64.decode(authorization)?.split(':');

            if (auth?.length === 2) {
                return {
                    username: auth.at(0),
                    password: auth.at(1)
                };
            }
        } catch(error) {
            return null;
        }

        return null;
    }

    decodeUserAgentHeader(userAgentHeader: string | undefined) {
        try {
            if (!userAgentHeader) {
                return null;
            }

            const userAgent = userAgentHeader.split('/');

            if (userAgent?.length > 0) {
                return userAgent.at(0);
            }
        } catch(error) {
            return null;
        }

        return null;
    }

    decrypt(cipherText: NodeJS.ArrayBufferView, securityKey: string, outputEncoding: BufferEncoding | undefined) {
        const cipher = crypto.createDecipheriv('aes-128-ecb', securityKey, null);
        return Buffer.concat([cipher.update(cipherText), cipher.final()]).toString(outputEncoding);
    }

    tryJsonDecode(value: string) {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }
}