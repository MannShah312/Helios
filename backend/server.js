// Load environment variables first
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

// Connect to MongoDB Atlas
connectDB();

// Scheduler to generate weekly revision every Sunday at 8:00 AM
const startWeeklyRevisionScheduler = () => {
  console.log('⏰ Weekly Revision Scheduler initialized (checks every minute).');
  setInterval(async () => {
    try {
      const now = new Date();
      // Check if Sunday (0) at 08:00 AM local time
      if (now.getDay() === 0 && now.getHours() === 8 && now.getMinutes() === 0) {
        console.log('[Scheduler] Sunday 8:00 AM reached. Triggering Weekly Revision generation...');
        const weeklyRevisionService = require('./services/weeklyRevisionService');
        const range = weeklyRevisionService.getCycleRange(now);
        await weeklyRevisionService.generateWeeklyRevision(range.startDate, range.endDate);
        console.log('[Scheduler] Weekly Revision generation cycle completed successfully.');
      }
    } catch (err) {
      console.error('[Scheduler] Error running weekly revision automatic cycle:', err.message);
    }
  }, 60000); // 1 minute
};
startWeeklyRevisionScheduler();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`=================================================`);
});

// Handle unhandled promise rejections globally
process.on('unhandledRejection', (err) => {
  console.error(`\x1b[31mUnhandled Rejection: ${err.message}\x1b[0m`);
  if (err.stack) {
    console.error(err.stack);
  }
  // Close server & exit process
  server.close(() => process.exit(1));
});
