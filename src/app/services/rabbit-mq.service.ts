import { singleton } from 'tsyringe';
import { connect } from 'amqp-connection-manager';
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/types/AmqpConnectionManager';

@singleton()
export default class RabbitMqService {

    private connection: IAmqpConnectionManager;

    connect() {
        if (!process.env.RABBIT_MQ_HOST_URL || !process.env.RABBIT_MQ_PORT || !process.env.RABBIT_MQ_RETRY_INTERVAL) {
            throw 'Missing Rabbit Mq Configuration!';
        }

        this.connection = connect([`amqp://${process.env.RABBIT_MQ_HOST_URL}:${process.env.RABBIT_MQ_PORT}`]);
    }

    createChannel(deviceUid: string, callback: any) {
        return this.connection.createChannel({
            setup: (channel: any) => {
                return Promise.all([
                    channel.assertQueue(deviceUid, { durable: true }),
                    channel.consume(deviceUid, (message: any) => {
                        if (message) {
                            callback(message?.content?.toString());
                            channel?.ack(message);
                        }
                    })
                ]);
            }
        });
    }
}