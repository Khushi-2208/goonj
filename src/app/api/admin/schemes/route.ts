import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { LocalVectorStore } from '@/lib/vectorStore';
import { extractTextFromPdf, extractTextFromUrl, chunkText } from '@/lib/parser';
import { getEmbedding } from '@/lib/gemini';
import { checkIsAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/schemes
 * Returns a list of all schemes registered in the SQLite database.
 */
export async function GET() {
  try {
    if (!await checkIsAdmin()) {
      return NextResponse.json({ success: false, error: 'Access denied. Admin role required.' }, { status: 403 });
    }
    const schemes = await prisma.scheme.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, schemes });
  } catch (error) {
    console.error('Error fetching schemes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve schemes list.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/schemes
 * Ingests a new scheme. Supports metadata fields, PDF uploads, or web URLs.
 */
export async function POST(request: NextRequest) {
  try {
    if (!await checkIsAdmin()) {
      return NextResponse.json({ success: false, error: 'Access denied. Admin role required.' }, { status: 403 });
    }
    const formData = await request.formData();
    
    // Extract metadata fields
    const title = formData.get('title') as string;
    const ministry = formData.get('ministry') as string | null;
    const state = formData.get('state') as string;
    const minAgeStr = formData.get('minAge') as string | null;
    const maxAgeStr = formData.get('maxAge') as string | null;
    const genderRestriction = (formData.get('genderRestriction') as string) || 'All';
    const incomeCeilingStr = formData.get('incomeCeiling') as string | null;
    const occupations = (formData.get('occupations') as string) || '';
    const casteCategories = (formData.get('casteCategories') as string) || '';
    const expiryDateStr = formData.get('expiryDate') as string | null;
    const applicationSteps = (formData.get('applicationSteps') as string) || 'Synthesized on the fly';
    const applyUrl = formData.get('applyUrl') as string | null;
    
    // Document source options
    const linkUrl = formData.get('linkUrl') as string | null;
    const pdfFile = formData.get('file') as File | null;
    
    if (!title || !state) {
      return NextResponse.json(
        { success: false, error: 'Title and State are required fields.' },
        { status: 400 }
      );
    }
    
    // Parse numeric/date options
    const minAge = minAgeStr ? parseInt(minAgeStr, 10) : null;
    const maxAge = maxAgeStr ? parseInt(maxAgeStr, 10) : null;
    const incomeCeiling = incomeCeilingStr ? parseFloat(incomeCeilingStr) : null;
    const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;
    
    // Step 1: Extract raw text content from the provided source
    let rawText = '';
    let documentUrl = '';
    
    if (pdfFile && pdfFile.name !== 'undefined' && pdfFile.size > 0) {
      console.log(`Extracting text from uploaded PDF: ${pdfFile.name}`);
      const arrayBuffer = await pdfFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      rawText = await extractTextFromPdf(buffer);
      documentUrl = `Uploaded PDF: ${pdfFile.name}`;
    } else if (linkUrl && linkUrl.trim() !== '') {
      console.log(`Extracting text from website link: ${linkUrl}`);
      rawText = await extractTextFromUrl(linkUrl.trim());
      documentUrl = linkUrl.trim();
    } else {
      return NextResponse.json(
        { success: false, error: 'Please supply either a guideline PDF file or a webpage link URL.' },
        { status: 400 }
      );
    }
    
    if (!rawText || rawText.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Could not extract any text content from the supplied source.' },
        { status: 400 }
      );
    }
    
    // Step 2: Create the SQLite database scheme record
    const scheme = await prisma.scheme.create({
      data: {
        title,
        ministry,
        state,
        minAge,
        maxAge,
        genderRestriction,
        incomeCeiling,
        occupations,
        casteCategories,
        expiryDate,
        applicationSteps,
        documentUrl,
        applyUrl: applyUrl ? applyUrl.trim() : null,
      },
    });
    
    // Step 3: Segment text and generate embeddings
    console.log('Chunking extracted guideline text...');
    const chunks = chunkText(rawText);
    console.log(`Generated ${chunks.length} chunks. Creating embeddings...`);
    
    const vectorChunks = [];
    for (const chunk of chunks) {
      // Generate embedding vector via Gemini
      const embedding = await getEmbedding(chunk);
      vectorChunks.push({
        schemeId: scheme.id,
        text: chunk,
        embedding,
      });
    }
    
    // Step 4: Write vectors to the local database file
    console.log('Writing embeddings to LocalVectorStore...');
    await LocalVectorStore.addChunks(vectorChunks);
    
    return NextResponse.json({
      success: true,
      schemeId: scheme.id,
      chunksProcessed: chunks.length,
      message: 'Scheme successfully ingested and vectorized!',
    });
    
  } catch (error) {
    console.error('Error in scheme ingestion route:', error);
    const message = error instanceof Error ? error.message : 'Failed to ingest scheme.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/schemes
 * Edits an existing scheme's metadata and optionally re-ingests documents.
 */
export async function PUT(request: NextRequest) {
  try {
    if (!await checkIsAdmin()) {
      return NextResponse.json({ success: false, error: 'Access denied. Admin role required.' }, { status: 403 });
    }
    const formData = await request.formData();
    const id = formData.get('id') as string;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Scheme ID is required' }, { status: 400 });
    }

    const existingScheme = await prisma.scheme.findUnique({ where: { id } });
    if (!existingScheme) {
      return NextResponse.json({ success: false, error: 'Scheme not found.' }, { status: 404 });
    }

    // Extract metadata fields
    const title = formData.get('title') as string | null;
    const ministry = formData.get('ministry') as string | null;
    const state = formData.get('state') as string | null;
    const minAgeStr = formData.get('minAge') as string | null;
    const maxAgeStr = formData.get('maxAge') as string | null;
    const genderRestriction = formData.get('genderRestriction') as string | null;
    const incomeCeilingStr = formData.get('incomeCeiling') as string | null;
    const occupations = formData.get('occupations') as string | null;
    const casteCategories = formData.get('casteCategories') as string | null;
    const expiryDateStr = formData.get('expiryDate') as string | null;
    const isActiveStr = formData.get('isActive') as string | null;
    const applyUrl = formData.get('applyUrl') as string | null;

    // Ingestion source options
    const linkUrl = formData.get('linkUrl') as string | null;
    const pdfFile = formData.get('file') as File | null;

    const dataToUpdate: Record<string, string | number | boolean | Date | null> = {};
    if (title !== null) dataToUpdate.title = title;
    if (ministry !== null) dataToUpdate.ministry = ministry;
    if (state !== null) dataToUpdate.state = state;
    if (minAgeStr !== null) dataToUpdate.minAge = minAgeStr ? parseInt(minAgeStr, 10) : null;
    if (maxAgeStr !== null) dataToUpdate.maxAge = maxAgeStr ? parseInt(maxAgeStr, 10) : null;
    if (genderRestriction !== null) dataToUpdate.genderRestriction = genderRestriction;
    if (incomeCeilingStr !== null) dataToUpdate.incomeCeiling = incomeCeilingStr ? parseFloat(incomeCeilingStr) : null;
    if (occupations !== null) dataToUpdate.occupations = occupations;
    if (casteCategories !== null) dataToUpdate.casteCategories = casteCategories;
    if (expiryDateStr !== null) dataToUpdate.expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;
    if (isActiveStr !== null) dataToUpdate.isActive = isActiveStr === 'true';
    if (applyUrl !== null) dataToUpdate.applyUrl = applyUrl ? applyUrl.trim() : null;

    // Update the database record
    const scheme = await prisma.scheme.update({
      where: { id },
      data: dataToUpdate,
    });

    let chunksProcessed = 0;

    // Check if new guideline document is provided for re-vectorization
    const hasNewPdf = pdfFile && pdfFile.name !== 'undefined' && pdfFile.size > 0;
    const hasNewUrl = linkUrl && linkUrl.trim() !== '';

    if (hasNewPdf || hasNewUrl) {
      let rawText = '';
      let documentUrl = '';

      if (hasNewPdf && pdfFile) {
        console.log(`Re-extracting text from updated PDF: ${pdfFile.name}`);
        const arrayBuffer = await pdfFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        rawText = await extractTextFromPdf(buffer);
        documentUrl = `Uploaded PDF: ${pdfFile.name}`;
      } else if (hasNewUrl && linkUrl) {
        console.log(`Re-extracting text from updated website link: ${linkUrl}`);
        rawText = await extractTextFromUrl(linkUrl.trim());
        documentUrl = linkUrl.trim();
      }

      if (rawText && rawText.trim() !== '') {
        // Save new document Url
        await prisma.scheme.update({
          where: { id },
          data: { documentUrl },
        });

        // Delete old vector chunks
        console.log(`Deleting old vectors for scheme: ${id}`);
        await LocalVectorStore.deleteBySchemeId(id);

        // Segment new text and generate embeddings
        console.log('Chunking updated guideline text...');
        const chunks = chunkText(rawText);
        console.log(`Generated ${chunks.length} chunks. Creating embeddings...`);

        const vectorChunks = [];
        for (const chunk of chunks) {
          const embedding = await getEmbedding(chunk);
          vectorChunks.push({
            schemeId: id,
            text: chunk,
            embedding,
          });
        }

        console.log('Writing updated embeddings to LocalVectorStore...');
        await LocalVectorStore.addChunks(vectorChunks);
        chunksProcessed = chunks.length;
      }
    }

    return NextResponse.json({
      success: true,
      scheme,
      chunksProcessed,
      message: 'Scheme successfully updated!',
    });

  } catch (error) {
    console.error('Error in scheme update route:', error);
    const message = error instanceof Error ? error.message : 'Failed to update scheme.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/schemes
 * Purges a scheme from the SQLite catalog and deletes all its associated vector embeddings.
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!await checkIsAdmin()) {
      return NextResponse.json({ success: false, error: 'Access denied. Admin role required.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Scheme ID is required in the query parameters.' },
        { status: 400 }
      );
    }
    
    // 1. Delete vectors from vector file
    await LocalVectorStore.deleteBySchemeId(id);
    
    // 2. Delete scheme row from SQLite
    await prisma.scheme.delete({
      where: { id },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Scheme and its vector index deleted successfully!',
    });
  } catch (error) {
    console.error('Error in scheme deletion route:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete scheme.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
