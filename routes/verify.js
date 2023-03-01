const User = require("../models/User");

async function verifyToken(req, res, next) {
  const authUser = req.session.user;
  if (!authUser) return res.status(401).send("Unauthorized user");
  req.user = authUser;

  next();
}

module.exports = verifyToken;
