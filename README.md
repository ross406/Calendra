
# Calendra

Calendra is an AI-powered scheduling assistant built with **Next.js 15** that lets users create and share event links, manage availability, and use natural language to plan their day. It integrates with **Google Calendar**, uses **Clerk** for authentication, and leverages **OpenAI-style function calling** and **Stable Diffusion** for task planning with contextual image generation.

---
### Live Link - https://calendra-chi.vercel.app/

## ✨ Features

* 🔐 Google Sign-In using **Clerk**
* 📅 Google Calendar integration for real-time event scheduling
* 🔗 Shareable **public event links** with availability-based booking
* 📆 Smart scheduling based on custom availability
* 🤖 **“Plan My Day”**: Convert plain English into scheduled tasks with AI-generated images
* 🧠 Support for **local LLM (Ollama)** or **Gemini API** for flexible development
* 🎨 Task image generation via **Stable Diffusion WebUI**

---

## 🚀 Getting Started

First, clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/calendra.git
cd calendra
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app in action.

---

## 🔧 Environment Setup

Create a `.env.local` file and add the following:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL= /events
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/events
DATABASE_URL=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URL=
GEMINI_API_KEY=
OPENAI_API_KEY=
```

Ensure you have:

* Clerk project setup for Google OAuth
* Google Cloud project with Calendar API enabled
* Stable Diffusion WebUI running locally at `http://127.0.0.1:7860`

---

## 🧪 AI Integration

* **Task extraction**: OpenAI-compatible function calling (Open-AI / Gemini / Ollama)
* **Image generation**: Stable Diffusion (via Automatic1111 API [https://github.com/AUTOMATIC1111/stable-diffusion-webui] )

---

## 🛠 Tech Stack

* **Next.js 15**
* **React Hook Form**
* **Clerk (Auth)**
* **Google APIs (Calendar)**
* **OpenAI / Gemini / Ollama**
* **Stable Diffusion**
* **Tailwind CSS**

---

## 📦 Deployment

You can deploy Calendra on **Vercel**:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

