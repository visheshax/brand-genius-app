from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import os
import io
from PIL import Image as PILImage
from pypdf import PdfReader # NEW: For PDF handling
import vertexai
from vertexai.generative_models import GenerativeModel, Part, SafetySetting
from vertexai.preview.vision_models import ImageGenerationModel, Image as VertexImage

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

# Initialize Gemini Models
text_model = GenerativeModel("gemini-1.5-flash-001")
vision_model = GenerativeModel("gemini-1.5-flash-001") # Capable of reading images

# --- DATA MODELS ---
class PromptRequest(BaseModel):
    prompt: str
    context: str

class AuditRequest(BaseModel):
    content_to_audit: str
    context: str

# --- ENDPOINTS ---

@app.get("/")
def home():
    return {"message": "Brand Genius Brain is LISTENING (Gemini Edition)"}

# 1. EXTRACT CONTEXT (Now supports PDF & Text)
@app.post("/extract-context-from-file")
async def extract_context(file: UploadFile = File(...)):
    try:
        content = await file.read()
        filename = file.filename.lower()
        extracted_text = ""

        if filename.endswith(".pdf"):
            # Parse PDF
            pdf_reader = PdfReader(io.BytesIO(content))
            for page in pdf_reader.pages:
                extracted_text += page.extract_text() + "\n"
        else:
            # Assume Text/MD
            extracted_text = content.decode("utf-8")

        print(f"Extracted text from {filename}: {len(extracted_text)} chars.")
        return {
            "status": "success", 
            "extracted_text": extracted_text.strip(),
            "message": "Context extracted successfully."
        }
    except Exception as e:
        print(f"Extraction failed: {str(e)}")
        return {"status": "error", "message": f"Could not read file: {str(e)}"}

# 2. GENERATE COPY (Powered by Gemini)
@app.post("/generate-copy")
def generate_copy(request: PromptRequest):
    try:
        print(f"Gemini generating copy...")
        prompt = f"""
        ROLE: You are a Senior Brand Strategist.
        BRAND CONTEXT: {request.context}
        
        TASK: {request.prompt}
        """
        
        response = text_model.generate_content(prompt)
        return {"response": response.text}
    except Exception as e:
        print(f"Gemini Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 3. VISUAL STUDIO (Consolidated Image Gen)
# If a file is uploaded, we use Gemini to analyze it for style, then generate.
@app.post("/generate-visual")
async def generate_visual(
    prompt: str = Form(...), 
    context: str = Form(...),
    file: UploadFile = File(None) # Optional file
):
    try:
        final_prompt = prompt
        
        # If user uploads a "Style Reference" image
        if file:
            print("Analyzing reference image for style...")
            content = await file.read()
            # Convert to Part for Gemini
            image_part = Part.from_data(data=content, mime_type=file.content_type)
            
            # Ask Gemini to describe the style to improve the prompt
            analysis_prompt = f"""
            Analyze the visual style, lighting, and composition of this reference image.
            Combine that style description with this user request: "{prompt}".
            Create a highly detailed image generation prompt.
            """
            
            analysis = vision_model.generate_content([image_part, analysis_prompt])
            final_prompt = analysis.text
            print(f"Enhanced Prompt: {final_prompt}")

        # Generate Image using Imagen 3
        print(f"Generating image with prompt: {final_prompt}")
        model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-001")
        
        images = model.generate_images(
            prompt=f"{final_prompt}. Brand Guidelines: {context}",
            number_of_images=1,
            aspect_ratio="1:1",
            safety_filter_level="block_some",
            person_generation="allow_adult"
        )
        return Response(content=images[0]._image_bytes, media_type="image/png")

    except Exception as e:
        print(f"Visual Studio Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 4. BRAND GUARDIAN (Audit Tool)
@app.post("/audit-content")
def audit_content(request: AuditRequest):
    try:
        print("Auditing content...")
        prompt = f"""
        You are the 'Brand Guardian'. Your job is to strictly audit content against our guidelines.
        
        BRAND GUIDELINES:
        {request.context}
        
        CONTENT TO AUDIT:
        {request.content_to_audit}
        
        OUTPUT FORMAT:
        1. Score (0-100)
        2. What is on-brand (Bullet points)
        3. What is OFF-brand (Bullet points)
        4. Suggested rewrite (if score < 90)
        """
        
        response = text_model.generate_content(prompt)
        return {"response": response.text}
    except Exception as e:
        print(f"Audit Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))