const TaskModel = require('../models/taskModel');
const PlanModel = require('../models/planModel');

const createTask = async (req, res) => {
    const { plan_id, title, description, duration_minutes, start_time, is_recurring, repeat_days, priority } = req.body;
    const user_id = req.user.id;

    try {
        // Verify Plan ownership
        const plan = await PlanModel.findById(plan_id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        if (plan.user_id !== user_id) return res.status(403).json({ message: 'Not authorized' });

        // Logic for Recurring Tasks
        if (is_recurring && repeat_days) {
            const startDate = new Date(plan.start_date);
            const endDate = new Date(plan.end_date);
            const tasksToCreate = [];
            const days = ['0', '1', '2', '3', '4', '5', '6'];

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dayIndex = d.getDay();
                if (repeat_days[dayIndex] === '1') {
                    tasksToCreate.push({
                        plan_id,
                        title,
                        description,
                        duration_minutes,
                        task_date: d.toISOString().split('T')[0], // YYYY-MM-DD
                        start_time,
                        is_recurring: true,
                        recurrence_pattern: 'daily_selected',
                        repeat_days,
                        priority: priority || 2
                    });
                }
            }
            const createdTasks = await TaskModel.createMany(tasksToCreate);
            res.status(201).json({ message: `Created \${createdTasks.length} recurring tasks`, tasks: createdTasks });
        } else {
            const { task_date } = req.body;
            if (!task_date) return res.status(400).json({ message: 'task_date is required for single task' });

            const task = await TaskModel.create({
                plan_id, title, description, duration_minutes, task_date, start_time,
                is_recurring: false, priority: priority || 2
            });
            res.status(201).json(task);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const getTasks = async (req, res) => {
    const { date, plan_id } = req.query;

    try {
        if (plan_id) {
            // Verify ownership
            const plan = await PlanModel.findById(plan_id);
            if (!plan) return res.status(404).json({ message: 'Plan not found' });
            if (plan.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

            const tasks = await TaskModel.findAllByPlanId(plan_id);
            return res.json(tasks);
        }

        if (date) {
            const tasks = await TaskModel.findByDate(req.user.id, date);
            return res.json(tasks);
        }

        return res.status(400).json({ message: 'query param date or plan_id required' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateTask = async (req, res) => {
    try {
        const task = await TaskModel.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        // Verify ownership via Plan
        const plan = await PlanModel.findById(task.plan_id);
        if (plan.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        const updatedTask = await TaskModel.update(req.params.id, req.body);
        res.json(updatedTask);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteTask = async (req, res) => {
    try {
        const task = await TaskModel.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        const plan = await PlanModel.findById(task.plan_id);
        if (plan.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        await TaskModel.delete(req.params.id);
        res.json({ message: 'Task deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createTask, getTasks, updateTask, deleteTask };
