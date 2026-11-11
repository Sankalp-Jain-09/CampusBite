"""Remove restaurant photo zoom metadata.

Revision ID: 0003
Revises: 0002
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("restaurants", "image_crop_zoom")


def downgrade() -> None:
    op.add_column("restaurants", sa.Column("image_crop_zoom", sa.Float(), server_default="1", nullable=False))
