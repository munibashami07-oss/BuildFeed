"""Add skill_levels to users table

Revision ID: p25000000abc
Revises: o24000000abc
Create Date: 2026-09-06 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "p25000000abc"
down_revision: Union[str, None] = "o24000000abc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("skill_levels", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
    )


def downgrade() -> None:
    op.drop_column("users", "skill_levels")
