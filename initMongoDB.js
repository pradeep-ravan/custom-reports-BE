/**
 * MongoDB initialization script
 * Run with: node initMongoDB.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection URI
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'custom_reports';

async function initializeDatabase() {
  if (!uri) {
    console.error('MongoDB URI is not defined. Please set MONGODB_URI in your environment variables.');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // Create collections (equivalent to tables in SQL)
    await db.createCollection('users');
    await db.createCollection('reports');
    await db.createCollection('report_data');
    
    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('reports').createIndex({ user_id: 1 });
    await db.collection('report_data').createIndex({ report_id: 1 });
    
    // Insert sample users
    const users = [
      { 
        name: 'John Doe', 
        email: 'john@example.com', 
        created_at: new Date() 
      },
      { 
        name: 'Jane Smith', 
        email: 'jane@example.com', 
        created_at: new Date() 
      }
    ];
    
    await db.collection('users').insertMany(users);
    console.log('Sample users created');
    
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

initializeDatabase().catch(console.error);