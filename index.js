// server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nkycuoy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // database
    const database = client.db("idea-Canvas");
    const blogCollection = database.collection("blogs");
    const wishlistCollection = database.collection("wishlist");
    const commentCollection = database.collection("comments");
    const newsletterCollection = database.collection("newsletter_subscribers");
    const notificationCollection = database.collection("notifications");
    const userProfilesCollection = database.collection("user_profiles");

    // ==================== NOTIFICATION ROUTES ====================

    // GET: Get notifications for ALL users
    app.get("/notifications", async (req, res) => {
      try {
        const notifications = await notificationCollection
          .find({})
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray();

        res.send(notifications);
      } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch notifications",
        });
      }
    });

    // PUT: Mark a notification as read
    app.put("/notifications/:notificationId/read", async (req, res) => {
      try {
        const { notificationId } = req.params;

        const result = await notificationCollection.updateOne(
          { _id: new ObjectId(notificationId) },
          { $set: { read: true, readAt: new Date() } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Notification not found",
          });
        }

        res.send({
          success: true,
          message: "Notification marked as read",
        });
      } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).send({
          success: false,
          message: "Failed to mark notification as read",
        });
      }
    });

    // PUT: Mark all notifications as read
    app.put("/notifications/read-all", async (req, res) => {
      try {
        const result = await notificationCollection.updateMany(
          { read: false },
          { $set: { read: true, readAt: new Date() } }
        );

        res.send({
          success: true,
          message: "All notifications marked as read",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).send({
          success: false,
          message: "Failed to mark all notifications as read",
        });
      }
    });

    // GET: Get unread notification count
    app.get("/notifications/unread-count", async (req, res) => {
      try {
        const count = await notificationCollection.countDocuments({
          read: false,
        });

        res.send({ count });
      } catch (error) {
        console.error("Error fetching unread count:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch unread count",
        });
      }
    });

    // ==================== NEWSLETTER ROUTES ====================

    // GET: Get all newsletter subscribers
    app.get("/newsletter_subscribers", async (req, res) => {
      try {
        const result = await newsletterCollection.find({}).toArray();
        res.send(result);
      } catch (err) {
        console.error("Failed to fetch subscribers:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // POST: Add a new newsletter subscriber with notification
    app.post("/api/subscribe", async (req, res) => {
      try {
        const { name, email, age, country } = req.body;

        // Basic validation
        if (!name || !email || !age || !country) {
          return res.status(400).json({ message: "All fields are required." });
        }

        // Check if already subscribed
        const existingSubscriber = await newsletterCollection.findOne({
          email,
        });
        if (existingSubscriber) {
          return res.status(400).json({
            message: "This email is already subscribed.",
          });
        }

        const result = await newsletterCollection.insertOne({
          name,
          email,
          age,
          country,
          subscribedAt: new Date(),
        });

        // Create notification for ALL logged in users
        const notification = {
          title: "New Subscriber! 🎉",
          message: `${name} from ${country} just subscribed to our newsletter`,
          type: "new_subscriber",
          subscriberData: { name, email, age, country },
          read: false,
          createdAt: new Date(),
        };

        await notificationCollection.insertOne(notification);

        res.status(201).json({
          message: "Successfully subscribed!",
          id: result.insertedId,
        });
      } catch (error) {
        console.error("Error during newsletter subscription:", error);
        res.status(500).json({
          message: "An error occurred during subscription.",
        });
      }
    });

    // ==================== BLOG ROUTES ====================

    // POST: Add a blog
    app.post("/addBlog", async (req, res) => {
      const blog = req.body;
      blog.createdAt = new Date();
      blog.likes = blog.likes || 0;
      blog.likedBy = blog.likedBy || [];
      const result = await blogCollection.insertOne(blog);
      res.send(result);
    });

    // GET: Fetch blogs with optional category, search, and pagination
    app.get("/blogs", async (req, res) => {
      const { category, search, page = 1, limit = 12 } = req.query;

      const filter = {};

      if (category && category !== "All") {
        filter.category = category;
      }
      if (search && search.trim() !== "") {
        filter.title = new RegExp(search.trim(), "i");
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      try {
        const totalBlogs = await blogCollection.countDocuments(filter);

        const blogs = await blogCollection
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        res.send({ blogs, totalBlogs });
      } catch (error) {
        console.error("Error fetching blogs with filter:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch blogs" });
      }
    });

    // GET: Total count of all blogs
    app.get("/blogs/count", async (req, res) => {
      try {
        const count = await blogCollection.countDocuments();
        res.send({ count });
      } catch (error) {
        console.error("Error fetching blog count:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch blog count" });
      }
    });

    // GET: 8 recent blogs
    app.get("/recent", async (req, res) => {
      const blogs = await blogCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(8)
        .toArray();
      res.send(blogs);
    });

    // GET: Get blog by ID
    app.get("/blog/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const blog = await blogCollection.findOne({ _id: new ObjectId(id) });
        if (!blog) {
          return res
            .status(404)
            .send({ success: false, message: "Blog not found" });
        }

        if (!blog.likes) blog.likes = 0;
        if (!blog.likedBy) blog.likedBy = [];

        res.send(blog);
      } catch (error) {
        res.status(400).send({ success: false, message: "Invalid blog ID" });
      }
    });

    // PUT: Update a blog by ID
    app.put("/blog/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      try {
        const result = await blogCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              title: updatedData.title,
              image: updatedData.image,
              category: updatedData.category,
              shortDescription: updatedData.shortDescription,
              longDescription: updatedData.longDescription,
              updatedAt: new Date(),
            },
          }
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Blog not found" });
        }

        res.send({ success: true, message: "Blog updated successfully" });
      } catch (error) {
        console.error("Failed to update blog:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to update blog" });
      }
    });

    // PUT: Like/Unlike a blog
    app.put("/blog/:id/like", async (req, res) => {
      const blogId = req.params.id;
      const { userEmail } = req.body;
      if (!userEmail) {
        return res
          .status(400)
          .send({ success: false, message: "User email is required." });
      }
      try {
        const blog = await blogCollection.findOne({
          _id: new ObjectId(blogId),
        });

        if (!blog) {
          return res
            .status(404)
            .send({ success: false, message: "Blog not found." });
        }

        const hasLiked = blog.likedBy && blog.likedBy.includes(userEmail);
        let updateDoc;

        if (hasLiked) {
          updateDoc = {
            $inc: { likes: -1 },
            $pull: { likedBy: userEmail },
          };
        } else {
          updateDoc = {
            $inc: { likes: 1 },
            $push: { likedBy: userEmail },
          };
        }

        const result = await blogCollection.updateOne(
          { _id: new ObjectId(blogId) },
          updateDoc
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Blog not found." });
        }

        res.send({
          success: true,
          message: "Like status updated successfully.",
        });
      } catch (error) {
        console.error("Failed to update like status:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to update like status." });
      }
    });

    // GET: Total count of all likes across all blogs
    app.get("/likes/count", async (req, res) => {
      try {
        const result = await blogCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalLikes: { $sum: "$likes" },
              },
            },
          ])
          .toArray();

        const count = result.length > 0 ? result[0].totalLikes : 0;
        res.send({ count });
      } catch (error) {
        console.error("Error fetching total likes count:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch total likes count",
        });
      }
    });

    // ==================== WISHLIST ROUTES ====================

    // POST: Add to Wishlist
    app.post("/wishlist", async (req, res) => {
      const { blogId, title, image, category, userEmail } = req.body;

      const existing = await wishlistCollection.findOne({ blogId, userEmail });
      if (existing) {
        return res.send({ success: false, message: "Already in wishlist" });
      }

      const result = await wishlistCollection.insertOne({
        blogId,
        title,
        image,
        category,
        userEmail,
        addedAt: new Date(),
      });

      res.send({ success: true, insertedId: result.insertedId });
    });

    // GET: Wishlist by user email
    app.get("/wishlist", async (req, res) => {
      const email = req.query.email;
      if (!email) return res.send([]);

      try {
        const wishlist = await wishlistCollection
          .find({ userEmail: email })
          .toArray();
        res.send(wishlist);
      } catch (error) {
        console.error("Wishlist fetch error:", error);
        res.status(500).send({ success: false, message: "Failed to fetch" });
      }
    });

    // GET: Total count of all wishlist items
    app.get("/wishlist/count", async (req, res) => {
      try {
        const count = await wishlistCollection.countDocuments();
        res.send({ count });
      } catch (error) {
        console.error("Error fetching wishlist count:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch wishlist count" });
      }
    });

    // DELETE: Remove from Wishlist by wishlist _id
    app.delete("/wishlist/:id", async (req, res) => {
      const id = req.params.id;
      const result = await wishlistCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // ==================== COMMENT ROUTES ====================

    // POST: Add a comment
    app.post("/comments", async (req, res) => {
      const comment = {
        ...req.body,
        createdAt: new Date(),
      };
      const result = await commentCollection.insertOne(comment);
      res.send({ success: true, result });
    });

    // GET: Total count of all comments
    app.get("/comments/count", async (req, res) => {
      try {
        const count = await commentCollection.countDocuments();
        res.send({ count });
      } catch (error) {
        console.error("Error fetching comment count:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch comment count" });
      }
    });

    // GET: Get comments for a blog
    app.get("/comments/:blogId", async (req, res) => {
      const blogId = req.params.blogId;
      const result = await commentCollection
        .find({ blogId })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // ==================== PROFILE ROUTES ====================

    // GET: Get user profile by email
    app.get("/profile/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const profile = await userProfilesCollection.findOne({ email });

        if (!profile) {
          return res.status(404).send({
            success: false,
            message: "Profile not found",
          });
        }

        res.send({ success: true, profile });
      } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch profile",
        });
      }
    });

    // POST: Create or update user profile
    app.post("/profile", async (req, res) => {
      try {
        const {
          email,
          name,
          bio,
          location,
          website,
          twitter,
          github,
          linkedin,
        } = req.body;

        if (!email) {
          return res.status(400).send({
            success: false,
            message: "Email is required",
          });
        }

        const profileData = {
          email,
          name: name || "",
          bio: bio || "",
          location: location || "",
          website: website || "",
          twitter: twitter || "",
          github: github || "",
          linkedin: linkedin || "",
          updatedAt: new Date(),
        };

        const result = await userProfilesCollection.updateOne(
          { email },
          {
            $set: profileData,
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        );

        res.send({
          success: true,
          message: "Profile saved successfully",
          result,
        });
      } catch (error) {
        console.error("Error saving profile:", error);
        res.status(500).send({
          success: false,
          message: "Failed to save profile",
        });
      }
    });

    // PUT: Update profile image
    app.put("/profile/image", async (req, res) => {
      try {
        const { email, photoURL } = req.body;

        if (!email || !photoURL) {
          return res.status(400).send({
            success: false,
            message: "Email and photoURL are required",
          });
        }

        const result = await userProfilesCollection.updateOne(
          { email },
          {
            $set: {
              photoURL,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );

        res.send({
          success: true,
          message: "Profile image updated successfully",
          result,
        });
      } catch (error) {
        console.error("Error updating profile image:", error);
        res.status(500).send({
          success: false,
          message: "Failed to update profile image",
        });
      }
    });

    // ==================== USER STATS ROUTES ====================

    // GET: Get user stats (blogs, likes, comments, wishlist)
    app.get("/profile/:email/stats", async (req, res) => {
      try {
        const email = req.params.email;

        const blogCount = await blogCollection.countDocuments({ email });
        const wishlistCount = await wishlistCollection.countDocuments({
          userEmail: email,
        });
        const commentCount = await commentCollection.countDocuments({
          userEmail: email,
        });

        const userBlogs = await blogCollection.find({ email }).toArray();
        const totalLikes = userBlogs.reduce(
          (sum, blog) => sum + (blog.likes || 0),
          0
        );

        res.send({
          success: true,
          stats: {
            blogs: blogCount,
            wishlist: wishlistCount,
            comments: commentCount,
            likes: totalLikes,
          },
        });
      } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch user stats",
        });
      }
    });

    // GET: Get user's own blogs with like and comment counts
    app.get("/user/blogs/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const userBlogs = await blogCollection
          .find({ email })
          .sort({ createdAt: -1 })
          .toArray();

        const blogsWithStats = await Promise.all(
          userBlogs.map(async (blog) => {
            const commentCount = await commentCollection.countDocuments({
              blogId: blog._id.toString(),
            });

            return {
              ...blog,
              commentCount,
              likes: blog.likes || 0,
              likedBy: blog.likedBy || [],
            };
          })
        );

        res.send({
          success: true,
          blogs: blogsWithStats,
          totalBlogs: userBlogs.length,
        });
      } catch (error) {
        console.error("Error fetching user blogs:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch user blogs",
        });
      }
    });

    // GET: Top 10 blogs by longDescription word count
    app.get("/blogs/top", async (req, res) => {
      try {
        const blogs = await blogCollection.find().toArray();

        const sortedBlogs = blogs
          .map((blog) => ({
            ...blog,
            wordCount: blog.longDescription
              ? blog.longDescription.trim().split(/\s+/).length
              : 0,
          }))
          .sort((a, b) => b.wordCount - a.wordCount)
          .slice(0, 10);

        res.send(sortedBlogs);
      } catch (error) {
        console.error("Error fetching top blogs:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch top blogs" });
      }
    });

    // GET: Recent blogs
    app.get("/recent-blogs", async (req, res) => {
      try {
        const blogs = await blogCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();
        res.send(blogs);
      } catch (error) {
        console.error("Error fetching recent blogs:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch recent blogs" });
      }
    });

    console.log("✅ Server started successfully!");
    console.log(
      "🔔 Notification system: ANY logged in user can see new subscribers"
    );
  } catch (error) {
    console.error("❌ Error starting server:", error);
  }
}

run().catch(console.dir);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Idea Canvas Blogs API",
    version: "1.0.0",
    features: {
      notifications: "All logged in users can see new subscriber notifications",
      blogs: "Full CRUD operations",
      newsletter: "Subscribe with notifications",
    },
  });
});

// Health check route
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
  console.log(`📍 API Base URL: http://localhost:${port}`);
});
