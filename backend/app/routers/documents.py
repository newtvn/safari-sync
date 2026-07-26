import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..models import Document, DocType, DocStatus, User
from ..schemas import DocumentOut
from ..security import get_current_user, require_role

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 5 * 1024 * 1024


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        doc_type_enum = DocType(doc_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document type")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF/JPG/PNG files are accepted")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 5MB limit")

    os.makedirs(settings.upload_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(settings.upload_dir, stored_name)
    with open(full_path, "wb") as f:
        f.write(contents)

    doc = Document(
        user_id=user.id,
        doc_type=doc_type_enum,
        file_path=full_path,
        original_filename=file.filename or stored_name,
        status=DocStatus.pending,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


@router.get("/mine", response_model=list[DocumentOut])
async def my_documents(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.user_id == user.id))
    return [DocumentOut.model_validate(d) for d in result.scalars().all()]


@router.get("/pending", response_model=list[DocumentOut])
async def pending_documents(
    staff: User = Depends(require_role("operator", "admin")), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.status == DocStatus.pending))
    return [DocumentOut.model_validate(d) for d in result.scalars().all()]


@router.post("/{document_id}/review", response_model=DocumentOut)
async def review_document(
    document_id: str,
    status: str,
    note: str = "",
    staff: User = Depends(require_role("operator", "admin")),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        doc.status = DocStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail="status must be verified or rejected")
    doc.reviewer_note = note
    await db.commit()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)
