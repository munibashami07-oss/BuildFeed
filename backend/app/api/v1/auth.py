import secrets
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    encrypt_token,
)
from app.core.email import send_password_reset_email
from app.models.user import User
from app.models.password_reset_token import PasswordResetToken
from app.services.github.github_service import github_service, GitHubServiceError
from app.core.rate_limiter import RateLimiter
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    UserResponse,
    TokenResponse,
    MessageResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    VerifyTokenResponse,
    OnboardingRequest,
    ProfileUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

security_bearer = HTTPBearer(auto_error=False)

login_limiter = RateLimiter(calls=15, period=300)
forgot_limiter = RateLimiter(calls=10, period=900)


def utc_now():
    return datetime.now(timezone.utc)


def get_current_user(
    auth_credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not auth_credentials or not auth_credentials.credentials:
        raise credentials_exception
    
    token = auth_credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user account")
    
    return user


SIGNUP_STATE_EXPIRE_MINUTES = 15


@router.post("/register", status_code=status.HTTP_200_OK)
def register_user(user_in: UserRegister, db: Session = Depends(get_db)):
    """Step 1 of signup: validate username/email/password, then hand back a GitHub
    OAuth URL. The account is NOT created yet — GitHub connection is required to
    finish signup. See /auth/github/callback, which actually creates the User.
    """
    existing_email = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    existing_username = db.query(User).filter(User.username == user_in.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken"
        )

    # Pack the not-yet-created account into a short-lived signed "state" token.
    # GitHub echoes this back verbatim to our callback, so we don't need server-side
    # session storage to bridge the redirect round-trip.
    pending_signup = {
        "purpose": "signup",
        "username": user_in.username,
        "email": user_in.email.lower(),
        "password_hash": get_password_hash(user_in.password),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=SIGNUP_STATE_EXPIRE_MINUTES),
    }
    state = jwt.encode(pending_signup, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    return {"github_authorize_url": github_service.get_authorize_url(state=state), "signup_token": state}


@router.post("/register/skip-github", response_model=TokenResponse)
def skip_github_signup(req: dict, db: Session = Depends(get_db)):
    """Finish signup without connecting GitHub. The same short-lived signed signup
    token used by the OAuth flow is consumed to create the account."""
    signup_token = req.get("signup_token") if isinstance(req, dict) else None
    if not signup_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing signup token.")
    try:
        payload = jwt.decode(signup_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired signup session. Please sign up again.")
    if payload.get("purpose") != "signup":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signup state.")
    if db.query(User).filter(User.email == payload["email"]).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")
    if db.query(User).filter(User.username == payload["username"]).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is already taken")

    user = User(
        email=payload["email"],
        username=payload["username"],
        password_hash=payload["password_hash"],
        is_active=True,
        interests=[],
        goals=[],
        onboarding_completed=False,
        theme_preference="light",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(
        access_token=create_access_token(subject=user.id),
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/github/callback")
def github_oauth_callback(code: str, state: str, db: Session = Depends(get_db)):
    """Step 2 of signup (and also used for future GitHub re-auth): GitHub redirects here
    with the OAuth `code` plus our `state` token. We decode the pending signup, exchange
    the code for an access token, create the User, and hand the frontend a normal
    BuildFeed access token via redirect.
    """
    try:
        payload = jwt.decode(state, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired signup session. Please sign up again.")

    purpose = payload.get("purpose")
    if purpose == "project_build":
        user = db.query(User).filter(User.id == payload.get("user_id"), User.is_active == True).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your BuildFeed session is no longer valid. Please log in again.")
        try:
            github_token = github_service.exchange_code_for_token(code)
            github_username = github_service.get_authenticated_username(github_token)
        except GitHubServiceError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"GitHub connection failed: {e}")

        user.github_username = github_username
        user.github_access_token = encrypt_token(github_token)
        user.github_connected_at = datetime.now(timezone.utc)
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)

        from app.services.project.project_service import project_service
        item_id = payload.get("item_id")
        existing = project_service.get_project_for_saved_item(db, user_id=user.id, item_id=item_id)
        if existing:
            project = existing
        else:
            try:
                project = project_service.create_project_from_saved(db, user_id=user.id, item_id=item_id)
            except ValueError as ve:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
        project = project_service.ensure_github_repo(db, user=user, project=project)
        access_token = create_access_token(subject=user.id)
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/auth/callback#token={access_token}&project_id={project.id}&action=build")

    if purpose != "signup":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signup state.")

    # Re-check uniqueness in case of a race between step 1 and this callback.
    if db.query(User).filter(User.email == payload["email"]).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")
    if db.query(User).filter(User.username == payload["username"]).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is already taken")

    try:
        github_token = github_service.exchange_code_for_token(code)
        github_username = github_service.get_authenticated_username(github_token)
    except GitHubServiceError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"GitHub connection failed: {e}")

    user = User(
        email=payload["email"],
        username=payload["username"],
        password_hash=payload["password_hash"],
        is_active=True,
        interests=[],
        goals=[],
        onboarding_completed=False,
        theme_preference="light",
        github_username=github_username,
        github_access_token=encrypt_token(github_token),
        github_connected_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=user.id)
    # Hand the token back to the SPA via a redirect fragment (never logged server-side).
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/auth/callback#token={access_token}")


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(login_limiter)])
def login_user(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email.lower()).first()
    
    # Generic error detail to prevent email enumeration
    invalid_login_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "title": "Invalid email or password.",
            "message": "Please enter the right email or password and try again."
        },
        headers={"WWW-Authenticate": "Bearer"}
    )
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise invalid_login_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )
    
    access_token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/logout", response_model=MessageResponse)
def logout_user(current_user: User = Depends(get_current_user)):
    return MessageResponse(message="Successfully logged out")


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.post("/onboarding", response_model=UserResponse)
def complete_onboarding(
    req: OnboardingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.interests = req.interests
    current_user.experience_level = req.experience_level
    if req.skill_levels is not None:
        current_user.skill_levels = req.skill_levels
    current_user.goals = req.goals
    current_user.onboarding_completed = True
    current_user.updated_at = utc_now()
    
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    req: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.username is not None and req.username != current_user.username:
        existing = db.query(User).filter(User.username == req.username).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken"
            )
        current_user.username = req.username

    if req.interests is not None:
        current_user.interests = req.interests
    if req.experience_level is not None:
        current_user.experience_level = req.experience_level
    if req.skill_levels is not None:
        current_user.skill_levels = req.skill_levels
    if req.goals is not None:
        current_user.goals = req.goals
    if req.theme_preference is not None:
        current_user.theme_preference = req.theme_preference

    current_user.updated_at = utc_now()
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/forgot-password", response_model=ForgotPasswordResponse, dependencies=[Depends(forgot_limiter)])
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()

    if user:
        raw_token = secrets.token_urlsafe(32)
        expires_at = utc_now() + timedelta(minutes=30)
        
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False
        ).update({"used": True})
        
        reset_record = PasswordResetToken(
            user_id=user.id,
            token=raw_token,
            expires_at=expires_at,
            used=False
        )
        db.add(reset_record)
        db.commit()

        sent = send_password_reset_email(user.email, raw_token)
        logger.warning("Password reset email to %s: %s", user.email, "SENT OK" if sent else "FAILED (see error above)")

        # Local-dev convenience only: when SMTP isn't configured/working in a
        # development environment, log the raw token server-side so a
        # developer can complete the flow manually. This NEVER goes in the
        # HTTP response — the token must never reach the frontend directly.
        if not sent and settings.APP_ENV == "development":
            logger.info("[DEV ONLY] Raw password reset token for %s: %s", user.email, raw_token)
    else:
        logger.warning("Password reset requested for UNREGISTERED email: %s (no email sent, by design)", req.email)

    return ForgotPasswordResponse(
        message="If an account exists for this email, you'll receive a password reset link."
    )


@router.get("/verify-reset-token", response_model=VerifyTokenResponse)
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token,
        PasswordResetToken.used == False
    ).first()
    
    if not record or record.expires_at < utc_now():
        return VerifyTokenResponse(valid=False)
    
    return VerifyTokenResponse(valid=True, email=record.user.email)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == req.token,
        PasswordResetToken.used == False
    ).first()
    
    if not record or record.expires_at < utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token. Please request a new password reset link."
        )
    
    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.password_hash = get_password_hash(req.new_password)
    user.updated_at = utc_now()
    record.used = True
    
    db.commit()
    
    return MessageResponse(message="Password reset successfully. You can now sign in.")