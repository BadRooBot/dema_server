const HabitModel = require('../models/habitModel');

const createHabit = async (req, res) => {
    try {
        const habit = await HabitModel.create({ ...req.body, user_id: req.user.id });
        res.status(201).json(habit);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getHabits = async (req, res) => {
    const { date } = req.query;

    try {
        if (date) {
            // Get habits with today's check-in status
            const habits = await HabitModel.getHabitsWithTodayStatus(req.user.id, date);
            return res.json(habits);
        }

        const habits = await HabitModel.findAllByUserId(req.user.id);
        res.json(habits);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getHabit = async (req, res) => {
    try {
        const habit = await HabitModel.findById(req.params.id);
        if (!habit) return res.status(404).json({ message: 'Habit not found' });
        if (habit.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        // Get stats
        const stats = await HabitModel.getStats(habit.id);

        res.json({ ...habit, stats });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateHabit = async (req, res) => {
    try {
        const habit = await HabitModel.findById(req.params.id);
        if (!habit) return res.status(404).json({ message: 'Habit not found' });
        if (habit.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        const updated = await HabitModel.update(req.params.id, req.body);
        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteHabit = async (req, res) => {
    try {
        const habit = await HabitModel.findById(req.params.id);
        if (!habit) return res.status(404).json({ message: 'Habit not found' });
        if (habit.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        await HabitModel.delete(req.params.id);
        res.json({ message: 'Habit deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const checkIn = async (req, res) => {
    const { date, notes } = req.body;

    try {
        const habit = await HabitModel.findById(req.params.id);
        if (!habit) return res.status(404).json({ message: 'Habit not found' });
        if (habit.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        const checkIn = await HabitModel.checkIn(req.params.id, date || new Date().toISOString().split('T')[0], notes);
        res.json(checkIn);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const uncheckIn = async (req, res) => {
    const { date } = req.body;

    try {
        const habit = await HabitModel.findById(req.params.id);
        if (!habit) return res.status(404).json({ message: 'Habit not found' });
        if (habit.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        await HabitModel.uncheckIn(req.params.id, date || new Date().toISOString().split('T')[0]);
        res.json({ message: 'Check-in removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getMonthlyCheckIns = async (req, res) => {
    const { year, month } = req.query;

    try {
        const habit = await HabitModel.findById(req.params.id);
        if (!habit) return res.status(404).json({ message: 'Habit not found' });
        if (habit.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        const now = new Date();
        const checkIns = await HabitModel.getCheckInsForMonth(
            req.params.id,
            year || now.getFullYear(),
            month || now.getMonth() + 1
        );

        const stats = await HabitModel.getStats(req.params.id);

        res.json({ habit, check_ins: checkIns, stats });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    createHabit, getHabits, getHabit, updateHabit, deleteHabit,
    checkIn, uncheckIn, getMonthlyCheckIns
};
