const NoteModel = require('../models/notesModel');
const PlanModel = require('../models/planModel');
const TaskModel = require('../models/taskModel');

const createNote = async (req, res) => {
    const { plan_id, task_id } = req.body;

    try {
        // Verify plan ownership if plan_id provided
        if (plan_id) {
            const plan = await PlanModel.findById(plan_id);
            if (!plan) return res.status(404).json({ message: 'Plan not found' });
            if (plan.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
        }

        // Verify task ownership if task_id provided
        if (task_id) {
            const task = await TaskModel.findById(task_id);
            if (!task) return res.status(404).json({ message: 'Task not found' });
            const plan = await PlanModel.findById(task.plan_id);
            if (plan.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
        }

        // Atomic findOrCreate - prevents race conditions
        const note = await NoteModel.findOrCreate({ ...req.body, user_id: req.user.id });

        // Return 200 if existing, 201 if new
        const statusCode = note._source === 'existing' ? 200 : 201;
        delete note._source;
        res.status(statusCode).json(note);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getNotes = async (req, res) => {
    const { plan_id, task_id } = req.query;

    try {
        let notes;

        if (plan_id) {
            // Verify ownership
            const plan = await PlanModel.findById(plan_id);
            if (!plan) return res.status(404).json({ message: 'Plan not found' });
            if (plan.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
            notes = await NoteModel.findByPlanId(plan_id);
        } else if (task_id) {
            const task = await TaskModel.findById(task_id);
            if (!task) return res.status(404).json({ message: 'Task not found' });
            const plan = await PlanModel.findById(task.plan_id);
            if (plan.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
            notes = await NoteModel.findByTaskId(task_id);
        } else {
            notes = await NoteModel.findAllByUserId(req.user.id);
        }

        res.json(notes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateNote = async (req, res) => {
    try {
        const note = await NoteModel.findById(req.params.id);
        if (!note) return res.status(404).json({ message: 'Note not found' });
        if (note.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        const updated = await NoteModel.update(req.params.id, req.body);
        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteNote = async (req, res) => {
    try {
        const note = await NoteModel.findById(req.params.id);
        if (!note) return res.status(404).json({ message: 'Note not found' });
        if (note.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        await NoteModel.delete(req.params.id);
        res.json({ message: 'Note deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createNote, getNotes, updateNote, deleteNote };
