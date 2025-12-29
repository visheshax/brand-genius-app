from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response  # <--- CRITICAL IMPORT
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from typing import Annotated, Optional
import requests
import PyPDF2
import io
import os
from dotenv import load_dotenv  # <--- NEW IMPORT

# --- CONFIGURATION ---
app = FastAPI(title="BrandGenius API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API KEYS ---
# (Keep your keys here)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
HF_API_TOKEN = os.getenv("HF_API_TOKEN")

if not GROQ_API_KEY or not HF_API_TOKEN:
    raise ValueError("API Keys are missing! Please check your .env file.")

# --- CLIENT SETUP ---
try:
    client = Groq(api_key=GROQ_API_KEY)
except:
    client = None

HF_API_URL = "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0"
hf_headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}

# --- DATA MODELS ---
class CopyRequest(BaseModel):
    prompt: str
    context: Optional[str] = ""

class ImageRequest(BaseModel):
    prompt: str
    style: Optional[str] = "minimalist, 4k"

# --- HELPER FUNCTIONS ---
def generate_copy_logic(prompt, context):
    if not client: return "Error: Groq Client not initialized."
    
    system_instruction = f"""
    You are a Senior Brand Strategist.
    CONTEXT: {context[:10000]}
    Task: Write creative marketing copy based on the user's prompt.
    """
    try:
        chat = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            temperature=0.6,
        )
        return chat.choices[0].message.content
    except Exception as e:
        return str(e)

def generate_image_logic(prompt, style):
    enhanced_prompt = f"{prompt}, {style}"
    payload = {"inputs": enhanced_prompt}
    try:
        response = requests.post(HF_API_URL, headers=hf_headers, json=payload)
        return response.content # Returns bytes
    except:
        return None

# --- API ENDPOINTS ---

@app.get("/")
def home():
    return {"status": "BrandGenius Brain is Online 🧠"}

# 1. Text Generation (JSON)
@app.post("/generate/copy")
def generate_copy_endpoint(request: CopyRequest):
    result = generate_copy_logic(request.prompt, request.context)
    return {"result": result}

# 2. Text Generation + File (Multipart)
@app.post("/generate/copy-with-file")
async def generate_copy_with_file(
    prompt: Annotated[str, Form()],
    context: Annotated[str, Form()] = "Professional marketing tone",
    file: Annotated[UploadFile, File()] = None
):
    extracted_text = ""
    if file:
        try:
            content = await file.read()
            if file.filename.endswith(".pdf"):
                reader = PyPDF2.PdfReader(io.BytesIO(content))
                for page in reader.pages:
                    extracted_text += page.extract_text() + "\n"
            elif file.filename.endswith(".txt") or file.filename.endswith(".md"):
                extracted_text = content.decode("utf-8")
            else:
                extracted_text = f"[Attached file: {file.filename} - Visual content]"
        except Exception as e:
            extracted_text = f"[Error reading file: {str(e)}]"

    full_context = f"{context}\n\n--- UPLOADED CONTENT ---\n{extracted_text}"
    result = generate_copy_logic(prompt, full_context)
    return {"result": result}

# 3. Image Generation (Multipart + Raw Response)
@app.post("/generate/image")
async def generate_image_endpoint(
    prompt: Annotated[str, Form()],
    style: Annotated[str, Form()] = "minimalist, 4k",
    file: Annotated[UploadFile, File()] = None
):
    # Handle optional file context
    file_context = ""
    if file:
        print(f"Received file for image: {file.filename}")
        file_context = " (inspired by attached brand guidelines)"

    final_prompt = f"{prompt} {file_context}"
    
    # Generate bytes
    image_bytes = generate_image_logic(final_prompt, style)
    
    if not image_bytes:
        raise HTTPException(status_code=500, detail="Image generation failed")
    
    # --- FIX IS HERE ---
    # We must return a Response object with media_type="image/png"
    # Do NOT return a dictionary like {"data": image_bytes}
    return Response(content=image_bytes, media_type="image/png")