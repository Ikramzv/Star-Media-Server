const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const { createServer } = require("http");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cluster = require("cluster");
const os = require("os");
const Message = require("./models/Message.js");

if (cluster.isPrimary) {
  const numCpus = os.cpus().length;
  for (let i = 0; i < numCpus; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    cluster.fork();
  });
} else {
  if (process.env.NODE_ENV !== "production") require("dotenv").config();

  const app = express();
  const server = createServer(app);
  const io = require("socket.io")(server);

  app.use(
    cors({
      credentials: true,
      origin: process.env.APP_URL,
    })
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(helmet());
  app.use(helmet.crossOriginResourcePolicy({ policy: "same-origin" }));
  app.use(morgan("common"));

  // SESSION

  app.use(
    session({
      name: "uid",
      secret: process.env.SESSION_SECRET,
      store: MongoStore.create({
        mongoUrl: process.env.MONGO_URL,
        ttl: 1000 * 60 * 60,
        collectionName: "sessions",
        dbName: "ChatApp",
        stringify: true,
      }),
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

  let users = new Map();
  let sockets = new Map();

  const addUser = (userId, socketId) => {
    if (!users.has(userId)) {
      users.set(userId, { userId, socketId });
      sockets.set(socketId, userId);
    } else {
      const user = users.get(userId);
      users.set(userId, { userId, socketId });
      sockets.delete(user.socketId);
      sockets.set(socketId, userId);
    }
  };

  const removeUser = (socketId) => {
    const userId = sockets.get(socketId);
    console.log(userId);
    users.delete(userId);
    sockets.delete(socketId);
  };

  const getUser = (userId) => {
    return users.get(userId);
  };

  io.on("connection", (socket) => {
    // connection
    console.log("user connected", users);

    // take connected user id from client and send online user to client
    socket.on("sendUser", (userId) => {
      addUser(userId, socket.id);
      console.log("Users : ", users);
      io.emit("getUsers", Array.from(users.values()));
    });
    // send message and get message
    socket.on(
      "sendMessage",
      ({ senderId, receiverId, receiver, text, conversationId }) => {
        const user = getUser(receiverId);
        // if there is a online friend, send an event to client else don't send an event
        if (!user) return;

        console.log(text);
        socket.to(user.socketId).emit("getMessage", {
          senderId,
          text,
          conversationId,
          receiver,
        });
      }
    );

    socket.on("deleteMessage", (data) => {
      const { receiverId } = data;
      const user = getUser(receiverId);
      if (!user) return;
      socket.to(user.socketId).emit("deleteMessageClient", data);
      // socket.to
    });

    socket.on("editMessage", (data) => {
      const { receiverId } = data;
      const user = getUser(receiverId);
      if (!user) return;
      socket.to(user.socketId).emit("editMessageClient", data);
    });

    // disconnection
    socket.on("disconnect", () => {
      console.log("a user disconnected");
      console.log(socket.id);
      console.log(Array.from(users.values()));
      removeUser(socket.id);
      console.log(Array.from(users.values()));
      io.emit("getUsers", Array.from(users.values()));

      socket.removeAllListeners();
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
}
