"""Create saved_content table

Revision ID: b98214309def
Revises: a15234910abc
Create Date: 2026-08-14 01:13:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b98214309def'
down_revision: Union[str, None] = 'a15234910abc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'saved_content',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content_item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['content_item_id'], ['content_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'content_item_id', name='uq_saved_content_user_item')
    )
    op.create_index(op.f('ix_saved_content_content_item_id'), 'saved_content', ['content_item_id'], unique=False)
    op.create_index(op.f('ix_saved_content_id'), 'saved_content', ['id'], unique=False)
    op.create_index(op.f('ix_saved_content_user_id'), 'saved_content', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_saved_content_user_id'), table_name='saved_content')
    op.drop_index(op.f('ix_saved_content_id'), table_name='saved_content')
    op.drop_index(op.f('ix_saved_content_content_item_id'), table_name='saved_content')
    op.drop_table('saved_content')
