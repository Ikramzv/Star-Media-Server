const Comment = require("../models/comment");
const User = require("../models/User");
const verifyToken = require("./verify");

const router = require("express").Router();

router.post("/", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { postId, comment } = req.body;
  try {
    const c = await new Comment({ userId, postId, comment }).save();

    return res.status(200).json(c);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

router.get("/comment/:postId", verifyToken, async (req, res) => {
  let { since } = req.query;
  since = since ? new Date(since) : new Date();
  console.log(since);
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
        $limit: 15,
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
