from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
import os
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel
from groq import Groq
from fastapi.responses import Response

app = FastAPI()

# --- GLOBAL MEMORY ---
# Default context if nothing is uploaded
BRAND_CONTEXT = "You are a helpful, professional brand strategist. Visual style is clean and modern."

# --- CLIENT SETUP ---
# Initialize Vertex AI (London)
vertexai.init(location="europe-west2")
# Initialize Groq
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# --- DATA MODELS ---
class PromptRequest(BaseModel):
    prompt: str

# --- HELPER FUNCTION: THE VISUAL TRANSLATOR ---
def optimize_prompt_for_visuals(user_prompt: str, context: str) -> str:
    """
    Uses Groq to rewrite a simple user prompt into a detailed
    visual description based on the uploaded brand context.
    """
    try:
        print("Translating prompt into visual brand language...")
        completion = groq_client.chat.completions.create(
            model="llama3-8b-8192", # Fast model for quick translation
            messages=[
                {"role": "system", "content": "You are an expert visual prompt engineer for AI image generators. Your job is to take a user request and rewrite it into a highly detailed visual description that perfectly matches the provided Brand Guidelines. Output ONLY the rewritten final prompt, no conversational text."},
                {"role": "user", "content": f"""
                BRAND GUIDELINES:
                ---
                {context}
                ---

                USER REQUEST: "{user_prompt}"

                TASK: Rewrite the user request into a detailed visual prompt that embodies the brand guidelines.
                DETAILED VISUAL PROMPT:
                """}
            ],
            temperature=0.7,
        )
        optimized_prompt = completion.choices[0].message.content.strip()
        print(f"Original Prompt: {user_prompt}")
        print(f"Optimized Brand Prompt: {optimized_prompt}")
        return optimized_prompt
    except Exception as e:
        print(f"Prompt optimization failed: {e}. Using original prompt.")
        return user_prompt

# --- ENDPOINTS ---

@app.get("/")
def home():
    return {"message": "Brand Genius Brain: Context-Aware Text AND Images Active."}

# === 1. SMART UPLOAD ===
@app.post("/upload-brand-assets")
async def upload_file(file: UploadFile = File(...)):
    global BRAND_CONTEXT
    try:
        content = await file.read()
        # Assuming .txt file for the demo
        text_content = content.decode("utf-8")
        
        # Update Global Memory
        BRAND_CONTEXT = text_content
        
        print(f"New Brand Context Loaded: {len(text_content)} chars.")
        return {"status": "Brand Guidelines Ingested into Memory.", "preview": text_content[:100] + "..."}
    except Exception as e:
        print(f"Upload failed: {str(e)}")
        return {"status": "Error reading file. Please upload .txt files."}

# === 2. CONTEXT-AWARE TEXT GEN ===
@app.post("/generate-copy")
def generate_copy(request: PromptRequest):
    global BRAND_CONTEXT
    try:
        # Inject context directly into system prompt
        completion = groq_client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": f"You are a Senior Brand Strategist. Strictly adhere to these brand guidelines:\n\n{BRAND_CONTEXT}"},
                {"role": "user", "content": request.prompt}
            ],
            temperature=0.7,
        )
        return {"response": completion.choices[0].message.content}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text Gen Failed: {str(e)}")

# === 3. CONTEXT-AWARE IMAGE GEN (NEW!) ===
@app.post("/generate-image")
def generate_image(request: PromptRequest):
    global BRAND_CONTEXT
    try:
        # STEP 1: Translate user request into visual brand language using Groq
        final_prompt = optimize_prompt_for_visuals(request.prompt, BRAND_CONTEXT)
        
        # STEP 2: Send the optimized, detailed prompt to Vertex AI
        model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-001")
        
        images = model.generate_images(
            prompt=final_prompt, # Use the rewritten prompt
            number_of_images=1,
            aspect_ratio="1:1",
            safety_filter_level="block_some",
            person_generation="allow_adult"
        )

        return Response(content=images[0]._image_bytes, media_type="image/png")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image Gen Failed: {str(e)}")