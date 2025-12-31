import os
import io
import base64
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from pypdf import PdfReader
import google.generativeai as genai
from PIL import Image

app = FastAPI()

# --- ENABLE CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INITIALIZE GEMINI ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# Use Gemini 1.5 Flash for speed and multimodal tasks
text_model = genai.GenerativeModel("gemini-1.5-flash")

# --- DATA MODELS ---
class PromptRequest(BaseModel):
    prompt: str
    context: str

class AuditRequest(BaseModel):
    content_to_audit: str
    context: str

@app.get("/")
def home():
    return {"message": "Brand Genius Brain is ONLINE (Gemini SDK)"}

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
                if text: extracted_text += text + "\n"
        else:
            extracted_text = content.decode("utf-8")

        return {"status": "success", "extracted_text": extracted_text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-copy")
def generate_copy(request: PromptRequest):
    try:
        prompt = f"ROLE: Senior Brand Strategist\nCONTEXT: {request.context}\nTASK: {request.prompt}"
        response = text_model.generate_content(prompt)
        return {"response": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-visual")
async def generate_visual(
    prompt: str = Form(...), 
    context: str = Form(...),
    file: UploadFile = File(None) 
):
    try:
        # Note: In the standard Gemini SDK, image generation is handled via 
        # the 'imagen' model or the new Gemini 2.0 multimodal capabilities.
        # For a 1:1 replacement of Vertex Imagen:
        image_gen_model = genai.GenerativeModel("gemini-1.5-flash") # Or "imagen-3" if your account has it enabled
        
        # If a file is provided, use it as a style reference (Multimodal)
        parts = [f"Generate a detailed visual description for a brand asset based on: {prompt}. Guidelines: {context}"]
        if file:
            img_data = await file.read()
            parts.append(Image.open(io.BytesIO(img_data)))
            parts.append("Apply the visual style of this image to the prompt.")

        # For this SDK, we typically generate a high-quality description 
        # OR use the specific Imagen model if available in your region.
        response = image_gen_model.generate_content(parts)
        
        # Note: Standard Gemini SDK image generation returns images 
        # in the 'generated_images' field for specific models.
        # If using standard Gemini 1.5, we return the text description 
        # or link to a placeholder until Gemini 2.0 image-out is fully deployed.
        return {"message": "Visual Strategy Generated", "details": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/audit-content")
def audit_content(request: AuditRequest):
    try:
        prompt = f"""
        Evaluate this content against brand guidelines. 
        GUIDELINES: {request.context}
        CONTENT: {request.content_to_audit}
        Output ONLY valid JSON: {{ "overall_score": 0-100, "tone_score": 0-100, "rubric_breakdown": [], "improvement_suggestions": "" }}
        """
        response = text_model.generate_content(prompt)
        clean_json = response.text.replace("```json", "").replace("```", "").strip()
        return {"response": clean_json}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))