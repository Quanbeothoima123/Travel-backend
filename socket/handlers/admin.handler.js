// socket/handlers/admin.handler.js
// Handler cho admin notifications

module.exports = function adminHandlers(io, socket) {
  console.log(`📡 Admin handlers registered for: ${socket.adminId}`);

  // ✅ Admin manually join room (optional, already auto-joined)
  socket.on("join-admin-room", (adminId) => {
    socket.join("admin-room");
    console.log(`✅ Admin ${adminId} manually joined admin-room`);

    socket.emit("room-joined", {
      status: "success",
      message: "Joined admin room",
      room: "admin-room",
      adminId: adminId,
    });
  });

  // ✅ Admin request notification history (optional)
  socket.on("get-notifications", async (data) => {
    try {
      // TODO: Query notification history from database
      // const notifications = await NotificationModel.find({ ... });

      socket.emit("notifications-history", {
        userNotifications: [],
        adminNotifications: [],
      });
    } catch (error) {
      console.error("❌ Error fetching notifications:", error);
    }
  });

  // ✅ Mark notification as read (optional)
  socket.on("mark-notification-read", async (notificationId) => {
    try {
      // TODO: Update notification status in database
      console.log(`✅ Marked notification ${notificationId} as read`);
    } catch (error) {
      console.error("❌ Error marking notification:", error);
    }
  });

  // ✅ Handle errors
  socket.on("error", (error) => {
    console.error(`❌ Admin socket error (${socket.adminId}):`, error);
  });
};
