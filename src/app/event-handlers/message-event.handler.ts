import { MessageStrategy } from "./interfaces/message-strategy";

export default class MessageEventHandler {

    private strategy: MessageStrategy;

    constructor(strategy: MessageStrategy) {
        this.strategy = strategy;
    }

    setStrategy(strategy: MessageStrategy): void {
        this.strategy = strategy;
    }

    handle(webSocket: any, packageParams: any): void {
        this.strategy.handle(webSocket, packageParams);
    }
}