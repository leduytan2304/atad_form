from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProfileSetBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    full_name: str = ""
    position: str = ""
    department: str = ""
    document_number: str = ""
    document_date: str = ""
    reference: str = ""


class ProfileSetCreate(ProfileSetBase):
    is_active: bool = False


class ProfileSetUpdate(BaseModel):
    name: str | None = None
    full_name: str | None = None
    position: str | None = None
    department: str | None = None
    document_number: str | None = None
    document_date: str | None = None
    reference: str | None = None
    is_active: bool | None = None


class ProfileSetRead(ProfileSetBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool
    created_at: datetime


class TemplateBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = "Khác"
    content: str = ""


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    content: str | None = None


class TemplateRead(TemplateBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class RequestItem(BaseModel):
    text: str = ""
    image_id: int | None = None


class SubmissionBase(BaseModel):
    title: str = ""
    profile_id: int | None = None
    profile_name: str = ""
    full_name: str = ""
    position: str = ""
    department: str = ""
    document_number: str = ""
    document_date: str = ""
    reference: str = ""
    content: str = ""
    requests: list[RequestItem] = []
    reason: str = ""
    reason_image_id: int | None = None


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionUpdate(SubmissionBase):
    pass


class SubmissionRead(SubmissionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    docx_path: str | None = None
    created_at: datetime
    updated_at: datetime


class UploadRead(BaseModel):
    id: int
    url: str
    original_name: str


class StockRow(BaseModel):
    product: str
    image_url: str | None = None
    office: str
    quantity: float


class StockRead(BaseModel):
    rows: list[StockRow]
    sheet_name: str
    source_url: str
    fetched_at: datetime
    product_count: int
    images_ready: bool = False
