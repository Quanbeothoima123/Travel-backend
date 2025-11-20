const amqp = require("amqplib");

let channel = null;
let connection = null;

// Kết nối tới RabbitMQ (CloudAMQP)
const connectRabbitMQ = async () => {
  try {
    const RABBITMQ_URL = process.env.RABBITMQ_URL;

    if (!RABBITMQ_URL) {
      throw new Error("RABBITMQ_URL is not defined in .env");
    }

    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Tạo các queue
    await channel.assertQueue("notifications.user", { durable: true });
    await channel.assertQueue("notifications.admin", { durable: true });

    console.log(" RabbitMQ kết nối thành công");
    console.log(" Tạo hàng đợi: notifications.user, notifications.admin");

    // Xử lý khi connection bị đóng
    connection.on("close", () => {
      console.error(" RabbitMQ kết nối bị đóng");
      setTimeout(connectRabbitMQ, 5000); // Reconnect sau 5s
    });

    connection.on("error", (err) => {
      console.error(" RabbitMQ lỗi kết nối:", err);
    });

    return { connection, channel };
  } catch (error) {
    console.error(" Failed to connect RabbitMQ:", error);
    setTimeout(connectRabbitMQ, 5000); // Retry sau 5s
  }
};

// Gửi message vào queue
const sendToQueue = async (queueName, message) => {
  try {
    if (!channel) {
      console.error(" RabbitMQ kênh chưa được gửi tạo");
      return false;
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    channel.sendToQueue(queueName, messageBuffer, { persistent: true });

    console.log(` Message đã gửi tới hàng đợi [${queueName}]:`, message);
    return true;
  } catch (error) {
    console.error(` Lỗi khi gửi tin nhắn đến hàng đợi [${queueName}]:`, error);
    return false;
  }
};

// Lắng nghe message từ queue
const consumeQueue = async (queueName, callback) => {
  try {
    if (!channel) {
      throw new Error("RabbitMQ kênh chưa được khởi tạo");
    }

    await channel.consume(
      queueName,
      (msg) => {
        if (msg !== null) {
          const content = JSON.parse(msg.content.toString());
          console.log(` Đa nhận tin nhắn từ [${queueName}]:`, content);

          // Gọi callback để xử lý message
          callback(content);

          // Acknowledge message đã xử lý xong
          channel.ack(msg);
        }
      },
      { noAck: false }
    );

    console.log(` Consumer started for queue: ${queueName}`);
  } catch (error) {
    console.error(` Error consuming queue [${queueName}]:`, error);
  }
};

// Đóng connection
const closeRabbitMQ = async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log(" RabbitMQ connection closed");
  } catch (error) {
    console.error(" Error closing RabbitMQ:", error);
  }
};

module.exports = {
  connectRabbitMQ,
  sendToQueue,
  consumeQueue,
  closeRabbitMQ,
  getChannel: () => channel,
};
