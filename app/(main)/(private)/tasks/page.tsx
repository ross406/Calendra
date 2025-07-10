"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CalendarPlus, Clock } from "lucide-react";
// import { useRouter } from 'next/navigation'
import { useAuth } from "@clerk/nextjs";
import {
  createPersonalTask,
  deleteTaskByEventId,
  generateImageFromPrompt,
  getTasksForUser,
  getTasksFromPromptOnly,
  saveTaskToDb,
  updateTaskCompletion,
} from "@/server/actions/personalTask";
import { toast } from "sonner";
import { enhanceTaskToImagePrompt } from "@/lib/utils";
import { deleteCalendarEvent } from "@/server/google/googleCalendar";
import { BlinkBlur, ThreeDot } from "react-loading-indicators";
import ShimmerCard from "./ShimmerCard";
import { BASE64 } from "./image";

type TaskWithImage = {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  eventId: string;
  base64Image: string;
  completed?: boolean;
};

const SAMPLE_BASE64 = BASE64;

export default function TaskPromptPage() {
  const [prompt, setPrompt] = useState("");
  const [myTasks, setMyTasks] = useState<TaskWithImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const { userId } = useAuth();
  // const router = useRouter()

  useEffect(() => {
    const loadTasks = async () => {
      if (!userId) return;
      const tasksFromDb = await getTasksForUser(userId);

      const mappedTasks: TaskWithImage[] = tasksFromDb.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description ?? "",
        startTime: task.startTime.toISOString(),
        endTime: task.endTime.toISOString(),
        base64Image: task.base64Image,
        completed: task.completed,
        eventId: task.calendarEventId || "", // ensure it's not undefined
      }));

      setMyTasks(mappedTasks);
    };
    loadTasks();
  }, [userId]);

  //   Timezone: Asia/Kolkata

  const examplePrompt = `Plan my day:
- From 10 AM to 1 PM: work on my project
- 1 PM to 2 PM: lunch
- 2 PM to 4 PM: design personal website
- 4 PM to 5 PM: practice DSA questions
- 5 PM to 6 PM: go for a walk`;

  const toggleCompletion = async (index: number) => {
    const task = myTasks[index];
    const newCompleted = !task.completed;

    setMyTasks((prev) =>
      prev.map((task, i) =>
        i === index ? { ...task, completed: !task.completed } : task
      )
    );

    try {
      await updateTaskCompletion({ id: task.id, completed: newCompleted });
    } catch (err) {
      console.error("Failed to update task completion", err);
      toast.error("❌ Could not update task status.");
    }
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    setMyTasks([]); // Clear existing tasks

    try {
      const rawTasks = await getTasksFromPromptOnly({ prompt });

      for (const task of rawTasks) {
        try {
          // 1. Enhance image prompt
          const imagePrompt = enhanceTaskToImagePrompt(task);

          // 2. Generate image
          const base64Image = process.env.NODE_ENV === "production" ? SAMPLE_BASE64 : await generateImageFromPrompt(imagePrompt);

          // 3. Add to Clerk calendar
          const result = await createPersonalTask({
            ...task,
            clerkUserId: String(userId),
          });

          const savedTask = await saveTaskToDb({
            ...task,
            clerkUserId: String(userId),
            eventId: String(result.eventId),
            base64Image,
          });

          setMyTasks((prev) => [
            ...prev,
            {
              id: savedTask.id, // ✅ get from DB
              title: task.title,
              description: task.description,
              startTime: task.startTime,
              endTime: task.endTime,
              eventId: String(result.eventId),
              base64Image,
              completed: false,
            },
          ]);

          toast.success(`✅ "${task.title}" scheduled successfully`, {
            duration: 4000,
            className:
              "!rounded-3xl !py-6 !px-5 !justify-center !text-green-500 !font-bold",
          });

          // Optional: wait a bit between toasts if needed
          await new Promise((r) => setTimeout(r, 300));
        } catch (err: any) {
          console.error(`❌ Error processing task "${task.title}"`, err);
          toast.error(`❌ Failed to schedule "${task.title}"`, {
            description: err.message,
            duration: 5000,
            className:
              "!rounded-3xl !py-6 !px-5 !justify-center !text-red-500 !font-bold",
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (index: number, eventId: string) => {
    setDeletingIndex(index);
    try {
      await deleteCalendarEvent({ clerkUserId: String(userId), eventId });

      await deleteTaskByEventId(eventId);

      setMyTasks((prev) => prev.filter((_, i) => i !== index));

      toast.success("🗑️ Task deleted from calendar", {
        className:
          "!rounded-3xl !py-6 !px-5 !justify-center !text-red-500 !font-bold",
      });
    } catch (err: any) {
      console.error("Error deleting event:", err.message);
      toast.error("❌ Failed to delete event", {
        description: err.message,
      });
    } finally {
      setDeletingIndex(null);
    }
  };

  return (
    <section className="flex flex-col md:flex-row gap-10 px-4 xl:px-10">
      <div className="w-full md:w-2/5 flex flex-col items-center gap-10 animate-fade-in px-4">
        <h1 className="text-4xl xl:text-5xl font-black text-center mt-10">
          Plan My Day
        </h1>
        <p className="text-gray-500 text-center text-md">
          Describe your day in plain English — we'll schedule tasks and generate
          matching images for each one.
        </p>

        <div className="w-full">
          <label className="text-sm text-gray-500 mb-2 block">
            Example Prompt
          </label>
          <pre className="bg-gray-100 p-4 rounded-md text-sm whitespace-pre-wrap border">
            {examplePrompt}
          </pre>
        </div>

        <Textarea
          className="w-full min-h-[180px] text-lg"
          placeholder="Type your plan here..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={loading || prompt.trim() === ""}
          className="bg-blue-500 hover:bg-blue-400 text-white py-6 hover:scale-110 duration-300 border-b-4 border-blue-700 hover:border-blue-500 rounded-2xl shadow-lg text-xl font-bold w-full flex justify-center items-center gap-2 cursor-pointer"
        >
          <CalendarPlus className="size-6" />
          {loading ? (
            <>
              {"Scheduling..."}{" "}
              <BlinkBlur
                color={["#ffffff", "#dbeafe", "#93c5fd", "#3b82f6"]}
                size="small"
                text=""
                textColor=""
              />
            </>
          ) : (
            "Create Tasks"
          )}
        </Button>
      </div>
      <div className="w-full md:w-3/5 px-4 py-6 md:max-h-[79vh] overflow-y-auto">
        <div className="flex flex-col items-center">
          <h1 className="text-4xl xl:text-5xl font-black text-center mt-10">
            Your Scheduled Tasks
          </h1>
          <p className="text-gray-500 text-center text-md mt-4">
            Automatically generated from your plan
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 px-6 py-6 mt-6">
          {myTasks.length === 0 && !loading && (
            <div className="col-span-full text-center text-gray-400 text-sm italic">
              No tasks yet. Add a prompt and click “Create Tasks” to begin.
            </div>
          )}

          {myTasks.map((task, index) => (
            <div
              key={`${task.title}-${index}`}
              className={`flex flex-col justify-between bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${
                task.completed ? "opacity-60 grayscale" : ""
              }`}
              // style={{ minHeight: "360px" }}
            >
              <img
                src={`data:image/png;base64,${task.base64Image}`}
                alt={task.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h2
                    className={`text-lg font-bold tracking-tight ${
                      task.completed
                        ? "text-gray-400 line-through"
                        : "text-gray-800"
                    }`}
                  >
                    {task.title}
                  </h2>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={task.completed || false}
                      onChange={() => toggleCompletion(index)}
                      className="accent-blue-600 w-4 h-4"
                    />
                    Done
                  </label>
                </div>

                <p
                  className={`text-sm ${
                    task.completed ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {task.description || "No description provided."}
                </p>
                <p className="flex items-center gap-1 text-xs text-gray-500 italic">
                  <Clock className="w-4 h-4 inline" />
                  {new Date(task.startTime).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  –{" "}
                  {new Date(task.endTime).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

                <button
                  disabled={deletingIndex === index}
                  onClick={() => handleDelete(index, task.eventId)}
                  className="w-full h-10 mt-2 px-4 py-2 rounded-md bg-red-700 text-white hover:bg-red-500 cursor-pointer"
                >
                  {deletingIndex === index ? (
                    <>
                      <ThreeDot
                        color="#32cd32"
                        size="small"
                        text=""
                        textColor=""
                      />
                      {/* Deleting... */}
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          ))}
          {loading && <ShimmerCard />}
        </div>
      </div>
    </section>
  );
}
