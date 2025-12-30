const TaskModel = require('../models/taskModel');
const PlanModel = require('../models/planModel');

// Create a task (single or recurring - stored as ONE row)
const createTask = async (req, res) => {
    const {
        plan_id, title, description, duration_minutes, task_date,
        start_time, is_recurring, recurrence_pattern, repeat_days, priority
    } = req.body;
    const user_id = req.user.id;

    try {
        // Verify Plan ownership
        const plan = await PlanModel.findById(plan_id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        if (plan.user_id !== user_id) return res.status(403).json({ message: 'Not authorized' });

        // Validate: non-recurring needs task_date
        if (!is_recurring && !task_date) {
            return res.status(400).json({ message: 'task_date is required for non-recurring task' });
        }

        // Atomic findOrCreate - prevents race conditions
        const task = await TaskModel.findOrCreate({
            plan_id,
            title,
            description,
            duration_minutes,
            task_date,
            start_time,
            is_recurring,
            recurrence_pattern,
            repeat_days,
            priority
        });

        // Return 200 if existing, 201 if new
        const statusCode = task._source === 'existing' ? 200 : 201;
        delete task._source;
        res.status(statusCode).json(task);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get tasks - by date or by plan_id
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

            // Map the results to include instance status for recurring tasks
            const mappedTasks = tasks.map(t => ({
                ...t,
                status: t.instance_status || t.status,
                actual_duration_minutes: t.instance_actual_duration || t.actual_duration_minutes || 0
            }));

            return res.json(mappedTasks);
        }

        return res.status(400).json({ message: 'Query param date or plan_id required' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update a task or a specific instance
const updateTask = async (req, res) => {
    const { instance_date } = req.query; // For updating a specific day of a recurring task

    try {
        const task = await TaskModel.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        // Verify ownership via Plan
        const plan = await PlanModel.findById(task.plan_id);
        if (plan.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        // If recurring task and instance_date provided, update the instance
        if (task.is_recurring && instance_date) {
            const instance = await TaskModel.updateInstance(task.id, instance_date, req.body);
            return res.json({
                ...task,
                status: instance.status,
                actual_duration_minutes: instance.actual_duration_minutes,
                instance
            });
        }

        // Otherwise update the base task
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
