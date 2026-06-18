"""rate_limit_buckets

Revision ID: c7a2e1b35d9f
Revises: 800af70b2198
Create Date: 2026-06-18 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'c7a2e1b35d9f'
down_revision: Union[str, None] = '800af70b2198'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rate_limit_buckets',
        sa.Column('bucket_key', sqlmodel.sql.sqltypes.AutoString(length=180), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('bucket_key'),
    )
    op.create_index(
        op.f('ix_rate_limit_buckets_created_at'),
        'rate_limit_buckets',
        ['created_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_rate_limit_buckets_created_at'), table_name='rate_limit_buckets')
    op.drop_table('rate_limit_buckets')
