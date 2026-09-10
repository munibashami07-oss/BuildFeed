"""Add embedding, embedding_status, embedding_error, and embedded_at to content_items

Revision ID: a15234910abc
Revises: f910a284e912
Create Date: 2026-08-13 18:28:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a15234910abc'
down_revision: Union[str, None] = 'f910a284e912'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('content_items', sa.Column('embedding', sa.JSON(), nullable=True))
    op.add_column('content_items', sa.Column('embedding_status', sa.String(length=50), server_default='pending', nullable=False))
    op.add_column('content_items', sa.Column('embedding_error', sa.Text(), nullable=True))
    op.add_column('content_items', sa.Column('embedded_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('content_items', 'embedded_at')
    op.drop_column('content_items', 'embedding_error')
    op.drop_column('content_items', 'embedding_status')
    op.drop_column('content_items', 'embedding')
