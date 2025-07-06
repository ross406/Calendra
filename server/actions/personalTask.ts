// src/server/actions/tasks.ts
"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { createCalendarEvent } from "../google/googleCalendar";
import { OpenAI } from "openai";
import { extractJsonBlock } from "@/lib/formatters";
import { GoogleGenAI } from "@google/genai";

export type PersonalTask = {
  clerkUserId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  timezone: string;
  title: string; // Task title
  description?: string;
};

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

    await createCalendarEvent({
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

    return { success: true };
  } catch (err: any) {
    console.error("Failed to create task:", err.message);
    throw new Error("Failed to create task");
  }
}

function getSystemPrompt(today: string, timezone: string): string {
  return `
You are a helpful assistant. Based on the user's schedule for today (${today}), extract each time block and return them as an array of task objects with these fields:
- title: A short title
- description: A short description
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

const LLM_PROVIDER: LLMProvider = 'GEMINI'

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


export async function getTasksOnlyFromPrompt({
  userId,
  prompt,
}: {
  userId: string
  prompt: string
}): Promise<PersonalTask[]> {
  const today = new Date().toISOString().split("T")[0]
  const timezone = "Asia/Kolkata"
  const systemPrompt = getSystemPrompt(today, timezone)
  const updatedPrompt = `${prompt.trim()} Please assume all tasks are for today (${today}).`

  switch (LLM_PROVIDER) {
    case "CHAT_GPT":
      return await getTasksFromChatGPT(systemPrompt, updatedPrompt)
    case "GEMINI":
      return await getTasksFromGemini(systemPrompt, updatedPrompt)
    case "OLLAMA":
      return await getTasksFromOllama(systemPrompt, updatedPrompt)
    default:
      throw new Error("Unsupported LLM provider")
  }
}



