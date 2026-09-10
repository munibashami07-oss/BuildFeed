"""create user_content_feedback table

Revision ID: q26000000abc
Revises: p25000000abc
Create Date: 2026-09-06 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'q26000000abc'
down_revision = 'p25000000abc'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'user_content_feedback',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('content_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('feedback_type', sa.String(length=50), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('user_id', 'content_item_id', 'feedback_type', name='uq_user_content_feedback_type')
    )
    op.create_index('ix_user_content_feedback_id', 'user_content_feedback', ['id'])
    op.create_index('ix_user_content_feedback_user_id', 'user_content_feedback', ['user_id'])
    op.create_index('ix_user_content_feedback_content_item_id', 'user_content_feedback', ['content_item_id'])


def downgrade():
    op.drop_index('ix_user_content_feedback_content_item_id', table_name='user_content_feedback')
    op.drop_index('ix_user_content_feedback_user_id', table_name='user_content_feedback')
    op.drop_index('ix_user_content_feedback_id', table_name='user_content_feedback')
    op.drop_table('user_content_feedback')
