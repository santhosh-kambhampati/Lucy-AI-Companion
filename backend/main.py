import os
import json
import subprocess
import webbrowser
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

load_dotenv()

MEMORY_FILE = "memory.json"

if not os.path.exists(MEMORY_FILE):
    with open(MEMORY_FILE, "w") as file:
        json.dump([], file)


def load_memory():
    try:
        with open(MEMORY_FILE, "r") as file:
            return json.load(file)
    except:
        return []


def save_memory(memory):
    with open(MEMORY_FILE, "w") as file:
        json.dump(memory, file, indent=2)


# Desktop command execution function
def execute_desktop_command(user_message):
    message = user_message.lower()

    app_commands = {
        "chrome": "Google Chrome",
        "google chrome": "Google Chrome",
        "safari": "Safari",
        "vscode": "Visual Studio Code",
        "vs code": "Visual Studio Code",
        "spotify": "Spotify",
        "terminal": "Terminal",
        "finder": "Finder",
        "notes": "Notes",
        "discord": "Discord"
    }

    for keyword, app_name in app_commands.items():
        if f"open {keyword}" in message:
            subprocess.run([
                "open",
                "-a",
                app_name
            ])

            return f"Opening {app_name}."

    if "open youtube" in message:
        webbrowser.open("https://youtube.com")
        return "Opening YouTube."

    if "open google" in message:
        webbrowser.open("https://google.com")
        return "Opening Google."

    if "open github" in message:
        webbrowser.open("https://github.com")
        return "Opening GitHub."

    if "open chatgpt" in message:
        webbrowser.open("https://chatgpt.com")
        return "Opening ChatGPT."

    if "search youtube for" in message:
        query = message.split("search youtube for")[-1].strip()

        webbrowser.open(
            f"https://www.youtube.com/results?search_query={query}"
        )

        return f"Searching YouTube for {query}."

    if "search google for" in message:
        query = message.split("search google for")[-1].strip()

        webbrowser.open(
            f"https://www.google.com/search?q={query}"
        )

        return f"Searching Google for {query}."

    return None


client = OpenAI(
    api_key="ollama",
    base_url="http://localhost:11434/v1"
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

@app.get("/")
def home():
    return {
        "message": "Backend running successfully"
    }

@app.post("/chat")
async def chat(data: ChatRequest):
    try:
        print("USER MESSAGE:", data.message)

        desktop_action = execute_desktop_command(
            data.message
        )

        if desktop_action:
            async def desktop_response():
                yield desktop_action

            return StreamingResponse(
                desktop_response(),
                media_type="text/plain"
            )

        memory = load_memory()

        recent_memory = memory[-4:]

        conversation_context = []

        for item in recent_memory:
            conversation_context.append(
                {
                    "role": "user",
                    "content": item["user"]
                }
            )

            conversation_context.append(
                {
                    "role": "assistant",
                    "content": item["vision"]
                }
            )

        stream = client.chat.completions.create(
            model="llama3",
            stream=True,
            messages=[
                {
                    "role": "system",
                    "content": "You are Lucy, a calm realtime AI companion. Speak naturally and conversationally like a human companion. Never repeatedly mention being an AI, assistant, Vision, or Lucy unless directly asked. Keep responses concise, natural, emotionally aware, and realtime-friendly."
                },
                *conversation_context,
                {
                    "role": "user",
                    "content": data.message
                }
            ]
        )

        async def generate():
            full_response = ""

            for chunk in stream:
                content = chunk.choices[0].delta.content

                if content:
                    full_response += content
                    yield content

            memory.append(
                {
                    "timestamp": str(datetime.now()),
                    "user": data.message,
                    "vision": full_response
                }
            )

            save_memory(memory)

        return StreamingResponse(
            generate(),
            media_type="text/plain"
        )

    except Exception as e:
        print("ERROR:", str(e))

        return {
            "response": f"Error: {str(e)}"
        }
