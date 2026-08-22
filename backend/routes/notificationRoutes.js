const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// GET /api/notifications/vapid-public-key
router.get('/vapid-public-key', (req, res, next) => {
  notificationController.getVapidPublicKey(req, res, next);
});

// POST /api/notifications/subscribe
router.post('/subscribe', (req, res, next) => {
  notificationController.subscribe(req, res, next);
});

module.exports = router;
