const express = require("express");
const mongoose = require('mongoose');
const ejs = require("ejs");
const dotenv = require('dotenv').config();

const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({extended:true}));
app.use(express.static("public"));

mongoose.connect(process.env.MONGODB_URI);

const postSchema = new mongoose.Schema({
  country: String,
  title: String,
  imageUrl: String,
  content: String,
  dateCreated: Number
});
postSchema.index({country: 'text', title: 'text', content: 'text'});
const Post = new mongoose.model("Post", postSchema);

// Homepage
app.get("/", async (req, res)=>{  // ?page=1size=6
  try {
    // define number of pages, number of documents per page, number of pages ...
    let {page=1, size=6} = req.query;
    const skip = (page - 1) * size;
    const numOfPosts = await Post.countDocuments();  // total number of posts
    const numOfPages = Math.ceil(numOfPosts / size);
    // fetch x(number of documents per page=size) latest documents for each page
    const posts = await Post.find().sort({ dateCreated: -1 }).select("title imageUrl").limit(size).skip(skip);
    // count the number of posts for each country (to display on the right side of the page)
    let countryCount = await Post.aggregate([{ $group : { _id : "$country", count: { $sum: 1 } } }])
    countryCount = countryCount.sort((a, b) => (b.count - a.count));

    res.render("home", {currentPage: parseInt(page), numOfPages: numOfPages, latestPosts: posts, countryCount: countryCount});

  } catch (e) {
    res.render("error", {errorMessage: e.message});
  }
});

// API for single post
app.route("/posts/:postId")

  .get(async(req, res)=>{
    try {
      const foundPost = await Post.findById(req.params.postId);
      const topPosts = await Post.find().sort({ dateCreated: -1 }).select("title imageUrl").limit(5);

      res.render("post", {postTitle: foundPost.title, postImage:foundPost.imageUrl,
          postContent: foundPost.content, topPosts: topPosts});
    } catch (e) {
      res.render("error", {errorMessage: e.message});
    }
  })

  .put(async(req, res)=>{
    try {
      await Post.replaceOne(
        {_id: req.params.postId},
        {country:req.body.country, title: req.body.title, imageUrl:req.body.imageUrl,
          content: req.body.content, dateCreated: req.body.dateCreated}
      )
      res.send("The post is updated succesfully");
    } catch (e) {
      res.send("An error occured while replacing the document.\n" + e.message);
    }
  })

  .patch(async(req, res)=>{
    try {
      await Post.updateOne({_id: req.params.postId}, {$set: req.body});
      res.send("The related field is updated succesfully");
    } catch (e) {
      res.send("An error occured while changing the document.\n" + e.message);
    }
  })

  .delete(async(req, res)=>{
    try {
      await Post.deleteOne({_id: req.params.postId});
      res.send("The post is deleted succesfully");
    } catch (e) {
      res.send("An error occured while deleting the document.\n" + e.message);
    }
  });

// Search Results page
app.get("/search", async(req, res)=>{ // ?q=keyword
  try {
    const docs = await Post.find({"$text": { $search: req.query.q }});
    res.render("srcresults", {foundPosts : docs});
  } catch (e) {
    res.render("error", {errorMessage: e.message});
  }
});

// Posts from only a single country
app.get("/country/:name", async(req, res)=>{
  try {
    const docs = await Post.find({ country: req.params.name });
    res.render("srcresults", {foundPosts : docs});
  } catch (e) {
    res.render("error", {errorMessage: e.message});
  }
});

// UI for Posting a new post
app.get("/compose", (req, res)=>{
  res.render("compose");
});

app.post("/compose", async(req, res)=>{
  try {
    const newPost = new Post({
      // comes from user inputs (compose.ejs)
      country: req.body.postCountry,
      title: req.body.postTitle,
      imageUrl: req.body.postImage,
      content: req.body.postBody,
      dateCreated: Date.now()
    });
    await newPost.save();
    res.redirect("/");

  } catch (e) {
    res.render("error", {errorMessage: e.message});
  }
});

app.get("/about", (req, res)=>{
  res.render("about");
});


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, ()=>{
  console.log("Server is running succesfully");
});
