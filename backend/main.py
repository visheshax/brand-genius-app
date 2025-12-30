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
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "gen-lang-client-0039182775")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1") 
vertexai.init(project=PROJECT_ID, location=LOCATION)

# Initialize Gemini Models
text_model = GenerativeModel("gemini-1.5-flash-001")
vision_model = GenerativeModel("gemini-1.5-flash-001") # Multimodal (Text + Images)

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
        return {"status": "error", "message": f"Could not read file: {str(e)}"}

# 2. CAMPAIGN WRITER (Gemini)
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

# 3. VISUAL STUDIO (Consolidated: Text-to-Image OR Image-to-Image Style)
@app.post("/generate-visual")
async def generate_visual(
    prompt: str = Form(...), 
    context: str = Form(...),
    file: UploadFile = File(None) # Optional Style Reference
):
    try:
        final_prompt = prompt
        
        # If user uploads a "Style Reference" image
        if file:
            print("Analyzing reference image for style...")
            content = await file.read()
            image_part = Part.from_data(data=content, mime_type=file.content_type)
            
            # Ask Gemini to extract the style
            analysis_prompt = f"""
            Analyze the visual style, lighting, color palette, and composition of this reference image.
            Describe it in 3 sentences.
            Then, combine that style description with this user request: "{prompt}".
            Output ONLY the final detailed prompt for an image generator.
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

# 4. BRAND GUARDIAN (Strict JSON Rubric)
@app.post("/audit-content")
def audit_content(request: AuditRequest):
    try:
        print("Auditing content against rubric...")
        
        prompt = f"""
        ROLE: You are the Chief Brand Compliance Officer.
        
        BRAND GUIDELINES:
        {request.context}
        
        CONTENT TO AUDIT:
        {request.content_to_audit}
        
        TASK:
        Evaluate the content strictly against the guidelines. 
        You must output your response in valid JSON format ONLY. 
        Do not add Markdown formatting (like ```json). Just the raw JSON string.
        
        JSON STRUCTURE:
        {{
            "overall_score": <number 0-100>,
            "tone_score": <number 0-100>,
            "rubric_breakdown": [
                "Pass: <Observation about tone>",
                "Fail: <Observation about specific keywords>"
            ],
            "improvement_suggestions": "<Specific rewrite instructions if score < 100>"
        }}
        """
        
        response = text_model.generate_content(prompt)
        
        # Clean response to ensure valid JSON
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        
        return {"response": raw_text}
    except Exception as e:
        print(f"Audit Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))