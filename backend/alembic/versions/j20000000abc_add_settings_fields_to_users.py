"""Add settings fields to users table

Revision ID: j20000000abc
Revises: i19000000abc
Create Date: 2026-08-15 15:00:00.000000

Adds Module 20 fields to the users table:
  bio, avatar_url                          — extended profile
  feed_content_limit, preferred_content_types — feed preferences
  notif_enabled, notif_achievements, notif_projects, notif_content  — notification prefs
  portfolio_public                          — privacy
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'j20000000abc'
down_revision: Union[str, None] = 'i19000000abc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extended profile
    op.add_column('users', sa.Column('bio',        sa.Text(),         nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.String(500),    nullable=True))

    # Feed preferences
    op.add_column('users', sa.Column('feed_content_limit',     sa.Integer(), nullable=False, server_default='10'))
    op.add_column('users', sa.Column('preferred_content_types', sa.JSON(),   nullable=False, server_default='[]'))

    # Notification preferences
    op.add_column('users', sa.Column('notif_enabled',      sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('users', sa.Column('notif_achievements', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('users', sa.Column('notif_projects',     sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('users', sa.Column('notif_content',      sa.Boolean(), nullable=False, server_default='true'))

    # Privacy
    op.add_column('users', sa.Column('portfolio_public', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    op.drop_column('users', 'portfolio_public')
    op.drop_column('users', 'notif_content')
    op.drop_column('users', 'notif_projects')
    op.drop_column('users', 'notif_achievements')
    op.drop_column('users', 'notif_enabled')
    op.drop_column('users', 'preferred_content_types')
    op.drop_column('users', 'feed_content_limit')
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'bio')
