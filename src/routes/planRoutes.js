const express = require('express');
const { createPlan, getMyPlans, getPlan, updatePlan, deletePlan } = require('../controllers/planController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/')
    .post(createPlan)
    .get(getMyPlans);

router.route('/:id')
    .get(getPlan)
    .put(updatePlan)
    .delete(deletePlan);

module.exports = router;
