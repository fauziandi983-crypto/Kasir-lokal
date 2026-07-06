const { getDB } = require('../db');

/**
 * Log an activity to the activity_log table
 * @param {Object} req - The Express request object containing user details (req.user)
 * @param {String} action - Short action name (e.g., 'LOGIN', 'CREATE_BARANG', 'CHECKOUT')
 * @param {String} description - Detailed description of the action
 */
async function logActivity(req, action, description) {
  try {
    if (!req.user) {
      console.warn("logActivity: req.user is undefined. Cannot log action:", action);
      return;
    }

    const { id: user_id, business_id, toko_id } = req.user;
    const db = await getDB();
    
    await db.run(`
      INSERT INTO activity_log (business_id, toko_id, user_id, action, description)
      VALUES (?, ?, ?, ?, ?)
    `, [business_id || null, toko_id || null, user_id, action, description]);
    
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw error to prevent crashing main flows just because logging failed
  }
}

module.exports = { logActivity };
