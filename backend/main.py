from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import os
import io
from PIL import Image as PILImage # Required for robust image handling
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

# --- CLIENT SETUP ---
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "gen-lang-client-0039182775")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1") 

vertexai.init(project=PROJECT_ID, location=LOCATION)
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# --- DATA MODELS ---
# Frontend must now send BOTH prompt and context
class PromptRequest(BaseModel):
    prompt: str
    context: str

# --- HELPER FUNCTION ---
def optimize_prompt_for_visuals(user_prompt: str, context: str) -> str:
    try:
        print("Translating prompt into visual brand language...")
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", # Upgrade to smarter model
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
    return {"message": "Brand Genius Brain is LISTENING (Stateless Mode)"}

# 1. EXTRACT CONTEXT (Replaces Upload)
# Reads the file and sends text back to frontend
@app.post("/extract-context-from-file")
async def extract_context(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text_content = content.decode("utf-8")
        print(f"Extracted text: {len(text_content)} chars.")
        return {
            "status": "success", 
            "extracted_text": text_content,
            "message": "Text extracted. Please save in frontend state."
        }
    except Exception as e:
        print(f"Extraction failed: {str(e)}")
        return {"status": "error", "message": "Could not read file."}

# 2. GENERATE COPY (Stateless)
@app.post("/generate-copy")
def generate_copy(request: PromptRequest):
    try:
        print(f"Generating copy for: {request.prompt}")
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", # Upgrade to smarter model
            messages=[
                {"role": "system", "content": f"You are a Senior Brand Strategist. Strictly adhere to these guidelines:\n\n{request.context}"},
                {"role": "user", "content": request.prompt}
            ],
            temperature=0.7,
        )
        return {"response": completion.choices[0].message.content}
    except Exception as e:
        print(f"Groq Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 3. GENERATE IMAGE (Stateless)
@app.post("/generate-image")
def generate_image(request: PromptRequest):
    try:
        print(f"Generating image for: {request.prompt}")
        final_prompt = optimize_prompt_for_visuals(request.prompt, request.context)
        
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

# 4. SWAP BACKGROUND (Stateless + Robust Image Handling)
@app.post("/swap-background")
async def swap_background(
    prompt: str = Form(...), 
    context: str = Form(...), # Context required here too
    file: UploadFile = File(...)
):
    try:
        print(f"Swapping background. Context length: {len(context)}")
        
        # 1. Read and Sanitize Image (Force PNG)
        content = await file.read()
        pil_image = PILImage.open(io.BytesIO(content)).convert("RGB")
        
        byte_arr = io.BytesIO()
        pil_image.save(byte_arr, format='PNG')
        clean_bytes = byte_arr.getvalue()
        
        source_image = Image(clean_bytes)

        # 2. Optimize prompt using context
        final_prompt = optimize_prompt_for_visuals(prompt, context)
        
        # 3. Generate
        model = ImageGenerationModel.from_pretrained("imagegeneration@006")
        
        images = model.edit_image(
            base_image=source_image,
            prompt=final_prompt,
            edit_mode="product-image", 
            number_of_images=1
        )
        
        return Response(content=images[0]._image_bytes, media_type="image/png")
    except Exception as e:
        print(f"Vertex AI Edit Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))