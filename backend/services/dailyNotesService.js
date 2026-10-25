const DailyNote = require('../models/DailyNote');
const { getAiClient, getGeminiModel } = require('../config/gemini');
const Subscription = require('../models/Subscription');
const webpush = require('web-push');

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT TOPIC SEQUENCES
// Each topic is { id, title, syllabusRef, part }
// topicOrder is 1-indexed position in the array.
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECT_SEQUENCES = {
  'modern-history': [
    { id: 'european-arrival', title: 'European Arrival in India — Portuguese, Dutch & French', syllabusRef: 'european-arrival' },
    { id: 'british-establishment', title: 'British East India Company — Establishment & Early Trade', syllabusRef: 'british-east-india-company' },
    { id: 'battle-of-plassey', title: 'Battle of Plassey (1757) — The Turning Point', syllabusRef: 'battle-of-plassey' },
    { id: 'battle-of-buxar', title: 'Battle of Buxar (1764) — Consolidating British Power', syllabusRef: 'battle-of-buxar' },
    { id: 'dual-government', title: 'Dual Government in Bengal & the Regulating Act (1773)', syllabusRef: 'regulating-act-1773' },
    { id: 'permanent-settlement', title: 'Permanent Settlement (1793) — Land Revenue & Zamindari System', syllabusRef: 'permanent-settlement' },
    { id: 'ryotwari-mahalwari', title: 'Ryotwari & Mahalwari Systems — Peasants Under British Rule', syllabusRef: 'land-revenue-systems' },
    { id: 'early-revolts', title: 'Early Resistance — Sanyasi, Fakir, Polygar & Peasant Revolts', syllabusRef: 'early-revolts' },
    { id: 'social-reform-part1', title: 'Socio-Religious Reform Movements — Part 1: Raja Ram Mohan Roy & Brahmo Samaj', syllabusRef: 'socio-religious-reforms', part: 'Part 1 of 2' },
    { id: 'social-reform-part2', title: 'Socio-Religious Reform Movements — Part 2: Arya Samaj, Ramakrishna & Aligarh Movement', syllabusRef: 'socio-religious-reforms', part: 'Part 2 of 2' },
    { id: 'economic-impact', title: 'Economic Impact of British Rule — Deindustrialisation & Drain of Wealth', syllabusRef: 'economic-impact-british' },
    { id: 'revolt-1857-causes', title: 'Revolt of 1857 — Causes & Background', syllabusRef: 'revolt-1857', part: 'Part 1 of 3' },
    { id: 'revolt-1857-course', title: 'Revolt of 1857 — Course, Key Centres & Leaders', syllabusRef: 'revolt-1857', part: 'Part 2 of 3' },
    { id: 'revolt-1857-aftermath', title: 'Revolt of 1857 — Aftermath & Crown Rule Begins', syllabusRef: 'revolt-1857', part: 'Part 3 of 3' },
    { id: 'rise-of-nationalism', title: 'Rise of Indian Nationalism — Conditions & Early Phase', syllabusRef: 'rise-of-nationalism' },
    { id: 'indian-national-congress', title: 'Indian National Congress (1885) — Founding, Moderates & Demands', syllabusRef: 'indian-national-congress' },
    { id: 'swadeshi-movement', title: 'Partition of Bengal (1905) & the Swadeshi Movement', syllabusRef: 'swadeshi-movement' },
    { id: 'extremists-surat-split', title: 'Extremists, Bal-Pal-Lal & the Surat Split (1907)', syllabusRef: 'surat-split' },
    { id: 'morley-minto', title: 'Morley-Minto Reforms (1909) & Communal Electorate', syllabusRef: 'morley-minto-reforms' },
    { id: 'home-rule-movement', title: 'Home Rule Movement (1916) — Tilak, Besant & Lucknow Pact', syllabusRef: 'home-rule-movement' },
    { id: 'gandhi-emergence', title: 'Emergence of Gandhi — Champaran, Kheda & Ahmedabad Satyagraha', syllabusRef: 'gandhi-emergence' },
    { id: 'rowlatt-jallianwala', title: 'Rowlatt Act (1919) & Jallianwala Bagh Massacre', syllabusRef: 'jallianwala-bagh' },
    { id: 'non-cooperation', title: 'Non-Cooperation Movement (1920-22) — Causes, Course & Withdrawal', syllabusRef: 'non-cooperation-movement' },
    { id: 'khilafat-movement', title: 'Khilafat Movement & Hindu-Muslim Unity', syllabusRef: 'khilafat-movement' },
    { id: 'simon-commission', title: 'Simon Commission (1927), Nehru Report & Demand for Poorna Swaraj', syllabusRef: 'simon-commission' },
    { id: 'civil-disobedience', title: 'Civil Disobedience Movement (1930) — Salt March & Gandhi-Irwin Pact', syllabusRef: 'civil-disobedience-movement' },
    { id: 'rtt-conferences', title: 'Round Table Conferences (1930-32) & Communal Award', syllabusRef: 'round-table-conferences' },
    { id: 'govt-of-india-1935', title: 'Government of India Act 1935 — Provisions & Significance', syllabusRef: 'govt-of-india-act-1935' },
    { id: 'congress-ministries', title: 'Congress Ministries (1937-39) & the August Offer', syllabusRef: 'congress-ministries' },
    { id: 'quit-india', title: 'Quit India Movement (1942) — Do or Die', syllabusRef: 'quit-india-movement' },
    { id: 'ina-subhas-bose', title: 'Indian National Army (INA) & Subhas Chandra Bose', syllabusRef: 'ina-subhas-bose' },
    { id: 'wavell-plan-cabinet', title: 'Wavell Plan (1945), Cabinet Mission Plan & Interim Government', syllabusRef: 'cabinet-mission' },
    { id: 'partition-independence', title: 'Partition of India & Independence (1947) — Mountbatten Plan', syllabusRef: 'partition-independence' },
    { id: 'integration-states', title: 'Integration of Princely States — Sardar Patel & Iron Will', syllabusRef: 'integration-princely-states' },
    { id: 'press-education', title: 'Development of Press, Education & Literature Under British Rule', syllabusRef: 'press-education-british' },
    { id: 'women-reform', title: 'Women\'s Question in 19th Century — Reform & Resistance', syllabusRef: 'women-reform-movements' },
    { id: 'tribal-revolts', title: 'Tribal Revolts — Munda, Santhal & Bhil Uprisings', syllabusRef: 'tribal-revolts' },
    { id: 'revolutionary-nationalism', title: 'Revolutionary Nationalism — Bhagat Singh, Chandrashekhar Azad & HSRA', syllabusRef: 'revolutionary-nationalism' },
    { id: 'constitutional-development', title: 'Constitutional Development in India (1773–1947) — Timeline & Key Acts', syllabusRef: 'constitutional-development' },
  ]
};

// Total topics per subject (for progress tracking)
const SUBJECT_META = {
  'modern-history': {
    displayName: 'Modern History',
    gsPaper: 'GS1',
    icon: 'book',
    totalTopics: SUBJECT_SEQUENCES['modern-history'].length
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Gemini JSON Response Schema
// ─────────────────────────────────────────────────────────────────────────────

const dailyNoteResponseSchema = {
  type: "object",
  properties: {
    quickGlimpseFlow: {
      type: "array",
      description: "Exactly 4 short phrases showing the essential flow: [Cause/Context, Key Event, Immediate Outcome, Long-term Significance]. Each phrase: 5-10 words max.",
      items: { type: "string" },
      minItems: 4,
      maxItems: 4
    },
    story: {
      type: "string",
      description: "The main narrative. Write as a connected historical story — NOT a textbook. Do NOT use headers or bullet lists inside the story. Naturally weave in causes, key dates, people, places, consequences and significance into flowing prose. 400-700 words for medium complexity topics."
    },
    connectionText: {
      type: "string",
      description: "1-2 short paragraphs connecting today's topic to what came before and what comes next. Show how this episode is one link in the chain of Modern Indian History."
    },
    prelimsFacts: {
      type: "array",
      description: "3-6 critical Prelims-ready facts. Each fact should be a complete, memorable sentence. Include dates, names, places, specific figures.",
      items: { type: "string" },
      minItems: 3,
      maxItems: 6
    },
    mainsAngles: {
      type: "array",
      description: "2-4 analytical angles suitable for UPSC Mains answers. Each angle should be a question-framing or theme, e.g. 'Analyse the role of X in Y'. Do not write full answers.",
      items: { type: "string" },
      minItems: 2,
      maxItems: 4
    },
    quickCheck: {
      type: "array",
      description: "Exactly 3 active-recall questions with hidden answers. Questions should test core understanding, not just rote facts.",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string", description: "2-3 sentence answer. Concise and precise." }
        },
        required: ["question", "answer"]
      },
      minItems: 3,
      maxItems: 3
    }
  },
  required: ["quickGlimpseFlow", "story", "connectionText", "prelimsFacts", "mainsAngles", "quickCheck"]
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Service Class
// ─────────────────────────────────────────────────────────────────────────────

class DailyNotesService {

  /**
   * Get the normalized date string for today (YYYY-MM-DD in IST)
   */
  getTodayIST() {
    const now = new Date();
    // IST = UTC + 5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    return istNow.toISOString().split('T')[0];
  }

  /**
   * Get today's scheduled date as a Date object (normalized to midnight UTC)
   */
  getScheduledDateForToday() {
    const todayStr = this.getTodayIST();
    return new Date(todayStr + 'T00:00:00.000Z');
  }

  /**
   * Get the next topicOrder to generate for a subject.
   * Looks at the highest topicOrder already in the DB for this subject.
   */
  async getNextTopicOrder(subject) {
    const latest = await DailyNote.findOne({ subject }).sort({ topicOrder: -1 }).lean();
    return latest ? latest.topicOrder + 1 : 1;
  }

  /**
   * Get subject display metadata (for the frontend subjects list)
   */
  getSubjectMeta(subject) {
    return SUBJECT_META[subject] || { displayName: subject, totalTopics: 0 };
  }

  /**
   * Get all subjects with today's lesson info and coverage count
   */
  async getSubjectsOverview() {
    const subjects = Object.keys(SUBJECT_SEQUENCES);
    const todayDate = this.getScheduledDateForToday();

    const results = await Promise.all(subjects.map(async (subject) => {
      const meta = this.getSubjectMeta(subject);
      const sequence = SUBJECT_SEQUENCES[subject];

      // Today's lesson
      const todayNote = await DailyNote.findOne({
        subject,
        scheduledDate: todayDate,
        generationStatus: 'COMPLETED'
      }).lean();

      // Total generated so far
      const generatedCount = await DailyNote.countDocuments({
        subject,
        generationStatus: 'COMPLETED'
      });

      return {
        subject,
        displayName: meta.displayName,
        gsPaper: meta.gsPaper,
        icon: meta.icon,
        totalTopicsInSequence: sequence.length,
        generatedCount,
        todayLesson: todayNote ? {
          topicOrder: todayNote.topicOrder,
          title: todayNote.title,
          part: todayNote.part || null,
          _id: todayNote._id
        } : null
      };
    }));

    return results;
  }

  /**
   * Get today's note for a subject (or most recent if not yet generated today)
   */
  async getTodayNote(subject) {
    const todayDate = this.getScheduledDateForToday();
    let note = await DailyNote.findOne({
      subject,
      scheduledDate: todayDate,
      generationStatus: 'COMPLETED'
    }).lean();

    if (!note) {
      // Fall back to most recent completed note
      note = await DailyNote.findOne({
        subject,
        generationStatus: 'COMPLETED'
      }).sort({ topicOrder: -1 }).lean();
    }

    return note;
  }

  /**
   * Get a note by topic order (for prev/next navigation)
   */
  async getNoteByOrder(subject, order) {
    return await DailyNote.findOne({
      subject,
      topicOrder: order,
      generationStatus: 'COMPLETED'
    }).lean();
  }

  /**
   * Get all completed notes for a subject (ordered list)
   */
  async getAllNotes(subject) {
    return await DailyNote.find({
      subject,
      generationStatus: 'COMPLETED'
    }).sort({ topicOrder: 1 }).lean();
  }

  /**
   * Generate the next daily note for all subjects that don't have one today.
   * Called by the scheduler at 10 AM IST.
   */
  async generateDailyNotes() {
    const subjects = Object.keys(SUBJECT_SEQUENCES);
    const todayDate = this.getScheduledDateForToday();
    const results = [];

    for (const subject of subjects) {
      try {
        // Check if today's note already exists
        const existing = await DailyNote.findOne({ subject, scheduledDate: todayDate });
        if (existing && existing.generationStatus === 'COMPLETED') {
          console.log(`[DailyNotes] ${subject}: Today's note already exists (order ${existing.topicOrder}). Skipping.`);
          results.push({ subject, status: 'skipped', reason: 'already exists' });
          continue;
        }

        const result = await this.generateNextNote(subject, todayDate);
        results.push({ subject, status: 'success', topicOrder: result.topicOrder, title: result.title });

      } catch (err) {
        console.error(`[DailyNotes] Error generating note for ${subject}: ${err.message}`);
        results.push({ subject, status: 'error', error: err.message });
      }
    }

    // Send push notification if at least one note was generated
    const successCount = results.filter(r => r.status === 'success').length;
    if (successCount > 0) {
      await this.sendPushNotification(results);
    }

    return results;
  }

  /**
   * Generate the next note in sequence for a subject.
   */
  async generateNextNote(subject, scheduledDate) {
    const sequence = SUBJECT_SEQUENCES[subject];
    if (!sequence) {
      throw new Error(`No sequence defined for subject: ${subject}`);
    }

    // Determine next topic order
    const nextOrder = await this.getNextTopicOrder(subject);
    if (nextOrder > sequence.length) {
      throw new Error(`All ${sequence.length} topics for ${subject} have already been generated.`);
    }

    const topicDef = sequence[nextOrder - 1]; // 0-indexed array
    const prevTopicDef = nextOrder > 1 ? sequence[nextOrder - 2] : null;
    const nextTopicDef = nextOrder < sequence.length ? sequence[nextOrder] : null;

    console.log(`[DailyNotes] Generating ${subject} topic ${nextOrder}/${sequence.length}: "${topicDef.title}"`);

    // Create placeholder document
    const placeholder = await DailyNote.findOneAndUpdate(
      { subject, scheduledDate },
      {
        subject,
        topicOrder: nextOrder,
        scheduledDate,
        title: topicDef.title,
        syllabusRef: topicDef.syllabusRef || null,
        part: topicDef.part || null,
        generationStatus: 'PENDING',
        quickGlimpse: { flow: [] },
        story: '',
        connecting: {
          prevTitle: prevTopicDef?.title || null,
          prevOrder: prevTopicDef ? nextOrder - 1 : null,
          nextTitle: nextTopicDef?.title || null,
          nextOrder: nextTopicDef ? nextOrder + 1 : null,
          connectionText: ''
        },
        upscTakeaways: { prelims: [], mains: [] },
        quickCheck: []
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Call Gemini for rich content
    const ai = getAiClient();
    const modelName = getGeminiModel();

    const promptText = `
You are an expert UPSC Modern Indian History teacher who writes like a gifted storyteller.

Your task: Generate a complete daily lesson for the following topic from the UPSC Modern Indian History syllabus.

TOPIC: "${topicDef.title}"
TOPIC ORDER: ${nextOrder} of ${sequence.length}
${topicDef.part ? `PART: ${topicDef.part}` : ''}

CONTEXT (for connecting the story):
- Previous topic in the sequence: ${prevTopicDef ? `"${prevTopicDef.title}"` : 'None (this is the first topic)'}
- Next topic in the sequence: ${nextTopicDef ? `"${nextTopicDef.title}"` : 'None (this is the last topic)'}

CONTENT PHILOSOPHY (strictly follow):
1. quickGlimpseFlow: Exactly 4 short phrases showing the essential causal flow. Max 10 words each. E.g., ["Mughal weakness invites European rivalry", "British win Battle of Plassey 1757", "Bengal treasury falls to Company", "British political supremacy begins"].

2. story: Write as ONE connected historical narrative. Not a textbook. No headers. No bullet lists. No "In conclusion" or "To summarize". Weave in causes, key people, dates, places, consequences and significance naturally into prose. The reader should feel they are understanding an unfolding story. 400-700 words.

3. connectionText: 1-2 paragraphs showing how today's topic is a bridge between what came before and what comes next. Make modern Indian history feel like ONE continuous story, not separate chapters.

4. prelimsFacts: 3-6 precise, exam-ready Prelims facts. Each a complete sentence with specific details (years, names, places, figures).

5. mainsAngles: 2-4 analytical question-frames for Mains. Do NOT write full answers — just sharp analytical angles.

6. quickCheck: Exactly 3 active-recall questions. Test conceptual understanding, not just recall. Each answer: 2-3 sentences.

IMPORTANT:
- Base everything on accurate historical facts only.
- Do not invent facts or dates.
- The story should feel like an episode in a serialized history podcast.
- Difficulty level: UPSC aspirant who has basic familiarity with the topic.
`;

    let generated;
    try {
      const geminiResponse = await ai.models.generateContent({
        model: modelName,
        contents: [{ text: promptText }],
        config: {
          responseMimeType: "application/json",
          responseSchema: dailyNoteResponseSchema,
        }
      });

      generated = JSON.parse(geminiResponse.text);
    } catch (err) {
      // Mark as failed
      await DailyNote.findByIdAndUpdate(placeholder._id, {
        generationStatus: 'FAILED',
        processingError: err.message
      });
      throw new Error(`Gemini generation failed for "${topicDef.title}": ${err.message}`);
    }

    // Validate and save generated content
    const updatedNote = await DailyNote.findByIdAndUpdate(
      placeholder._id,
      {
        quickGlimpse: { flow: generated.quickGlimpseFlow || [] },
        story: generated.story || '',
        connecting: {
          prevTitle: prevTopicDef?.title || null,
          prevOrder: prevTopicDef ? nextOrder - 1 : null,
          nextTitle: nextTopicDef?.title || null,
          nextOrder: nextTopicDef ? nextOrder + 1 : null,
          connectionText: generated.connectionText || ''
        },
        upscTakeaways: {
          prelims: generated.prelimsFacts || [],
          mains: generated.mainsAngles || []
        },
        quickCheck: (generated.quickCheck || []).slice(0, 3),
        generationStatus: 'COMPLETED',
        processingError: null
      },
      { returnDocument: 'after' }
    );

    console.log(`[DailyNotes] ✅ Generated "${topicDef.title}" (order ${nextOrder}) for ${subject}.`);
    return updatedNote;
  }

  /**
   * Force-generate a specific topic order for a subject (admin/manual use).
   */
  async generateSpecificNote(subject, targetOrder) {
    const sequence = SUBJECT_SEQUENCES[subject];
    if (!sequence || targetOrder < 1 || targetOrder > sequence.length) {
      throw new Error(`Invalid subject or order: ${subject} #${targetOrder}`);
    }

    // Check if already exists
    const existing = await DailyNote.findOne({ subject, topicOrder: targetOrder, generationStatus: 'COMPLETED' });
    if (existing) {
      return existing;
    }

    const todayDate = this.getScheduledDateForToday();
    // Temporarily set next order to the target
    const topicDef = sequence[targetOrder - 1];
    const prevTopicDef = targetOrder > 1 ? sequence[targetOrder - 2] : null;
    const nextTopicDef = targetOrder < sequence.length ? sequence[targetOrder] : null;

    const placeholder = await DailyNote.findOneAndUpdate(
      { subject, topicOrder: targetOrder },
      {
        subject,
        topicOrder: targetOrder,
        scheduledDate: todayDate,
        title: topicDef.title,
        syllabusRef: topicDef.syllabusRef || null,
        part: topicDef.part || null,
        generationStatus: 'PENDING',
        quickGlimpse: { flow: [] },
        story: '',
        connecting: {
          prevTitle: prevTopicDef?.title || null,
          prevOrder: prevTopicDef ? targetOrder - 1 : null,
          nextTitle: nextTopicDef?.title || null,
          nextOrder: nextTopicDef ? targetOrder + 1 : null,
          connectionText: ''
        },
        upscTakeaways: { prelims: [], mains: [] },
        quickCheck: []
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    const ai = getAiClient();
    const modelName = getGeminiModel();

    const promptText = `
You are an expert UPSC Modern Indian History teacher who writes like a gifted storyteller.

TOPIC: "${topicDef.title}"
TOPIC ORDER: ${targetOrder} of ${sequence.length}
${topicDef.part ? `PART: ${topicDef.part}` : ''}

Previous topic: ${prevTopicDef ? `"${prevTopicDef.title}"` : 'None'}
Next topic: ${nextTopicDef ? `"${nextTopicDef.title}"` : 'None'}

Generate a daily lesson following this philosophy:
1. quickGlimpseFlow: 4 short causal-flow phrases (max 10 words each)
2. story: Connected historical narrative, 400-700 words, no headers or bullets
3. connectionText: 1-2 paragraphs bridging prev → today → next
4. prelimsFacts: 3-6 Prelims-ready specific facts
5. mainsAngles: 2-4 Mains analytical angles (no full answers)
6. quickCheck: Exactly 3 active-recall Q&A pairs
`;

    const geminiResponse = await ai.models.generateContent({
      model: modelName,
      contents: [{ text: promptText }],
      config: {
        responseMimeType: "application/json",
        responseSchema: dailyNoteResponseSchema,
      }
    });

    const generated = JSON.parse(geminiResponse.text);

    const updatedNote = await DailyNote.findByIdAndUpdate(
      placeholder._id,
      {
        quickGlimpse: { flow: generated.quickGlimpseFlow || [] },
        story: generated.story || '',
        connecting: {
          prevTitle: prevTopicDef?.title || null,
          prevOrder: prevTopicDef ? targetOrder - 1 : null,
          nextTitle: nextTopicDef?.title || null,
          nextOrder: nextTopicDef ? targetOrder + 1 : null,
          connectionText: generated.connectionText || ''
        },
        upscTakeaways: {
          prelims: generated.prelimsFacts || [],
          mains: generated.mainsAngles || []
        },
        quickCheck: (generated.quickCheck || []).slice(0, 3),
        generationStatus: 'COMPLETED',
        processingError: null
      },
      { returnDocument: 'after' }
    );

    return updatedNote;
  }

  /**
   * Send push notification to all subscribers when notes are ready.
   */
  async sendPushNotification(results) {
    try {
      const subscriptions = await Subscription.find();
      if (!subscriptions || subscriptions.length === 0) return;

      const successTopics = results.filter(r => r.status === 'success');
      const notificationPayload = JSON.stringify({
        title: '📚 Today\'s Study Notes Ready!',
        body: successTopics.length === 1
          ? `Today: ${successTopics[0].title}`
          : `${successTopics.length} new lessons generated`,
        icon: '/logo192.png',
        badge: '/logo192.png',
        data: { url: '/notes' }
      });

      const sendPromises = subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub.subscription, notificationPayload);
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await Subscription.findByIdAndDelete(sub._id);
          }
        }
      });
      await Promise.allSettled(sendPromises);
      console.log(`[DailyNotes] Push notification sent to ${subscriptions.length} subscribers.`);
    } catch (err) {
      console.error('[DailyNotes] Failed to send push notifications:', err.message);
    }
  }

  /**
   * Get subject sequence info (for admin/debug)
   */
  getSubjectSequence(subject) {
    return SUBJECT_SEQUENCES[subject] || [];
  }
}

module.exports = new DailyNotesService();
