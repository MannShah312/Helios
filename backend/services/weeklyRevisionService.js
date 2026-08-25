const WeeklyRevision = require('../models/WeeklyRevision');
const CurrentAffairs = require('../models/CurrentAffairs');
const { getAiClient, getGeminiModel } = require('../config/gemini');
const Subscription = require('../models/Subscription');
const webpush = require('web-push');

// Response schema for structured Gemini output
const weeklyRevisionResponseSchema = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      description: "List of synthesized revision topics. Process every topic from the input list.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Refined, clear UPSC-style title for the topic"
          },
          revisionSummary: {
            type: "string",
            description: "A high-yield 2-4 line quick revision summary covering the core aspect of the topic"
          },
          whyItMatters: {
            type: "string",
            description: "Why this topic is significant for UPSC Mains/Prelims"
          },
          factsKeywords: {
            type: "array",
            items: { type: "string" },
            description: "3-5 critical facts, statistics, reports, articles, or keywords for revision"
          },
          gsPaper: {
            type: "string",
            enum: ["GS-I", "GS-II", "GS-III", "GS-IV"],
            description: "General Studies paper classification"
          },
          subject: {
            type: "string",
            description: "The subject under the GS paper (e.g. Economy, Polity, Science & Tech, Environment, etc.)"
          },
          importance: {
            type: "string",
            enum: ["HIGH", "MEDIUM", "LOW"],
            description: "Importance level"
          },
          currentAffairsDate: {
            type: "string",
            description: "The original date of the current affairs document in YYYY-MM-DD format (exactly as provided in the input topic context)"
          },
          currentAffairsTopicNumber: {
            type: "integer",
            description: "The original topicNumber (exactly as provided in the input topic context)"
          }
        },
        required: [
          "title", "revisionSummary", "whyItMatters", "factsKeywords", 
          "gsPaper", "subject", "importance", "currentAffairsDate", "currentAffairsTopicNumber"
        ]
      }
    }
  },
  required: ["topics"]
};

class WeeklyRevisionService {
  /**
   * Calculate the start and end of the most recent completed Sunday 7:30 AM cycle.
   * Cycle starts on Sunday at 07:30 AM (inclusive) and ends on Sunday at 07:30 AM (exclusive).
   */
  getCycleRange(referenceDate = new Date()) {
    const d = new Date(referenceDate);
    const currentDay = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Normalize reference date to current day at 07:30:00 local time
    const currentSunday730 = new Date(d);
    currentSunday730.setDate(d.getDate() - currentDay);
    currentSunday730.setHours(7, 30, 0, 0);

    let cycleEndDate;
    if (currentDay === 0) {
      if (d >= currentSunday730) {
        // Today is Sunday and it is after 7:30 AM. Cycle completed today at 7:30 AM.
        cycleEndDate = currentSunday730;
      } else {
        // Today is Sunday but it is before 7:30 AM. Cycle completed last Sunday at 7:30 AM.
        cycleEndDate = new Date(currentSunday730);
        cycleEndDate.setDate(currentSunday730.getDate() - 7);
      }
    } else {
      // Today is Monday-Saturday. The cycle completed on the most recent Sunday (currentDay days ago) at 7:30 AM.
      cycleEndDate = currentSunday730;
    }

    const cycleStartDate = new Date(cycleEndDate);
    cycleStartDate.setDate(cycleEndDate.getDate() - 7);

    return { startDate: cycleStartDate, endDate: cycleEndDate };
  }

  /**
   * Fetch or generate weekly revision for the current/latest cycle.
   */
  async getLatestWeeklyRevision(referenceDate = new Date(), delayMs = 10000) {
    const { startDate, endDate } = this.getCycleRange(referenceDate);
    
    // Check if revision document already exists
    const existing = await WeeklyRevision.findOne({ startDate, endDate });
    if (existing) {
      return existing;
    }

    // Auto-generate if it doesn't exist
    console.log(`[WeeklyRevision] Auto-generating revision for cycle: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    return await this.generateWeeklyRevision(startDate, endDate, delayMs);
  }

  /**
   * Generate weekly revision materials using Gemini for a given date range.
   */
  async generateWeeklyRevision(startDate, endDate, delayMs = 10000) {
    // 1. Fetch current affairs records uploaded within this cycle
    const currentAffairsDocs = await CurrentAffairs.find({
      createdAt: { $gte: startDate, $lt: endDate },
      processingStatus: 'COMPLETED'
    }).sort({ date: 1 });

    if (!currentAffairsDocs || currentAffairsDocs.length === 0) {
      console.log(`[WeeklyRevision] No completed current affairs records found between ${startDate.toISOString()} and ${endDate.toISOString()}`);
      return null;
    }

    // 2. Prepare topics input for Gemini
    const topicsToSummarize = [];
    for (const doc of currentAffairsDocs) {
      const formattedDate = doc.date.toISOString().split('T')[0];
      for (const topic of doc.topics) {
        topicsToSummarize.push({
          currentAffairsDate: formattedDate,
          currentAffairsTopicNumber: topic.topicNumber,
          title: topic.title,
          gsPaper: topic.classification.gsPaper,
          subject: topic.classification.subject,
          importance: topic.importance,
          shortDescription: topic.shortDescription,
          analysisPoints: [
            topic.analysis.whatHappened,
            topic.analysis.background,
            topic.analysis.whyImportant,
            ...(topic.analysis.keyPoints || []),
            ...(topic.analysis.governmentMeasures || []),
            ...(topic.analysis.challenges || []),
            ...(topic.analysis.wayForward || [])
          ].filter(Boolean),
          facts: topic.prelims?.facts || [],
          keywords: topic.prelims?.keywords || []
        });
      }
    }

    if (topicsToSummarize.length === 0) {
      console.log('[WeeklyRevision] No topics found inside the fetched current affairs records.');
      return null;
    }

    // 3. Group topics by subject
    const subjectsMap = {};
    topicsToSummarize.forEach(topic => {
      const subject = topic.subject || 'General';
      if (!subjectsMap[subject]) {
        subjectsMap[subject] = [];
      }
      subjectsMap[subject].push(topic);
    });

    const uniqueSubjects = Object.keys(subjectsMap);
    console.log(`[WeeklyRevision] Grouped weekly current affairs into ${uniqueSubjects.length} subjects.`);

    const ai = getAiClient();
    const modelName = getGeminiModel();
    const allGeneratedTopics = [];

    // Process subject-by-subject
    for (let sIdx = 0; sIdx < uniqueSubjects.length; sIdx++) {
      const subjectName = uniqueSubjects[sIdx];
      const subjectTopics = subjectsMap[subjectName];

      console.log(`[WeeklyRevision] Subject ${sIdx + 1}/${uniqueSubjects.length}: Sending ${subjectTopics.length} topics for subject "${subjectName}" to Gemini...`);

      const promptText = `
        You are an elite UPSC current affairs revision mentor. Your task is to convert the provided list of daily current affairs topics under the subject "${subjectName}" from the past week into a concise, high-yield revision study deck.
        
        Input Topics List:
        ${JSON.stringify(subjectTopics, null, 2)}
        
        Requirements for each topic in the output:
        1. Map it directly back to its original currentAffairsDate and currentAffairsTopicNumber (these must match the input fields exactly).
        2. Convert it into a 2-4 line quick revision summary. Focus on core conceptual understandings, facts, and main themes.
        3. Extract or summarize why it matters for UPSC Mains/Prelims.
        4. Provide a factsKeywords array containing 3-5 important facts, data points, or keywords.
        5. Retain or slightly refine the title, gsPaper, subject, and importance for examination clarity.
        
        IMPORTANT:
        - Do not generate or write any detailed Mains essay responses or answers. Keep everything concise for rapid reading in a few minutes.
        - Base all information strictly on the provided context. Do not invent facts, statistics, or legal articles.
        - Return the output in the exact JSON format matching the schema.
      `;

      try {
        const geminiResponse = await ai.models.generateContent({
          model: modelName,
          contents: [{ text: promptText }],
          config: {
            responseMimeType: "application/json",
            responseSchema: weeklyRevisionResponseSchema,
          }
        });

        const payload = JSON.parse(geminiResponse.text);
        if (payload && payload.topics && Array.isArray(payload.topics)) {
          allGeneratedTopics.push(...payload.topics);
          console.log(`[WeeklyRevision] Successfully synthesized ${payload.topics.length} revision cards for subject "${subjectName}".`);
        } else {
          console.error(`[WeeklyRevision] Warning: Gemini returned invalid response for subject "${subjectName}". Falling back to database topics.`);
          subjectTopics.forEach(orig => {
            allGeneratedTopics.push({
              title: orig.title,
              revisionSummary: orig.shortDescription,
              whyItMatters: orig.analysisPoints ? orig.analysisPoints.join(' ') : 'UPSC relevance to be analyzed.',
              factsKeywords: [...(orig.facts || []), ...(orig.keywords || [])],
              currentAffairsDate: orig.currentAffairsDate,
              currentAffairsTopicNumber: orig.currentAffairsTopicNumber
            });
          });
        }
      } catch (error) {
        console.error(`[WeeklyRevision] Error generating revision for subject "${subjectName}": ${error.message}. Falling back to database topics.`);
        subjectTopics.forEach(orig => {
          allGeneratedTopics.push({
            title: orig.title,
            revisionSummary: orig.shortDescription,
            whyItMatters: orig.analysisPoints ? orig.analysisPoints.join(' ') : 'UPSC relevance to be analyzed.',
            factsKeywords: [...(orig.facts || []), ...(orig.keywords || [])],
            currentAffairsDate: orig.currentAffairsDate,
            currentAffairsTopicNumber: orig.currentAffairsTopicNumber
          });
        });
      }

      // Suitable gap/delay between subjects to prevent 429 errors
      if (sIdx < uniqueSubjects.length - 1 && delayMs > 0) {
        console.log(`[WeeklyRevision] Waiting ${delayMs / 1000} seconds before next subject request to prevent 429 quota exhaustion...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    if (allGeneratedTopics.length === 0) {
      throw new Error("Weekly revision generation failed: No topics were generated.");
    }

    console.log(`[WeeklyRevision] Consolidated ${allGeneratedTopics.length} revision cards across all subjects. Saving to database...`);

    // 4. Save to database using upsert with robust database metadata merging
    const savedDoc = await WeeklyRevision.findOneAndUpdate(
      { startDate, endDate },
      {
        startDate,
        endDate,
        topics: allGeneratedTopics.map((t, idx) => {
          // Find the matching original topic from the input database topics array to ensure 100% validity
          const original = topicsToSummarize.find(orig => {
            const origDateStr = orig.currentAffairsDate; // "YYYY-MM-DD"
            
            let tDateStr = '';
            if (t.currentAffairsDate) {
              try {
                tDateStr = new Date(t.currentAffairsDate).toISOString().split('T')[0];
              } catch (e) {
                tDateStr = t.currentAffairsDate.toString().split('T')[0];
              }
            }
            
            return orig.currentAffairsTopicNumber === t.currentAffairsTopicNumber && origDateStr === tDateStr;
          }) || topicsToSummarize.find(orig => orig.title.toLowerCase() === (t.title || '').toLowerCase())
             || topicsToSummarize[idx]
             || topicsToSummarize[0];

          return {
            title: original.title,
            revisionSummary: t.revisionSummary || original.shortDescription,
            whyItMatters: t.whyItMatters || 'UPSC relevance to be analyzed.',
            factsKeywords: Array.isArray(t.factsKeywords) && t.factsKeywords.length > 0 
              ? t.factsKeywords 
              : [...(original.facts || []), ...(original.keywords || [])],
            classification: {
              gsPaper: original.gsPaper || 'GS-III',
              subject: original.subject || 'General'
            },
            importance: original.importance || 'MEDIUM',
            currentAffairsDate: new Date(original.currentAffairsDate),
            currentAffairsTopicNumber: original.currentAffairsTopicNumber,
            completed: false // Default to false on generation
          };
        })
      },
      { upsert: true, new: true, runValidators: true }
    );

    // 6. Broadcast notification asynchronously
    (async () => {
      try {
        const subscriptions = await Subscription.find();
        if (subscriptions.length === 0) return;

        console.log(`[WeeklyRevision] Broadcasting ready alert to ${subscriptions.length} subscribers`);
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        const notificationPayload = JSON.stringify({
          title: 'Weekly Revision Deck Ready!',
          body: `Your UPSC revision cards for week ${startStr} to ${endStr} are prepared with ${savedDoc.topics.length} topics!`,
          url: '/'
        });

        webpush.setVapidDetails(
          process.env.VAPID_EMAIL || 'mailto:mannwork312@gmail.com',
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );

        await Promise.all(subscriptions.map(sub => 
          webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth
            }
          }, notificationPayload).catch(async err => {
            console.error(`[WeeklyRevision] Failed to send push to ${sub.endpoint}:`, err.message);
            if (err.statusCode === 410 || err.statusCode === 404) {
              await Subscription.deleteOne({ endpoint: sub.endpoint });
            }
          })
        ));
      } catch (pushErr) {
        console.error('[WeeklyRevision] Push notification failed:', pushErr.message);
      }
    })();

    return savedDoc;
  }

  /**
   * Toggle completion status of a specific topic inside a weekly revision document.
   */
  async toggleTopicCompletion(revisionId, topicId) {
    const revision = await WeeklyRevision.findById(revisionId);
    if (!revision) {
      throw new Error(`Weekly revision with ID ${revisionId} not found`);
    }

    const topic = revision.topics.id(topicId);
    if (!topic) {
      throw new Error(`Topic with ID ${topicId} not found in this revision`);
    }

    topic.completed = !topic.completed;
    await revision.save();
    return revision;
  }
}

module.exports = new WeeklyRevisionService();
