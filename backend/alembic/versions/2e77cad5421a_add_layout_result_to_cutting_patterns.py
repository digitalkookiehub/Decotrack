"""add layout_result to cutting_patterns

Revision ID: 2e77cad5421a
Revises: dcd222c82ba2
Create Date: 2026-08-26 18:10:36.340125

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '2e77cad5421a'
down_revision: Union[str, None] = 'dcd222c82ba2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cutting_patterns",
        sa.Column("layout_result", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cutting_patterns", "layout_result")
