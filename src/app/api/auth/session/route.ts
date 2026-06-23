import { NextResponse } from 'next/server';
import { getOrCreateDbUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getOrCreateDbUser();
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Session error:', error);
    const message = error instanceof Error ? error.message : 'Session load failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
