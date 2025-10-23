// controllers/chat.controller.js
const Chat = require("../../models/chat.model");
const Message = require("../../models/message.model");
const User = require("../../models/user.model");

// Route: GET /api/v1/chat/getChatList
module.exports.getChatList = async (req, res) => {
  try {
    const userId = req.user.userId;

    const chats = await Chat.find({
      participants: userId,
      deletedFor: { $ne: userId },
    })
      .populate({
        path: "participants",
        select: "userName customName avatar",
      })
      .populate({
        path: "lastMessage",
        select: "content type createdAt sender",
      })
      .sort({ lastMessageAt: -1 })
      .limit(50);

    // Format data cho frontend
    const formattedChats = await Promise.all(
      chats.map(async (chat) => {
        const otherUser = chat.participants.find(
          (p) => p._id.toString() !== userId.toString()
        );

        // Lấy nickname nếu có
        const currentUser = await User.findById(userId);
        const nicknameObj = currentUser.nicknames?.find(
          (n) => n.user.toString() === otherUser._id.toString()
        );

        // Tính unread count
        const unreadCount =
          chat.unreadCount?.find(
            (u) => u.userId.toString() === userId.toString()
          )?.count || 0;

        return {
          chatId: chat._id,
          type: chat.type,
          otherUser: {
            _id: otherUser._id,
            name:
              nicknameObj?.nickname ||
              otherUser.customName ||
              otherUser.userName,
            avatar: otherUser.avatar,
          },
          lastMessage: chat.lastMessage
            ? {
                content: chat.lastMessage.content,
                type: chat.lastMessage.type,
                createdAt: chat.lastMessage.createdAt,
                isMe: chat.lastMessage.sender.toString() === userId.toString(),
              }
            : null,
          unreadCount,
          updatedAt: chat.lastMessageAt || chat.updatedAt,
        };
      })
    );

    res.json({ success: true, data: formattedChats });
  } catch (error) {
    console.error("Get chat list error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: POST /api/v1/chat/create-or-get
// ✅ ĐÃ SỬA: Tìm trước, nếu không có thì tạo mới
module.exports.createOrGetChat = async (req, res) => {
  try {
    const { otherUserId } = req.body;
    const userId = req.user.userId;

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        error: "otherUserId is required",
      });
    }

    // Kiểm tra người dùng có tồn tại không
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // ✅ QUAN TRỌNG: Sort participants để đảm bảo thứ tự nhất quán
    const participants = [userId.toString(), otherUserId.toString()].sort();

    // ✅ Bước 1: Tìm chat hiện có
    let chat = await Chat.findOne({
      type: "private",
      participants: { $all: participants, $size: 2 },
    })
      .populate("participants", "userName customName avatar")
      .populate("lastMessage");

    // ✅ Bước 2: Nếu chưa có, tạo mới
    if (!chat) {
      try {
        chat = await Chat.create({
          participants: participants,
          type: "private",
          lastMessageAt: new Date(),
          unreadCount: [
            { userId: userId, count: 0 },
            { userId: otherUserId, count: 0 },
          ],
        });

        // Populate sau khi tạo
        chat = await Chat.findById(chat._id)
          .populate("participants", "userName customName avatar")
          .populate("lastMessage");
      } catch (createError) {
        // ✅ Nếu bị duplicate (race condition), tìm lại
        if (createError.code === 11000) {
          console.log("⚠️ Duplicate detected, finding existing chat...");
          chat = await Chat.findOne({
            type: "private",
            participants: { $all: participants, $size: 2 },
          })
            .populate("participants", "userName customName avatar")
            .populate("lastMessage");

          if (!chat) {
            throw new Error("Failed to create or find chat");
          }
        } else {
          throw createError;
        }
      }
    }

    // Format response
    const foundOtherUser = chat.participants.find(
      (p) => p._id.toString() !== userId.toString()
    );

    const currentUser = await User.findById(userId);
    const nicknameObj = currentUser.nicknames?.find(
      (n) => n.user.toString() === foundOtherUser._id.toString()
    );

    res.json({
      success: true,
      data: {
        chatId: chat._id,
        otherUser: {
          _id: foundOtherUser._id,
          name:
            nicknameObj?.nickname ||
            foundOtherUser.customName ||
            foundOtherUser.userName,
          avatar: foundOtherUser.avatar,
        },
      },
    });
  } catch (error) {
    console.error("Create or get chat error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: GET /api/v1/chat/detail/:chatId
module.exports.getChatDetail = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Kiểm tra quyền truy cập
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    }).populate("participants", "userName customName avatar");

    if (!chat) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Lấy thông tin người kia
    const otherUser = chat.participants.find(
      (p) => p._id.toString() !== userId.toString()
    );

    const currentUser = await User.findById(userId);
    const nicknameObj = currentUser.nicknames?.find(
      (n) => n.user.toString() === otherUser._id.toString()
    );

    res.json({
      success: true,
      data: {
        chatId: chat._id,
        type: chat.type,
        otherUser: {
          _id: otherUser._id,
          name:
            nicknameObj?.nickname || otherUser.customName || otherUser.userName,
          avatar: otherUser.avatar,
        },
      },
    });
  } catch (error) {
    console.error("Get chat detail error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: PATCH /api/v1/chat/nickname/:chatId
module.exports.setNickname = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { nickname } = req.body;
    const userId = req.user.userId;

    // Lấy thông tin người kia
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const otherUserId = chat.participants.find(
      (p) => p.toString() !== userId.toString()
    );

    // Xóa nickname cũ nếu có
    await User.findByIdAndUpdate(userId, {
      $pull: { nicknames: { user: otherUserId } },
    });

    // Thêm nickname mới nếu không rỗng
    if (nickname && nickname.trim()) {
      await User.findByIdAndUpdate(userId, {
        $push: {
          nicknames: {
            user: otherUserId,
            nickname: nickname.trim(),
          },
        },
      });
    }

    res.json({
      success: true,
      message: "Nickname updated successfully",
    });
  } catch (error) {
    console.error("Set nickname error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: DELETE /api/v1/chat/:chatId
module.exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Thêm userId vào deletedFor
    await Chat.findByIdAndUpdate(chatId, {
      $addToSet: { deletedFor: userId },
    });

    res.json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error("Delete chat error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
