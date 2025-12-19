const express = require('express');
const {
    createHabit, getHabits, getHabit, updateHabit, deleteHabit,
    checkIn, uncheckIn, getMonthlyCheckIns
} = require('../controllers/habitsController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/')
    .post(createHabit)
    .get(getHabits);

router.route('/:id')
    .get(getHabit)
    .put(updateHabit)
    .delete(deleteHabit);

router.post('/:id/check', checkIn);
router.post('/:id/uncheck', uncheckIn);
router.get('/:id/calendar', getMonthlyCheckIns);

module.exports = router;
