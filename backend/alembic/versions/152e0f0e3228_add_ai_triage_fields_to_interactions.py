"""add AI triage fields to interactions

Revision ID: 152e0f0e3228
Revises: a676d96e080f
Create Date: 2026-08-30 17:58:27.316905

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '152e0f0e3228'
down_revision: Union[str, None] = 'a676d96e080f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("interactions", sa.Column("ai_summary", sa.Text(), nullable=True))
    op.add_column("interactions", sa.Column("ai_suggested_reply", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("interactions", "ai_suggested_reply")
    op.drop_column("interactions", "ai_summary")
