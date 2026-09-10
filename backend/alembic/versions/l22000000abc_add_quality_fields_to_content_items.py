"""Add quality fields to content_items (Module 21: Content Quality & Moderation)

Revision ID: l22000000abc
Revises: k21000000abc
Create Date: 2026-08-19 00:00:00.000000

Adds four new columns to content_items to support the quality/moderation pipeline:
  - quality_status     VARCHAR(50)  DEFAULT 'pending'   NOT NULL
      Values: 'pending' | 'passed' | 'rejected' | 'flagged'
      Indexed for fast batch queries (find all pending items, etc.)
  - quality_issues     JSON         NULLABLE
      List of issue-code strings, e.g. ["near_duplicate", "stale_content"]
  - quality_score      JSON         NULLABLE
      Dict mapping check name → float score, e.g. {"duplicate": 1.0, "freshness": 0.7}
  - quality_checked_at TIMESTAMPTZ  NULLABLE
      Timestamp of the most recent quality check run for this item.

Existing rows are set to quality_status='pending' so the first quality batch
will pick them all up and evaluate them without any data loss.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "l22000000abc"
down_revision: Union[str, None] = "k21000000abc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add quality_status with a server-side default so existing rows are valid immediately
    op.add_column(
        "content_items",
        sa.Column(
            "quality_status",
            sa.String(50),
            nullable=False,
            server_default="pending",
        ),
    )
    # Index for fast status-filtered batch queries
    op.create_index(
        "ix_content_items_quality_status",
        "content_items",
        ["quality_status"],
    )

    op.add_column(
        "content_items",
        sa.Column("quality_issues", sa.JSON(), nullable=True),
    )
    op.add_column(
        "content_items",
        sa.Column("quality_score", sa.JSON(), nullable=True),
    )
    op.add_column(
        "content_items",
        sa.Column("quality_checked_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("content_items", "quality_checked_at")
    op.drop_column("content_items", "quality_score")
    op.drop_column("content_items", "quality_issues")
    op.drop_index("ix_content_items_quality_status", table_name="content_items")
    op.drop_column("content_items", "quality_status")
