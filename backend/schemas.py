"""Pydantic request / response models for the Doctor Application API."""

from __future__ import annotations

import json
from datetime import date
from typing import Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

DoctorStatus = Literal["Active", "On Leave", "Inactive"]
AppointmentStatus = Literal["Scheduled", "Completed", "Cancelled", "Pending"]
PaymentStatus = Literal["Unpaid", "Paid", "Refunded"]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict[str, Any]


class ProfileUpdate(BaseModel):
    """Fields the signed-in user may change on their own account."""

    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=120)
    # Only applied when the client explicitly sends the key ("" removes the picture).
    avatar_url: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=64)


# ---------------------------------------------------------------------------
# Doctors
# ---------------------------------------------------------------------------
class DoctorBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: str
    phone: Optional[str] = None
    specialty: str = Field(..., min_length=2, max_length=120)
    qualification: Optional[str] = None
    experience_years: int = Field(default=0, ge=0, le=70)
    hospital: Optional[str] = None
    city: Optional[str] = None
    country: str = "Pakistan"
    consultation_fee: float = Field(default=0, ge=0)
    rating: float = Field(default=0, ge=0, le=5)
    status: DoctorStatus = "Active"
    gender: Optional[Literal["Male", "Female", "Other", "Rather Not Say"]] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

    # ----- Extra fields imported from the local Firestore backup -----
    urdu_name: Optional[str] = None
    whatsapp: Optional[str] = None
    opd_info: Optional[str] = None
    ot_schedule: Optional[str] = None
    diseases: Optional[str] = None
    clinics_json: Optional[str] = None
    timings_json: Optional[str] = None
    views_count: int = Field(default=0, ge=0)
    total_calls: int = Field(default=0, ge=0)
    sehat_card_empaneled: int = Field(default=0, ge=0, le=1)
    profile_activity: Optional[str] = None
    doctors_message: Optional[str] = None

    @field_validator(
        "opd_info",
        "ot_schedule",
        "clinics_json",
        "timings_json",
        "profile_activity",
        mode="before",
    )
    @classmethod
    def _json_blob(cls, v: Any) -> Any:
        """Accept either a JSON string or a Python dict/list for TEXT columns."""
        if v is None:
            return v
        if isinstance(v, (dict, list)):
            return json.dumps(v, ensure_ascii=False)
        return v

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if "@" not in v:
            raise ValueError("invalid email address")
        return v

    @field_validator("name", "specialty")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class DoctorCreate(DoctorBase):
    pass


class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = Field(default=None, ge=0, le=70)
    hospital: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    consultation_fee: Optional[float] = Field(default=None, ge=0)
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    status: Optional[DoctorStatus] = None
    gender: Optional[Literal["Male", "Female", "Other", "Rather Not Say"]] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

    # ----- Extra fields imported from the local Firestore backup -----
    urdu_name: Optional[str] = None
    whatsapp: Optional[str] = None
    opd_info: Optional[str] = None
    ot_schedule: Optional[str] = None
    diseases: Optional[str] = None
    clinics_json: Optional[str] = None
    timings_json: Optional[str] = None
    views_count: Optional[int] = Field(default=None, ge=0)
    total_calls: Optional[int] = Field(default=None, ge=0)
    sehat_card_empaneled: Optional[int] = Field(default=None, ge=0, le=1)
    profile_activity: Optional[str] = None
    doctors_message: Optional[str] = None

    @field_validator(
        "opd_info",
        "ot_schedule",
        "clinics_json",
        "timings_json",
        "profile_activity",
        mode="before",
    )
    @classmethod
    def _json_blob(cls, v: Any) -> Any:
        """Accept either a JSON string or a Python dict/list for TEXT columns."""
        if v is None:
            return v
        if isinstance(v, (dict, list)):
            return json.dumps(v, ensure_ascii=False)
        return v


class Doctor(DoctorBase):
    id: int
    total_patients: int = 0
    avatar_url: Optional[str] = None
    created_at: str
    updated_at: str


class DoctorListResponse(BaseModel):
    items: list[dict[str, Any]]
    total: int
    page: int
    limit: int
    pages: int


# ---------------------------------------------------------------------------
# Appointments / patients
# ---------------------------------------------------------------------------
class PatientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=0, le=130)
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None


class AppointmentCreate(BaseModel):
    patient_id: Optional[int] = None
    patient_name: Optional[str] = None
    doctor_id: int
    appointment_date: date
    time_slot: str
    reason: Optional[str] = None
    fee: float = 0
    status: AppointmentStatus = "Scheduled"
    payment_status: PaymentStatus = "Unpaid"


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class DashboardStats(BaseModel):
    total_doctors: int
    active_doctors: int
    total_patients: int
    total_appointments: int
    today_appointments: int
    completed_appointments: int
    pending_appointments: int
    cancelled_appointments: int
    total_revenue: float
    new_doctors_this_month: int
    avg_rating: float
    top_specialty: Optional[str] = None


class Message(BaseModel):
    message: str
