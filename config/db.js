const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection URI
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'custom_reports';

// Connection variable
let client;
let db;

// Connect to MongoDB
async function connectToDatabase() {
  if (db) return db;
  
  if (!uri) {
    throw new Error('MongoDB URI is not defined. Please set MONGODB_URI in your environment variables.');
  }
  
  try {
    client = new MongoClient(uri);
    await client.connect();
    console.log('Connected to MongoDB');
    
    db = client.db(dbName);
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

// Close the connection when the application terminates
process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
});

module.exports = { connectToDatabase };