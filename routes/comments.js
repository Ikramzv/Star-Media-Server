const Comment = require("../models/comment");
const User = require("../models/User");
const verifyToken = require("./verify");

const router = require("express").Router();

// create comment

router.post("/", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { postId, comment, _id } = req.body;
  console.log(req.body, _id);
  try {
    const c = await new Comment({ userId, postId, comment, _id }).save();

    return res.status(200).json(c);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

// edit comment

router.patch("/:commentId", async (req, res) => {
  try {
    const updated = await Comment.findByIdAndUpdate(
      req.params.commentId,
      [
        {
          $set: {
            comment: req.body.comment,
          },
        },
      ],
      { new: true }
    );
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

// delete comment

router.delete("/:commentId", verifyToken, async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (req.user.id !== comment?.userId)
    return res
      .status(401)
      .send("Only the owner of the comment can delete comment");

  try {
    await comment.deleteOne();
    return res.status(200).send("post deleted");
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

// get comments

router.get("/comment/:postId", verifyToken, async (req, res) => {
  let { since } = req.query;
  since = since ? new Date(since) : new Date();
  try {
    const comments = await Comment.aggregate([
      {
        $match: {
          postId: req.params.postId,
          createdAt: {
            $lt: since,
          },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $limit: 10,
      },
      {
        $lookup: {
          from: "users",
          let: {
            userId: "$userId",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    "$_id",
                    {
                      $toObjectId: "$$userId",
                    },
                  ],
                },
              },
            },
            {
              $project: {
                username: 1,
                userProfileImage: 1,
                _id: 1,
              },
            },
          ],
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
    ]);
    return res.status(200).json(comments);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

// like comment

router.patch("/like/:commentId", verifyToken, async (req, res) => {
  try {
    const updated = await Comment.findByIdAndUpdate(
      req.params.commentId,
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
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

module.exports = router;
