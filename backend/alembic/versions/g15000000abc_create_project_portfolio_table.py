"""Create project_portfolio table

Revision ID: g15000000abc
Revises: f13000000abc
Create Date: 2026-08-15 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'g15000000abc'
down_revision: Union[str, None] = 'f13000000abc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'project_portfolio',
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('github_url', sa.String(length=500), nullable=True),
        sa.Column('demo_url', sa.String(length=500), nullable=True),
        sa.Column('portfolio_summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('project_id'),
    )
    op.create_index(
        op.f('ix_project_portfolio_project_id'),
        'project_portfolio',
        ['project_id'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_project_portfolio_project_id'), table_name='project_portfolio')
    op.drop_table('project_portfolio')
