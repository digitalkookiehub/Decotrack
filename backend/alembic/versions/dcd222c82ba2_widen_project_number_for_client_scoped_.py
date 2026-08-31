"""widen project_number for client-scoped numbering

Revision ID: dcd222c82ba2
Revises: 857b61310bd3
Create Date: 2026-08-26 17:36:29.580324

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dcd222c82ba2'
down_revision: Union[str, None] = '857b61310bd3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "projects",
        "project_number",
        existing_type=sa.String(length=20),
        type_=sa.String(length=30),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "projects",
        "project_number",
        existing_type=sa.String(length=30),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
