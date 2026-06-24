import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';

function getApiKeyFromEnvFile(): string {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const firstEq = trimmed.indexOf('=');
        if (firstEq === -1) continue;
        const key = trimmed.slice(0, firstEq).trim();
        if (key === 'GEMINI_API_KEY') {
          let val = trimmed.slice(firstEq + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          }
          return val;
        }
      }
    }
  } catch (err) {
    console.error('Failed to parse .env file for GEMINI_API_KEY:', err);
  }
  return process.env.GEMINI_API_KEY || '';
}

export function getAIClient() {
  const key = getApiKeyFromEnvFile();
  console.log(`[src/lib/gemini] Active API Key suffix: ...${key.slice(-5)}`);
  return new GoogleGenAI({
    apiKey: key
  });
}

export async function callGeminiWithFallback(params: {
  contents: string;
  config: any;
}): Promise<any> {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    let attempts = 0;
    const maxAttempts = 3;
    let fallbackToNextModel = false;

    while (attempts < maxAttempts) {
      try {
        console.log(`[src/lib/gemini] Attempting Gemini call with model ${model} (attempt ${attempts + 1})...`);
        const res = await getAIClient().models.generateContent({
          model,
          contents: params.contents,
          config: params.config
        });
        return res;
      } catch (err: any) {
        attempts++;
        lastError = err;
        const errStr = String(err.message || err);
        console.warn(`[src/lib/gemini] Model ${model} failed (attempt ${attempts}):`, errStr);

        const isRateLimited = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.toLowerCase().includes('quota');
        const isServerUnavailable = errStr.includes('503') || errStr.includes('UNAVAILABLE') || err.status === 503;

        if (isRateLimited) {
          const delay = attempts * 3000;
          console.log(`[src/lib/gemini] Rate limit hit. Waiting ${delay}ms before retrying model ${model}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (isServerUnavailable) {
          const delay = attempts * 1000;
          console.log(`[src/lib/gemini] Server transient error. Waiting ${delay}ms before retrying model ${model}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          fallbackToNextModel = true;
          break;
        }
      }
    }

    if (!fallbackToNextModel && lastError) {
      throw lastError;
    }
  }
  throw lastError || new Error('All model attempts failed');
}

/**
 * Generate a vector embedding for a given text chunk using text-embedding-004.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const response = await getAIClient().models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
    });

    if (response.embeddings?.[0]?.values) {
      return response.embeddings[0].values;
    }
    throw new Error('Failed to retrieve embedding values');
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

export interface UserProfile {
  state: string;
  age: number;
  gender: 'Male' | 'Female' | 'All';
  casteCategory: 'SC' | 'ST' | 'OBC' | 'General';
  annualIncome: number;
  occupation: string;
  disabilityStatus: 'Yes' | 'No';
  disabilityPercentage: number;
}

export interface StandardizedProfileResponse {
  detectedLanguage: string;
  profile: UserProfile;
  needsAndInterests: string;
}

/**
 * Uses Gemini to parse conversational voice questionnaire answers into a clean, structured demographic profile.
 */
export async function parseProfileFromAnswers(answers: string[]): Promise<StandardizedProfileResponse> {
  const prompt = `
You are an expert demographic analyzer for government schemes in India.
Below is an array of 8 answers supplied by a user during a voice interview. 
The questions asked were:
1. State of residence
2. Age
3. Gender
4. Caste / Category (SC, ST, OBC, General)
5. Annual household income (INR)
6. Occupation (e.g. farmer, student, unemployed, etc.)
7. Disability status
8. Spoken need or interest (what they are looking for, e.g. housing, education, farming help)

Here are the user's answers:
${answers.map((ans, i) => `${i + 1}. "${ans}"`).join('\n')}

Task:
Parse these answers, detect the predominant language, and output a clean, structured JSON profile.
Ensure the output matches the required schema. For numeric fields like age and income, extract the numbers from the strings. For casteCategory, categorize it as SC, ST, OBC, or General. For state, standardize it to the official state name in English (e.g. Maharashtra, Uttar Pradesh). If any field is unclear, use standard defaults. Translate needsAndInterests to English to facilitate vector search.
`;

  try {
    const response = await callGeminiWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLanguage: { type: Type.STRING },
            needsAndInterests: { type: Type.STRING },
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
                disabilityPercentage: { type: Type.INTEGER }
              },
              required: ['state', 'age', 'gender', 'casteCategory', 'annualIncome', 'occupation', 'disabilityStatus', 'disabilityPercentage']
            }
          },
          required: ['detectedLanguage', 'profile', 'needsAndInterests']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as StandardizedProfileResponse;
    }
    throw new Error('Empty response from profile parser');
  } catch (error) {
    console.error('Error parsing profile answers:', error);
    throw error;
  }
}

export interface EligibilityResult {
  schemeId: string;
  title: string;
  ministry: string;
  description: string;
  isEligible: boolean;
  whyEligible: string;
  benefits: string;
  stepsToApply: string[];
  documentUrl?: string | null;
}

/**
 * Takes matching schemes text chunks and the user profile to perform final RAG verification and translate details.
 */
export async function synthesizeEligibility(
  userProfile: UserProfile,
  needsAndInterests: string,
  schemesData: { id: string; title: string; ministry: string | null; chunks: string[] }[],
  targetLanguage: string
): Promise<EligibilityResult[]> {
  const prompt = `
You are an empathetic, clear eligibility reviewer assisting users to find government entitlements they qualify for.

User Demographics Profile:
- State: ${userProfile.state}
- Age: ${userProfile.age}
- Gender: ${userProfile.gender}
- Caste/Category: ${userProfile.casteCategory}
- Annual Income: ${userProfile.annualIncome} INR
- Occupation: ${userProfile.occupation}
- Disability: ${userProfile.disabilityStatus} (${userProfile.disabilityPercentage}%)
- Interests: ${needsAndInterests}

Below are the candidate schemes and the official guideline text chunks retrieved from the database.
For each scheme, verify if the user truly qualifies based on the demographic and criteria guidelines described in the chunks.
Important: Focus strictly on the demographic and criteria guidelines (like state, age, gender, income, caste, and student status) to determine eligibility. Stated interests are provided for context, but do NOT mark a user as ineligible ('isEligible': false) just because the scheme's scope doesn't align with their search interests. If they satisfy the demographics and status rules, they are eligible.
If the user qualifies, output 'isEligible': true. Detail exactly why they qualify, list the benefits, synthesize a clear step-by-step application instruction checklist, and provide a concise description explaining what the scheme is and its core objectives.
If they do not qualify, output 'isEligible': false, explain which criterion they did not meet, and provide the concise description explaining the scheme. Do not invent or hallucinate restrictions that are not in the provided chunks.

CRITICAL: Translate all output texts (title, description, whyEligible, benefits, stepsToApply) into the user's target language: "${targetLanguage}" (e.g. Hindi, Marathi, Telugu, Spanish). 
If the target language is English or not supported, output in the requested language but use clear and accessible phrasing.

Candidate Schemes:
${schemesData.map(scheme => `
---
Scheme ID: ${scheme.id}
Title: ${scheme.title}
Ministry: ${scheme.ministry || 'N/A'}
Guideline Paragraphs:
${scheme.chunks.map(ch => `- ${ch}`).join('\n')}
---
`).join('\n')}

Format your output as a JSON list matching the schema.
`;

  try {
    const response = await callGeminiWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              schemeId: { type: Type.STRING },
              title: { type: Type.STRING },
              ministry: { type: Type.STRING },
              description: { type: Type.STRING },
              isEligible: { type: Type.BOOLEAN },
              whyEligible: { type: Type.STRING },
              benefits: { type: Type.STRING },
              stepsToApply: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ['schemeId', 'title', 'isEligible', 'whyEligible', 'benefits', 'stepsToApply', 'description']
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as EligibilityResult[];
    }
    throw new Error('Empty response from eligibility synthesizer');
  } catch (error) {
    console.error('Error synthesizing eligibility results:', error);
    throw error;
  }
}
