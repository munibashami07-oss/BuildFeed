"""Create user_consumed_content table

Revision ID: c10234509abc
Revises: b98214309def
Create Date: 2026-08-14 02:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c10234509abc'
down_revision: Union[str, None] = 'b98214309def'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_consumed_content',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content_item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('consumed_date', sa.Date(), nullable=False),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['content_item_id'], ['content_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'content_item_id', 'consumed_date', name='uq_user_consumed_item_date')
    )
    op.create_index(op.f('ix_user_consumed_content_consumed_date'), 'user_consumed_content', ['consumed_date'], unique=False)
    op.create_index(op.f('ix_user_consumed_content_content_item_id'), 'user_consumed_content', ['content_item_id'], unique=False)
    op.create_index(op.f('ix_user_consumed_content_id'), 'user_consumed_content', ['id'], unique=False)
    op.create_index(op.f('ix_user_consumed_content_user_id'), 'user_consumed_content', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_consumed_content_user_id'), table_name='user_consumed_content')
    op.drop_index(op.f('ix_user_consumed_content_id'), table_name='user_consumed_content')
    op.drop_index(op.f('ix_user_consumed_content_content_item_id'), table_name='user_consumed_content')
    op.drop_index(op.f('ix_user_consumed_content_consumed_date'), table_name='user_consumed_content')
    op.drop_table('user_consumed_content')
