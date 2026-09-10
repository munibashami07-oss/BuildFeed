"""Add profile onboarding and theme fields

Revision ID: c7391a284e91
Revises: a981425fc5e5
Create Date: 2026-08-13 17:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7391a284e91'
down_revision: Union[str, None] = 'a981425fc5e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('interests', sa.JSON(), server_default='[]', nullable=False))
    op.add_column('users', sa.Column('experience_level', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('goals', sa.JSON(), server_default='[]', nullable=False))
    op.add_column('users', sa.Column('onboarding_completed', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('theme_preference', sa.String(length=20), server_default='light', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'theme_preference')
    op.drop_column('users', 'onboarding_completed')
    op.drop_column('users', 'goals')
    op.drop_column('users', 'experience_level')
    op.drop_column('users', 'interests')
