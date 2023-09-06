const express = require('express');
const router = express.Router();
const checkAuthorization = require('../middleware/checkAuthorization');
const User = require('../models/User');
const Plant = require('../models/Plant');
const Order = require('../models/Order');

router.get('/', checkAuthorization, async (req, res) => {
    const plants = await Plant.find();
    const users = await User.find();
    const orders = await Order.find().sort({createdAt:-1}).populate("user").populate("details.plant").exec();
    console.log(orders);
    res.render('admin/dashboard', {admin: req.user, plants, users, orders});
});

module.exports = router;