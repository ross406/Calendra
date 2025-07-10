// src/server/actions/tasks.ts
"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { createCalendarEvent } from "../google/googleCalendar";
import { OpenAI } from "openai";
import { extractJsonBlock } from "@/lib/formatters";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/drizzle/db";
import { TaskTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
// import { enhanceTaskToImagePrompt } from "@/lib/utils";

export type PersonalTask = {
  clerkUserId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  timezone: string;
  title: string; // Task title
  description?: string;
};

export async function saveTaskToDb(task: {
  clerkUserId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  eventId: string;
  base64Image: string;
}) {
   const [insertedTask] = await db.insert(TaskTable).values({
    clerkUserId: task.clerkUserId,
    title: task.title,
    description: task.description || "",
    startTime: new Date(task.startTime),
    endTime: new Date(task.endTime),
    calendarEventId: task.eventId,  // ✅ correct field name
    base64Image: task.base64Image,
    completed: false,        
  }).returning();

  return insertedTask;

}

export async function getTasksForUser(clerkUserId: string) {
  return await db
    .select()
    .from(TaskTable)
    .where(eq(TaskTable.clerkUserId, clerkUserId));
}

export async function updateTaskCompletion({
  id,
  completed,
}: {
  id: string;
  completed: boolean;
}) {
  await db
    .update(TaskTable)
    .set({ completed })
    .where(eq(TaskTable.id, id));

  return { success: true };

}

export async function deleteTaskByEventId(eventId: string) {
  await db
    .delete(TaskTable)
    .where(eq(TaskTable.calendarEventId, eventId));
  
  return { success: true };
}

export async function createPersonalTask(task: PersonalTask) {
  try {
    // Fetch user data from Clerk
    const client = await clerkClient();
    const user = await client.users.getUser(task.clerkUserId);
    const primaryEmail = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    );

    if (!primaryEmail) {
      throw new Error("Clerk user has no primary email");
    }

    const fullName = `${user.firstName} ${user.lastName}`;

    const calendarEvent = await createCalendarEvent({
      clerkUserId: task.clerkUserId,
      startTime: new Date(task.startTime),
      durationInMinutes:
        (new Date(task.endTime).getTime() -
          new Date(task.startTime).getTime()) /
        1000 /
        60,
      //   timezone: task.timezone,
      eventName: task.title,
      guestName: fullName, // ✅ Use real name
      guestEmail: primaryEmail.emailAddress, // ✅ Use real email
      guestNotes: task.description || "",
    });

    return { success: true,  eventId: calendarEvent.id, };
  } catch (err: any) {
    console.error("Failed to create task:", err.message);
    throw new Error("Failed to create task");
  }
}

function getSystemPrompt(today: string, timezone: string): string {
  return `
You are a helpful assistant. Based on the user's schedule for today (${today}), extract each time block and return them as an array of task objects with these fields:
- title: A short title
- description: A short description about the task or title only in different words
- startTime: ISO string (e.g., "${today}T10:00:00+05:30")
- endTime: ISO string
- timezone: "${timezone}"

Respond ONLY with a JSON array. No extra text or formatting.

Example:
[
  {
    "title": "Work on my project",
    "description": "Focus on backend tasks",
    "startTime": "${today}T10:00:00+05:30",
    "endTime": "${today}T13:00:00+05:30",
    "timezone": "${timezone}"
  }
]
`.trim()
}

export async function getTasksFromChatGPT(systemPrompt: string, userPrompt: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo-1106',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })
  const rawText = response.choices[0].message.content || ''
  return JSON.parse(extractJsonBlock(rawText))
}

export async function getTasksFromGemini(systemPrompt: string, userPrompt: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
      },
    ],
  })
  const rawText = String(response.text)
  return JSON.parse(extractJsonBlock(rawText))
}

export async function getTasksFromOllama(systemPrompt: string, userPrompt: string) {
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
    }),
  })
  const { message } = await response.json()
  return JSON.parse(extractJsonBlock(message.content))
}



// Set your LLM provider: 'CHAT_GPT' | 'GEMINI' | 'OLLAMA'
type LLMProvider = 'CHAT_GPT' | 'GEMINI' | 'OLLAMA'

const LLM_PROVIDER: LLMProvider = 'OLLAMA'

export async function createTasksFromPrompt({
  userId,
  prompt,
}: {
  userId: string
  prompt: string
}) {
  const today = new Date().toISOString().split('T')[0]
  const timezone = 'Asia/Kolkata'

  const formattedPrompt = prompt.trim().endsWith('.')
    ? prompt
    : `${prompt}.`

  const updatedPrompt = `${formattedPrompt} Please assume all tasks are for today (${today}).`

  const systemPrompt = getSystemPrompt(today, timezone)

  let tasks = []

  switch (LLM_PROVIDER) {
    case 'CHAT_GPT':
      tasks = await getTasksFromChatGPT(systemPrompt, updatedPrompt)
      break
    case 'GEMINI':
      tasks = await getTasksFromGemini(systemPrompt, updatedPrompt)
      break
    case 'OLLAMA':
      tasks = await getTasksFromOllama(systemPrompt, updatedPrompt)
      break
    default:
      throw new Error(`Unsupported LLM provider: ${LLM_PROVIDER}`)
  }

  console.log(`${LLM_PROVIDER} TASKS`, tasks)

  const results: { title: string; success: boolean; error?: string }[] = []

for (const task of tasks) {
    try {
      await createPersonalTask({ ...task, clerkUserId: userId })
      results.push({ title: task.title, success: true })
    } catch (err: any) {
      results.push({ title: task.title, success: false, error: err.message })
    }
  }

  return results

}


// export async function getTasksOnlyFromPrompt({
//   prompt,
// }: {
//   prompt: string
// }): Promise<PersonalTask[]> {
//   const today = new Date().toISOString().split("T")[0]
//   const timezone = "Asia/Kolkata"
//   const systemPrompt = getSystemPrompt(today, timezone)
//   const updatedPrompt = `${prompt.trim()} Please assume all tasks are for today (${today}).`

//   switch (LLM_PROVIDER) {
//     case "CHAT_GPT":
//       return await getTasksFromChatGPT(systemPrompt, updatedPrompt)
//     case "GEMINI":
//       return await getTasksFromGemini(systemPrompt, updatedPrompt)
//     case "OLLAMA":
//       return await getTasksFromOllama(systemPrompt, updatedPrompt)
//     default:
//       throw new Error("Unsupported LLM provider")
//   }
// }

// export async function getTasksOnlyFromPrompt({
//   prompt,
// }: {
//   prompt: string;
// }): Promise<(PersonalTask & { base64Image: string })[]> {
//   const today = new Date().toISOString().split("T")[0];
//   const timezone = "Asia/Kolkata";
//   const systemPrompt = getSystemPrompt(today, timezone);
//   const updatedPrompt = `${prompt.trim()} Please assume all tasks are for today (${today}).`;

//   let tasks: PersonalTask[];

//   switch (LLM_PROVIDER) {
//     case "CHAT_GPT":
//       tasks = await getTasksFromChatGPT(systemPrompt, updatedPrompt);
//       break;
//     case "GEMINI":
//       tasks = await getTasksFromGemini(systemPrompt, updatedPrompt);
//       break;
//     case "OLLAMA":
//       tasks = await getTasksFromOllama(systemPrompt, updatedPrompt);
//       break;
//     default:
//       throw new Error("Unsupported LLM provider");
//   }

//   // For each task, generate image
//   const tasksWithImages = await Promise.all(
//     tasks.map(async (task) => {
//       const imagePrompt = enhanceTaskToImagePrompt(task);
//       const base64Image = await generateImageFromPrompt(imagePrompt);
//       return { ...task, base64Image };
//     })
//   );

//   return tasksWithImages;
// }

export async function getTasksFromPromptOnly({
  prompt,
}: {
  prompt: string;
}): Promise<PersonalTask[]> {
  const today = new Date().toISOString().split("T")[0];
  const timezone = "Asia/Kolkata";
  const systemPrompt = getSystemPrompt(today, timezone);
  const updatedPrompt = `${prompt.trim()} Please assume all tasks are for today (${today}).`;

  switch (LLM_PROVIDER) {
    case "CHAT_GPT":
      return await getTasksFromChatGPT(systemPrompt, updatedPrompt);
    case "GEMINI":
      return await getTasksFromGemini(systemPrompt, updatedPrompt);
    case "OLLAMA":
      return await getTasksFromOllama(systemPrompt, updatedPrompt);
    default:
      throw new Error("Unsupported LLM provider");
  }
}



export async function generateImageFromPrompt(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 150000); // ⏱ 15 seconds
  const payload = {
    prompt,
    negative_prompt:
      "blurry, lowres, deformed, noisy, distorted, ugly, low quality, jpeg artifacts, extra limbs, bad perspective, poorly drawn",
    steps:20,
    cfg_scale: 7,
    // width: 100,
    // height: 100,
    width: 512,
    height: 512,
    // sampler_index: "DPM++ 2M",
    sampler_index: "DPM++ 2M",
    seed: -1,
    enable_hr: false,
    // enable_hr: false,
    // denoising_strength: 0.5,
    // hr_scale: 2,
    // hr_upscaler: "R-ESRGAN 4x+",
    // hr_second_pass_steps: 20,
    // hr_resize_x: 1024,
    // hr_resize_y: 1024,
  };

    try {

  const response = await fetch("http://127.0.0.1:7860/sdapi/v1/txt2img", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation failed: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.images[0]; // base64 string
} catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Image generation timed out");
    }
    throw err;
  }
}


