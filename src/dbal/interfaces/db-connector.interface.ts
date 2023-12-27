export default interface DbConnector {
    getConnection(): Promise<any>;
    query(sql: string, values?: any[]): Promise<any>;
}