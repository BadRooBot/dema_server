const express = require('express');
const { getDashboardStats, getPlanStats } = require('../controllers/statsController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/dashboard', getDashboardStats);
router.get('/plan/:plan_id', getPlanStats);

module.exports = router;
