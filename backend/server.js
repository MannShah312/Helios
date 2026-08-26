// Load environment variables first
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

// Connect to MongoDB Atlas
connectDB();

// Scheduler to generate weekly revision every Sunday starting at 7:00 AM and spacing it out
const startWeeklyRevisionScheduler = () => {
  console.log('⏰ Weekly Revision Scheduler initialized (checks every minute).');
  setInterval(async () => {
    try {
      const now = new Date();
      // Check if Sunday (0) at 07:00 AM local time
      if (now.getDay() === 0 && now.getHours() === 7 && now.getMinutes() === 0) {
        console.log('[Scheduler] Sunday 7:00 AM reached. Triggering Weekly Revision generation...');
        const weeklyRevisionService = require('./services/weeklyRevisionService');
        // Explicitly set cycle ending today at 7:30 AM
        const endDate = new Date(now);
        endDate.setHours(7, 30, 0, 0);
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 7);

        await weeklyRevisionService.generateWeeklyRevision(startDate, endDate, 300000); // 5-minute gap between subjects
        console.log('[Scheduler] Weekly Revision generation cycle completed successfully.');
      }
    } catch (err) {
      console.error('[Scheduler] Error running weekly revision automatic cycle:', err.message);
    }
  }, 60000); // 1 minute
};
startWeeklyRevisionScheduler();

// Scheduler: Generate daily notes at 10:00 AM IST (= 04:30 AM UTC) every day
const startDailyNotesScheduler = () => {
  console.log('⏰ Daily Notes Scheduler initialized (checks every minute).');
  setInterval(async () => {
    try {
      const now = new Date();
      // 10:00 AM IST = 04:30 AM UTC
      if (now.getUTCHours() === 4 && now.getUTCMinutes() === 30) {
        console.log('[DailyNotes Scheduler] 10:00 AM IST reached. Triggering daily notes generation...');
        const dailyNotesService = require('./services/dailyNotesService');
        const results = await dailyNotesService.generateDailyNotes();
        const successCount = results.filter(r => r.status === 'success').length;
        console.log(`[DailyNotes Scheduler] Generation complete. ${successCount} notes created.`);
      }
    } catch (err) {
      console.error('[DailyNotes Scheduler] Error running daily notes cycle:', err.message);
    }
  }, 60000); // check every minute
};
startDailyNotesScheduler();

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
