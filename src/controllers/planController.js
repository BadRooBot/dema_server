const PlanModel = require('../models/planModel');

const createPlan = async (req, res) => {
    const {
        name,
        description,
        plan_type,
        start_date,
        end_date,
        image_path,
        color,
        priority,
        status,
        daily_goal_minutes,
        reminders_enabled,
        display_order
    } = req.body;
    const user_id = req.user.id;
    const sanitizedName = name ? name.trim() : name;

    try {
        // Check for duplicate
        console.log(`Checking duplicate for: ${sanitizedName}, ${start_date}, ${end_date}`);
        const existingPlan = await PlanModel.findDuplicate(user_id, sanitizedName, start_date, end_date);

        if (existingPlan) {
            console.log('Duplicate plan found:', existingPlan.id);
            return res.status(200).json(existingPlan);
        }

        const plan = await PlanModel.create({
            user_id,
            name: sanitizedName,
            description,
            plan_type,
            start_date,
            end_date,
            image_path,
            color,
            priority,
            status,
            daily_goal_minutes,
            reminders_enabled,
            display_order
        });
        res.status(201).json(plan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getMyPlans = async (req, res) => {
    try {
        const plans = await PlanModel.findAllByUserId(req.user.id);
        res.json(plans);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getPlan = async (req, res) => {
    try {
        const plan = await PlanModel.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        // Check ownership
        if (plan.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        res.json(plan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updatePlan = async (req, res) => {
    try {
        const plan = await PlanModel.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        if (plan.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updatedPlan = await PlanModel.update(req.params.id, req.body);
        res.json(updatedPlan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deletePlan = async (req, res) => {
    try {
        const plan = await PlanModel.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        if (plan.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await PlanModel.delete(req.params.id);
        res.json({ message: 'Plan removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createPlan, getMyPlans, getPlan, updatePlan, deletePlan };
