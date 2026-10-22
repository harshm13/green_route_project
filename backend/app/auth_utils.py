import os
from datetime import datetime, timedelta, timezone
from typing import Optional, List
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import SessionLocal
from . import models

import secrets
from pathlib import Path

DEPRECATED_OLD_KEY = "greenroute-super-secure-jwt-secret-key-2026-production"

def _resolve_jwt_secret() -> str:
    env_secret = os.getenv("JWT_SECRET")
    if env_secret:
        if env_secret == DEPRECATED_OLD_KEY:
            raise RuntimeError(
                "Insecure deployment: JWT_SECRET matches the deprecated hardcoded default. "
                "A unique deployment-specific secret is required."
            )
        return env_secret

    secret_file = Path(__file__).resolve().parent.parent.parent / ".jwt_secret"
    if secret_file.exists():
        secret = secret_file.read_text().strip()
        if secret and secret != DEPRECATED_OLD_KEY:
            return secret

    new_secret = secrets.token_urlsafe(32)
    try:
        secret_file.write_text(new_secret)
    except Exception:
        pass
    return new_secret

SECRET_KEY = _resolve_jwt_secret()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login", auto_error=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with a salt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hashed password."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a signed JWT access token containing user identity and role."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token, explicitly invalidating tokens signed with old key."""
    # Invalidate any token signed with the deprecated fallback key
    try:
        deprecated_check = jwt.decode(token, DEPRECATED_OLD_KEY, algorithms=[ALGORITHM])
        if deprecated_check:
            return None
    except jwt.PyJWTError:
        pass

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """FastAPI dependency to retrieve the authenticated user from a Bearer token."""
    if not token:
        return None
    
    payload = decode_access_token(token)
    if not payload:
        return None
        
    user_id = payload.get("sub")
    if not user_id:
        return None
        
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    return user

def require_auth(user: Optional[models.User] = Depends(get_current_user)) -> models.User:
    """Dependency that enforces a valid authenticated user."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def require_role(allowed_roles: List[str]):
    """
    Dependency factory to enforce Role-Based Access Control (RBAC).
    Checks both role membership and account approval state.
    """
    def role_checker(user: models.User = Depends(require_auth)) -> models.User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Role '{user.role}' is not authorized. Allowed: {allowed_roles}"
            )
        if not user.is_approved:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Your account is pending Head Authority approval."
            )
        return user
    return role_checker
