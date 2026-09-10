"""Create content_item_likes table (Module 22 – Like System & Trending)

Revision ID: o24000000abc
Revises: n23000000abc
Create Date: 2026-08-19 00:00:00.000000

One row per (user_id, content_item_id) pair — a user can like each piece
of content at most once.  The table drives both the interactive Like button
on feed cards and the "Trending This Week" widget (ranked by total likes in
the past 7 days across all users).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "o24000000abc"
down_revision: Union[str, None] = "n23000000abc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "content_item_likes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content_item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "content_item_id", name="uq_content_item_likes_user_item"),
    )
    op.create_index("ix_content_item_likes_user_id", "content_item_likes", ["user_id"])
    op.create_index("ix_content_item_likes_content_item_id", "content_item_likes", ["content_item_id"])
    op.create_index("ix_content_item_likes_created_at", "content_item_likes", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_content_item_likes_created_at", table_name="content_item_likes")
    op.drop_index("ix_content_item_likes_content_item_id", table_name="content_item_likes")
    op.drop_index("ix_content_item_likes_user_id", table_name="content_item_likes")
    op.drop_table("content_item_likes")
