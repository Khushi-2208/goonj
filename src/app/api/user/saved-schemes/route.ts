import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOrCreateDbUser } from '@/lib/auth';

export async function GET() {
  try {
    const dbUser = await getOrCreateDbUser();
    const userId = dbUser?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please login first.' }, { status: 401 });
    }

    const saved = await prisma.savedScheme.findMany({
      where: { userId },
      include: {
        scheme: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ success: true, schemes: saved.map(s => s.scheme) });
  } catch (error) {
    console.error('Fetch saved schemes error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch saved schemes';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const dbUser = await getOrCreateDbUser();
    const userId = dbUser?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { schemeId } = await request.json();
    if (!schemeId) {
      return NextResponse.json({ success: false, error: 'Scheme ID is required' }, { status: 400 });
    }

    const bookmark = await prisma.savedScheme.upsert({
      where: {
        userId_schemeId: {
          userId,
          schemeId
        }
      },
      create: {
        userId,
        schemeId
      },
      update: {}
    });

    return NextResponse.json({ success: true, bookmark });
  } catch (error) {
    console.error('Bookmark error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save scheme bookmark';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const dbUser = await getOrCreateDbUser();
    const userId = dbUser?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schemeId = searchParams.get('schemeId');

    if (!schemeId) {
      return NextResponse.json({ success: false, error: 'Scheme ID is required' }, { status: 400 });
    }

    await prisma.savedScheme.delete({
      where: {
        userId_schemeId: {
          userId,
          schemeId
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unbookmark error:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove bookmark';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
