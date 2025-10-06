const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;

// Cấu hình đường dẫn FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
const B2 = require("backblaze-b2");
const Short = require("../../models/short.model");
const slugify = require("slugify");

// Khởi tạo Backblaze B2
const b2 = new B2({
  applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
});

// Cấu hình multer để lưu tạm file
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../../../temp/uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv|flv|wmv/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file video!"));
    }
  },
});

// Hàm kiểm tra độ dài video
const getVideoDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration;
        resolve(duration);
      }
    });
  });
};

// Hàm xác thực và lấy upload URL từ B2
const authorizeB2 = async () => {
  try {
    await b2.authorize();
    return true;
  } catch (error) {
    console.error("B2 Authorization Error:", error);
    throw new Error("Không thể kết nối với Backblaze B2");
  }
};

// Hàm upload file lên B2
const uploadToB2 = async (filePath, fileName, bucketId) => {
  try {
    const fileData = await fs.readFile(filePath);

    // Lấy upload URL
    const uploadUrlResponse = await b2.getUploadUrl({
      bucketId: bucketId,
    });

    // Upload file
    const response = await b2.uploadFile({
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken,
      fileName: fileName,
      data: fileData,
    });

    return response.data;
  } catch (error) {
    console.error("B2 Upload Error:", error);
    throw error;
  }
};

// Hàm tạo HLS segments từ video
// Hàm tạo HLS segments từ video - UPDATED WITH DEBUG
const convertToHLS = (inputPath, outputDir) => {
  return new Promise((resolve, reject) => {
    const outputPlaylist = path.join(outputDir, "playlist.m3u8");

    ffmpeg(inputPath)
      .outputOptions([
        // Video codec
        "-c:v libx264",
        "-profile:v main",
        "-level 4.0",

        // Bitrate
        "-b:v 1500k",
        "-maxrate 1800k",
        "-bufsize 3000k",

        // Audio
        "-c:a aac",
        "-b:a 128k",
        "-ar 44100",

        // Encoding speed
        "-preset veryfast",

        // CRITICAL: Keyframe settings để đảm bảo seeking hoạt động
        "-g 48", // Keyframe mỗi 48 frames
        "-keyint_min 48", // Min keyframe interval
        "-sc_threshold 0", // Tắt scene change detection
        "-force_key_frames expr:gte(t,n_forced*2)", // Force keyframe mỗi 2s

        // HLS settings
        "-f hls",
        "-hls_time 6", // 6 giây mỗi segment
        "-hls_list_size 0",
        "-hls_segment_type mpegts",
        "-hls_flags independent_segments+program_date_time",
        "-start_number 0",
        "-hls_segment_filename",
        path.join(outputDir, "segment%03d.ts"),
      ])
      .output(outputPlaylist)
      .on("start", (commandLine) => {
        console.log("FFmpeg command:", commandLine);
      })
      .on("progress", (progress) => {
        console.log(`Processing: ${Math.round(progress.percent || 0)}% done`);
      })
      .on("end", async () => {
        console.log("HLS conversion completed");

        // DEBUG: Kiểm tra playlist vừa tạo
        try {
          const playlistContent = await fs.readFile(outputPlaylist, "utf8");
          console.log("\n=== PLAYLIST CONTENT ===");
          console.log(playlistContent);
          console.log("=========================\n");

          // Validate playlist
          if (!playlistContent.includes("#EXT-X-INDEPENDENT-SEGMENTS")) {
            console.error(
              "❌ WARNING: Missing #EXT-X-INDEPENDENT-SEGMENTS flag!"
            );
          } else {
            console.log("✅ Has #EXT-X-INDEPENDENT-SEGMENTS flag");
          }

          // Parse segment durations
          const matches = playlistContent.match(/#EXTINF:([\d.]+)/g);
          if (matches) {
            const durations = matches.map((m) => parseFloat(m.split(":")[1]));
            console.log("📊 Segment durations:", durations);
            console.log("   Min:", Math.min(...durations).toFixed(2), "s");
            console.log("   Max:", Math.max(...durations).toFixed(2), "s");
            console.log(
              "   Avg:",
              (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(
                2
              ),
              "s"
            );
          }
        } catch (err) {
          console.error("Cannot read playlist for validation:", err);
        }

        resolve(outputPlaylist);
      })
      .on("error", (err, stdout, stderr) => {
        console.error("FFmpeg Error:", err.message);
        console.error("FFmpeg stderr:", stderr);
        reject(err);
      })
      .run();
  });
};

// Hàm upload toàn bộ HLS files lên B2 - UPDATED WITH DEBUG
const uploadHLSToB2 = async (hlsDir, shortId, bucketId) => {
  try {
    const files = await fs.readdir(hlsDir);

    console.log("\n=== FILES TO UPLOAD ===");
    for (const file of files) {
      const filePath = path.join(hlsDir, file);
      const stats = await fs.stat(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`${file}: ${sizeMB} MB`);

      // Warning cho file quá nhỏ
      if (stats.size === 0) {
        console.error(`❌ CRITICAL: ${file} is 0 bytes!`);
        throw new Error(`Invalid file: ${file} is empty`);
      }

      if (stats.size < 1000 && file.endsWith(".ts")) {
        console.warn(`⚠️ WARNING: ${file} is very small (${stats.size} bytes)`);
      }
    }
    console.log("=======================\n");

    const uploadPromises = [];
    const b2Folder = `shorts/${shortId}/`;

    for (const file of files) {
      const filePath = path.join(hlsDir, file);
      const b2FileName = `${b2Folder}${file}`;

      console.log(`Uploading: ${b2FileName}`);
      uploadPromises.push(
        uploadToB2(filePath, b2FileName, bucketId)
          .then(() => console.log(`✅ Uploaded: ${file}`))
          .catch((err) => {
            console.error(`❌ Failed to upload ${file}:`, err.message);
            throw err;
          })
      );
    }

    await Promise.all(uploadPromises);
    console.log("✅ All HLS files uploaded successfully");

    // Trả về URL của playlist.m3u8
    const playlistUrl = `${b2Folder}playlist.m3u8`;
    return playlistUrl;
  } catch (error) {
    console.error("Error uploading HLS to B2:", error);
    throw error;
  }
};

// Hàm dọn dẹp file tạm
const cleanupTempFiles = async (paths) => {
  for (const filePath of paths) {
    try {
      await fs.rm(filePath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error deleting ${filePath}:`, error);
    }
  }
};

// Controller xử lý upload
const uploadShort = async (req, res) => {
  let tempPaths = [];

  try {
    const { title, description, province, ward, placeName, googleMap, tags } =
      req.body;
    const videoFile = req.file;

    if (!videoFile) {
      return res.status(400).json({ message: "Video file is required" });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    // Thêm video file vào danh sách cần cleanup
    tempPaths.push(videoFile.path);

    // Kiểm tra độ dài video (max 2 phút = 120 giây)
    try {
      const duration = await getVideoDuration(videoFile.path);

      if (duration > 120) {
        await cleanupTempFiles(tempPaths);
        return res.status(400).json({
          message: "Video quá dài! Vui lòng upload video ngắn hơn 2 phút",
          duration: Math.round(duration),
          maxDuration: 120,
        });
      }

      console.log(`Video duration: ${duration} seconds`);
    } catch (error) {
      console.error("Error checking video duration:", error);
      await cleanupTempFiles(tempPaths);
      return res.status(400).json({
        message: "Không thể đọc thông tin video. File có thể bị lỗi",
      });
    }

    // Tạo slug từ title
    const slug =
      slugify(title, { lower: true, strict: true }) + "-" + Date.now();

    // Tạo short document tạm thời
    const newShort = new Short({
      title,
      slug,
      description: description || "",
      videoUrl: "", // Sẽ cập nhật sau
      createdBy: req.user.userId, // Giả sử có middleware xác thực
      province: province || null,
      ward: ward || null,
      placeName: placeName || "",
      googleMap: googleMap || "",
      tags: tags ? JSON.parse(tags) : [],
      status: "inactive", // Inactive cho đến khi upload xong
    });

    await newShort.save();

    // Xác thực B2
    await authorizeB2();

    // Tạo thư mục HLS tạm thời
    const hlsDir = path.join(__dirname, `../../../../temp/hls/${newShort._id}`);
    await fs.mkdir(hlsDir, { recursive: true });
    tempPaths.push(hlsDir);

    // Trả response ngay để frontend hiển thị loading
    res.status(202).json({
      message: "Video is being processed",
      shortId: newShort._id,
    });

    // Xử lý video bất đồng bộ
    processVideoAsync(videoFile.path, hlsDir, newShort, tempPaths);
  } catch (error) {
    console.error("Upload error:", error);

    // Cleanup temp files
    await cleanupTempFiles(tempPaths);

    if (!res.headersSent) {
      res.status(500).json({
        message: "Lỗi khi upload video",
        error: error.message,
      });
    }
  }
};

// Xử lý video bất đồng bộ
const processVideoAsync = async (videoPath, hlsDir, shortDoc, tempPaths) => {
  try {
    console.log("Starting video conversion to HLS...");

    // Chuyển đổi video sang HLS
    await convertToHLS(videoPath, hlsDir);

    console.log("HLS conversion completed. Uploading to B2...");

    // Upload HLS files lên B2
    const bucketId = process.env.B2_BUCKET_ID;
    const playlistUrl = await uploadHLSToB2(hlsDir, shortDoc._id, bucketId);

    // Cập nhật Short document với video URL
    shortDoc.videoUrl = `shorts/${shortDoc._id}/playlist.m3u8`; // ⬅️ THAY ĐỔI DÒNG NÀY
    shortDoc.status = "active";
    await shortDoc.save();

    console.log("Video processing completed successfully!");

    // Cleanup temp files
    await cleanupTempFiles(tempPaths);
  } catch (error) {
    console.error("Error processing video:", error);

    // Cập nhật status thành failed
    shortDoc.status = "deleted";
    shortDoc.deletedAt = new Date();
    await shortDoc.save();

    // Cleanup temp files
    await cleanupTempFiles(tempPaths);
  }
};

// Controller kiểm tra trạng thái xử lý video
const getProcessingStatus = async (req, res) => {
  try {
    const { shortId } = req.params;

    const short = await Short.findById(shortId);

    if (!short) {
      return res.status(404).json({ message: "Short not found" });
    }

    let status = "processing";
    if (short.status === "active") {
      status = "completed";
    } else if (short.status === "deleted") {
      status = "failed";
    }

    res.json({
      status,
      videoUrl: short.videoUrl,
      shortId: short._id,
    });
  } catch (error) {
    console.error("Error checking status:", error);
    res.status(500).json({ message: "Error checking status" });
  }
};

// Hàm tạo signed URL cho video private trên B2
const getB2SignedUrl = async (fileName, validDurationInSeconds = 3600) => {
  try {
    await b2.authorize();

    const response = await b2.getDownloadAuthorization({
      bucketId: process.env.B2_BUCKET_ID,
      fileNamePrefix: fileName,
      validDurationInSeconds: validDurationInSeconds,
    });

    // Tạo URL với authorization token
    const bucketName = process.env.B2_BUCKET_NAME;
    const endpoint =
      process.env.B2_ENDPOINT || "s3.us-east-005.backblazeb2.com";

    const signedUrl = `https://${bucketName}.${endpoint}/file/${bucketName}/${fileName}?Authorization=${response.data.authorizationToken}`;

    return signedUrl;
  } catch (error) {
    console.error("Error creating signed URL:", error);
    throw error;
  }
};

// Controller lấy URL video để phát
// Controller lấy URL video để phát
const getVideoUrl = async (req, res) => {
  try {
    const { shortId } = req.params;

    const short = await Short.findById(shortId);

    if (!short || short.status !== "active") {
      return res.status(404).json({ message: "Video not found or not ready" });
    }

    // THAY ĐỔI: Trả về proxy URL thay vì B2 URL
    const playlistUrl = `${process.env.DOMAIN_BACKEND}/api/v1/shorts/playlist/${shortId}`;

    res.json({
      playlistUrl: playlistUrl,
      shortId: short._id,
    });
  } catch (error) {
    console.error("Error getting video URL:", error);
    res.status(500).json({ message: "Error getting video URL" });
  }
};

// Lấy danh sách shorts (pagination)
const getShorts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Query options
    const query = {
      status: "active", // Chỉ lấy video đã active
    };

    // Có thể thêm filter theo province, tags, etc
    if (req.query.province) {
      query.province = req.query.province;
    }

    if (req.query.tags) {
      query.tags = { $in: req.query.tags.split(",") };
    }

    // Đếm tổng số shorts
    const total = await Short.countDocuments(query);

    // Lấy shorts với pagination
    const shorts = await Short.find(query)
      .select("-__v") // Loại bỏ __v
      .populate("province", "name") // Populate province name
      .populate("ward", "name") // Populate ward name
      .populate("createdBy", "name email avatar") // Populate user info
      .sort({ createdAt: -1 }) // Sắp xếp mới nhất trước
      .skip(skip)
      .limit(limit)
      .lean(); // Chuyển sang plain object để tăng performance

    // Tính toán pagination info
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    res.json({
      success: true,
      shorts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Error fetching shorts:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tải danh sách video",
      error: error.message,
    });
  }
};

// Lấy chi tiết 1 short
const getShortById = async (req, res) => {
  try {
    const { shortId } = req.params;

    const short = await Short.findById(shortId)
      .populate("province", "name")
      .populate("ward", "name")
      .populate("createdBy", "name email avatar");

    if (!short) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy video",
      });
    }

    if (short.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Video chưa sẵn sàng để xem",
      });
    }

    // Tăng view count
    short.views = (short.views || 0) + 1;
    await short.save();

    res.json({
      success: true,
      short,
    });
  } catch (error) {
    console.error("Error fetching short:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tải video",
      error: error.message,
    });
  }
};

// Tăng view count
const incrementView = async (req, res) => {
  try {
    const { shortId } = req.params;

    const short = await Short.findByIdAndUpdate(
      shortId,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!short) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy video",
      });
    }

    res.json({
      success: true,
      views: short.views,
    });
  } catch (error) {
    console.error("Error incrementing view:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật view",
      error: error.message,
    });
  }
};

// Lấy shorts trending (nhiều view nhất)
const getTrendingShorts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const shorts = await Short.find({ status: "active" })
      .select("-__v")
      .populate("province", "name")
      .populate("createdBy", "name avatar")
      .sort({ views: -1, likes: -1 }) // Sắp xếp theo views và likes
      .limit(limit)
      .lean();

    res.json({
      success: true,
      shorts,
    });
  } catch (error) {
    console.error("Error fetching trending shorts:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tải video trending",
      error: error.message,
    });
  }
};

// Tìm kiếm shorts
const searchShorts = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    if (!q || q.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập từ khóa tìm kiếm",
      });
    }

    const searchQuery = {
      status: "active",
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
        { placeName: { $regex: q, $options: "i" } },
      ],
    };

    const total = await Short.countDocuments(searchQuery);

    const shorts = await Short.find(searchQuery)
      .select("-__v")
      .populate("province", "name")
      .populate("createdBy", "name avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      shorts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error searching shorts:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm kiếm video",
      error: error.message,
    });
  }
};

// Lấy shorts theo user
const getShortsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {
      createdBy: userId,
      status: "active",
    };

    const total = await Short.countDocuments(query);

    const shorts = await Short.find(query)
      .select("-__v")
      .populate("province", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      shorts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching user shorts:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tải video của user",
      error: error.message,
    });
  }
};

module.exports = {
  upload: upload.single("video"),
  uploadShort,
  getProcessingStatus,
  getVideoUrl,
  getShorts,
  getShortById,
  incrementView,
  getTrendingShorts,
  searchShorts,
  getShortsByUser,
};
