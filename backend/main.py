from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import os
import io
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel, Image
from groq import Groq

app = FastAPI()

# --- ENABLE CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL MEMORY ---
BRAND_CONTEXT = "You are a helpful, professional brand strategist for a FMCG company. Visual style is clean and modern."

# --- CLIENT SETUP ---
# Ensure your Google Cloud Project ID is set in environment or defaults
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "gen-lang-client-0039182775")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1") 

vertexai.init(project=PROJECT_ID, location=LOCATION)
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
            temperature=0.3,
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
            temperature=0.6,
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
        
        # Imagen 3 for standard generation
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

# --- NEW: SWAP BACKGROUND ENDPOINT ---
@app.post("/swap-background")
async def swap_background(prompt: str = Form(...), file: UploadFile = File(...)):
    global BRAND_CONTEXT
    try:
        print(f"Swapping background with prompt: {prompt}")
        
        # 1. Read the uploaded image bytes
        content = await file.read()
        source_image = Image(content)

        # 2. Optimize prompt using the brand context
        final_prompt = optimize_prompt_for_visuals(prompt, BRAND_CONTEXT)
        
        # 3. Use Imagen 2 (imagegeneration@006) for editing capabilities
        # Note: Imagen 3 editing support is rolling out, but @006 is stable for 'product-image' mode
        model = ImageGenerationModel.from_pretrained("imagegeneration@006")
        
        images = model.edit_image(
            base_image=source_image,
            prompt=final_prompt,
            edit_mode="product-image", # Special mode for background swapping
            number_of_images=1
        )
        
        return Response(content=images[0]._image_bytes, media_type="image/png")
    except Exception as e:
        print(f"Vertex AI Edit Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))