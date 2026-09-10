"""Add content_sources and content_items tables

Revision ID: e89f10a74b12
Revises: c7391a284e91
Create Date: 2026-08-13 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e89f10a74b12'
down_revision: Union[str, None] = 'c7391a284e91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create content_sources table
    op.create_table(
        'content_sources',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('source_type', sa.String(length=50), nullable=False),
        sa.Column('base_url', sa.String(length=500), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('last_fetched_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_content_sources_id'), 'content_sources', ['id'], unique=False)

    # 2. Create content_items table
    op.create_table(
        'content_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('source_id', sa.UUID(), nullable=False),
        sa.Column('external_id', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('source_url', sa.String(length=1000), nullable=False),
        sa.Column('author', sa.String(length=255), nullable=True),
        sa.Column('thumbnail_url', sa.String(length=1000), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('discovered_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('raw_metadata', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='discovered', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['source_id'], ['content_sources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source_id', 'external_id', name='uq_content_items_source_external')
    )
    op.create_index(op.f('ix_content_items_id'), 'content_items', ['id'], unique=False)
    op.create_index(op.f('ix_content_items_source_id'), 'content_items', ['source_id'], unique=False)
    op.create_index(op.f('ix_content_items_source_url'), 'content_items', ['source_url'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_content_items_source_url'), table_name='content_items')
    op.drop_index(op.f('ix_content_items_source_id'), table_name='content_items')
    op.drop_index(op.f('ix_content_items_id'), table_name='content_items')
    op.drop_table('content_items')
    op.drop_index(op.f('ix_content_sources_id'), table_name='content_sources')
    op.drop_table('content_sources')
