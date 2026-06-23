import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function getOrCreateDbUser() {
  try {
    const { userId } = await auth();
    if (!userId) return null;

    // 1. Try to find the user by Clerk ID
    let dbUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            savedSchemes: true,
            searchHistories: true,
          }
        }
      }
    });

    if (dbUser) return dbUser;

    // 2. If not found, fetch from Clerk API
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const firstName = clerkUser.firstName || '';
    const lastName = clerkUser.lastName || '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || clerkUser.username || 'Citizen';
    
    // Find a phone number or make one up from Clerk ID (to satisfy unique constraint)
    const phone = clerkUser.phoneNumbers?.[0]?.phoneNumber || `clerk_${userId}`;

    // 3. Check if there is an existing user in Prisma with the exact same phone number.
    const existingByPhone = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingByPhone && existingByPhone.id !== userId) {
      // Merge history and saved schemes from the old account (existingByPhone.id) to the new Clerk userId
      try {
        await prisma.$transaction([
          // Create the new user with Clerk userId
          prisma.user.create({
            data: {
              id: userId,
              name,
              phone,
            },
          }),
          // Re-link saved schemes
          prisma.savedScheme.updateMany({
            where: { userId: existingByPhone.id },
            data: { userId },
          }),
          // Re-link search histories
          prisma.searchHistory.updateMany({
            where: { userId: existingByPhone.id },
            data: { userId },
          }),
          // Re-link downloaded reports
          prisma.downloadedReport.updateMany({
            where: { userId: existingByPhone.id },
            data: { userId },
          }),
          // Delete the old user to clean up
          prisma.user.delete({
            where: { id: existingByPhone.id },
          }),
        ]);

        dbUser = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            _count: {
              select: {
                savedSchemes: true,
                searchHistories: true,
              }
            }
          }
        });
      } catch (err) {
        console.error('Failed transaction during user phone migration:', err);
        // Fallback: create with modified phone if the transaction fails
        dbUser = await prisma.user.create({
          data: {
            id: userId,
            name,
            phone: `${phone}_${userId}`,
          },
          include: {
            _count: {
              select: {
                savedSchemes: true,
                searchHistories: true,
              }
            }
          }
        });
      }
    } else {
      // No existing user found by phone. Simply create the new user.
      dbUser = await prisma.user.create({
        data: {
          id: userId,
          name,
          phone,
        },
        include: {
          _count: {
            select: {
              savedSchemes: true,
              searchHistories: true,
            }
          }
        }
      });
    }

    return dbUser;
  } catch (error) {
    console.error('getOrCreateDbUser error:', error);
    return null;
  }
}
