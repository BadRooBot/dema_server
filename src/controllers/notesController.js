const NoteModel = require('../models/notesModel');

const createNote = async (req, res) => {
    try {
        const note = await NoteModel.create({ ...req.body, user_id: req.user.id });
        res.status(201).json(note);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const getNotes = async (req, res) => {
    try {
        const notes = await NoteModel.findAllByUserId(req.user.id);
        res.json(notes);
    } catch (error) {
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
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createNote, getNotes, deleteNote };
