import re
from pydantic import BaseModel, EmailStr, Field, field_validator

_PWD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=256)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not _PWD_RE.match(v):
            raise ValueError(
                "La password deve contenere almeno 8 caratteri, "
                "una lettera maiuscola, una minuscola e un numero."
            )
        return v
