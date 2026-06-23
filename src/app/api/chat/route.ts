import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { prisma } from '@/lib/db';
import { LocalVectorStore } from '@/lib/vectorStore';
import { getEmbedding, synthesizeEligibility, EligibilityResult } from '@/lib/gemini';
import { getOrCreateDbUser } from '@/lib/auth';

function getAIClient() {
  const key = process.env.GEMINI_API_KEY || '';
  console.log(`[getAIClient] Active API Key suffix: ...${key.slice(-5)}`);
  return new GoogleGenAI({
    apiKey: key
  });
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], profile = {}, turnNumber = 1 } = body;
    let detectedLanguage = body.detectedLanguage || 'English';

    if (typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Latest user message is required.' }, { status: 400 });
    }

    // Deactivate expired schemes on the fly so we maintain an auto-expiry system
    try {
      const now = new Date();
      await prisma.scheme.updateMany({
        where: {
          expiryDate: { lt: now },
          isActive: true
        },
        data: {
          isActive: false
        }
      });
    } catch (dbErr) {
      console.error('Error auto-expiring schemes:', dbErr);
    }

    const currentProfile = {
      state: profile.state || '',
      age: typeof profile.age === 'number' ? profile.age : 0,
      gender: profile.gender || 'All',
      casteCategory: profile.casteCategory || 'General',
      annualIncome: typeof profile.annualIncome === 'number' ? profile.annualIncome : 0,
      occupation: profile.occupation || '',
      disabilityStatus: profile.disabilityStatus || 'No',
      disabilityPercentage: typeof profile.disabilityPercentage === 'number' ? profile.disabilityPercentage : 0,
      needsAndInterests: profile.needsAndInterests || ''
    };

    const prompt = `
You are the conversational assistant for GOONJ (गूंज), a voice-first government scheme discovery platform.
Your goal is to converse with a citizen in their preferred language to gather key demographic details to match them with government welfare schemes.

Core details to collect:
1. state (Standardized to the official English state name, e.g. "Bihar", "Maharashtra", "Uttar Pradesh", "Tamil Nadu", or "Central")
2. age (Number)
3. gender ("Male", "Female", or "All")
4. casteCategory ("SC", "ST", "OBC", or "General")
5. annualIncome (Number in INR, e.g. 150000)
6. occupation (e.g. "farmer", "student", "unemployed", "merchant", "weaver", "artisan", etc.)
7. disabilityStatus ("Yes" or "No")
8. needsAndInterests (A short English translation of what they are looking for, e.g. "education scholarship", "farming seed subsidies", "housing help", "business loans")

Current Accumulated Profile:
${JSON.stringify(currentProfile, null, 2)}

Chat History:
${history.map((h: ChatTurn) => `${h.role === 'user' ? 'Citizen' : 'Goonj Assistant'}: "${h.content}"`).join('\n')}

Latest Citizen Input:
"${message}"

Current Turn Number: ${turnNumber} (Max allowed questions: 8)
Established Language: ${turnNumber > 1 ? detectedLanguage : 'Not yet established'}

Instructions:
1. ${turnNumber === 1 
      ? 'Detect the citizen\'s primary spoken language (e.g. Hindi, English, Bhojpuri, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia) from this first input, and save to "detectedLanguage".' 
      : `Do NOT attempt to guess or change the language. The language has already been established as "${detectedLanguage}". Strictly save "${detectedLanguage}" to "detectedLanguage".`
   }
2. If possible, detect the specific dialect (e.g. Bhojpuri, Maithili, Magahi, standard Hindi, etc.) and save to "dialect".
3. Extract any new details from the latest citizen input and merge them into the profile. Ensure age and annualIncome are numbers. For state, map to standardized English names. If caste is mentioned (like SC, ST, OBC), categorize appropriately.
4. For any fields that have not been provided or cannot be inferred yet, strictly use their existing value from the Current Accumulated Profile.
5. Identify which of the 8 core parameters are still missing (i.e. default empty values, age=0, income=0, needsAndInterests='', state='').
6. If there are missing fields AND the turnNumber is less than 8:
   - Formulate a single, polite, natural question in the citizen's detected language to ask for ONE of the missing parameters. Keep the tone warm, welcoming, and extremely simple (suitable for rural/elderly users).
   - Set "isComplete" to false.
7. If all key parameters are filled, OR if the turnNumber reaches 8:
   - Formulate a brief warm closing in the citizen's language telling them you are scanning the matching schemes.
   - Set "isComplete" to true.
`;

    const callGeminiWithFallback = async (modelParams: {
      contents: string;
      config: any;
    }) => {
      const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
      let lastError: any = null;

      for (const model of models) {
        let attempts = 0;
        const maxAttempts = 2;
        while (attempts < maxAttempts) {
          try {
            console.log(`[POST /api/chat] Attempting Gemini call with model ${model} (attempt ${attempts + 1})...`);
            const res = await getAIClient().models.generateContent({
              model,
              contents: modelParams.contents,
              config: modelParams.config
            });
            return res;
          } catch (err: any) {
            attempts++;
            lastError = err;
            console.warn(`[POST /api/chat] Model ${model} failed (attempt ${attempts}):`, err.message || err);
            
            const errStr = String(err.message || err);
            const isTransient = errStr.includes('503') || errStr.includes('429') || errStr.includes('UNAVAILABLE') || err.status === 503;
            if (isTransient) {
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              break;
            }
          }
        }
      }
      throw lastError || new Error('All model attempts failed');
    };

    const response = await callGeminiWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLanguage: { type: Type.STRING },
            dialect: { type: Type.STRING },
            profile: {
              type: Type.OBJECT,
              properties: {
                state: { type: Type.STRING },
                age: { type: Type.INTEGER },
                gender: { type: Type.STRING, enum: ['Male', 'Female', 'All'] },
                casteCategory: { type: Type.STRING, enum: ['SC', 'ST', 'OBC', 'General'] },
                annualIncome: { type: Type.NUMBER },
                occupation: { type: Type.STRING },
                disabilityStatus: { type: Type.STRING, enum: ['Yes', 'No'] },
                disabilityPercentage: { type: Type.INTEGER },
                needsAndInterests: { type: Type.STRING }
              },
              required: ['state', 'age', 'gender', 'casteCategory', 'annualIncome', 'occupation', 'disabilityStatus', 'disabilityPercentage', 'needsAndInterests']
            },
            missingFields: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            nextQuestion: { type: Type.STRING },
            isComplete: { type: Type.BOOLEAN }
          },
          required: ['detectedLanguage', 'profile', 'missingFields', 'nextQuestion', 'isComplete']
        }
      }
    });

    if (!response.text) {
      throw new Error('Empty response from Gemini conversation analyzer.');
    }

    const parsedResult = JSON.parse(response.text);
    const { detectedLanguage: responseLang, dialect, profile: updatedProfile, isComplete, nextQuestion } = parsedResult;
    detectedLanguage = responseLang || detectedLanguage;

    // Check if we need to run scheme matching
    if (isComplete) {
      console.log('Conversation complete! Running scheme matching engine...');

      // Find database matches
      const candidateSchemes = await prisma.scheme.findMany({
        where: {
          isActive: true,
          state: {
            in: [updatedProfile.state, 'Central', 'central']
          },
          OR: [
            { minAge: null },
            { minAge: { lte: updatedProfile.age } }
          ],
          AND: [
            {
              OR: [
                { maxAge: null },
                { maxAge: { gte: updatedProfile.age } }
              ]
            },
            {
              genderRestriction: {
                in: [updatedProfile.gender, 'All', 'all']
              }
            },
            {
              OR: [
                { incomeCeiling: null },
                { incomeCeiling: { gte: updatedProfile.annualIncome } }
              ]
            }
          ]
        }
      });

      // Programmatic filtering for occupation and caste
      const userOccupation = updatedProfile.occupation.toLowerCase().trim();
      const userCaste = updatedProfile.casteCategory.toLowerCase().trim();

      const fullyMatchingSchemes = candidateSchemes.filter(scheme => {
        if (scheme.occupations && scheme.occupations.trim() !== '') {
          const allowedOccupations = scheme.occupations.toLowerCase().split(',').map(o => o.trim());
          const hasMatchingJob = allowedOccupations.includes(userOccupation) || 
                                 allowedOccupations.includes('all') || 
                                 allowedOccupations.length === 0;
          if (!hasMatchingJob) return false;
        }

        if (scheme.casteCategories && scheme.casteCategories.trim() !== '') {
          const allowedCastes = scheme.casteCategories.toLowerCase().split(',').map(c => c.trim());
          const hasMatchingCaste = allowedCastes.includes(userCaste) || 
                                   allowedCastes.includes('all') || 
                                   allowedCastes.length === 0;
          if (!hasMatchingCaste) return false;
        }

        return true;
      });

      let qualifyingSchemes: EligibilityResult[] = [];

      if (fullyMatchingSchemes.length > 0) {
        const queryVector = await getEmbedding(updatedProfile.needsAndInterests || 'welfare benefits');
        const candidateIds = fullyMatchingSchemes.map(s => s.id);
        const searchResults = await LocalVectorStore.search(queryVector, candidateIds, 15);

        const chunksByScheme = new Map<string, string[]>();
        for (const match of searchResults) {
          const chunks = chunksByScheme.get(match.schemeId) || [];
          if (chunks.length < 3) {
            chunks.push(match.text);
          }
          chunksByScheme.set(match.schemeId, chunks);
        }

        const schemesDataForSynthesis = fullyMatchingSchemes
          .map(scheme => ({
            id: scheme.id,
            title: scheme.title,
            ministry: scheme.ministry,
            chunks: chunksByScheme.get(scheme.id) || [scheme.applicationSteps]
          }))
          .sort((a, b) => {
            const hasA = chunksByScheme.has(a.id) ? 1 : 0;
            const hasB = chunksByScheme.has(b.id) ? 1 : 0;
            return hasB - hasA;
          });

        const schemesToEvaluate = schemesDataForSynthesis.slice(0, 5);

        const eligibilityResults = await synthesizeEligibility(
          updatedProfile,
          updatedProfile.needsAndInterests || 'welfare benefits',
          schemesToEvaluate,
          detectedLanguage
        );

        qualifyingSchemes = eligibilityResults.filter(r => r.isEligible);
      }

      // Check if logged in to save history
      const dbUser = await getOrCreateDbUser();
      const userId = dbUser?.id || null;

      // Save to SearchHistory
      try {
        await prisma.searchHistory.create({
          data: {
            userId,
            query: updatedProfile.needsAndInterests || 'welfare benefits',
            state: updatedProfile.state,
            age: updatedProfile.age,
            gender: updatedProfile.gender,
            income: updatedProfile.annualIncome,
            occupation: updatedProfile.occupation,
            caste: updatedProfile.casteCategory,
            detectedLanguage
          }
        });
      } catch (dbErr) {
        console.error('Failed to log search history:', dbErr);
      }

      return NextResponse.json({
        success: true,
        detectedLanguage,
        dialect,
        profile: updatedProfile,
        isComplete: true,
        nextQuestion,
        schemes: qualifyingSchemes,
        totalEligible: qualifyingSchemes.length
      });
    }

    return NextResponse.json({
      success: true,
      detectedLanguage,
      dialect,
      profile: updatedProfile,
      isComplete: false,
      nextQuestion
    });

  } catch (error) {
    console.error('Error in api/chat:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
