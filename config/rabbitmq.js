const amqp = require("amqplib");

let channel = null;
let connection = null;
let isConnecting = false; // ✅ Thêm flag để tránh kết nối lặp

// ✅ CẢI THIỆN RABBITMQ CONNECTION VỚI EXPONENTIAL BACKOFF
const connectRabbitMQ = async (retryCount = 0) => {
  // ✅ Tránh kết nối đồng thời
  if (isConnecting) {
    console.log("⏳ Connection already in progress...");
    return { connection, channel };
  }

  isConnecting = true;

  try {
    const RABBITMQ_URL = process.env.RABBITMQ_URL;
    if (!RABBITMQ_URL) {
      throw new Error("RABBITMQ_URL is not defined in .env");
    }

    console.log(
      `🔄 Attempting RabbitMQ connection (Attempt ${retryCount + 1})...`
    );

    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // ✅ Tăng prefetch để xử lý message tốt hơn
    await channel.prefetch(10);

    // ✅ Tạo queues
    await channel.assertQueue("notifications.user", { durable: true });
    await channel.assertQueue("notifications.admin", { durable: true });

    console.log("✅ RabbitMQ kết nối thành công");
    console.log("✅ Tạo hàng đợi: notifications.user, notifications.admin");

    isConnecting = false;

    // ✅ Xử lý khi connection bị đóng
    connection.on("close", () => {
      console.error("❌ RabbitMQ kết nối bị đóng, sẽ reconnect...");
      channel = null;
      connection = null;
      isConnecting = false;
      setTimeout(() => connectRabbitMQ(0), 5000); // Reset retry count
    });

    // ✅ Xử lý connection errors
    connection.on("error", (err) => {
      console.error("❌ RabbitMQ connection error:", err.message);
      channel = null;
      connection = null;
      isConnecting = false;
      setTimeout(() => connectRabbitMQ(0), 5000);
    });

    return { connection, channel };
  } catch (error) {
    isConnecting = false;
    console.error(
      `❌ Failed to connect RabbitMQ (Attempt ${retryCount + 1}):`,
      error.message
    );

    // ✅ EXPONENTIAL BACKOFF (tối đa 60 giây)
    const delay = Math.min(5000 * Math.pow(2, retryCount), 60000);
    console.log(`⏳ Retrying in ${delay / 1000} seconds...`);

    setTimeout(() => connectRabbitMQ(retryCount + 1), delay);
  }
};

// ✅ GỬI MESSAGE VÀO QUEUE
const sendToQueue = async (queueName, message) => {
  try {
    if (!channel) {
      console.error("❌ RabbitMQ kênh chưa được khởi tạo");
      return false;
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    channel.sendToQueue(queueName, messageBuffer, { persistent: true });
    console.log(`✅ Message đã gửi tới hàng đợi [${queueName}]:`, message);
    return true;
  } catch (error) {
    console.error(
      `❌ Lỗi khi gửi tin nhắn đến hàng đợi [${queueName}]:`,
      error.message
    );
    return false;
  }
};

// ✅ LẮNG NGHE MESSAGE TỪ QUEUE
const consumeQueue = async (queueName, callback) => {
  try {
    if (!channel) {
      throw new Error("RabbitMQ kênh chưa được khởi tạo");
    }

    await channel.consume(
      queueName,
      (msg) => {
        if (msg !== null) {
          try {
            const content = JSON.parse(msg.content.toString());
            console.log(`✅ Đã nhận tin nhắn từ [${queueName}]:`, content);

            // Gọi callback để xử lý message
            callback(content);

            // ✅ Acknowledge message đã xử lý xong
            channel.ack(msg);
          } catch (parseError) {
            console.error(
              `❌ Lỗi parse message từ [${queueName}]:`,
              parseError.message
            );
            // NACK message nếu không parse được
            channel.nack(msg, false, true); // Requeue = true
          }
        }
      },
      { noAck: false }
    );

    console.log(`✅ Consumer started for queue: ${queueName}`);
  } catch (error) {
    console.error(`❌ Error consuming queue [${queueName}]:`, error.message);
    // ✅ Retry consume sau vài giây
    setTimeout(() => consumeQueue(queueName, callback), 3000);
  }
};

// ✅ ĐÓNG CONNECTION
const closeRabbitMQ = async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log("✅ RabbitMQ connection closed");
  } catch (error) {
    console.error("❌ Error closing RabbitMQ:", error.message);
  }
};

// ✅ LẤY CHANNEL (nếu cần sử dụng trực tiếp)
const getChannel = () => {
  if (!channel) {
    console.warn("⚠️ RabbitMQ channel is not ready yet");
    return null;
  }
  return channel;
};

module.exports = {
  connectRabbitMQ,
  sendToQueue,
  consumeQueue,
  closeRabbitMQ,
  getChannel,
};
