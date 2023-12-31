export default interface DbConnector {
    getConnection(): Promise<any>;
}