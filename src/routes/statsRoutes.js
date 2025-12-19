const express = require('express');
const { getDashboardStats } = require('../controllers/statsController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

router.get('/dashboard', getDashboardStats);

module.exports = router;
