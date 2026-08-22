const CurrentAffairs = require('../models/CurrentAffairs');
const { getAiClient, getGeminiModel } = require('../config/gemini');
const { cloudinary = {} } = require('../config/cloudinary');
const Subscription = require('../models/Subscription');
const webpush = require('web-push');

// JSON schema definition for structured output matching our desired Mongoose schema
const currentAffairsResponseSchema = {
  type: "object",
  properties: {
    date: {
      type: "string",
      description: "The date of the current affairs extracted from the image in YYYY-MM-DD format (e.g. 2026-08-20)"
    },
    topics: {
      type: "array",
      description: "List of all UPSC current affairs topics found in the image. Capture every topic present.",
      items: {
        type: "object",
        properties: {
          topicNumber: {
            type: "integer",
            description: "The original number of the topic from the list (e.g. 1, 2, 3, etc.)"
          },
          originalHeadline: {
            type: "string",
            description: "The topic headline exactly as written in the image"
          },
          title: {
            type: "string",
            description: "A refined, clear title for the topic suitable for UPSC"
          },
          shortDescription: {
            type: "string",
            description: "A concise 1-2 sentence explanation of the current event (easy to understand, factual, not a full Mains answer)"
          },
          classification: {
            type: "object",
            properties: {
              gsPaper: {
                type: "string",
                enum: ["GS-I", "GS-II", "GS-III", "GS-IV"],
                description: "Primary UPSC General Studies paper classification"
              },
              subject: {
                type: "string",
                description: "The subject under the GS paper (e.g. Economy, Polity, History, Science & Technology)"
              },
              subSubject: {
                type: "string",
                description: "A more specific sub-topic or theme"
              }
            },
            required: ["gsPaper", "subject", "subSubject"]
          },
          importance: {
            type: "string",
            enum: ["HIGH", "MEDIUM", "LOW"],
            description: "Relevance of this topic for UPSC exam preparation"
          },
          analysis: {
            type: "object",
            properties: {
              whatHappened: {
                type: "string",
                description: "A summary of the current news event or decision"
              },
              background: {
                type: "string",
                description: "Brief background or historical context surrounding this issue"
              },
              whyImportant: {
                type: "string",
                description: "UPSC Mains significance of this topic"
              },
              keyPoints: {
                type: "array",
                items: { type: "string" },
                description: "2-5 analytical key points or dimensions of the topic"
              },
              governmentMeasures: {
                type: "array",
                items: { type: "string" },
                description: "List of relevant policies, acts, schemes, or measures taken by the government"
              },
              challenges: {
                type: "array",
                items: { type: "string" },
                description: "Major challenges, drawbacks, or issues associated with it"
              },
              wayForward: {
                type: "array",
                items: { type: "string" },
                description: "Actionable recommendations, reforms, or solutions"
              }
            },
            required: ["whatHappened", "background", "whyImportant", "keyPoints", "governmentMeasures", "challenges", "wayForward"]
          },
          prelims: {
            type: "object",
            properties: {
              facts: {
                type: "array",
                items: { type: "string" },
                description: "Factual information useful for Prelims (institutions, grouping, terms, articles, etc.)"
              },
              keywords: {
                type: "array",
                items: { type: "string" },
                description: "Important terminology or core keywords related to the topic"
              }
            },
            required: ["facts", "keywords"]
          },
          revision: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "One active-recall revision question focused on UPSC dimensions"
              },
              answer: {
                type: "string",
                description: "A concise answer explaining the key points of the revision question"
              }
            },
            required: ["question", "answer"]
          },
          sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                url: { type: "string", description: "Real source URL found via search grounding" },
                sourceType: { type: "string", enum: ["official", "media", "other"] }
              },
              required: ["title", "url", "sourceType"]
            },
            description: "List of source citations found during Google Search grounding. Provide real URLs. If none, return empty array."
          }
        },
        "required": [
          "topicNumber", "originalHeadline", "title", "shortDescription",
          "classification", "importance", "analysis", "prelims", "revision", "sources"
        ]
      }
    }
  },
  required: ["date", "topics"]
};

class CurrentAffairsService {
  /**
   * Process a current affairs image:
   * 1. Download image from Cloudinary (where Multer saved it).
   * 2. Send image to Gemini API with Google Search grounding and structured schema.
   * 3. Validate extracted fields.
   * 4. Perform upsert (replacing existing document for the same day to avoid duplicates).
   */
  async processImage(file) {
    if (!file) {
      throw new Error('Image file is missing');
    }

    console.log('[CurrentAffairs] Image received');
    console.log('[CurrentAffairs] Cloudinary upload complete'); // Already uploaded by Multer at this point
    console.log('[CurrentAffairs] Sending image to Gemini');

    // 1. Fetch file from Cloudinary and convert to Base64 buffer
    let base64Image;
    try {
      const response = await fetch(file.path);
      if (!response.ok) {
        throw new Error(`Failed to fetch file from Cloudinary: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      base64Image = Buffer.from(arrayBuffer).toString('base64');
    } catch (error) {
      console.error(`[CurrentAffairs] Error downloading image from Cloudinary: ${error.message}`);
      throw new Error(`Cloudinary asset retrieval failed: ${error.message}`);
    }

    // 2. Call Gemini models API
    const ai = getAiClient();
    const modelName = getGeminiModel();
    let geminiResponse;

    const promptText = `
      You are a UPSC current affairs expert. Your task is to analyze the provided image containing a list of news headlines.
      
      Requirements:
      1. Extract the Date: Identify the date explicitly mentioned in the image (e.g. 'DATE:- 20/08/2026'). Convert it into standard YYYY-MM-DD format. Do not use today's date if another date is printed in the image. If you cannot detect the date, fail or return a clear error indicator.
      2. Detect All Topics: Detect EVERY distinct numbered headline present in the image. Do not assume there are exactly 10; there could be 8, 12, 13, 15, or more. Record every single one of them.
      3. Google Search Grounding: For each headline/topic, use your Google Search tool to search for real background facts, constitutional provisions, latest statistics, and official government data (RBI, SEBI, Supreme Court, Ministries, reputed media).
      4. Avoid Hallucinations: Do not fabricate facts, statistics, or URLs. If a source URL cannot be found, omit it (return empty sources array).
      5. Structured Response: Return the exact JSON structure defined in the schema.
    `;

    try {
      geminiResponse = await ai.models.generateContent({
        model: modelName,
        contents: [
          { text: promptText },
          {
            inlineData: {
              data: base64Image,
              mimeType: file.mimetype,
            },
          },
        ],
        config: {

          responseMimeType: "application/json",
          responseSchema: currentAffairsResponseSchema,
        },
      });
    } catch (error) {
      console.error('[CurrentAffairs] Gemini API call failed complete log:', error);
      throw new Error(`Gemini analysis failed: ${error.message}`);
    }

    console.log('[CurrentAffairs] Gemini processing complete');

    // 3. Parse and Validate the Gemini Output
    let payload;
    try {
      payload = JSON.parse(geminiResponse.text);
    } catch (error) {
      console.error('[CurrentAffairs] Gemini output is not valid JSON:', geminiResponse.text);
      throw new Error('Gemini returned an invalid JSON response structure');
    }

    // Validate date presence
    if (!payload.date) {
      throw new Error('Could not detect the date from the current affairs headlines list');
    }

    const parsedDate = new Date(payload.date);
    if (isNaN(parsedDate.getTime())) {
      throw new Error(`Extracted date is invalid: ${payload.date}`);
    }

    // Normalize date to midnight UTC to ensure reliable duplicate detection
    parsedDate.setUTCHours(0, 0, 0, 0);

    // Validate topics
    if (!payload.topics || !Array.isArray(payload.topics)) {
      throw new Error('Gemini response did not contain a valid topics array');
    }

    const topicCount = payload.topics.length;
    console.log(`[CurrentAffairs] Topics detected: ${topicCount}`);

    // Verify all topics have required parameters
    payload.topics.forEach((topic, idx) => {
      if (!topic.topicNumber) topic.topicNumber = idx + 1;
      if (!topic.title || !topic.shortDescription) {
        throw new Error(`Topic at index ${idx} is missing required fields (title, shortDescription)`);
      }
    });

    console.log('[CurrentAffairs] Saving to MongoDB');

    // 4. Handle duplicates - if a document for this date already exists, delete its image from Cloudinary to save space
    try {
      const existingDoc = await CurrentAffairs.findOne({ date: parsedDate });
      if (existingDoc && existingDoc.sourceImage && existingDoc.sourceImage.publicId) {
        // Delete the previous source image from Cloudinary
        try {
          await cloudinary.uploader.destroy(existingDoc.sourceImage.publicId);
          console.log(`[CurrentAffairs] Deleted existing image ${existingDoc.sourceImage.publicId} from Cloudinary to avoid duplicate orphans`);
        } catch (err) {
          console.error(`[CurrentAffairs] Failed to delete duplicate image from Cloudinary: ${err.message}`);
        }
      }
    } catch (dbErr) {
      console.error(`[CurrentAffairs] Warning checking duplicates in database: ${dbErr.message}`);
    }

    // 5. Upsert CurrentAffairs document in MongoDB
    try {
      const savedDoc = await CurrentAffairs.findOneAndUpdate(
        { date: parsedDate },
        {
          date: parsedDate,
          sourceImage: {
            url: file.path,
            publicId: file.filename, // Multer-storage-cloudinary populates publicId here
          },
          topicCount: topicCount,
          topics: payload.topics,
          processingStatus: 'COMPLETED',
        },
        { upsert: true, new: true, runValidators: true }
      );

      console.log('[CurrentAffairs] Processing complete');

      // Trigger push notifications asynchronously
      (async () => {
        try {
          const subscriptions = await Subscription.find();
          if (subscriptions.length === 0) return;

          console.log(`[CurrentAffairs] Broadcasting push notifications to ${subscriptions.length} subscribers`);
          const formattedDate = savedDoc.date.toISOString().split('T')[0];
          const notificationPayload = JSON.stringify({
            title: 'Helios Study Deck Ready!',
            body: `Your current affairs deck for ${formattedDate} is ready with ${savedDoc.topicCount} topics!`,
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
              console.error(`[CurrentAffairs] Failed to send push to ${sub.endpoint}:`, err.message);
              if (err.statusCode === 410 || err.statusCode === 404) {
                // Subscription has expired or is no longer valid, delete it
                await Subscription.deleteOne({ endpoint: sub.endpoint });
                console.log(`[CurrentAffairs] Deleted expired subscription: ${sub.endpoint}`);
              }
            })
          ));
        } catch (pushErr) {
          console.error('[CurrentAffairs] Push notification broadcast failed:', pushErr.message);
        }
      })();

      return savedDoc;
    } catch (error) {
      console.error(`[CurrentAffairs] Database saving failed: ${error.message}`);
      throw new Error(`Database saving failed: ${error.message}`);
    }
  }

  /**
   * Fetch the most recently saved day record
   */
  async getLatest() {
    try {
      const doc = await CurrentAffairs.findOne().sort({ date: -1 });
      return doc;
    } catch (error) {
      console.error(`[CurrentAffairs] Error fetching latest: ${error.message}`);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * Fetch all dates with their topic counts
   */
  async getDatesMetadata() {
    try {
      const docs = await CurrentAffairs.find({}, 'date topicCount').sort({ date: -1 });
      return docs.map(doc => ({
        date: doc.date,
        topicCount: doc.topicCount
      }));
    } catch (error) {
      console.error(`[CurrentAffairs] Error fetching dates metadata: ${error.message}`);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * Fetch current affairs document by date string (e.g. 2026-08-20)
   */
  async getByDate(dateString) {
    try {
      const parsedDate = new Date(dateString);
      if (isNaN(parsedDate.getTime())) {
        throw new Error(`Invalid date string: ${dateString}`);
      }

      // Normalize to midnight UTC to match DB format
      parsedDate.setUTCHours(0, 0, 0, 0);

      const doc = await CurrentAffairs.findOne({ date: parsedDate });
      return doc;
    } catch (error) {
      console.error(`[CurrentAffairs] Error fetching by date: ${error.message}`);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }
}

module.exports = new CurrentAffairsService();
