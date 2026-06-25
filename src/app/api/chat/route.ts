import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { prisma } from '@/lib/db';
import { LocalVectorStore } from '@/lib/vectorStore';
import { getEmbedding, synthesizeEligibility, EligibilityResult, getAIClient, callGeminiWithFallback } from '@/lib/gemini';
import { getOrCreateDbUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

    let prompt = '';
    if (turnNumber === 1) {
      prompt = `
You are the conversational assistant for GOONJ (गूंज), a voice-first government scheme discovery platform in India.
Your goal is to detect the citizen's language and ask them to supply all their demographic details in one go so we can match them with welfare schemes.

Citizen First Input:
"${message}"

Instructions:
1. Detect the citizen's primary spoken language (e.g. Hindi, English, Bhojpuri, Marathi, Tamil, Telugu, Gujarati, Bengali, etc.). Save to "detectedLanguage".
2. Detect the dialect if possible (e.g. Bhojpuri, Maithili, standard Hindi, etc.). Save to "dialect".
3. Check if the citizen's input already contains multiple demographic details (e.g. state, age, caste, income, occupation, etc.).
   - If they did NOT provide multiple demographics (usually it's just a greeting like "Hi", "नमस्ते", or "I need schemes"):
     - Set "isComplete" to false.
     - Formulate a warm, welcoming response in the citizen's detected language. Explicitly ask them to state all the details. Set this response to "nextQuestion".
     - For the "profile" object, output the current profile or default values since details are not provided yet.
   - If they DID already provide multiple demographics in their first message:
     - Set "isComplete" to true.
     - Extract all details into the "profile" object. Ensure age and annualIncome are numbers. Standardize the state name to the official English name.
     - Formulate a brief closing in their language saying you are matching schemes. Set to "nextQuestion".
4. Translate the following 8 demographic questions into the citizen's detected language and output them in the "translatedQuestions" array:
   Question 1: "State of residence"
   Question 2: "Age"
   Question 3: "Gender"
   Question 4: "Caste category (General, OBC, SC, or ST)"
   Question 5: "Annual family income (in Rupees)"
   Question 6: "Occupation / Job"
   Question 7: "Disability status (Yes/No, with percentage if applicable)"
   Question 8: "What kind of government assistance or welfare schemes are you looking for?"
`;
    } else {
      prompt = `
You are the conversational assistant for GOONJ (गूंज).
The citizen has provided their details in response to our question.
Your goal is to parse their input and extract all their demographic details.

Citizen Input:
"${message}"

Chat History (for context):
${history.map((h: ChatTurn) => `${h.role === 'user' ? 'Citizen' : 'Goonj Assistant'}: "${h.content}"`).join('\n')}

Instructions:
1. Extract all details into the "profile" object.
   Demographics to extract:
   - state: Standardized official English state name (e.g. "Bihar", "Maharashtra", "Uttar Pradesh", "Tamil Nadu", or "Central"). Default to "Bihar" if not mentioned.
   - age: Number. Default to 25 if not mentioned.
   - gender: "Male", "Female", or "All". Default to "All" if not mentioned.
   - casteCategory: "SC", "ST", "OBC", or "General". Default to "General" if not mentioned.
   - annualIncome: Number in INR (e.g. 150000). Default to 150000 if not mentioned.
   - occupation: e.g. "farmer", "student", "unemployed", "merchant", "weaver", "artisan". Default to "farmer" if not mentioned.
   - disabilityStatus: "Yes" or "No". Default to "No" if not mentioned.
   - disabilityPercentage: Number. Default to 0 if not mentioned.
   - needsAndInterests: English translation of what they are looking for. Default to "welfare benefits" if not mentioned.
2. Maintain the "detectedLanguage" as "${detectedLanguage}".
3. Formulate a brief warm closing in the citizen's language (e.g. Hindi or English) telling them you are scanning the database for eligible schemes. Save to "nextQuestion".
4. Set "isComplete" to true.
5. Output the translated questions in the citizen's detected language in the "translatedQuestions" array (similar to Turn 1).
`;
    }

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
            isComplete: { type: Type.BOOLEAN },
            translatedQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['detectedLanguage', 'profile', 'missingFields', 'nextQuestion', 'isComplete', 'translatedQuestions']
        }
      }
    });

    if (!response.text) {
      throw new Error('Empty response from Gemini conversation analyzer.');
    }

    const parsedResult = JSON.parse(response.text);
    const { detectedLanguage: responseLang, dialect, profile: updatedProfile, isComplete, nextQuestion, translatedQuestions } = parsedResult;
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

        const evaluatedResults = eligibilityResults.filter(r => r.isEligible);
        qualifyingSchemes = evaluatedResults.map(qs => {
          const dbScheme = fullyMatchingSchemes.find(s => s.id === qs.schemeId);
          return {
            ...qs,
            documentUrl: dbScheme?.documentUrl || null,
            applyUrl: dbScheme?.applyUrl || null
          };
        });
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
        totalEligible: qualifyingSchemes.length,
        translatedQuestions
      });
    }

    return NextResponse.json({
      success: true,
      detectedLanguage,
      dialect,
      profile: updatedProfile,
      isComplete: false,
      nextQuestion,
      translatedQuestions
    });

  } catch (error) {
    console.error('Error in api/chat:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
