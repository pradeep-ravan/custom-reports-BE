const path = require('path');
const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const nodemailer = require('nodemailer');
const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../config/db');
require('dotenv').config();

// Get all reports
exports.getAllReports = async (req, res) => {
  try {
    const db = await connectToDatabase();
    const reports = await db.collection('reports')
      .aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            metrics: 1,
            filters: 1,
            created_at: 1,
            user_id: 1,
            user_name: '$user.name'
          }
        },
        {
          $sort: { created_at: -1 }
        }
      ]).toArray();
    
    res.status(200).json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
};

// Create a new report
exports.createReport = async (req, res) => {
  try {
    const { name, userId, metrics, filters } = req.body;
    const db = await connectToDatabase();
    
    // Create a new report document
    const report = {
      name,
      user_id: userId ? new ObjectId(userId) : null,
      metrics,
      filters: filters || null,
      created_at: new Date()
    };
    
    const result = await db.collection('reports').insertOne(report);
    
    res.status(201).json({ 
      id: result.insertedId,
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
    const db = await connectToDatabase();
    
    // Use aggregation to join with users collection
    const reports = await db.collection('reports')
      .aggregate([
        {
          $match: { _id: new ObjectId(reportId) }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            metrics: 1,
            filters: 1,
            created_at: 1,
            user_id: 1,
            user_name: '$user.name',
            user_email: '$user.email'
          }
        }
      ]).toArray();
    
    if (reports.length === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    res.status(200).json(reports[0]);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ message: 'Failed to fetch report' });
  }
};

// Generate report data
exports.generateReportData = async (req, res) => {
  try {
    const reportId = req.params.id;
    const db = await connectToDatabase();
    
    // Get report details
    const report = await db.collection('reports').findOne({ _id: new ObjectId(reportId) });
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    // Generate dummy data based on metrics
    const dummyData = generateDummyData(report.metrics, 100); // Generate 100 rows of data
    
    // Save the generated data
    const reportData = {
      report_id: new ObjectId(reportId),
      data_json: dummyData,
      created_at: new Date()
    };
    
    await db.collection('report_data').insertOne(reportData);
    
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
    const db = await connectToDatabase();
    
    // Get latest report data
    const reportData = await db.collection('report_data')
      .find({ report_id: new ObjectId(reportId) })
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    if (reportData.length === 0) {
      return res.status(404).json({ message: 'Report data not found' });
    }
    
    res.status(200).json(reportData[0].data_json);
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
    const db = await connectToDatabase();
    
    // Get report details
    const report = await db.collection('reports')
      .aggregate([
        {
          $match: { _id: new ObjectId(reportId) }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            metrics: 1,
            filters: 1,
            created_at: 1,
            user_id: 1,
            user_name: '$user.name'
          }
        }
      ]).toArray();
    
    if (report.length === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    // Get report data
    const reportData = await db.collection('report_data')
      .find({ report_id: new ObjectId(reportId) })
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    if (reportData.length === 0) {
      return res.status(404).json({ message: 'Report data not found' });
    }
    
    // Generate CSV
    const csvPath = await generateCSV(reportData[0].data_json, report[0].name);
    
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
      subject: `Custom Report: ${report[0].name}`,
      text: `Please find attached the custom report "${report[0].name}".`,
      attachments: [
        {
          filename: `${report[0].name.replace(/\s+/g, '_')}.csv`,
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
    const db = await connectToDatabase();
    
    // Get report details
    const report = await db.collection('reports').findOne({ _id: new ObjectId(reportId) });
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    // Get report data
    const reportData = await db.collection('report_data')
      .find({ report_id: new ObjectId(reportId) })
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    if (reportData.length === 0) {
      return res.status(404).json({ message: 'Report data not found' });
    }
    
    // Generate CSV
    const csvPath = await generateCSV(reportData[0].data_json, report.name);
    
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