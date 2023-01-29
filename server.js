const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const { createServer } = require("http");
const session = require("express-session");
const Redis = require("ioredis");

const RedisClient = new Redis();
const RedisStore = require("connect-redis")(session);

if (process.env.NODE_ENV !== "production") require("dotenv").config();

const app = express();
const server = createServer(app);
const io = require("socket.io")(server);

app.use(cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(helmet());
app.use(morgan("common"));

// SESSION

app.use(
  session({
    name: "uid",
    secret: process.env.SESSION_SECRET,
    store: new RedisStore({ client: RedisClient, disableTouch: false }),
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60,
      sameSite: "lax",
    },
    resave: false,
    saveUninitialized: false,
  })
);

// ROUTES

app.use("/users", require("./routes/users.js"));
app.use("/auth", require("./routes/auth.js"));
app.use("/posts", require("./routes/posts.js"));
app.use("/conversations", require("./routes/Conversations.js"));
app.use("/messages", require("./routes/Messages.js"));
app.use("/comments", require("./routes/comments"));

// ===

// SOCKET

let users = [];

const addUser = (userId, socketId) => {
  if (!users.some((user) => user.userId === userId)) {
    users.push({ userId, socketId });
  } else {
    users = users.map((user) =>
      user.userId === userId ? { userId, socketId } : user
    );
  }

  return users;
};

const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
  return users;
};

const getUser = (userId) => {
  return users.find((user) => user.userId === userId);
};

io.on("connection", (socket) => {
  // connection
  console.log("user connected", users);

  // take connected user id from client and send online user to client
  socket.on("sendUser", (userId) => {
    users = addUser(userId, socket.id);
    console.log("send user", users);
    io.emit("getUsers", users);
  });
  // send message and get message
  socket.on(
    "sendMessage",
    ({ senderId, receiverId, receiver, text, conversationId }) => {
      const user = getUser(receiverId);
      console.log(user, users);
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
    users = removeUser(socket.id);
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
