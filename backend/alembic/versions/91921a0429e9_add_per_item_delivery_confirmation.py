"""add per-item delivery confirmation

Revision ID: 91921a0429e9
Revises: 2e77cad5421a
Create Date: 2026-08-30 17:23:26.662577

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '91921a0429e9'
down_revision: Union[str, None] = '2e77cad5421a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("dispatch_items", sa.Column("delivered_quantity", sa.Integer(), nullable=True))
    op.add_column(
        "dispatch_items",
        sa.Column("site_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("dispatch_items", "site_verified")
    op.drop_column("dispatch_items", "delivered_quantity")
