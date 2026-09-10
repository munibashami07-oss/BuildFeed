"""Add ai_metadata, processing_error, and processed_at to content_items

Revision ID: f910a284e912
Revises: e89f10a74b12
Create Date: 2026-08-13 18:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f910a284e912'
down_revision: Union[str, None] = 'e89f10a74b12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('content_items', sa.Column('ai_metadata', sa.JSON(), nullable=True))
    op.add_column('content_items', sa.Column('processing_error', sa.Text(), nullable=True))
    op.add_column('content_items', sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('content_items', 'processed_at')
    op.drop_column('content_items', 'processing_error')
    op.drop_column('content_items', 'ai_metadata')
