import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { LocalVectorStore } from '@/lib/vectorStore';
import { parseProfileFromAnswers, getEmbedding, synthesizeEligibility } from '@/lib/gemini';

/**
 * POST /api/match
 * Receives the 8 voice question answers, parses the profile, finds eligible schemes,
 * and synthesizes translated benefits and application instructions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { answers } = body;
    
    if (!answers || !Array.isArray(answers) || answers.length !== 8) {
      return NextResponse.json(
        { success: false, error: 'Expected an array of exactly 8 answers matching the interview flow.' },
        { status: 400 }
      );
    }
    
    console.log('Parsing user answers using Gemini LLM...');
    // Step 1: Parse answers into standardized demographic filters + query
    const parsedData = await parseProfileFromAnswers(answers);
    const { profile, needsAndInterests, detectedLanguage } = parsedData;
    console.log('Parsed User Profile:', JSON.stringify(profile, null, 2));
    console.log('Detected Language:', detectedLanguage);
    console.log('Needs & Interests Query:', needsAndInterests);
    
    // Step 2: Query SQLite with strict demographic filters (Metadata filtering)
    console.log('Executing demographic filters on SQLite...');
    const candidateSchemes = await prisma.scheme.findMany({
      where: {
        isActive: true,
        // State constraint: Must match the user's state OR be a "Central" scheme
        state: {
          in: [profile.state, 'Central', 'central'],
        },
        // Age constraints (if specified)
        OR: [
          { minAge: null },
          { minAge: { lte: profile.age } }
        ],
        AND: [
          {
            OR: [
              { maxAge: null },
              { maxAge: { gte: profile.age } }
            ]
          },
          // Gender constraints
          {
            genderRestriction: {
              in: [profile.gender, 'All', 'all'],
            }
          },
          // Income constraints
          {
            OR: [
              { incomeCeiling: null },
              { incomeCeiling: { gte: profile.annualIncome } }
            ]
          }
        ]
      }
    });
    
    console.log(`Demographic filter passed for ${candidateSchemes.length} schemes.`);
    
    if (candidateSchemes.length === 0) {
      return NextResponse.json({
        success: true,
        profile,
        detectedLanguage,
        schemes: [],
        message: 'No schemes matched your demographic criteria.'
      });
    }
    
    // Filter by caste and occupation if they are stored as arrays in SQLite
    // Since SQLite stores occupations and casteCategories as comma-separated strings,
    // we filter them programmatically in JavaScript.
    const userOccupation = profile.occupation.toLowerCase().trim();
    const userCaste = profile.casteCategory.toLowerCase().trim();
    
    const fullyMatchingSchemes = candidateSchemes.filter(scheme => {
      // 1. Occupation Check
      if (scheme.occupations && scheme.occupations.trim() !== '') {
        const allowedOccupations = scheme.occupations.toLowerCase().split(',').map(o => o.trim());
        const hasMatchingJob = allowedOccupations.includes(userOccupation) || 
                               allowedOccupations.includes('all') || 
                               allowedOccupations.length === 0;
        if (!hasMatchingJob) return false;
      }
      
      // 2. Caste Check
      if (scheme.casteCategories && scheme.casteCategories.trim() !== '') {
        const allowedCastes = scheme.casteCategories.toLowerCase().split(',').map(c => c.trim());
        const hasMatchingCaste = allowedCastes.includes(userCaste) || 
                                 allowedCastes.includes('all') || 
                                 allowedCastes.length === 0;
        if (!hasMatchingCaste) return false;
      }
      
      return true;
    });
    
    console.log(`Demographic & category checks combined passed for ${fullyMatchingSchemes.length} schemes.`);
    
    if (fullyMatchingSchemes.length === 0) {
      return NextResponse.json({
        success: true,
        profile,
        detectedLanguage,
        schemes: [],
        message: 'No schemes matched your specific occupation or caste category.'
      });
    }
    
    const candidateIds = fullyMatchingSchemes.map(s => s.id);
    
    // Step 3: Run semantic search to rank surviving schemes
    console.log('Generating embedding for user query...');
    const queryVector = await getEmbedding(needsAndInterests);
    
    console.log('Searching local vector DB with metadata filters...');
    const searchResults = await LocalVectorStore.search(queryVector, candidateIds, 15);
    
    // Step 4: Group retrieved chunks by Scheme ID
    const chunksByScheme = new Map<string, string[]>();
    for (const match of searchResults) {
      const chunks = chunksByScheme.get(match.schemeId) || [];
      // Keep up to 3 most relevant paragraphs per scheme to stay within token limits
      if (chunks.length < 3) {
        chunks.push(match.text);
      }
      chunksByScheme.set(match.schemeId, chunks);
    }
    
    // Assemble candidate schemes data with their relevant chunks for the LLM
    const schemesDataForSynthesis = fullyMatchingSchemes
      .map(scheme => ({
        id: scheme.id,
        title: scheme.title,
        ministry: scheme.ministry,
        chunks: chunksByScheme.get(scheme.id) || [scheme.applicationSteps], // fallback to default description
      }))
      // prioritize schemes that actually had search chunks returned
      .sort((a, b) => {
        const hasA = chunksByScheme.has(a.id) ? 1 : 0;
        const hasB = chunksByScheme.has(b.id) ? 1 : 0;
        return hasB - hasA;
      });
      
    // Step 5: Synthesize and translate final details using Gemini LLM
    console.log(`Synthesizing eligibility for ${schemesDataForSynthesis.length} candidate schemes in language: ${detectedLanguage}...`);
    
    // We only process top 5 schemes to prevent prompt overflow and reduce latency
    const schemesToEvaluate = schemesDataForSynthesis.slice(0, 5);
    
    const eligibilityResults = await synthesizeEligibility(
      profile,
      needsAndInterests,
      schemesToEvaluate,
      detectedLanguage
    );
    
    // Filter results to only return qualifying schemes to the user
    const evaluatedResults = eligibilityResults.filter(r => r.isEligible);
    const qualifyingSchemes = evaluatedResults.map(qs => {
      const dbScheme = fullyMatchingSchemes.find(s => s.id === qs.schemeId);
      return {
        ...qs,
        documentUrl: dbScheme?.documentUrl || null,
        applyUrl: dbScheme?.applyUrl || null
      };
    });
    
    return NextResponse.json({
      success: true,
      profile,
      detectedLanguage,
      schemes: qualifyingSchemes,
      totalEvaluated: schemesToEvaluate.length,
    });
    
  } catch (error) {
    console.error('Error in eligibility matching route:', error);
    const message = error instanceof Error ? error.message : 'Failed to analyze eligibility.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
