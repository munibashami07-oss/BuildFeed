"""Add GitHub integration fields

Revision ID: k21000000abc
Revises: j20000000abc
Create Date: 2026-08-18 00:00:00.000000

Adds GitHub OAuth fields to users (required at signup) and a repo URL to projects
(populated the first time "Build This" is clicked on a saved project):
  users.github_username, users.github_access_token, users.github_connected_at
  projects.github_repo_url
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'k21000000abc'
down_revision: Union[str, None] = 'j20000000abc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('github_username', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('github_access_token', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('github_connected_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('projects', sa.Column('github_repo_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'github_repo_url')

    op.drop_column('users', 'github_connected_at')
    op.drop_column('users', 'github_access_token')
    op.drop_column('users', 'github_username')
