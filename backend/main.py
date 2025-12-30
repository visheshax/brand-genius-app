from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import os
import io
import json
from PIL import Image as PILImage
from pypdf import PdfReader
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
# --- CLIENT SETUP ---
# We hardcode your actual project details here to fix the 404 error
# --- CLIENT SETUP ---
# Keep Project ID as is
PROJECT_ID = "brand-genius-app-186356869150" 

# CHANGE THIS to us-central1 (even if your server is in Europe)
LOCATION = "us-central1" 


vertexai.init(project=PROJECT_ID, location=LOCATION)


# Initialize Gemini Models
text_model = GenerativeModel("gemini-1.5-flash") # Removed "-001"
vision_model = GenerativeModel("gemini-1.5-flash") # Removed "-001"

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

# 1. EXTRACT CONTEXT (Supports PDF & Text)
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
        # This print will show up in Cloud Run logs if it fails
        raise HTTPException(status_code=500, detail=f"Could not read file: {str(e)}")

# 2. CAMPAIGN WRITER
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

# 3. VISUAL STUDIO
@app.post("/generate-visual")
async def generate_visual(
    prompt: str = Form(...), 
    context: str = Form(...),
    file: UploadFile = File(None) 
):
    try:
        final_prompt = prompt
        if file:
            print("Analyzing reference image for style...")
            content = await file.read()
            image_part = Part.from_data(data=content, mime_type=file.content_type)
            analysis_prompt = f"""
            Analyze the visual style of this image. Combine it with this request: "{prompt}".
            Output ONLY the detailed image prompt.
            """
            analysis = vision_model.generate_content([image_part, analysis_prompt])
            final_prompt = analysis.text

        print(f"Generating image with prompt: {final_prompt}")
        model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-001")
        images = model.generate_images(
            prompt=f"{final_prompt}. Brand Guidelines: {context}",
            number_of_images=1,
            aspect_ratio="1:1"
        )
        return Response(content=images[0]._image_bytes, media_type="image/png")

    except Exception as e:
        print(f"Visual Studio Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 4. BRAND GUARDIAN
@app.post("/audit-content")
def audit_content(request: AuditRequest):
    try:
        print("Auditing content...")
        prompt = f"""
        ROLE: Chief Brand Compliance Officer.
        BRAND GUIDELINES: {request.context}
        CONTENT TO AUDIT: {request.content_to_audit}
        TASK: Evaluate content. Output valid JSON ONLY.
        JSON STRUCTURE: {{ "overall_score": <0-100>, "tone_score": <0-100>, "rubric_breakdown": ["pass", "fail"], "improvement_suggestions": "string" }}
        """
        response = text_model.generate_content(prompt)
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        return {"response": raw_text}
    except Exception as e:
        print(f"Audit Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))