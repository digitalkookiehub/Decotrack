"""add lead measurements table

Revision ID: 327b9017d7b0
Revises: 152e0f0e3228
Create Date: 2026-08-30 18:43:11.449228

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '327b9017d7b0'
down_revision: Union[str, None] = '152e0f0e3228'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lead_measurements",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("lead_id", sa.Integer(), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("room", sa.String(length=100), nullable=False),
        sa.Column("length_mm", sa.Numeric(10, 2), nullable=True),
        sa.Column("width_mm", sa.Numeric(10, 2), nullable=True),
        sa.Column("height_mm", sa.Numeric(10, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source", sa.Enum("AI_SCAN", "MANUAL", name="measurementsource"), nullable=False),
        sa.Column("logged_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("lead_measurements")
    op.execute("DROP TYPE IF EXISTS measurementsource")
