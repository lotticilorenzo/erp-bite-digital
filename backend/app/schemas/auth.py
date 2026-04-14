from pydantic import BaseModel, EmailStr, Field

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    # min 8 chars, max 128 — coerente con il validator in UserCreate
    new_password: str = Field(..., min_length=8, max_length=128)
