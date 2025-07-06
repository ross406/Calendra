'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CalendarPlus } from 'lucide-react'
// import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { createPersonalTask, getTasksOnlyFromPrompt } from '@/server/actions/personalTask'
import { toast } from "sonner"

export default function TaskPromptPage() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { userId } = useAuth()
  // const router = useRouter()

//   Timezone: Asia/Kolkata

  const examplePrompt = `Plan my day:
- From 10 AM to 1 PM: work on my project
- 1 PM to 2 PM: lunch
- 2 PM to 4 PM: design personal website
- 4 PM to 5 PM: practice DSA questions
- 5 PM to 6 PM: go for a walk
`

const handleSubmit = async () => {
  setError("")
  setLoading(true)

  try {

    const tasks = await getTasksOnlyFromPrompt({ prompt })

    for (const task of tasks) {
      try {
        await createPersonalTask({ ...task, clerkUserId: String(userId) })

        toast.success(`✅ "${task.title}" scheduled successfully`, {
          duration: 4000,
          className:
            "!rounded-3xl !py-6 !px-5 !justify-center !text-green-500 !font-bold",
        })

        // Optional: wait a bit between toasts if needed
        await new Promise((r) => setTimeout(r, 300))
      } catch (err: any) {
        toast.error(`❌ Failed to schedule "${task.title}"`, {
          description: err.message,
          duration: 5000,
          className:
            "!rounded-3xl !py-6 !px-5 !justify-center !text-red-500 !font-bold",
        })
      }
    }
  } catch (err: any) {
    setError(err.message || "Something went wrong.")
  } finally {
    setLoading(false)
  }
}

  return (
    <section className="flex flex-col items-center gap-10 animate-fade-in px-4 max-w-3xl mx-auto">
      <h1 className="text-4xl xl:text-5xl font-black text-center mt-10">
        Plan My Day
      </h1>
      <p className="text-gray-500 text-center text-md">
        Describe your day in plain English. We'll turn it into tasks in your calendar.
      </p>

      <div className="w-full">
        <label className="text-sm text-gray-500 mb-2 block">Example Prompt</label>
        <pre className="bg-gray-100 p-4 rounded-md text-sm whitespace-pre-wrap border">
          {examplePrompt}
        </pre>
      </div>

      <Textarea
        className="w-full min-h-[180px] text-lg"
        placeholder="Type your plan here..."
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={loading || prompt.trim() === ''}
        className="bg-blue-500 hover:bg-blue-400 text-white py-6 hover:scale-110 duration-300 border-b-4 border-blue-700 hover:border-blue-500 rounded-2xl shadow-lg text-xl font-bold w-full flex justify-center items-center gap-2"
      >
        <CalendarPlus className="size-6" />
        {loading ? 'Scheduling...' : 'Create Tasks'}
      </Button>
    </section>
  )
}
