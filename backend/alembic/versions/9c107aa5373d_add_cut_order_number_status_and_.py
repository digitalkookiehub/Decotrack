"""add cut_order_number status and tracking fields

Revision ID: 9c107aa5373d
Revises: a78d990d2e5b
Create Date: 2026-04-09 15:52:49.263899

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c107aa5373d'
down_revision: Union[str, None] = 'a78d990d2e5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type
    cutorderstatus = sa.Enum('PLANNED', 'CUTTING', 'COMPLETED', 'CANCELLED', name='cutorderstatus')
    cutorderstatus.create(op.get_bind(), checkfirst=True)

    # Add columns as nullable first
    op.add_column('cutting_patterns', sa.Column('cut_order_number', sa.String(length=20), nullable=True))
    op.add_column('cutting_patterns', sa.Column('status', cutorderstatus, nullable=True))
    op.add_column('cutting_patterns', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('cutting_patterns', sa.Column('sheets_consumed', sa.Integer(), nullable=True))
    op.add_column('cutting_patterns', sa.Column('actual_wastage_percent', sa.Numeric(precision=5, scale=2), nullable=True))

    # Set defaults for existing rows
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT id FROM cutting_patterns WHERE cut_order_number IS NULL"))
    rows = result.fetchall()
    for i, row in enumerate(rows):
        conn.execute(
            sa.text("UPDATE cutting_patterns SET cut_order_number = :num, status = 'PLANNED' WHERE id = :id"),
            {"num": f"CO-2026-{i+1:04d}", "id": row[0]}
        )

    # Now make NOT NULL
    op.alter_column('cutting_patterns', 'cut_order_number', nullable=False)
    op.alter_column('cutting_patterns', 'status', nullable=False, server_default='PLANNED')
    op.create_index(op.f('ix_cutting_patterns_cut_order_number'), 'cutting_patterns', ['cut_order_number'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_cutting_patterns_cut_order_number'), table_name='cutting_patterns')
    op.drop_column('cutting_patterns', 'actual_wastage_percent')
    op.drop_column('cutting_patterns', 'sheets_consumed')
    op.drop_column('cutting_patterns', 'completed_at')
    op.drop_column('cutting_patterns', 'status')
    op.drop_column('cutting_patterns', 'cut_order_number')
    sa.Enum(name='cutorderstatus').drop(op.get_bind(), checkfirst=True)
