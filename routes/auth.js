const { Router } = require("express");
const User = require("../models/User.js");
const bcrypt = require("bcrypt");
const verify = require("./verify");

const router = Router();

// Register

router.post("/register", async (req, res) => {
  const user = new User(req.body);

  try {
    const registeredUser = await user.save();

    const { password, ...others } = registeredUser._doc;
    req.session.user = {
      id: user._id,
      admin: false, // for now
      username: user.username,
    };
    res.status(200).json(others);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

router.post("/login", async (req, res) => {
  try {
    // Check the given user email, then if exists check password,but not send error
    const user = await User.findOne({ email: req.body.email });
    if (!user)
      return res.status(403).send("No user was found with given email");
    // Check encoded password bcrypt compare function
    bcrypt.compare(req.body.password, user.password, (err, result) => {
      if (!result) return res.status(403).send("Invalid password");
      const { password, ...others } = user._doc;

      req.session.user = {
        id: user._id,
        isAdmin: false, // for now
        username: user.username,
      };
      res.status(200).json(others);
    });
  } catch (error) {
    res.status(403).send(error.message);
  }
});

router.post("/logout", async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) return res.status(500).json(err);
      return res.clearCookie("uid").status(200).send("Logged out");
    });
  } catch (error) {
    return res.status(500).json(error);
  }
});

// call me

router.get("/me", verify, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    return res.status(200).json(me);
  } catch (error) {
    return res.status(500).json(error);
  }
});

module.exports = router;
