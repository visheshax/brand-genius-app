from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import os
import io
import json
from pypdf import PdfReader
import vertexai
from vertexai.generative_models import GenerativeModel, Part
from vertexai.preview.vision_models import ImageGenerationModel

app = FastAPI()

# --- ENABLE CORS ---
# In production, replace ["*"] with your specific Frontend URL for better security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# main.py

# main.py

# ✅ FIX: Match the project ID you are using in your terminal
PROJECT_ID = "brand-genius-prod-1767127479" 
LOCATION = "us-central1"

vertexai.init(project=PROJECT_ID, location=LOCATION)

# Initialize Gemini
text_model = GenerativeModel("gemini-1.5-flash")
vision_model = GenerativeModel("gemini-1.5-flash")

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

@app.post("/extract-context-from-file")
async def extract_context(file: UploadFile = File(...)):
    try:
        content = await file.read()
        filename = file.filename.lower()
        extracted_text = ""

        if filename.endswith(".pdf"):
            pdf_reader = PdfReader(io.BytesIO(content))
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
        else:
            extracted_text = content.decode("utf-8")

        print(f"✅ Extracted {len(extracted_text)} chars from {filename}")
        return {
            "status": "success", 
            "extracted_text": extracted_text.strip(),
            "message": "Context extracted successfully."
        }
    except Exception as e:
        print(f"❌ Extraction Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Could not read file: {str(e)}")

@app.post("/generate-copy")
def generate_copy(request: PromptRequest):
    try:
        print(f"✍️ Generating copy...")
        prompt = f"""
        ROLE: You are a Senior Brand Strategist.
        BRAND CONTEXT: {request.context}
        TASK: {request.prompt}
        """
        response = text_model.generate_content(prompt)
        return {"response": response.text}
    except Exception as e:
        print(f"❌ Gemini Text Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-visual")
async def generate_visual(
    prompt: str = Form(...), 
    context: str = Form(...),
    file: UploadFile = File(None) 
):
    try:
        final_prompt = prompt
        
        # 1. Image Analysis (if file provided)
        if file:
            print("👁️ Analyzing reference image style...")
            content = await file.read()
            image_part = Part.from_data(data=content, mime_type=file.content_type)
            
            analysis_prompt = f"""
            Analyze the visual style (lighting, color palette, composition) of this image.
            Create a highly detailed image generation prompt that applies THIS STYLE to this request: "{prompt}".
            Output ONLY the raw prompt text.
            """
            analysis = vision_model.generate_content([image_part, analysis_prompt])
            final_prompt = analysis.text
            print(f"✨ Enhanced Prompt: {final_prompt}")

        # 2. Image Generation
        print(f"🎨 Generating image...")
        model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-001")
        
        # Note: 'aspect_ratio' support depends on the specific model version/region
        images = model.generate_images(
            prompt=f"{final_prompt}. Follow these brand visual guidelines strictly: {context}",
            number_of_images=1,
            aspect_ratio="1:1"
        )
        return Response(content=images[0]._image_bytes, media_type="image/png")

    except Exception as e:
        print(f"❌ Visual Studio Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/audit-content")
def audit_content(request: AuditRequest):
    try:
        print("🛡️ Auditing content...")
        prompt = f"""
        ROLE: Chief Brand Compliance Officer.
        BRAND GUIDELINES: {request.context}
        CONTENT TO AUDIT: {request.content_to_audit}
        TASK: Evaluate the content against the guidelines.
        OUTPUT FORMAT: Return valid, parseable JSON ONLY. No markdown formatting (no ```json blocks).
        JSON STRUCTURE: {{ "overall_score": <0-100 integer>, "tone_score": <0-100 integer>, "rubric_breakdown": ["string", "string"], "improvement_suggestions": "string" }}
        """
        
        response = text_model.generate_content(prompt)
        
        # Clean the response to ensure valid JSON
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        
        return {"response": raw_text}
    except Exception as e:
        print(f"❌ Audit Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))