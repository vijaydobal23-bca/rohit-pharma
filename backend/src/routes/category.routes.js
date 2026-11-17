const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { cacheMiddleware } = require('../middlewares/cache.middleware');

router.use(authenticateToken);

// Cached Categories List (300s)
router.get('/', cacheMiddleware(300, 'cats'), categoryController.getAllCategories);

router.post('/', authorize('employee', 'admin'), categoryController.createCategory);
router.put('/:id', authorize('employee', 'admin'), categoryController.updateCategory);
router.delete('/:id', authorize('employee', 'admin'), categoryController.deleteCategory);

module.exports = router;
