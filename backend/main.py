from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware  # <--- NEW IMPORT
from fastapi.responses import Response
from pydantic import BaseModel
import os
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel
from groq import Groq

app = FastAPI()

# --- 1. ENABLE CORS (THE FIX) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (Simplest for this demo)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (POST, GET, etc.)
    allow_headers=["*"],  # Allows all headers
)

# --- GLOBAL MEMORY ---
BRAND_CONTEXT = "You are a helpful, professional brand strategist. Visual style is clean and modern."

# --- CLIENT SETUP ---
vertexai.init(location="europe-west2")
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# --- DATA MODELS ---
class PromptRequest(BaseModel):
    prompt: str

# --- HELPER FUNCTION ---
def optimize_prompt_for_visuals(user_prompt: str, context: str) -> str:
    try:
        print("Translating prompt into visual brand language...")
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are an expert visual prompt engineer. Rewrite the user request into a highly detailed visual description that matches the Brand Guidelines. Output ONLY the rewritten prompt."},
                {"role": "user", "content": f"BRAND GUIDELINES:\n{context}\n\nUSER REQUEST: {user_prompt}\n\nDETAILED VISUAL PROMPT:"}
            ],
            temperature=0.7,
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        print(f"Prompt optimization failed: {e}")
        return user_prompt

# --- ENDPOINTS ---

@app.get("/")
def home():
    return {"message": "Brand Genius Brain is LISTENING (CORS Enabled)"}

@app.post("/upload-brand-assets")
async def upload_file(file: UploadFile = File(...)):
    global BRAND_CONTEXT
    try:
        content = await file.read()
        text_content = content.decode("utf-8")
        BRAND_CONTEXT = text_content
        print(f"New Brand Context: {len(text_content)} chars.")
        return {"status": "Brand Guidelines Ingested", "preview": text_content[:50] + "..."}
    except Exception as e:
        print(f"Upload failed: {str(e)}")
        return {"status": "Error reading file."}

@app.post("/generate-copy")
def generate_copy(request: PromptRequest):
    global BRAND_CONTEXT
    try:
        print(f"Generating copy for: {request.prompt}")
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": f"You are a Senior Brand Strategist. Strictly adhere to these guidelines:\n\n{BRAND_CONTEXT}"},
                {"role": "user", "content": request.prompt}
            ],
            temperature=0.7,
        )
        return {"response": completion.choices[0].message.content}
    except Exception as e:
        print(f"Groq Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-image")
def generate_image(request: PromptRequest):
    global BRAND_CONTEXT
    try:
        print(f"Generating image for: {request.prompt}")
        final_prompt = optimize_prompt_for_visuals(request.prompt, BRAND_CONTEXT)
        
        model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-001")
        images = model.generate_images(
            prompt=final_prompt,
            number_of_images=1,
            aspect_ratio="1:1",
            safety_filter_level="block_some",
            person_generation="allow_adult"
        )
        return Response(content=images[0]._image_bytes, media_type="image/png")
    except Exception as e:
        print(f"Vertex AI Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
