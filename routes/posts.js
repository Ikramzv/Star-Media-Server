const { Router, response } = require("express");
const Post = require("../models/Post");
const verify = require("./verify");
const mongoose = require("mongoose");
const User = require("../models/User");
const Comment = require("../models/comment");
const { post_aggregate } = require("../utils");

const router = Router();

// create post

router.post("/", verify, async (req, res) => {
  const newPost = new Post({
    ...req.body,
    userId: req.user.id,
  });
  try {
    const savePost = await newPost.save();
    res.status(200).json(savePost);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// update a post

router.put("/:id", verify, async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id);
  if (post.userId.toString() === req.user.id) {
    try {
      const updatedPost = await Post.findByIdAndUpdate(
        id,
        {
          $set: req.body,
        },
        { new: true }
      );
      res.status(200).json(updatedPost);
    } catch (err) {
      res.status(403).send(err.message);
    }
  } else {
    res.status(403).send("You are not allowed for editing the post");
  }
});

// delete a post

router.delete("/:id", verify, async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id);
  if (post.userId.toString() === req.user.id) {
    try {
      await post.deleteOne();
      await Comment.deleteMany({
        postId: post._id,
      });
      res.status(200).send("Post has been deleted");
    } catch (err) {
      res.status(403).send(err.message);
    }
  } else {
    res.status(403).send("You are not allowed for deleting the post");
  }
});

// edit post

router.patch("/edit/:id", verify, async (req, res) => {
  const { id } = req.params;
  const { desc } = req.body;
  try {
    const post = await Post.findOneAndUpdate(
      { _id: id },
      [
        {
          $set: {
            desc,
          },
        },
      ],
      { new: true }
    );
    return res.status(200).json(post);
  } catch (error) {
    return res.status(200).send(error.message);
  }
});

// like a post

router.put("/:id/like", verify, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(403).send("No post was found with the given id");
  try {
    const post = await Post.updateOne(
      { _id: id },
      [
        {
          $set: {
            likes: {
              $cond: {
                if: {
                  $in: [req.user.id, "$likes"],
                },
                then: {
                  $setDifference: ["$likes", [req.user.id]],
                },
                else: {
                  $concatArrays: ["$likes", [req.user.id]],
                },
              },
            },
          },
        },
      ],
      { new: true }
    );
    return res.status(200).json(post);
  } catch (err) {
    res.status(403).send(err.message);
  }
});

// get a post

router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    res.status(200).json(post);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// get timeline posts

router.get("/timeline/all", verify, async (req, res) => {
  let { since } = req.query;
  since = since ? new Date(since) : new Date();
  try {
    const currentUser = await User.findById(req.user.id);
    const allPosts = await Post.aggregate(
      post_aggregate(currentUser, req, since)
    );
    res.status(200).json(allPosts);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// get posts by 5-5

router.get("/timeline/additional_to_show", verify, async (req, res) => {
  let { since } = req.query;
  since = since ? new Date(since) : new Date();
  console.log(since);
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const posts = await Post.aggregate(
      post_aggregate(user, req, since, "additional")
    );
    return res.status(200).json(posts);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

module.exports = router;
