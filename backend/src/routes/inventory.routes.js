const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { cacheMiddleware } = require('../middlewares/cache.middleware');

router.use(authenticateToken);

// Cached Inventory Alerts and Batches (60s)
router.get('/alerts', cacheMiddleware(60, 'alerts'), inventoryController.getAlerts);
router.get('/movements', inventoryController.getStockMovements);
router.get('/batches', cacheMiddleware(60, 'batches'), inventoryController.getAllBatches);

router.post('/batches', authorize('employee', 'admin'), inventoryController.addStockBatch);
router.put('/batches/:id', authorize('employee', 'admin'), inventoryController.updateBatch);
router.post('/adjust', authorize('employee', 'admin'), inventoryController.adjustStock);

module.exports = router;
