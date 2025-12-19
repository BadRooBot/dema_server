const express = require('express');
const { createNote, getNotes, updateNote, deleteNote } = require('../controllers/notesController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/')
    .post(createNote)
    .get(getNotes);

router.route('/:id')
    .put(updateNote)
    .delete(deleteNote);

module.exports = router;
