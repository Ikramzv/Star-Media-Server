const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const userRouter = require("./routes/users.js");
const authRouter = require("./routes/auth.js");
const postRouter = require("./routes/posts.js");
const ConversationRouter = require("./routes/Conversations.js");
const MessageRouter = require("./routes/Messages.js");
const { createServer } = require("http");

if (process.env.NODE_ENV !== "production") require("dotenv").config();

const app = express();
const server = createServer(app);
const io = require("socket.io")(server);

app.use(cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(helmet());
app.use(morgan("common"));

// ROUTES

app.use("/users", userRouter);
app.use("/auth", authRouter);
app.use("/posts", postRouter);
app.use("/conversations", ConversationRouter);
app.use("/messages", MessageRouter);

// ===

// SOCKET

let users = [];

const addUser = (userId, socketId) => {
  !users.some((user) => user.userId === userId) &&
    users.push({ userId, socketId });
};

const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
  return users.find((user) => user.userId === userId);
};

io.on("connection", (socket) => {
  // connection
  console.log("user connected");

  // take connected user id from client and send online user to client
  socket.on("sendUser", (userId) => {
    addUser(userId, socket.id);
    io.emit("getUsers", users);
  });
  // send message and get message
  socket.on(
    "sendMessage",
    ({ senderId, receiverId, receiver, text, conversationId }) => {
      const user = getUser(receiverId);
      // if there is a online friend send an event to client else don't send an event
      user &&
        socket.to(user.socketId).emit("getMessage", {
          senderId,
          text,
          conversationId,
          receiver,
        });
    }
  );

  // disconnection
  socket.on("disconnect", () => {
    console.log("a user disconnected");
    removeUser(socket.id);
    io.emit("getUsers", users);
  });
});

// ==

app.get("/", (req, res) => {
  res.send("Server is running");
});

mongoose
  .connect(process.env.MONGO_URL, { dbName: "ChatApp" })
  .then(() => {
    console.log("MongDB connected");
  })
  .catch((err) => console.log(err));

server.listen(process.env.PORT || 5000, () => {
  console.log("Server up and running on port 5000");
});
