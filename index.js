const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("idea-Canvas");
    const blogCollection = database.collection("blogs");
    const wishlistCollection = database.collection("wishlist");

    // POST: Add a blog
    app.post("/addBlog", async (req, res) => {
      const blog = req.body;
      blog.createdAt = new Date();
      const result = await blogCollection.insertOne(blog);
      res.send(result);
    });

    // ❤️ POST: Add to Wishlist
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

    // 🧾 GET: Wishlist by user email
    app.get("/wishlist", async (req, res) => {
      const email = req.query.email;
      const wishlist = await wishlistCollection
        .find({ userEmail: email })
        .toArray();
      res.send(wishlist);
    });

    // ❌ DELETE: Remove from Wishlist
    const { ObjectId } = require("mongodb");
    app.delete("/wishlist/:id", async (req, res) => {
      const id = req.params.id;
      const result = await wishlistCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // GET: 6 recent blogs
    app.get("/recent", async (req, res) => {
      const blogs = await blogCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(blogs);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("welcome to our Blogs");
});
app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
