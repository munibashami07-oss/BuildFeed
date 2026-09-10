"""Create notifications table

Revision ID: i19000000abc
Revises: h16000000abc
Create Date: 2026-08-15 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'i19000000abc'
down_revision: Union[str, None] = 'h16000000abc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.String(length=60), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('link', sa.String(length=500), nullable=True),
        sa.Column('related_id', sa.String(length=100), nullable=True),
        sa.Column('related_type', sa.String(length=50), nullable=True),
        sa.Column('dedup_key', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_notifications_id',         'notifications', ['id'],         unique=False)
    op.create_index('ix_notifications_user_id',    'notifications', ['user_id'],    unique=False)
    op.create_index('ix_notifications_type',       'notifications', ['type'],       unique=False)
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'], unique=False)
    op.create_index('ix_notifications_dedup_key',  'notifications', ['dedup_key'],  unique=False)
    # Partial unique index: dedup only when dedup_key IS NOT NULL
    op.execute(
        "CREATE UNIQUE INDEX uq_notifications_user_dedup "
        "ON notifications (user_id, dedup_key) "
        "WHERE dedup_key IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_notifications_user_dedup")
    op.drop_index('ix_notifications_dedup_key',  table_name='notifications')
    op.drop_index('ix_notifications_created_at', table_name='notifications')
    op.drop_index('ix_notifications_type',       table_name='notifications')
    op.drop_index('ix_notifications_user_id',    table_name='notifications')
    op.drop_index('ix_notifications_id',         table_name='notifications')
    op.drop_table('notifications')
