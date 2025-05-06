 # Custom Reports - Backend Documentation

## Overview

The Custom Reports backend is a Node.js application built with Express and MySQL that provides APIs for creating, managing, and generating custom reports. The application allows users to select metrics, generate data, visualize reports, and export them in various formats.

## Features

- RESTful API for custom report management
- MySQL database integration for data storage
- Report generation with customizable metrics
- CSV export functionality
- Email delivery of reports
- Dashboard data aggregation
- Integration with Power BI

## Technology Stack

- **Node.js**: JavaScript runtime environment
- **Express**: Web application framework
- **MySQL**: Relational database
- **mysql2**: MySQL client for Node.js
- **EJS**: Templating engine for views
- **csv-writer**: Library for CSV generation
- **nodemailer**: Email sending functionality
- **dotenv**: Environment variable management
- **cors**: Cross-Origin Resource Sharing support
- **body-parser**: Request body parsing middleware


## Installation and Setup

### Prerequisites

- Node.js (v14 or higher)
- MySQL (v8.0 or higher)

### Installation Steps

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd custom-reports/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following environment variables:
   ```
   PORT=4000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=custom_reports
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

4. Create the database and tables:
   ```bash
   mysql -u root -p < config/database.sql
   ```

5. Start the application:
   ```bash
   npm run dev
   ```

## API Endpoints

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports` | Get all reports |
| POST | `/api/reports` | Create a new report |
| GET | `/api/reports/:id` | Get a specific report by ID |
| POST | `/api/reports/:id/generate` | Generate data for a report |
| GET | `/api/reports/:id/data` | Get data for a specific report |
| POST | `/api/reports/:id/email` | Email a report |
| GET | `/api/reports/download/:id` | Download report as CSV |

## Database Schema

The application uses the following database tables:

### Users

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| name | VARCHAR(100) | User's name |
| email | VARCHAR(100) | User's email address |
| created_at | DATETIME | Timestamp of creation |

### Reports

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| name | VARCHAR(100) | Report name |
| user_id | INT | Foreign key to users table |
| metrics | TEXT | JSON string of selected metrics |
| filters | TEXT | JSON string of applied filters |
| created_at | DATETIME | Timestamp of creation |

### Report Data

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| report_id | INT | Foreign key to reports table |
| data_json | TEXT | JSON string of report data |
| created_at | DATETIME | Timestamp of creation |

## Key Components

### Database Connection (config/db.js)

Creates and exports a MySQL connection pool for database operations.

### Report Controller (controllers/reportController.js)

Contains all logic for handling report operations:
- Creating reports
- Fetching reports
- Generating report data
- CSV file generation
- Email delivery

### Report Routes (routes/reportRoutes.js)

Defines all API routes and connects them to controller functions.

### Main Application (index.js)

Sets up the Express application with middleware and routes.

## Deployment

### Local Development

```bash
npm run dev
```

### Production Deployment

For production deployment:

```bash
npm start
```

### Serverless Deployment (Vercel)

To deploy to Vercel, create a `vercel.json` file in the project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

Then deploy with the Vercel CLI:

```bash
vercel
```

## Email Configuration

The application uses Nodemailer to send reports via email. To configure email sending:

1. For Gmail accounts, enable 2-Step Verification
2. Generate an App Password
3. Update the `.env` file with your email and app password

## CSV Generation

Reports are exported as CSV files using the `csv-writer` library. The generated files are temporarily stored in the `public/reports` directory and then streamed to the client or attached to emails.

## Power BI Integration

The backend provides a template for Power BI integration in `views/powerbi.ejs`. In a production environment, you would replace the placeholder with actual Power BI embed code.

## Error Handling

The application includes error handling for:
- Database connection issues
- File system operations
- API request validation
- Email sending failures

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
