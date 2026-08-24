const fs = require('fs').promises;
const path = require('path');
const CurrentAffairs = require('../models/CurrentAffairs');

class SyllabusService {
  /**
   * Helper function to normalize GS paper names.
   * Maps 'GS-I', 'GS-II', etc. to 'GS1', 'GS2', etc.
   */
  normalizePaper(gsPaper) {
    if (!gsPaper) return '';
    const clean = gsPaper.toUpperCase().replace(/[\s-]/g, '');
    if (clean.includes('GSI') && !clean.includes('V')) {
      if (clean.includes('III')) return 'GS3';
      if (clean.includes('II')) return 'GS2';
      return 'GS1';
    }
    if (clean.includes('GSIV')) return 'GS4';
    return clean; // Fallback
  }

  /**
   * Retrieve clean words from text for keyword matching.
   */
  getWords(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // replace punctuation with space
      .split(/\s+/)
      .filter(w => w.length >= 3); // ignore short words
  }

  /**
   * Main service function to get UPSC Syllabus enriched with matching news.
   */
  async getSyllabusWithNews() {
    try {
      // 1. Load the syllabus json file
      const syllabusPath = path.join(__dirname, '../utils/upsc_syllabus.json');
      const fileData = await fs.readFile(syllabusPath, 'utf8');
      const syllabus = JSON.parse(fileData);

      // 2. Fetch all completed Current Affairs from the database
      const affairsDocs = await CurrentAffairs.find({ processingStatus: 'COMPLETED' }).sort({ date: -1 });

      // Flatten all news topics from all dates
      const allNewsTopics = [];
      affairsDocs.forEach(doc => {
        const dateStr = doc.date.toISOString().split('T')[0];
        doc.topics.forEach(topic => {
          allNewsTopics.push({
            date: dateStr,
            topicNumber: topic.topicNumber,
            title: topic.title,
            shortDescription: topic.shortDescription,
            importance: topic.importance,
            classification: {
              gsPaper: topic.classification.gsPaper,
              subject: topic.classification.subject,
              subSubject: topic.classification.subSubject
            },
            keywords: topic.prelims?.keywords || []
          });
        });
      });

      // Initialize mapping buckets inside the syllabus structure
      const subjects = syllabus.subjects.map(subject => {
        return {
          ...subject,
          chapters: subject.chapters.map(chapter => {
            return {
              ...chapter,
              topics: chapter.topics.map(topic => {
                return {
                  ...topic,
                  relatedNews: [] // holds related current affairs items
                };
              })
            };
          })
        };
      });

      // 3. Map each news topic to a syllabus topic and subtopic
      allNewsTopics.forEach(news => {
        const matchResult = this.findBestMatch(news, subjects);
        if (matchResult && matchResult.topic) {
          matchResult.topic.relatedNews.push({
            date: news.date,
            topicNumber: news.topicNumber,
            title: news.title,
            shortDescription: news.shortDescription,
            importance: news.importance,
            classification: news.classification,
            subtopic: matchResult.subtopic
          });
        }
      });

      // 4. Calculate overall statistics
      let totalSubjects = subjects.length;
      let totalChapters = 0;
      let totalTopics = 0;
      let totalSubtopics = 0;
      let totalNewsMappedCount = 0;

      subjects.forEach(sub => {
        sub.chapters.forEach(chap => {
          totalChapters++;
          chap.topics.forEach(topic => {
            totalTopics++;
            totalSubtopics += (topic.subtopics || []).length;
            totalNewsMappedCount += topic.relatedNews.length;
          });
        });
      });

      return {
        success: true,
        exam: syllabus.exam,
        version: syllabus.version,
        stats: {
          totalSubjects,
          totalChapters,
          totalTopics,
          totalSubtopics,
          totalNewsMappedCount
        },
        subjects
      };
    } catch (error) {
      console.error('[SyllabusService] Error enriching syllabus:', error);
      throw error;
    }
  }

  /**
   * Helper function to find the best matching subtopic in a list based on keywords.
   */
  findBestSubtopic(newsWords, subtopics) {
    if (!subtopics || subtopics.length === 0) return null;
    let bestSub = subtopics[0];
    let highestScore = -1;

    subtopics.forEach(subt => {
      let score = 0;
      const subtWords = this.getWords(subt);
      subtWords.forEach(w => {
        if (newsWords.includes(w)) score++;
      });
      if (score > highestScore) {
        highestScore = score;
        bestSub = subt;
      }
    });

    return bestSub;
  }

  /**
   * Heuristic mapping function to find the best matching topic in the syllabus tree.
   */
  findBestMatch(news, subjects) {
    const newsPaperCode = this.normalizePaper(news.classification.gsPaper);
    
    // Filter subjects by the GS Paper code
    const candidateSubjects = subjects.filter(sub => sub.paper === newsPaperCode);
    if (candidateSubjects.length === 0) return null;

    // Tokenize news properties for overlap matching
    const newsWords = [
      ...this.getWords(news.title),
      ...this.getWords(news.classification.subject),
      ...this.getWords(news.classification.subSubject),
      ...news.keywords.flatMap(kw => this.getWords(kw))
    ];

    let bestTopic = null;
    let highestScore = 0;

    // Search through chapters & topics in candidate subjects
    for (const subject of candidateSubjects) {
      for (const chapter of subject.chapters) {
        for (const topic of chapter.topics) {
          let score = 0;

          // 1. Check matching words in Topic Name (weight: 3 per match)
          const topicWords = this.getWords(topic.name);
          topicWords.forEach(word => {
            if (newsWords.includes(word)) score += 3;
          });

          // 2. Check matching words in Subtopics (weight: 1 per match)
          if (topic.subtopics) {
            topic.subtopics.forEach(subtopic => {
              const subtopicWords = this.getWords(subtopic);
              subtopicWords.forEach(word => {
                if (newsWords.includes(word)) score += 1;
              });
            });
          }

          // 3. Boost score if subject name matches the news classification subject (weight: 2)
          const subjectWords = this.getWords(subject.name);
          const classSubjectWords = this.getWords(news.classification.subject);
          subjectWords.forEach(word => {
            if (classSubjectWords.includes(word)) score += 2;
          });

          // 4. Boost score if chapter name matches the news classification subSubject (weight: 2)
          const chapterWords = this.getWords(chapter.name);
          const classSubSubjectWords = this.getWords(news.classification.subSubject);
          chapterWords.forEach(word => {
            if (classSubSubjectWords.includes(word)) score += 2;
          });

          // Keep track of the highest score topic
          if (score > highestScore) {
            highestScore = score;
            bestTopic = topic;
          }
        }
      }
    }

    // Fallback logic if score is too low or zero:
    // Try to find the closest subject by name within the same paper, and assign it to its first topic.
    if (highestScore < 2) {
      const bestSubjectMatch = candidateSubjects.find(sub => {
        const subNameLower = sub.name.toLowerCase();
        const newsSubLower = news.classification.subject.toLowerCase();
        return subNameLower.includes(newsSubLower) || newsSubLower.includes(subNameLower);
      });

      if (bestSubjectMatch && bestSubjectMatch.chapters[0] && bestSubjectMatch.chapters[0].topics[0]) {
        const topic = bestSubjectMatch.chapters[0].topics[0];
        const subtopic = this.findBestSubtopic(newsWords, topic.subtopics);
        return { topic, subtopic };
      }

      // Default fallback: return the first topic of the first subject under this paper
      if (candidateSubjects[0] && candidateSubjects[0].chapters[0] && candidateSubjects[0].chapters[0].topics[0]) {
        const topic = candidateSubjects[0].chapters[0].topics[0];
        const subtopic = this.findBestSubtopic(newsWords, topic.subtopics);
        return { topic, subtopic };
      }
    }

    if (bestTopic) {
      const subtopic = this.findBestSubtopic(newsWords, bestTopic.subtopics);
      return { topic: bestTopic, subtopic };
    }

    return null;
  }
}

module.exports = new SyllabusService();
