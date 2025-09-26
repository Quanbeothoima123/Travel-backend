const mongoose = require("mongoose");
const Comment = require("../../models/comment.model");
const LikeComment = require("../../models/like-comment.model");
const DislikeComment = require("../../models/dislike-comment-model");

// [GET] /api/v1/comments - Lấy danh sách bình luận với phân trang và filter
const getComments = async (req, res) => {
  try {
    const {
      targetId,
      targetType = "news",
      page = 1,
      limit = 10,
      sortBy = "newest", // newest, oldest, mostLiked
      loadReplies = "false",
    } = req.query;

    const userId = req.user?.userId;

    if (!targetId) {
      return res.status(400).json({
        success: false,
        message: "targetId là bắt buộc",
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Xác định cách sắp xếp
    let sortOption = {};
    switch (sortBy) {
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "mostLiked":
        sortOption = { likeCount: -1, createdAt: -1 };
        break;
      case "newest":
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    // Pipeline chính để lấy bình luận gốc
    const pipeline = [
      // Match bình luận cho target cụ thể và không phải reply
      {
        $match: {
          targetId: new mongoose.Types.ObjectId(targetId),
          targetType: targetType,
          parentCommentId: null,
          status: "approved",
        },
      },

      // Populate thông tin user
      {
        $lookup: {
          from: "user",
          localField: "userId",
          foreignField: "_id",
          as: "userId",
        },
      },
      { $unwind: "$userId" },

      // Thêm thông tin like của user hiện tại (nếu có)
      ...(userId
        ? [
            {
              $lookup: {
                from: "like-comment",
                let: {
                  commentId: "$_id",
                  currentUserId: new mongoose.Types.ObjectId(userId),
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$commentId", "$$commentId"] },
                          { $eq: ["$userId", "$$currentUserId"] },
                        ],
                      },
                    },
                  },
                ],
                as: "userLike",
              },
            },
            // Thêm thông tin dislike của user hiện tại
            {
              $lookup: {
                from: "dislike-comment",
                let: {
                  commentId: "$_id",
                  currentUserId: new mongoose.Types.ObjectId(userId),
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$commentId", "$$commentId"] },
                          { $eq: ["$userId", "$$currentUserId"] },
                        ],
                      },
                    },
                  },
                ],
                as: "userDislike",
              },
            },
          ]
        : []),

      // Thêm số lượng replies cho mỗi comment
      {
        $lookup: {
          from: "comment",
          let: { commentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$parentCommentId", "$$commentId"] },
                status: "approved",
              },
            },
            { $count: "total" },
          ],
          as: "repliesCount",
        },
      },

      // Thêm các field được tính toán
      {
        $addFields: {
          // Thông tin tương tác của user hiện tại
          isLiked: userId
            ? {
                $gt: [{ $size: { $ifNull: ["$userLike", []] } }, 0],
              }
            : false,
          isDisliked: userId
            ? {
                $gt: [{ $size: { $ifNull: ["$userDislike", []] } }, 0],
              }
            : false,
          // Số lượng replies
          repliesCount: {
            $ifNull: [{ $arrayElemAt: ["$repliesCount.total", 0] }, 0],
          },
        },
      },

      // Format dữ liệu trả về (chỉ dùng inclusion projection)
      {
        $project: {
          _id: 1,
          userId: {
            _id: "$userId._id",
            fullName: "$userId.fullName",
            avatar: "$userId.avatar",
          },
          targetId: 1,
          targetType: 1,
          parentCommentId: 1,
          content: 1,
          likeCount: 1,
          dislikeCount: 1,
          status: 1,
          privateInfoUser: 1,
          createdAt: 1,
          updatedAt: 1,
          isLiked: 1,
          isDisliked: 1,
          repliesCount: 1,
        },
      },

      // Sắp xếp
      { $sort: sortOption },

      // Phân trang
      { $skip: skip },
      { $limit: limitNum },
    ];

    const comments = await Comment.aggregate(pipeline);

    // Nếu loadReplies = true, load replies cho từng comment (chỉ load 3 replies đầu)
    if (loadReplies === "true" && comments.length > 0) {
      for (let comment of comments) {
        const repliesData = await getCommentRepliesHelper(
          comment._id,
          userId,
          1,
          3,
          "newest"
        );
        comment.replies = repliesData.replies;
        comment.repliesHasMore = repliesData.hasMore;
      }
    }

    // Đếm tổng số bình luận gốc để tính pagination
    const totalComments = await Comment.countDocuments({
      targetId: new mongoose.Types.ObjectId(targetId),
      targetType: targetType,
      parentCommentId: null,
      status: "approved",
    });

    const totalPages = Math.ceil(totalComments / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        comments,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalComments,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
        sortBy,
        filters: {
          newest: "Mới nhất",
          oldest: "Cũ nhất",
          mostLiked: "Nhiều like nhất",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy bình luận",
      error: error.message,
    });
  }
};

// ENHANCED: Helper function để lấy replies đa cấp (recursive)
const getCommentRepliesHelper = async (
  commentId,
  userId = null,
  page = 1,
  limit = 5,
  sortBy = "newest",
  maxDepth = 3 // Giới hạn độ sâu để tránh infinite loop
) => {
  try {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let sortOption = {};
    switch (sortBy) {
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "mostLiked":
        sortOption = { likeCount: -1, createdAt: -1 };
        break;
      case "newest":
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    // ENHANCED: Recursive function để lấy replies con
    const getRepliesRecursive = async (parentId, currentDepth = 0) => {
      if (currentDepth >= maxDepth) {
        return [];
      }

      const pipeline = [
        {
          $match: {
            parentCommentId: new mongoose.Types.ObjectId(parentId),
            status: "approved",
          },
        },

        // Populate user info
        {
          $lookup: {
            from: "user",
            localField: "userId",
            foreignField: "_id",
            as: "userId",
          },
        },
        { $unwind: "$userId" },

        // Add user like/dislike if userId provided
        ...(userId
          ? [
              {
                $lookup: {
                  from: "like-comment",
                  let: {
                    commentId: "$_id",
                    currentUserId: new mongoose.Types.ObjectId(userId),
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$commentId", "$$commentId"] },
                            { $eq: ["$userId", "$$currentUserId"] },
                          ],
                        },
                      },
                    },
                  ],
                  as: "userLike",
                },
              },
              {
                $lookup: {
                  from: "dislike-comment",
                  let: {
                    commentId: "$_id",
                    currentUserId: new mongoose.Types.ObjectId(userId),
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$commentId", "$$commentId"] },
                            { $eq: ["$userId", "$$currentUserId"] },
                          ],
                        },
                      },
                    },
                  ],
                  as: "userDislike",
                },
              },
            ]
          : []),

        // Thêm các field được tính toán
        {
          $addFields: {
            isLiked: userId
              ? {
                  $gt: [{ $size: { $ifNull: ["$userLike", []] } }, 0],
                }
              : false,
            isDisliked: userId
              ? {
                  $gt: [{ $size: { $ifNull: ["$userDislike", []] } }, 0],
                }
              : false,
          },
        },

        {
          $project: {
            _id: 1,
            userId: {
              _id: "$userId._id",
              fullName: "$userId.fullName",
              avatar: "$userId.avatar",
            },
            targetId: 1,
            targetType: 1,
            parentCommentId: 1,
            content: 1,
            likeCount: 1,
            dislikeCount: 1,
            status: 1,
            privateInfoUser: 1,
            createdAt: 1,
            updatedAt: 1,
            isLiked: 1,
            isDisliked: 1,
          },
        },

        { $sort: sortOption },
      ];

      const replies = await Comment.aggregate(pipeline);

      // ENHANCED: Recursively get nested replies for each reply
      for (let reply of replies) {
        const nestedReplies = await getRepliesRecursive(
          reply._id,
          currentDepth + 1
        );
        reply.nestedReplies = nestedReplies;
        reply.nestedRepliesCount = nestedReplies.length;
        reply.depth = currentDepth + 1;
      }

      return replies;
    };

    // Get top-level replies with pagination
    const topLevelPipeline = [
      {
        $match: {
          parentCommentId: new mongoose.Types.ObjectId(commentId),
          status: "approved",
        },
      },

      // Populate user info
      {
        $lookup: {
          from: "user",
          localField: "userId",
          foreignField: "_id",
          as: "userId",
        },
      },
      { $unwind: "$userId" },

      // Add user like/dislike if userId provided
      ...(userId
        ? [
            {
              $lookup: {
                from: "like-comment",
                let: {
                  commentId: "$_id",
                  currentUserId: new mongoose.Types.ObjectId(userId),
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$commentId", "$$commentId"] },
                          { $eq: ["$userId", "$$currentUserId"] },
                        ],
                      },
                    },
                  },
                ],
                as: "userLike",
              },
            },
            {
              $lookup: {
                from: "dislike-comment",
                let: {
                  commentId: "$_id",
                  currentUserId: new mongoose.Types.ObjectId(userId),
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$commentId", "$$commentId"] },
                          { $eq: ["$userId", "$$currentUserId"] },
                        ],
                      },
                    },
                  },
                ],
                as: "userDislike",
              },
            },
          ]
        : []),

      // Thêm các field được tính toán
      {
        $addFields: {
          isLiked: userId
            ? {
                $gt: [{ $size: { $ifNull: ["$userLike", []] } }, 0],
              }
            : false,
          isDisliked: userId
            ? {
                $gt: [{ $size: { $ifNull: ["$userDislike", []] } }, 0],
              }
            : false,
        },
      },

      {
        $project: {
          _id: 1,
          userId: {
            _id: "$userId._id",
            fullName: "$userId.fullName",
            avatar: "$userId.avatar",
          },
          targetId: 1,
          targetType: 1,
          parentCommentId: 1,
          content: 1,
          likeCount: 1,
          dislikeCount: 1,
          status: 1,
          privateInfoUser: 1,
          createdAt: 1,
          updatedAt: 1,
          isLiked: 1,
          isDisliked: 1,
        },
      },

      { $sort: sortOption },
      { $skip: skip },
      { $limit: limitNum + 1 }, // +1 để check hasMore
    ];

    const topLevelReplies = await Comment.aggregate(topLevelPipeline);
    const hasMore = topLevelReplies.length > limitNum;

    if (hasMore) {
      topLevelReplies.pop(); // Remove extra item
    }

    // ENHANCED: Get nested replies for each top-level reply
    for (let reply of topLevelReplies) {
      const nestedReplies = await getRepliesRecursive(reply._id, 0);
      reply.nestedReplies = nestedReplies;
      reply.nestedRepliesCount = nestedReplies.length;
      reply.depth = 0;
    }

    return { replies: topLevelReplies, hasMore };
  } catch (error) {
    console.error("Error fetching nested replies:", error);
    throw error;
  }
};

// ENHANCED: Helper để đếm tổng số replies (bao gồm nested)
const countAllReplies = async (commentId) => {
  try {
    const countRepliesRecursive = async (parentId) => {
      const directReplies = await Comment.countDocuments({
        parentCommentId: new mongoose.Types.ObjectId(parentId),
        status: "approved",
      });

      // Get all direct replies
      const replies = await Comment.find({
        parentCommentId: new mongoose.Types.ObjectId(parentId),
        status: "approved",
      }).select("_id");

      let totalNestedReplies = 0;
      for (let reply of replies) {
        totalNestedReplies += await countRepliesRecursive(reply._id);
      }

      return directReplies + totalNestedReplies;
    };

    return await countRepliesRecursive(commentId);
  } catch (error) {
    console.error("Error counting nested replies:", error);
    return 0;
  }
};

// [GET] /api/v1/comments/replies/:commentId - Lấy replies đa cấp
const getCommentReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    const {
      page = 1,
      limit = 5,
      sortBy = "newest",
      includeNested = "true",
    } = req.query;
    const userId = req.user?.userId;

    // ENHANCED: Support for nested replies
    const { replies, hasMore } =
      includeNested === "true"
        ? await getCommentRepliesHelper(commentId, userId, page, limit, sortBy)
        : await getCommentRepliesHelper(
            commentId,
            userId,
            page,
            limit,
            sortBy,
            0
          ); // Depth 0 = only direct replies

    // Count total replies (including nested if enabled)
    const totalReplies =
      includeNested === "true"
        ? await countAllReplies(commentId)
        : await Comment.countDocuments({
            parentCommentId: new mongoose.Types.ObjectId(commentId),
            status: "approved",
          });

    const totalPages = Math.ceil(totalReplies / parseInt(limit));

    return res.status(200).json({
      success: true,
      data: {
        replies,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalReplies,
          hasNextPage: hasMore,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit),
          includeNested: includeNested === "true",
          maxDepth: includeNested === "true" ? 3 : 0,
        },
      },
    });
  } catch (error) {
    console.error("Error in getCommentRepliesAPI:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy phản hồi",
      error: error.message,
    });
  }
};

// ENHANCED: Thêm endpoint để lấy single comment với full nested replies
// [GET] /api/v1/comments/:commentId/full-tree
const getCommentFullTree = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.userId;

    const { replies } = await getCommentRepliesHelper(
      commentId,
      userId,
      1,
      999,
      "newest",
      5
    );
    const totalReplies = await countAllReplies(commentId);

    return res.status(200).json({
      success: true,
      data: {
        replies,
        totalReplies,
        structure: "full-tree",
        maxDepth: 5,
      },
    });
  } catch (error) {
    console.error("Error in getCommentFullTree:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy cây phản hồi",
      error: error.message,
    });
  }
};

// [POST] /api/v1/comments - Tạo bình luận mới
const createComment = async (req, res) => {
  try {
    const {
      targetId,
      targetType,
      content,
      parentCommentId = null,
      isAnonymous = false,
    } = req.body;
    const userId = req.user.userId;

    if (!targetId || !targetType || !content) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc",
      });
    }

    const newComment = new Comment({
      userId,
      targetId,
      targetType,
      parentCommentId,
      content: content.trim(),
      privateInfoUser: {
        isAnonymous,
        displayName: isAnonymous ? "Người dùng ẩn danh" : undefined,
        avatar: isAnonymous
          ? "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Hacker_behind_PC.svg/800px-Hacker_behind_PC.svg.png"
          : undefined,
      },
    });

    await newComment.save();

    // Populate user info for response
    await newComment.populate("userId", "fullName avatar");

    return res.status(201).json({
      success: true,
      message: "Tạo bình luận thành công",
      data: newComment,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo bình luận",
      error: error.message,
    });
  }
};

// [POST] /api/v1/comments/like - Like comment
const likeComment = async (req, res) => {
  try {
    const { commentId } = req.body;
    const userId = req.user.userId;

    if (!commentId) {
      return res.status(400).json({
        success: false,
        message: "commentId là bắt buộc",
      });
    }

    // Check if comment exists
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Bình luận không tồn tại",
      });
    }

    // Check if already liked
    const existingLike = await LikeComment.findOne({
      userId,
      commentId,
    });

    if (existingLike) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã like bình luận này rồi",
      });
    }

    // Remove dislike if exists
    await DislikeComment.findOneAndDelete({
      userId,
      commentId,
    });

    // Add like
    const newLike = new LikeComment({
      userId,
      commentId,
      isAnonymous: comment.privateInfoUser?.isAnonymous || false,
    });

    await newLike.save();

    // Update counts
    const likeCount = await LikeComment.countDocuments({ commentId });
    const dislikeCount = await DislikeComment.countDocuments({ commentId });

    await Comment.findByIdAndUpdate(commentId, {
      likeCount,
      dislikeCount,
    });

    return res.status(200).json({
      success: true,
      message: "Like thành công",
      data: { likeCount, dislikeCount },
    });
  } catch (error) {
    console.error("Error liking comment:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi like bình luận",
      error: error.message,
    });
  }
};

// [POST] /api/v1/comments/unlike - Unlike comment
const unlikeComment = async (req, res) => {
  try {
    const { commentId } = req.body;
    const userId = req.user.userId;

    if (!commentId) {
      return res.status(400).json({
        success: false,
        message: "commentId là bắt buộc",
      });
    }

    // Remove like
    const deletedLike = await LikeComment.findOneAndDelete({
      userId,
      commentId,
    });

    if (!deletedLike) {
      return res.status(400).json({
        success: false,
        message: "Bạn chưa like bình luận này",
      });
    }

    // Update counts
    const likeCount = await LikeComment.countDocuments({ commentId });
    const dislikeCount = await DislikeComment.countDocuments({ commentId });

    await Comment.findByIdAndUpdate(commentId, {
      likeCount,
      dislikeCount,
    });

    return res.status(200).json({
      success: true,
      message: "Unlike thành công",
      data: { likeCount, dislikeCount },
    });
  } catch (error) {
    console.error("Error unliking comment:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi unlike bình luận",
      error: error.message,
    });
  }
};

// [POST] /api/v1/comments/dislike - Dislike comment
const dislikeComment = async (req, res) => {
  try {
    const { commentId } = req.body;
    const userId = req.user.userId;

    if (!commentId) {
      return res.status(400).json({
        success: false,
        message: "commentId là bắt buộc",
      });
    }

    // Check if comment exists
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Bình luận không tồn tại",
      });
    }

    // Check if already disliked
    const existingDislike = await DislikeComment.findOne({
      userId,
      commentId,
    });

    if (existingDislike) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã dislike bình luận này rồi",
      });
    }

    // Remove like if exists
    await LikeComment.findOneAndDelete({
      userId,
      commentId,
    });

    // Add dislike
    const newDislike = new DislikeComment({
      userId,
      commentId,
      isAnonymous: comment.privateInfoUser?.isAnonymous || false,
    });

    await newDislike.save();

    // Update counts
    const likeCount = await LikeComment.countDocuments({ commentId });
    const dislikeCount = await DislikeComment.countDocuments({ commentId });

    await Comment.findByIdAndUpdate(commentId, {
      likeCount,
      dislikeCount,
    });

    return res.status(200).json({
      success: true,
      message: "Dislike thành công",
      data: { likeCount, dislikeCount },
    });
  } catch (error) {
    console.error("Error disliking comment:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi dislike bình luận",
      error: error.message,
    });
  }
};

// [POST] /api/v1/comments/undislike - Undislike comment
const unDisLikeComment = async (req, res) => {
  try {
    const { commentId } = req.body;
    const userId = req.user.userId;

    if (!commentId) {
      return res.status(400).json({
        success: false,
        message: "commentId là bắt buộc",
      });
    }

    // Remove dislike
    const deletedDislike = await DislikeComment.findOneAndDelete({
      userId,
      commentId,
    });

    if (!deletedDislike) {
      return res.status(400).json({
        success: false,
        message: "Bạn chưa dislike bình luận này",
      });
    }

    // Update counts
    const likeCount = await LikeComment.countDocuments({ commentId });
    const dislikeCount = await DislikeComment.countDocuments({ commentId });

    await Comment.findByIdAndUpdate(commentId, {
      likeCount,
      dislikeCount,
    });

    return res.status(200).json({
      success: true,
      message: "Undislike thành công",
      data: { likeCount, dislikeCount },
    });
  } catch (error) {
    console.error("Error undisliking comment:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi undislike bình luận",
      error: error.message,
    });
  }
};
// [GET] /api/v1/comments/count - Đếm tổng số bình luận bao gồm nested
const getCommentsCount = async (req, res) => {
  try {
    const { targetId } = req.query;

    if (!targetId) {
      return res.status(400).json({
        success: false,
        message: "targetId là bắt buộc",
      });
    }

    // Đếm tất cả comment (main + nested) cho target này
    const totalCount = await Comment.countDocuments({
      targetId: new mongoose.Types.ObjectId(targetId),
      status: "approved",
    });

    return res.status(200).json({
      success: true,
      data: { totalCount },
    });
  } catch (error) {
    console.error("Error counting comments:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi đếm bình luận",
      error: error.message,
    });
  }
};

// [DELETE] /api/v1/comments/delete/:commentId - Xóa bình luận và tất cả replies con (recursive)
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    if (!commentId) {
      return res.status(400).json({
        success: false,
        message: "commentId là bắt buộc",
      });
    }

    // Check if comment exists
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Bình luận không tồn tại",
      });
    }

    // Check permission to delete
    const canDelete =
      userRole === "admin" ||
      comment.userId.toString() === userId ||
      (comment.privateInfoUser?.isAnonymous &&
        comment.privateInfoUser?.userId === userId);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa bình luận này",
      });
    }

    // Recursive function to collect all nested comment IDs
    const collectNestedCommentIds = async (parentId) => {
      const nestedComments = await Comment.find({
        parentCommentId: new mongoose.Types.ObjectId(parentId),
      }).select("_id");

      let allIds = nestedComments.map((c) => c._id);

      // Recursively collect deeper nested comments
      for (let nestedComment of nestedComments) {
        const deeperIds = await collectNestedCommentIds(nestedComment._id);
        allIds = [...allIds, ...deeperIds];
      }

      return allIds;
    };

    // Collect all nested comment IDs
    const nestedCommentIds = await collectNestedCommentIds(commentId);
    const allCommentIds = [
      new mongoose.Types.ObjectId(commentId),
      ...nestedCommentIds,
    ];

    // console.log(
    //   `Deleting comment ${commentId} and ${nestedCommentIds.length} nested comments`
    // );

    // Start transaction for data consistency
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Delete all likes for these comments
        await LikeComment.deleteMany({
          commentId: { $in: allCommentIds },
        }).session(session);

        // Delete all dislikes for these comments
        await DislikeComment.deleteMany({
          commentId: { $in: allCommentIds },
        }).session(session);

        // Delete all comments (parent + all nested)
        await Comment.deleteMany({
          _id: { $in: allCommentIds },
        }).session(session);
      });

      // console.log(
      //   `Successfully deleted ${allCommentIds.length} comments and their interactions`
      // );

      return res.status(200).json({
        success: true,
        message: "Xóa bình luận thành công",
        data: {
          deletedCount: allCommentIds.length,
          deletedCommentId: commentId,
          deletedNestedIds: nestedCommentIds,
        },
      });
    } catch (transactionError) {
      console.error("Transaction failed:", transactionError);
      return res.status(500).json({
        success: false,
        message: "Lỗi khi xóa bình luận trong database",
        error: transactionError.message,
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error("Error deleting comment:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa bình luận",
      error: error.message,
    });
  }
};
module.exports = {
  getComments,
  getCommentReplies,
  getCommentFullTree,
  getCommentRepliesHelper,
  countAllReplies,
  getCommentsCount,
  createComment,
  likeComment,
  unlikeComment,
  dislikeComment,
  unDisLikeComment,
  deleteComment,
};
