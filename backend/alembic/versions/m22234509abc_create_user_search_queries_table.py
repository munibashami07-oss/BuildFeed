"""Create user_search_queries table

Revision ID: m22234509abc
Revises: l22000000abc
Create Date: 2026-08-20 15:51:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'm22234509abc'
down_revision: Union[str, None] = 'l22000000abc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_search_queries',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('query', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_search_queries_created_at'), 'user_search_queries', ['created_at'], unique=False)
    op.create_index(op.f('ix_user_search_queries_id'), 'user_search_queries', ['id'], unique=False)
    op.create_index(op.f('ix_user_search_queries_user_id'), 'user_search_queries', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_search_queries_user_id'), table_name='user_search_queries')
    op.drop_index(op.f('ix_user_search_queries_id'), table_name='user_search_queries')
    op.drop_index(op.f('ix_user_search_queries_created_at'), table_name='user_search_queries')
    op.drop_table('user_search_queries')
