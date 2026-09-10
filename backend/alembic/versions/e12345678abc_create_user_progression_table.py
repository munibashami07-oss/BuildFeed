"""Create user_progression table

Revision ID: e12345678abc
Revises: d11234509abc
Create Date: 2026-08-15 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e12345678abc'
down_revision: Union[str, None] = 'd11234509abc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_progression',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('total_xp', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('level', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('awarded_step_ids', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('awarded_project_ids', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('completed_steps_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completed_projects_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index(op.f('ix_user_progression_id'), 'user_progression', ['id'], unique=False)
    op.create_index(op.f('ix_user_progression_user_id'), 'user_progression', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_progression_user_id'), table_name='user_progression')
    op.drop_index(op.f('ix_user_progression_id'), table_name='user_progression')
    op.drop_table('user_progression')
