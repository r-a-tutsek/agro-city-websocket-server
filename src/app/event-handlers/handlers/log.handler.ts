import { autoInjectable } from "tsyringe";
import { MessageStrategy } from "../interfaces/message-strategy";
import DeviceService from "../../services/device.service";

@autoInjectable()
export class LogHandler implements MessageStrategy {

    constructor(private deviceService: DeviceService) {}

    handle(webSocket: any, packageParams: any): void {
        this.deviceService.saveDeviceLog({
            device: webSocket.username,
            logLevel: (Object?.keys(packageParams)?.at(0) ?? '') as string,
            message: (Object?.values(packageParams)?.at(0) ?? '') as string,
        });
    }
}