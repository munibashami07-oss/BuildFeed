"""Add sharing fields to project_portfolio table

Revision ID: h16000000abc
Revises: g15000000abc
Create Date: 2026-08-15 13:00:00.000000

Adds:
  is_public  — Boolean, default False, server_default 'false'
  share_slug — String(80), nullable, unique index
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'h16000000abc'
down_revision: Union[str, None] = 'g15000000abc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'project_portfolio',
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'project_portfolio',
        sa.Column('share_slug', sa.String(length=80), nullable=True),
    )
    op.create_unique_constraint(
        'uq_project_portfolio_share_slug', 'project_portfolio', ['share_slug']
    )
    op.create_index(
        'ix_project_portfolio_share_slug', 'project_portfolio', ['share_slug'], unique=True
    )


def downgrade() -> None:
    op.drop_index('ix_project_portfolio_share_slug', table_name='project_portfolio')
    op.drop_constraint('uq_project_portfolio_share_slug', 'project_portfolio', type_='unique')
    op.drop_column('project_portfolio', 'share_slug')
    op.drop_column('project_portfolio', 'is_public')
