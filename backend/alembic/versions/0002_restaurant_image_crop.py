"""Persist restaurant photo crop positioning.

Revision ID: 0002
Revises: 0001
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("restaurants", sa.Column("image_crop_x", sa.Float(), server_default="0.5", nullable=False))
    op.add_column("restaurants", sa.Column("image_crop_y", sa.Float(), server_default="0.5", nullable=False))
    op.add_column("restaurants", sa.Column("image_crop_zoom", sa.Float(), server_default="1", nullable=False))


def downgrade() -> None:
    op.drop_column("restaurants", "image_crop_zoom")
    op.drop_column("restaurants", "image_crop_y")
    op.drop_column("restaurants", "image_crop_x")
