const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const passport = require("passport");
const checkAuthentication = require("../middleware/checkAuthentication");
const Plant = require("../models/Plant");
const stripe = require("stripe")("sk_test_tR3PYbcVNZZ796tH88S4VQ2u");
const Order = require("../models/Order");

// Get Route For Register
router.get("/register", (req, res) => {
  res.render("users/register");
});

// Post Route For Users Register
router.post("/register", async (req, res) => {
  const foundDuplicate = async (email) => {
    try {
      const duplicate = await User.findOne({ email: email });
      if (duplicate) return true;
      return false;
    } catch (e) {
      console.log(e);
      return false;
    }
  };
  const errors = [];
  const nameRagex = /^[a-zA-Z ]*$/;
  const addressRagex = /^[a-zA-Z0-9]*$/;
  const emailRagex =
    /^[a-zA-Z0-9\-_]+(\.[a-zA-Z0-9\-_]+)*@[a-z0-9]+(\-[a-z0-9]+)*(\.[a-z0-9]+(\-[a-z0-9]+)*)*\.[a-z]{2,4}$/;
  const newUser = {
    name: req.body.name,
    address: req.body.address,
    email: req.body.email,
    password: req.body.password,
  };
  if (!nameRagex.test(newUser.name)) {
    errors.push({
      msg: `Name doesn't Contain any number or a special Charecter.`,
    });
  }
  if (!addressRagex.test(newUser.address)) {
    errors.push({
      msg: `Address is not Valid. Please enter a valid address.`,
    });
  }
  if (!emailRagex.test(newUser.email)) {
    errors.push({
      msg: `Email is not Valid. Please enter a valid Email.`,
    });
  }
  if (newUser.password.length < 6) {
    errors.push({
      msg: `Password must contain atleast 6 Characters`,
    });
  }
  if (await foundDuplicate(newUser.email)) {
    errors.push({
      msg: `Email is already Registered`,
    });
  }
  if (errors.length > 0) {
    res.render("users/register", { errors: errors, newUser: newUser });
  } else {
    try {
      const hashedPassword = await bcrypt.hash(newUser.password, 10);
      try {
        const savedUser = new User({
          name: newUser.name,
          address: newUser.address,
          email: newUser.email,
          password: hashedPassword,
        });
        await savedUser.save();
        
        req.flash("success", "You are now Registered.");
        res.redirect("/users/login");
      } catch (e) {
        res.render("users/register", {
          errors: { msg: "Internal Server Error" },
          newUser: newUser,
        });
      }
    } catch (e) {
      res.render("users/register", {
        errors: { msg: "Internal Server Error" },
        newUser: newUser,
      });
    }
  }
});

// Users Login Route
router.get("/login", (req, res) => {
  res.render("users/login");
});

// Users Login Post Route
router.post(
  "/login",
  passport.authenticate("local", {
    successFlash: true,
    successRedirect: "/plants",
    failureFlash: true,
    failureRedirect: "/users/login",
  }),
  (req, res) => {}
);

router.get("/logout", (req, res) => {
  req.logOut();
  res.redirect("/plants");
});

// Cart Route
router.put("/cart/:id", checkAuthentication, async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id);
    const user = req.user;
    user.carts.push({ plant });
    User.findByIdAndUpdate(user.id, user, (err, savedUser) => {
      if (err) {
        console.log(err);
        res.redirect("back");
      } else {
        res.redirect("/users/dashboard");
      }
    });
  } catch (e) {
    console.log(e);
    res.redirect("back");
  }
});

// Delete Item
router.delete("/cart/:id/delete", checkAuthentication, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const index = user.carts.findIndex((plant) => plant.equals(req.params.id));
    user.carts.splice(index, 1);
    User.findByIdAndUpdate(user.id, user, (err, savedUser) => {
      if (err) {
        console.log(err);
        res.redirect("back");
      } else {
        res.redirect("/users/dashboard");
      }
    });
  } catch (e) {
    console.log(e);
    res.redirect("back");
  }
});
// Dashboard
router.get("/dashboard", checkAuthentication, (req, res) => {
  if (req.user.role !== "admin") {
    User.findById(req.user.id)
      .populate("carts.plant")
      .exec((err, user) => {
        if (err) {
          res.redirect("/plants");
        } else {
          //  res.json(user);
          res.render("users/dashboard", { user: user });
        }
      });
  } else {
    res.redirect("/admin");
  }
});

router.post("/checkout", checkAuthentication, async (req, res) => {
  try {
    const oldUser = req.user;
    oldUser.carts.forEach((cartItem) => {
      cartItem.quantity = req.body[cartItem.plant];
    });
    await User.findByIdAndUpdate(oldUser.id, oldUser);

    User.findById(oldUser.id)
      .populate("carts.plant")
      .exec((err, user) => {
        if (err) {
          res.redirect("/plants");
        } else {
          let total = 0;
          user.carts.forEach((cartItem) => {
            total += cartItem.quantity * cartItem.plant.price;
          });
          res.render("users/checkout", { user, total });
        }
      });
  } catch (e) {
    console.log(e);
    res.redirect("back");
  }
});

router.post("/order", async (req, res) => {
  const { stripeEmail, stripeToken } = req.body;
  const customer = await stripe.customers.create({
    email: stripeEmail,
    source: stripeToken,
  });
  User.findById(req.user.id)
    .populate("carts.plant")
    .exec(async (err, user) => {
      if (err) {
        req.flash("error", "Could not Process Your Payment");
        res.redirect("/plants");
      } else {
        let total = 0;
        user.carts.forEach((cartItem) => {
          total += cartItem.quantity * cartItem.plant.price;
        });
        const charge = await stripe.charges.create({
          customer: customer.id,
          description: "Plant Store Orders",
          amount: total * 100,
          currency: "inr",
        });
        try {
          const order = new Order({
            user,
            details: user.carts,
            amount: total,
          });
          await order.save();
          let updatedUser = req.user;
          updatedUser.carts = [];
          await User.findByIdAndUpdate(updatedUser.id, updatedUser);

          let msg = `
                <table>
                    <thead>
                        <tr style="font-size: 1.2em; color:blue; letter-spacing: 1.2px;">
                            <th scope="col">name</th>
                            <th scope="col" style="margin: 0 2em">Price</th>
                            <th scope="col">Quantity</th>
                        </tr>
                    </thead>
                <tbody>
                `;
          user.carts.forEach((item) => {
            msg += `
                    <tr style="letter-spacing: 1.2px; font-size: 1.6em">
                        <td> ${item.plant.name} </td>
                        <td style="color: red; margin: 0 2em">Rs. ${item.plant.price} </td>
                        <td style="text-align: center">${item.quantity}</td>
                    </tr>
                    `;
          });
          msg += `
                </tbody>
                </table>
                <h3 style="font-size: 1.2em;color: #f511ed">Your Order Id: ${order._id}</h3>
                <h2  style="color: red">Total Amount: Rs. ${total}</h2>
                <p  style="font-size: 1.2em; color: #d534eb">Your Order reciept Download from <a href=${charge.receipt_url}>here</a></p>
                <h2 style="color: purple">Your Orders will be delivered to you within 3/4 business days</h3>
                <h4>Thanks For Shopping With Us</h4>
                <p style="color: orange">admin, BOOK STORE</p>
                </body>
                `;
          // sgMail.setApiKey(process.env.SEND_GRID_API_KEY);
          // console.log(process.env.SEND_GRID_API_KEY);
          // const mail = {
          //   to: req.user.email,
          //   from: `BOOK STORE <testse1064@gmail.com>`,
          //   // from: `BOOK STORE <${process.env.SEND_GRID_SENDER_MAIL}>`,
          //   subject: "Order Summary BOOK STORE",
          //   text: "Order Summary",
          //   html: msg,
          // };
          // sgMail.send(mail);
          req.flash("success", "Your Orders are Successful.");
          res.redirect("/users/orders");
        } catch (e) {
          res.json(e);
        }
      }
    });
});

router.get("/orders", checkAuthentication, async (req, res) => {
  const orders = await Order.find({ user: req.user })
    .sort({ createdAt: -1 })
    .populate("details.plant")
    .exec();
  res.render("users/orders", { orders });
});

module.exports = router;
