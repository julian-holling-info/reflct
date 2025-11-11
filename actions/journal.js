"use server";

import { getPixabayImage } from "./public";
import { getMoodById, MOODS } from "@/app/lib/moods";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import aj from "@/lib/arcjet";
import { ArcjetIpDetails, request } from "@arcjet/next";

import { revalidatePath } from "next/cache";
import { includes } from "zod";

export async function createJournalEntry(data) {

    console.log("Data.Mood: " + data.mood);
    
    let prismaUser;

    try {

        const { userId } = await auth();
        if(!userId) throw new Error("Unauthorized");        //  If not logged in, throw an error

        //  Arcjet Rate Limiting (to be applied later)
        const req = await request();
        const decision = await aj.protect(req, {
            userId,
            requested: 1,
        });

        if(decision.isDenied()){
            if(decision.reason.isRateLimit()){
               const { remaining, reset } = decision.reason;
               console.error({
                code: "RATE_LIMIT_EXCEEDD",
                details: {
                    remaining,
                    resetInSeconds: reset,
                },
               });

               throw new Error("Too many requests. Please try again later.");
            }

            throw new Error("Request Blocked.");
        }

        prismaUser = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if(!prismaUser) {
            throw new Error("User not found");
        }

        //  Pull the matching Mood from the collection of moods
        const mood = MOODS[data.mood.toUpperCase()];
        
        if(!mood) throw new Error("Invalid mood");

        const moodImageUrl = await getPixabayImage(data.moodQuery);
        
        const entry = await db.entry.create({
            data: {
                title: data.title,
                content: data.content,
                mood: mood.id,
                moodScore: mood.score,
                moodImageUrl,
                userId: prismaUser.id,
                collectionId: data.collectionId || null,
            }
        })

        //  Clean up any draft data ...
        await db.draft.deleteMany({
            where: {userId: prismaUser.Id}
        });

        //  invlidate any chacned data on the /dashboard path.
        revalidatePath('/dashboard');

        //  return the entry object
        return entry;

    } catch (error) {
        throw new Error(error.message);
    }
}

export async function getJournalEntries({
        collectionId,
        orderBy = "desc", // or "asc"
    } = {}) 

{

    try {
    
        const { userId } = await auth();
        if(!userId) throw new Error("Unauthorized");        //  If not logged in, throw an error

        const prismaUser = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if(!prismaUser) {
            throw new Error("User not found");
        }

        const entries = await db.entry.findMany({
        where: {
            userId: prismaUser.id,
            ...(collectionId === "unorganized"
                 ? { collectionId: null } 
                 : collectionId 
                    ? { collectionId } 
                    : {}),
            },
            include: {
                collection : {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: orderBy,
            },
     
        });

    // Add mood data to each entry
    const entriesWithMoodData = entries.map((entry) => ({
      ...entry,
      moodData: getMoodById(entry.mood),
    }));

    return {
      success: true,
      data: {
        entries: entriesWithMoodData,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getJournalEntry(id) {
 
    try {
    
        const { userId } = await auth();
        if(!userId) throw new Error("Unauthorized");        //  If not logged in, throw an error

        const prismaUser = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if(!prismaUser) {
            throw new Error("User not found");
        }

        const journalEntry = await db.entry.findFirst({
            where: {
                id,
                userId: prismaUser.id,
            },
            include: {
                collection: {
                    select: {
                        id:true,
                        name:true,
                    },
                },
            },
        });

        if(!journalEntry) throw new Error("Entry not found");

        return journalEntry;

    } catch (error) {
        throw new Error(error.message);
    }
}

export async function deleteJournalEntry(id){
    
    try {
        
        const { userId } = await auth();
        if(!userId) throw new Error("Unauthorized");

        const prismaUser = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if(!prismaUser) {
            throw new Error("User not found");
        }

        const entry = await db.entry.findFirst({
            where: {
                id,
                userId: prismaUser.id,
            }
        });

        if(!entry) throw new Error("Journal Entry not found");

        await db.entry.delete({
            where: {
                id
            },
        });

        return true;

    } catch (error) {
        throw new Error(error.message);    
    }
}

export async function updateJournalEntry(data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) throw new Error("User not found");

    // Check if entry exists and belongs to user
    const existingEntry = await db.entry.findFirst({
      where: {
        id: data.id,
        userId: user.id,
      },
    });

    if (!existingEntry) throw new Error("Entry not found");

    // Get mood data
    const mood = MOODS[data.mood.toUpperCase()];
    if (!mood) throw new Error("Invalid mood");

    // Get new mood image if mood changed
    let moodImageUrl = existingEntry.moodImageUrl;
    if (existingEntry.mood !== mood.id) {
      moodImageUrl = await getPixabayImage(data.moodQuery);
    }

    // Update the entry
    const updatedEntry = await db.entry.update({
      where: { id: data.id },
      data: {
        title: data.title,
        content: data.content,
        mood: mood.id,
        moodScore: mood.score,
        moodImageUrl,
        collectionId: data.collectionId || null,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/journal/${data.id}`);
    return updatedEntry;
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getDraft() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const draft = await db.draft.findUnique({
      where: { userId: user.id },
    });

    return { success: true, data: draft };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function saveDraft(data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const draft = await db.draft.upsert({
      where: { userId: user.id },
      create: {
        title: data.title,
        content: data.content,
        mood: data.mood,
        userId: user.id,
      },
      update: {
        title: data.title,
        content: data.content,
        mood: data.mood,
      },
    });

    revalidatePath("/dashboard");
    return { success: true, data: draft };
  } catch (error) {
    return { success: false, error: error.message };
  }
}