from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from .config import settings
from .db import get_db
from .models import User, now

hasher = PasswordHasher()
bearer = HTTPBearer(auto_error=False)
ROLES = {"viewer": 0, "analyst": 1, "supervisor": 2, "administrator": 3}


def password_valid(encoded, password):
    try:
        return hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def token(user):
    return jwt.encode(
        {
            "sub": user.id,
            "exp": now() + timedelta(minutes=settings().access_token_minutes),
            "iat": now(),
            "iss": "crimestack",
            "aud": "crimestack-web",
        },
        settings().token_secret,
        algorithm="HS256",
    )


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db=Depends(get_db)
):
    try:
        if not credentials:
            raise ValueError()
        payload = jwt.decode(
            credentials.credentials,
            settings().token_secret,
            algorithms=["HS256"],
            issuer="crimestack",
            audience="crimestack-web",
            options={"require": ["exp", "sub", "iat"]},
        )
        user = db.scalar(select(User).where(User.id == payload["sub"]))
        if not user:
            raise ValueError()
        return user
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(401, "Session expired or invalid. Please sign in.") from None


def require(role):
    def dependency(user=Depends(current_user)):
        if ROLES[user.role] < ROLES[role]:
            raise HTTPException(403, f"{role.title()} permission required")
        return user

    return dependency
