const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { cacheMiddleware } = require('../middlewares/cache.middleware');

router.use(authenticateToken);

// Admin-only dashboard analytics (cached for 60s with instant invalidation on sales)
router.get('/admin', authorize('admin'), cacheMiddleware(60, 'dash:admin'), dashboardController.getAdminDashboard);

// Employee dashboard overview (cached for 60s)
router.get('/employee', authorize('employee', 'admin'), cacheMiddleware(60, 'dash:employee'), dashboardController.getEmployeeDashboard);

module.exports = router;
