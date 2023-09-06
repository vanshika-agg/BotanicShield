const express = require("express");
const router = express.Router();
const Plant = require("../models/Plant");
// const checkAuthentication = require('../middleware/checkAuthentication');
const checkAuthorization = require("../middleware/checkAuthorization");

router.get("/", async (req, res) => {
  const plants = await Plant.find({});
  res.render("plants/home", { plants: plants, user: req.user });
});

router.get("/view/:id", (req, res) => {
  Plant.findById(req.params.id)
    .populate("comments")
    .exec((err, plant) => {
      if (err) {
        console.log(err);
        res.redirect("/plants");
      } else {
        res.render("plants/view", { plant: plant, user: req.user });
      }
    });
});

router.get("/new", checkAuthorization, (req, res) => {
  res.render("plants/new");
});

router.post("/new", checkAuthorization, async (req, res) => {
  const plant = {
    name: req.body.name,
    image: req.body.image,
    description: req.body.description,
    price: parseFloat(req.body.price),
  };
  try {
    const newPlant = new Plant(plant);
    await newPlant.save();
    res.redirect(`/plants/view/${newPlant._id}`);
  } catch (e) {
    console.log(e);
    res.render("plants/new", { plant: plant });
  }
});

router.get("/edit/:id", checkAuthorization, async (req, res) => {
  const plant = await Plant.findById(req.params.id);
  res.render("plants/edit", { plant: plant });
});
router.put("/edit/:id", checkAuthorization, async (req, res) => {
  const plant = {
    name: req.body.name,
    image: req.body.image,
    description: req.body.description,
    price: parseFloat(req.body.price),
  };
  try {
    const updatedPlant = await Plant.findByIdAndUpdate(req.params.id, plant);
    await updatedPlant.save();
    res.redirect(`/plants/view/${updatedPlant._id}`);
  } catch (e) {
    console.log(e);
    res.render("plants/new", { plant: plant });
  }
});

router.delete("/delete/:id", checkAuthorization, async (req, res) => {
  await Plant.findByIdAndDelete(req.params.id);
  res.redirect("/plants");
});

module.exports = router;
