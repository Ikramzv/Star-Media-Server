const post_aggregate = (currentUser, req, since, additional) => {
  let inOrNin = "$in";
  if (additional) inOrNin = "$nin";
  return [
    {
      $match: {
        userId: {
          [inOrNin]: [...currentUser?.followings, req.user.id],
        },
        createdAt: {
          $lt: since,
        },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $limit: 5,
    },
    {
      $addFields: {
        convertedUserId: { $toObjectId: "$userId" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "convertedUserId",
        foreignField: "_id",
        as: "user",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              email: 1,
              userProfileImage: 1,
              city: 1,
              from: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "comments",
        let: {
          postId: "$_id",
        },
        as: "commentsCount",
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  "$postId",
                  {
                    $toString: "$$postId",
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: "$postId",
              count: {
                $count: {},
              },
            },
          },
          {
            $project: {
              _id: 0,
            },
          },
        ],
      },
    },
    {
      $project: {
        convertedUserId: 0,
      },
    },
    {
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $set: {
        commentsCount: {
          $ifNull: [
            {
              $arrayElemAt: ["$commentsCount", 0],
            },
            {
              count: 0,
            },
          ],
        },
      },
    },
    {
      $unwind: {
        path: "$commentsCount",
      },
    },
  ];
};

module.exports = {
  post_aggregate,
};
