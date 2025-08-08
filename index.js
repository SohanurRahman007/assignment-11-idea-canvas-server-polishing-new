const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nkycuoy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// MongoDB Client
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

    // POST: Add a blog
    app.post("/addBlog", async (req, res) => {
      const blog = req.body;
      blog.createdAt = new Date();
      const result = await blogCollection.insertOne(blog);
      res.send(result);
    });

    // GET: Fetch blogs with optional category, search, and pagination
    app.get("/blogs", async (req, res) => {
      // Extract query parameters, providing default values for pagination
      const { category, search, page = 1, limit = 12 } = req.query;

      // Initialize an empty filter object
      const filter = {};

      // Add category filter if it's provided and not 'All'
      if (category && category !== "All") {
        filter.category = category;
      }
      if (search && search.trim() !== "") {
        filter.title = new RegExp(search.trim(), "i");
      }

      // Calculate how many documents to skip for the current page
      const skip = (parseInt(page) - 1) * parseInt(limit);

      try {
        // Get the total count of documents that match the filter
        const totalBlogs = await blogCollection.countDocuments(filter);

        // Fetch the blogs for the current page, sorting by creation date
        const blogs = await blogCollection
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        // Send the paginated blogs and the total count in a single response
        res.send({ blogs, totalBlogs });
      } catch (error) {
        console.error("Error fetching blogs with filter:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch blogs" });
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

        // Ensure 'likes' and 'likedBy' exist for a consistent response
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

    // GET: Wishlist by user email with blog details
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

    // DELETE: Remove from Wishlist by wishlist _id
    app.delete("/wishlist/:id", async (req, res) => {
      const id = req.params.id;
      const result = await wishlistCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // GET: Get comments for a blog
    app.get("/comments/:blogId", async (req, res) => {
      const blogId = req.params.blogId;
      const result = await commentCollection.find({ blogId }).toArray();
      res.send(result);
    });

    // POST: Add a comment
    app.post("/comments", async (req, res) => {
      const result = await commentCollection.insertOne(req.body);
      res.send({ success: true, result });
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

    // Ping MongoDB
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // No closing client here to keep server running
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Welcome to our Blogs API");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// checking
