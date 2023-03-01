const { Router } = require("express");
const Message = require("../models/Message");
const verify = require("./verify");

const router = Router();

// get all messages

router.get("/", verify, async (req, res) => {
  try {
    const messages = await Message.find();
    res.status(200).json(messages);
  } catch (error) {
    res.status(400).json(error);
  }
});

// get all unread messages

router.get("/unread", async (req, res) => {
  try {
    const messages = await Message.aggregate([
      {
        $match: {
          read: false,
        },
      },
    ]);
    return res.status(200).json(messages);
  } catch (error) {}
});

// send message

router.post("/", verify, async (req, res) => {
  const newMessage = new Message({
    ...req.body,
    sender: req.user.id,
  });
  try {
    const savedMessage = await newMessage.save();
    res.status(200).json(savedMessage);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// get message

router.get("/:conversationId", verify, async (req, res) => {
  const { conversationId } = req.params;
  try {
    const messages = await Message.aggregate([
      {
        $match: {
          $expr: {
            $eq: ["$conversationId", conversationId],
          },
        },
      },
      {
        $sort: {
          createdAt: 1,
        },
      },
      {
        $lookup: {
          from: "users",
          let: {
            sender: "$sender",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: "$_id" }, "$$sender"],
                },
              },
            },
            {
              $project: {
                username: 1,
                userProfileImage: 1,
              },
            },
          ],
          as: "receiver",
        },
      },
      {
        $unwind: "$receiver",
      },
    ]);
    res.status(200).send(messages);
  } catch (error) {
    res.status(400).json(error);
  }
});

// set message read

router.patch("/messageRead/:messageId", verify, async (req, res) => {
  const { messageId } = req.params;
  try {
    const message = await Message.findByIdAndUpdate(
      messageId,
      {
        $set: {
          read: true,
        },
      },
      { new: true }
    );
    res.status(200).json(message);
  } catch (error) {
    res.status(400).json(error);
  }
});

// set message red with conversation

router.patch(
  "/conversationMessageRead/:conversationId",
  verify,
  async (req, res) => {
    const { conversationId } = req.params;
    try {
      const messages = await Message.find({
        conversationId: conversationId,
      });

      const updatedMessages = await Promise.all(
        messages.map((m) => {
          return m.updateOne(
            {
              $set: {
                read: true,
              },
            },
            { new: true }
          );
        })
      );

      res.status(200).json(updatedMessages);
    } catch (error) {
      res.status(400).json(error);
    }
  }
);

// Delete message

router.delete("/message/:id", verify, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (msg.sender !== req.user.id) {
      return res
        .status(401)
        .json("Only an author of message can delete that message");
    }

    await msg.deleteOne();
    return res.status(200).send("Message deleted succesfully");
  } catch (error) {
    return res.status(500).json(error);
  }
});

// edit message

router.patch("/message/:id", verify, async (req, res) => {
  try {
    const updatedMsg = await Message.updateOne(
      {
        _id: req.params.id,
        sender: req.user.id,
      },
      {
        $set: {
          text: req.body.msgText,
        },
      },
      { new: true }
    );
    return res.status(200).json(updatedMsg);
  } catch (error) {
    return res.status(500).json(error);
  }
});

module.exports = router;
