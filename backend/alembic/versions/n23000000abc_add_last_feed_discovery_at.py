"""Track the last successful discovery used for each user's feed.

Revision ID: n23000000abc
Revises: m22234509abc
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'n23000000abc'
down_revision: Union[str, None] = 'm22234509abc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('last_feed_discovery_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        'ix_users_last_feed_discovery_at',
        'users',
        ['last_feed_discovery_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_users_last_feed_discovery_at', table_name='users')
    op.drop_column('users', 'last_feed_discovery_at')
