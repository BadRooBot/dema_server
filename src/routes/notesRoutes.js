const express = require('express');
const { createNote, getNotes, deleteNote } = require('../controllers/notesController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

router.route('/')
    .post(createNote)
    .get(getNotes);

router.delete('/:id', deleteNote);

module.exports = router;
