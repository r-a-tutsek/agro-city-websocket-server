export interface MessageStrategy {
    handle(webSocket: any, packageParams: any): void;
}