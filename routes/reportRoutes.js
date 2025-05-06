const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Report routes
router.get('/', reportController.getAllReports);
router.post('/', reportController.createReport);
router.get('/:id', reportController.getReportById);
router.post('/:id/generate', reportController.generateReportData);
router.get('/:id/data', reportController.getReportData);
router.post('/:id/email', reportController.emailReport);
router.get('/download/:id', reportController.downloadReportCSV);

module.exports = router;