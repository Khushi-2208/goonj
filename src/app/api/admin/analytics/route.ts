import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkIsAdmin } from '@/lib/adminAuth';

export async function GET() {
  try {
    if (!await checkIsAdmin()) {
      return NextResponse.json({ success: false, error: 'Access denied. Admin role required.' }, { status: 403 });
    }
    const totalUsers = await prisma.user.count();
    const totalSearches = await prisma.searchHistory.count();

    // Group searches by language
    const languageGroups = await prisma.searchHistory.groupBy({
      by: ['detectedLanguage'],
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          detectedLanguage: 'desc'
        }
      },
      take: 5
    });

    // Group searches by state
    const stateGroups = await prisma.searchHistory.groupBy({
      by: ['state'],
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          state: 'desc'
        }
      },
      take: 5
    });

    // Fetch schemes with their bookmark counts and feedback counts
    const schemes = await prisma.scheme.findMany({
      include: {
        _count: {
          select: {
            savedSchemes: true,
            feedbacks: true
          }
        }
      }
    });

    // Sort schemes by saved count to get "most searched/saved schemes"
    const mostSavedSchemes = [...schemes]
      .sort((a, b) => b._count.savedSchemes - a._count.savedSchemes)
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        title: s.title,
        savedCount: s._count.savedSchemes,
        feedbackCount: s._count.feedbacks
      }));

    // Helpfulness overall
    const feedbackTotal = await prisma.feedback.count();
    const feedbackHelpful = await prisma.feedback.count({
      where: { helpful: true }
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalSearches,
        languages: languageGroups.map(lg => ({ name: lg.detectedLanguage, count: lg._count._all })),
        states: stateGroups.map(sg => ({ name: sg.state || 'Unknown', count: sg._count._all })),
        mostSavedSchemes,
        feedback: {
          total: feedbackTotal,
          helpful: feedbackHelpful,
          percent: feedbackTotal > 0 ? Math.round((feedbackHelpful / feedbackTotal) * 100) : 100
        }
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve analytics';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

