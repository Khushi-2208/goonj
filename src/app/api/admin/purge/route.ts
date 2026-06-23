import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { LocalVectorStore } from '@/lib/vectorStore';
import { checkIsAdmin } from '@/lib/adminAuth';

/**
 * GET /api/admin/purge
 * Periodically cleans up the databases by removing expired schemes and their vectors.
 * Can be scheduled as a daily/weekly cron job.
 */
export async function GET() {
  try {
    if (!await checkIsAdmin()) {
      return NextResponse.json({ success: false, error: 'Access denied. Admin role required.' }, { status: 403 });
    }
    const currentDate = new Date();
    
    // Step 1: Find all schemes where the expiry date has passed
    const expiredSchemes = await prisma.scheme.findMany({
      where: {
        expiryDate: {
          lt: currentDate,
        },
      },
      select: {
        id: true,
        title: true,
        expiryDate: true,
      },
    });
    
    if (expiredSchemes.length === 0) {
      return NextResponse.json({
        success: true,
        purgedCount: 0,
        message: 'No expired schemes found. Database is up to date!',
      });
    }
    
    const purgedTitles: string[] = [];
    
    // Step 2: Delete each expired scheme from vectors and SQLite
    for (const scheme of expiredSchemes) {
      console.log(`Purging expired scheme: "${scheme.title}" (Expired: ${scheme.expiryDate})`);
      
      // Delete vector chunks
      await LocalVectorStore.deleteBySchemeId(scheme.id);
      
      // Delete database entry
      await prisma.scheme.delete({
        where: { id: scheme.id },
      });
      
      purgedTitles.push(scheme.title);
    }
    
    return NextResponse.json({
      success: true,
      purgedCount: expiredSchemes.length,
      purgedSchemes: purgedTitles,
      message: `Successfully purged ${expiredSchemes.length} expired schemes from the catalog.`,
    });
    
  } catch (error) {
    console.error('Error during database purge:', error);
    const message = error instanceof Error ? error.message : 'Failed to clean up expired schemes.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/purge
 * Allow admins to trigger the purge manually using a button on the admin panel.
 */
export async function POST() {
  return GET();
}
