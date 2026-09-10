import base64
import logging
import re
from typing import Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


class GitHubServiceError(Exception):
    """Raised when a GitHub API call fails in a way the caller should surface to the user."""


class GitHubService:
    def get_authorize_url(self, state: str) -> str:
        """Build the GitHub OAuth consent URL. `state` should be a signed, tamper-proof token."""
        params = (
            f"client_id={settings.GITHUB_CLIENT_ID}"
            f"&redirect_uri={settings.GITHUB_OAUTH_REDIRECT_URI}"
            f"&scope=repo"
            f"&state={state}"
        )
        return f"https://github.com/login/oauth/authorize?{params}"

    def exchange_code_for_token(self, code: str) -> str:
        """Exchange the OAuth `code` GitHub redirected back with for an access token."""
        resp = httpx.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_OAUTH_REDIRECT_URI,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        token = data.get("access_token")
        if not token:
            raise GitHubServiceError(f"GitHub did not return an access token: {data}")
        return token

    def get_authenticated_username(self, access_token: str) -> str:
        resp = httpx.get(
            f"{GITHUB_API}/user",
            headers=self._auth_headers(access_token),
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()["login"]

    def create_repo_with_readme(
        self,
        access_token: str,
        repo_name: str,
        project_title: str,
        project_description: Optional[str],
        technologies: Optional[list] = None,
    ) -> str:
        """Create a new repo for the user (idempotent-ish: handles name collisions) and
        push an initial README pre-filled from the project. Returns the repo's HTML URL.
        """
        slug = self._slugify(repo_name)
        final_name, html_url = self._create_repo_with_unique_name(access_token, slug)
        self._push_readme(
            access_token,
            username=self.get_authenticated_username(access_token),
            repo_name=final_name,
            project_title=project_title,
            project_description=project_description,
            technologies=technologies or [],
        )
        return html_url

    # --- internals ---

    def _auth_headers(self, access_token: str) -> dict:
        return {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _slugify(self, name: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", name.strip()).strip("-")
        return slug[:90] or "buildfeed-project"

    def _create_repo_with_unique_name(self, access_token: str, base_name: str) -> Tuple[str, str]:
        """Try base_name, then base_name-2, base_name-3... until GitHub accepts it."""
        for suffix in range(0, 20):
            candidate = base_name if suffix == 0 else f"{base_name}-{suffix + 1}"
            resp = httpx.post(
                f"{GITHUB_API}/user/repos",
                headers=self._auth_headers(access_token),
                json={
                    "name": candidate,
                    "description": "Created automatically via BuildFeed",
                    "private": False,
                    "auto_init": False,
                },
                timeout=15.0,
            )
            if resp.status_code == 201:
                data = resp.json()
                return data["name"], data["html_url"]
            # 422 with "name already exists" -> try next suffix
            if resp.status_code == 422 and "already exists" in resp.text.lower():
                continue
            raise GitHubServiceError(f"GitHub repo creation failed ({resp.status_code}): {resp.text}")
        raise GitHubServiceError("Could not find an available repo name after 20 attempts.")

    def _push_readme(
        self,
        access_token: str,
        username: str,
        repo_name: str,
        project_title: str,
        project_description: Optional[str],
        technologies: list,
    ) -> None:
        tech_line = f"\n**Tech stack:** {', '.join(technologies)}\n" if technologies else ""
        readme_content = (
            f"# {project_title}\n\n"
            f"{project_description or 'Project scaffolded from BuildFeed.'}\n"
            f"{tech_line}\n"
            f"---\n"
            f"_This repository was created automatically by [BuildFeed](https://buildfeed.app) "
            f"when you clicked **Build This**. Start committing your code here!_\n"
        )
        encoded = base64.b64encode(readme_content.encode()).decode()
        resp = httpx.put(
            f"{GITHUB_API}/repos/{username}/{repo_name}/contents/README.md",
            headers=self._auth_headers(access_token),
            json={
                "message": "Initial commit: BuildFeed starter README",
                "content": encoded,
            },
            timeout=15.0,
        )
        if resp.status_code not in (200, 201):
            # Repo already exists at this point; log but don't fail the whole flow over the README.
            logger.warning("Failed to push README to %s/%s: %s", username, repo_name, resp.text)


github_service = GitHubService()
