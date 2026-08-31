"""add geocoded delivery coordinates to dispatches

Revision ID: a676d96e080f
Revises: 91921a0429e9
Create Date: 2026-08-30 17:31:52.385821

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a676d96e080f'
down_revision: Union[str, None] = '91921a0429e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("dispatches", sa.Column("delivery_lat", sa.Numeric(10, 7), nullable=True))
    op.add_column("dispatches", sa.Column("delivery_lng", sa.Numeric(10, 7), nullable=True))


def downgrade() -> None:
    op.drop_column("dispatches", "delivery_lng")
    op.drop_column("dispatches", "delivery_lat")
