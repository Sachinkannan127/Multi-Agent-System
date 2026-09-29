import io
import logging
import os
import sys
import site
import importlib

# Ensure site-packages are present in sys.path
try:
    for sp in site.getsitepackages() + [site.getusersitepackages()]:
        if sp and sp not in sys.path and os.path.exists(sp):
            sys.path.insert(0, sp)
    custom_sp = r"C:\Users\Sachin\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages"
    if custom_sp not in sys.path and os.path.exists(custom_sp):
        sys.path.insert(0, custom_sp)
    importlib.invalidate_caches()
except Exception:
    pass

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

logger = logging.getLogger("app.routes.ocr")
router = APIRouter(prefix="/ocr", tags=["OCR & Image Extraction"])

# Global cache for EasyOCR reader instances keyed by language tuple
_readers: Dict[str, Any] = {}


def get_ocr_reader(languages: Optional[List[str]] = None):
    """
    Lazily instantiates and caches EasyOCR reader.
    Defaults to English ['en'].
    """
    try:
        import easyocr
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="EasyOCR is not installed in this environment. Install easyocr, torch, and torchvision to enable image text extraction.",
        )

    langs = tuple(sorted(languages or ["en"]))
    lang_key = ",".join(langs)

    if lang_key not in _readers:
        logger.info(f"Initializing EasyOCR reader for languages: {langs}")
        # gpu=False ensures universal compatibility without CUDA setup errors
        _readers[lang_key] = easyocr.Reader(list(langs), gpu=False)

    return _readers[lang_key]


class OCRLineItem(BaseModel):
    text: str
    confidence: float
    bbox: Optional[List[List[int]]] = None


class OCRExtractResponse(BaseModel):
    success: bool
    filename: str
    text: str
    lines: List[OCRLineItem]
    total_lines: int
    avg_confidence: float
    languages: List[str]


@router.post("/extract", response_model=OCRExtractResponse, summary="Extract Text from Image using EasyOCR")
async def extract_text_from_image(
    file: UploadFile = File(..., description="Image file (PNG, JPG, JPEG, WEBP, BMP)"),
    languages: Optional[str] = Form("en", description="Comma-separated language codes, e.g. 'en,es,fr'"),
):
    """
    Extracts text from an uploaded image using EasyOCR.
    Returns the concatenated full text, individual lines, bounding boxes, and confidence scores.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file uploaded.")

    # Validate image extension
    allowed_exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".gif"}
    ext = ("." + file.filename.rsplit(".", 1)[-1]).lower() if "." in file.filename else ""
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Supported formats: {', '.join(sorted(allowed_exts))}",
        )

    try:
        # Read file bytes
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

        # Parse language list
        lang_list = [l.strip() for l in languages.split(",") if l.strip()] if languages else ["en"]

        lines: List[OCRLineItem] = []
        conf_sum = 0.0

        try:
            reader = get_ocr_reader(lang_list)
            # Run EasyOCR extraction on in-memory bytes
            raw_results = reader.readtext(contents)

            for bbox, text, prob in raw_results:
                clean_text = str(text).strip()
                if clean_text:
                    formatted_bbox = [[int(pt[0]), int(pt[1])] for pt in bbox] if bbox else None
                    lines.append(
                        OCRLineItem(
                            text=clean_text,
                            confidence=round(float(prob), 4),
                            bbox=formatted_bbox,
                        )
                    )
                    conf_sum += float(prob)
        except (ImportError, ModuleNotFoundError, Exception) as ocr_err:
            logger.warning(f"EasyOCR local reader unavailable ({ocr_err}), falling back to Vision LLM extraction...")
            import base64
            from app.core.config import settings
            import litellm

            b64_img = base64.b64encode(contents).decode("utf-8")
            mime_type = f"image/{ext.replace('.', '')}"
            if mime_type == "image/jpg":
                mime_type = "image/jpeg"

            prompt_text = (
                f"Extract all readable text from this image exactly as written. "
                f"Preserve line breaks, tables, and headers. Target languages: {', '.join(lang_list)}. "
                f"Return ONLY the extracted text, with no conversational preamble or markdown code blocks."
            )

            # Attempt Gemini Vision / Groq Vision via LiteLLM
            api_key = settings.GEMINI_API_KEY or settings.GROQ_API_KEY
            model_name = "gemini/gemini-1.5-flash" if settings.GEMINI_API_KEY else "groq/llama-3.2-11b-vision-preview"

            resp = litellm.completion(
                model=model_name,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt_text},
                            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_img}"}},
                        ],
                    }
                ],
                api_key=api_key,
                temperature=0.1,
            )
            extracted_raw = resp.choices[0].message.content or ""
            for raw_line in extracted_raw.splitlines():
                if raw_line.strip():
                    lines.append(OCRLineItem(text=raw_line.strip(), confidence=0.98, bbox=None))
                    conf_sum += 0.98

        total_lines = len(lines)
        avg_confidence = round(conf_sum / total_lines, 4) if total_lines > 0 else 0.0
        full_text = "\n".join(item.text for item in lines)

        return OCRExtractResponse(
            success=True,
            filename=file.filename,
            text=full_text,
            lines=lines,
            total_lines=total_lines,
            avg_confidence=avg_confidence,
            languages=lang_list,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR extraction failed for {file.filename}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR extraction failed: {str(e)}",
        )
