const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Get all reports
exports.getAllReports = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, u.name as user_name
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `);
    
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
};

// Create a new report
exports.createReport = async (req, res) => {
  try {
    const { name, userId, metrics, filters } = req.body;
    
    const query = `
      INSERT INTO reports (name, user_id, metrics, filters)
      VALUES (?, ?, ?, ?)
    `;
    
    const [result] = await pool.execute(query, [
      name,
      userId || null,
      JSON.stringify(metrics),
      filters ? JSON.stringify(filters) : null
    ]);
    
    res.status(201).json({ 
      id: result.insertId,
      message: 'Report created successfully' 
    });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ message: 'Failed to create report' });
  }
};

// Get report by ID
exports.getReportById = async (req, res) => {
  try {
    const reportId = req.params.id;
    
    const [rows] = await pool.query(`
      SELECT r.*, u.name as user_name, u.email as user_email
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `, [reportId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    const report = rows[0];
    report.metrics = JSON.parse(report.metrics);
    
    if (report.filters) {
      report.filters = JSON.parse(report.filters);
    }
    
    res.status(200).json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ message: 'Failed to fetch report' });
  }
};

// Generate report data
exports.generateReportData = async (req, res) => {
  try {
    const reportId = req.params.id;
    
    // Get report details
    const [reportRows] = await pool.query('SELECT * FROM reports WHERE id = ?', [reportId]);
    
    if (reportRows.length === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    const report = reportRows[0];
    const metrics = JSON.parse(report.metrics);
    
    // Generate dummy data based on metrics
    const dummyData = generateDummyData(metrics, 100); // Generate 100 rows of data
    
    // Save the generated data
    const query = `
      INSERT INTO report_data (report_id, data_json)
      VALUES (?, ?)
    `;
    
    await pool.execute(query, [reportId, JSON.stringify(dummyData)]);
    
    res.status(200).json({
      message: 'Report data generated successfully',
      data: dummyData.slice(0, 10) // Send first 10 rows as preview
    });
  } catch (error) {
    console.error('Error generating report data:', error);
    res.status(500).json({ message: 'Failed to generate report data' });
  }
};

// Get report data
exports.getReportData = async (req, res) => {
  try {
    const reportId = req.params.id;
    
    // Get latest report data
    const [dataRows] = await pool.query(`
      SELECT *
      FROM report_data
      WHERE report_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [reportId]);
    
    if (dataRows.length === 0) {
      return res.status(404).json({ message: 'Report data not found' });
    }
    
    const reportData = JSON.parse(dataRows[0].data_json);
    
    res.status(200).json(reportData);
  } catch (error) {
    console.error('Error fetching report data:', error);
    res.status(500).json({ message: 'Failed to fetch report data' });
  }
};

// Email report
exports.emailReport = async (req, res) => {
  try {
    const reportId = req.params.id;
    const { email } = req.body;
    
    // Get report details
    const [reportRows] = await pool.query(`
      SELECT r.*, u.name as user_name
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `, [reportId]);
    
    if (reportRows.length === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    const report = reportRows[0];
    
    // Get report data
    const [dataRows] = await pool.query(`
      SELECT *
      FROM report_data
      WHERE report_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [reportId]);
    
    if (dataRows.length === 0) {
      return res.status(404).json({ message: 'Report data not found' });
    }
    
    // Generate CSV
    const reportData = JSON.parse(dataRows[0].data_json);
    const csvPath = await generateCSV(reportData, report.name);
    
    // Setup email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    // Send email with CSV attachment
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Custom Report: ${report.name}`,
      text: `Please find attached the custom report "${report.name}".`,
      attachments: [
        {
          filename: `${report.name.replace(/\s+/g, '_')}.csv`,
          path: csvPath
        }
      ]
    };
    
    await transporter.sendMail(mailOptions);
    
    // Clean up temporary file
    fs.unlinkSync(csvPath);
    
    res.status(200).json({ message: 'Report sent successfully' });
  } catch (error) {
    console.error('Error emailing report:', error);
    res.status(500).json({ message: 'Failed to email report' });
  }
};

// Download report CSV
exports.downloadReportCSV = async (req, res) => {
  try {
    const reportId = req.params.id;
    
    // Get report details
    const [reportRows] = await pool.query('SELECT * FROM reports WHERE id = ?', [reportId]);
    
    if (reportRows.length === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    const report = reportRows[0];
    
    // Get report data
    const [dataRows] = await pool.query(`
      SELECT *
      FROM report_data
      WHERE report_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [reportId]);
    
    if (dataRows.length === 0) {
      return res.status(404).json({ message: 'Report data not found' });
    }
    
    // Generate CSV
    const reportData = JSON.parse(dataRows[0].data_json);
    const csvPath = await generateCSV(reportData, report.name);
    
    // Set response headers for download
    res.setHeader('Content-Disposition', `attachment; filename=${report.name.replace(/\s+/g, '_')}.csv`);
    res.setHeader('Content-Type', 'text/csv');
    
    // Stream the file to response
    const fileStream = fs.createReadStream(csvPath);
    fileStream.pipe(res);
    
    // Clean up temporary file after streaming
    fileStream.on('end', () => {
      fs.unlinkSync(csvPath);
    });
  } catch (error) {
    console.error('Error downloading report CSV:', error);
    res.status(500).json({ message: 'Failed to download report CSV' });
  }
};

// Helper function to generate dummy data based on metrics
function generateDummyData(metrics, rowCount) {
  const data = [];
  
  for (let i = 0; i < rowCount; i++) {
    const row = {};
    
    metrics.forEach(metric => {
      switch (metric) {
        case 'Master-O ID':
          row['Master-O ID'] = `MO-${100000 + i}`;
          break;
        case 'Content launch date':
          // Random date in the past year
          const launchDate = new Date();
          launchDate.setDate(launchDate.getDate() - Math.floor(Math.random() * 365));
          row['Content launch date'] = launchDate.toISOString().split('T')[0];
          break;
        case 'Challenges':
          row['Challenges'] = Math.random() > 0.5 ? 'Completed' : 'In Progress';
          break;
        case 'Completion Status':
          row['Completion Status'] = Math.random() > 0.3 ? 'Completed' : 'Incomplete';
          break;
        case 'Completion Date':
          if (row['Completion Status'] === 'Completed') {
            const completionDate = new Date();
            completionDate.setDate(completionDate.getDate() - Math.floor(Math.random() * 30));
            row['Completion Date'] = completionDate.toISOString().split('T')[0];
          } else {
            row['Completion Date'] = '';
          }
          break;
        case 'Completed In Days':
          if (row['Completion Status'] === 'Completed') {
            row['Completed In Days'] = Math.floor(Math.random() * 30) + 1;
          } else {
            row['Completed In Days'] = '';
          }
          break;
        case 'Attempts':
          row['Attempts'] = Math.floor(Math.random() * 5) + 1;
          break;
        case 'Score':
          row['Score'] = Math.floor(Math.random() * 100);
          break;
        case 'Max Score':
          row['Max Score'] = 100;
          break;
        case 'Time Spent':
          row['Time Spent'] = `${Math.floor(Math.random() * 120) + 10} minutes`;
          break;
        case 'Microskill Name':
          const skills = ['JavaScript', 'Python', 'Machine Learning', 'Data Visualization', 'API Integration'];
          row['Microskill Name'] = skills[Math.floor(Math.random() * skills.length)];
          break;
        case 'Login Status':
          row['Login Status'] = Math.random() > 0.2 ? 'Active' : 'Inactive';
          break;
        case 'Last Login Date':
          if (row['Login Status'] === 'Active') {
            const loginDate = new Date();
            loginDate.setDate(loginDate.getDate() - Math.floor(Math.random() * 7));
            row['Last Login Date'] = loginDate.toISOString().split('T')[0];
          } else {
            const loginDate = new Date();
            loginDate.setDate(loginDate.getDate() - Math.floor(Math.random() * 30) - 10);
            row['Last Login Date'] = loginDate.toISOString().split('T')[0];
          }
          break;
      }
    });
    
    data.push(row);
  }
  
  return data;
}

// Helper function to generate CSV file
async function generateCSV(data, reportName) {
  const timestamp = new Date().getTime();
  const fileName = `${reportName.replace(/\s+/g, '_')}_${timestamp}.csv`;
  const filePath = path.join(__dirname, '..', 'public', 'reports', fileName);
  
  // Ensure the directory exists
  const dir = path.join(__dirname, '..', 'public', 'reports');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Create CSV writer
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: Object.keys(data[0]).map(key => ({ id: key, title: key }))
  });
  
  await csvWriter.writeRecords(data);
  
  return filePath;
}