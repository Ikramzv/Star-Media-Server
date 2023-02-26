const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
    },
    postId: {
      type: String,
    },
    comment: {
      type: String,
    },
    likes: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true, _id: false }
);

module.exports = mongoose.model("Comment", commentSchema);
