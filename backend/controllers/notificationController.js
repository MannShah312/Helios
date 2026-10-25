const Subscription = require('../models/Subscription');

class NotificationController {
  /**
   * GET /api/notifications/vapid-public-key
   * Send the VAPID public key configured on the server
   */
  async getVapidPublicKey(req, res, next) {
    try {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) {
        return res.status(500).json({
          success: false,
          message: "VAPID Public Key is not configured on the server."
        });
      }
      res.status(200).json({
        success: true,
        publicKey: publicKey
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/notifications/subscribe
   * Save or update a client device push subscription in MongoDB
   */
  async subscribe(req, res, next) {
    try {
      const { endpoint, keys } = req.body;

      if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        return res.status(400).json({
          success: false,
          message: "Invalid push subscription object structure. endpoint and keys (p256dh, auth) are required."
        });
      }

      // Upsert subscription based on endpoint to avoid duplicates
      const subscription = await Subscription.findOneAndUpdate(
        { endpoint },
        { endpoint, keys },
        { upsert: true, returnDocument: 'after', runValidators: true }
      );

      res.status(201).json({
        success: true,
        message: "Subscription stored successfully.",
        data: subscription
      });
    } catch (error) {
      console.error("[NotificationController] Error storing subscription:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to store push subscription."
      });
    }
  }
}

module.exports = new NotificationController();
