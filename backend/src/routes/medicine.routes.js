const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicine.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const upload = require('../middlewares/upload.middleware');
const { cacheMiddleware } = require('../middlewares/cache.middleware');

// All medicine routes require authentication
router.use(authenticateToken);

// Cached Read Endpoints (Redis Cloud)
router.get('/filters', cacheMiddleware(300, 'meds:filters'), medicineController.getFiltersData);
router.get('/', cacheMiddleware(120, 'meds:list'), medicineController.getAllMedicines);
router.get('/:id', cacheMiddleware(120, 'meds:detail'), medicineController.getMedicineById);

// Employees and Admins can manage medicines (supports multer multipart/form-data for ImageKit storage)
router.post('/', authorize('employee', 'admin'), upload.single('image'), medicineController.createMedicine);
router.put('/:id', authorize('employee', 'admin'), upload.single('image'), medicineController.updateMedicine);
router.delete('/:id', authorize('employee', 'admin'), medicineController.deleteMedicine);

module.exports = router;
