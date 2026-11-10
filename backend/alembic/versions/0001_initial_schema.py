"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-11-08

All CampusBite tables (PLAN.md section 4). Reviewed by hand after autogenerate.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('phone', sa.String(length=20), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('role', sa.Enum('customer', 'restaurant_owner', 'delivery_partner', name='userrole', native_enum=False), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('default_address', sa.Text(), nullable=True),
    sa.Column('vehicle_type', sa.Enum('bicycle', 'scooter', 'bike', name='vehicletype', native_enum=False), nullable=True),
    sa.Column('vehicle_number', sa.String(length=20), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users'))
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)

    op.create_table('restaurants',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('owner_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=150), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('cuisine', sa.String(length=100), nullable=False),
    sa.Column('address', sa.Text(), nullable=False),
    sa.Column('phone', sa.String(length=20), nullable=False),
    sa.Column('image_url', sa.String(length=500), nullable=True),
    sa.Column('is_open', sa.Boolean(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], name=op.f('fk_restaurants_owner_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_restaurants')),
    sa.UniqueConstraint('owner_id', name=op.f('uq_restaurants_owner_id'))
    )
    op.create_index(op.f('ix_restaurants_name'), 'restaurants', ['name'], unique=False)

    op.create_table('menu_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('restaurant_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=150), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('category', sa.String(length=100), nullable=False),
    sa.Column('image_url', sa.String(length=500), nullable=True),
    sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('is_veg', sa.Boolean(), nullable=False),
    sa.Column('is_available', sa.Boolean(), nullable=False),
    sa.Column('is_deleted', sa.Boolean(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('price > 0', name=op.f('ck_menu_items_price_positive')),
    sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], name=op.f('fk_menu_items_restaurant_id_restaurants')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_menu_items'))
    )
    op.create_index(op.f('ix_menu_items_name'), 'menu_items', ['name'], unique=False)
    op.create_index('ix_menu_items_restaurant_flags', 'menu_items', ['restaurant_id', 'is_deleted', 'is_available'], unique=False)
    op.create_index(op.f('ix_menu_items_restaurant_id'), 'menu_items', ['restaurant_id'], unique=False)

    op.create_table('orders',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('customer_id', sa.Integer(), nullable=False),
    sa.Column('restaurant_id', sa.Integer(), nullable=False),
    sa.Column('delivery_partner_id', sa.Integer(), nullable=True),
    sa.Column('status', sa.Enum('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED', name='orderstatus', native_enum=False), nullable=False),
    sa.Column('payment_status', sa.Enum('pending', 'mock_paid', 'refunded', name='paymentstatus', native_enum=False), nullable=False),
    sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('delivery_fee', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('delivery_address', sa.Text(), nullable=False),
    sa.Column('contact_phone', sa.String(length=20), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('status_updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('cancellable_until', sa.DateTime(timezone=True), nullable=False),
    sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['users.id'], name=op.f('fk_orders_customer_id_users')),
    sa.ForeignKeyConstraint(['delivery_partner_id'], ['users.id'], name=op.f('fk_orders_delivery_partner_id_users')),
    sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], name=op.f('fk_orders_restaurant_id_restaurants')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_orders'))
    )
    op.create_index('ix_orders_customer_created', 'orders', ['customer_id', 'created_at'], unique=False)
    op.create_index('ix_orders_partner_status', 'orders', ['delivery_partner_id', 'status'], unique=False)
    op.create_index('ix_orders_restaurant_status_created', 'orders', ['restaurant_id', 'status', 'created_at'], unique=False)

    op.create_table('admin_reminder_logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('restaurant_id', sa.Integer(), nullable=False),
    sa.Column('order_status_at_reminder', sa.Enum('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED', name='orderstatus', native_enum=False), nullable=False),
    sa.Column('message', sa.String(length=255), nullable=False),
    sa.Column('minutes_pending', sa.Integer(), nullable=False),
    sa.Column('is_resolved', sa.Boolean(), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_admin_reminder_logs_order_id_orders'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], name=op.f('fk_admin_reminder_logs_restaurant_id_restaurants')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_admin_reminder_logs'))
    )
    op.create_index(op.f('ix_admin_reminder_logs_order_id'), 'admin_reminder_logs', ['order_id'], unique=False)
    op.create_index('ix_admin_reminder_logs_restaurant_resolved', 'admin_reminder_logs', ['restaurant_id', 'is_resolved'], unique=False)

    op.create_table('order_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('menu_item_id', sa.Integer(), nullable=False),
    sa.Column('item_name', sa.String(length=150), nullable=False),
    sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('line_total', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('quantity BETWEEN 1 AND 20', name=op.f('ck_order_items_quantity_range')),
    sa.ForeignKeyConstraint(['menu_item_id'], ['menu_items.id'], name=op.f('fk_order_items_menu_item_id_menu_items')),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_order_items_order_id_orders'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_order_items'))
    )
    op.create_index(op.f('ix_order_items_order_id'), 'order_items', ['order_id'], unique=False)

    op.create_table('order_status_history',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('from_status', sa.Enum('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED', name='orderstatus', native_enum=False), nullable=True),
    sa.Column('to_status', sa.Enum('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED', name='orderstatus', native_enum=False), nullable=False),
    sa.Column('changed_by_user_id', sa.Integer(), nullable=True),
    sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['changed_by_user_id'], ['users.id'], name=op.f('fk_order_status_history_changed_by_user_id_users')),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_order_status_history_order_id_orders'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_order_status_history'))
    )
    op.create_index(op.f('ix_order_status_history_order_id'), 'order_status_history', ['order_id'], unique=False)

    op.create_table('payment_ledger',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('entry_type', sa.Enum('charge', 'refund', name='ledgerentrytype', native_enum=False), nullable=False),
    sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('status', sa.Enum('success', 'failed', name='ledgerstatus', native_enum=False), nullable=False),
    sa.Column('method', sa.String(length=20), nullable=False),
    sa.Column('transaction_ref', sa.String(length=64), nullable=False),
    sa.Column('note', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_payment_ledger_order_id_orders'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_payment_ledger')),
    sa.UniqueConstraint('transaction_ref', name=op.f('uq_payment_ledger_transaction_ref'))
    )
    op.create_index(op.f('ix_payment_ledger_order_id'), 'payment_ledger', ['order_id'], unique=False)

    op.create_table('return_requests',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('customer_id', sa.Integer(), nullable=False),
    sa.Column('reason', sa.Text(), nullable=False),
    sa.Column('status', sa.Enum('requested', 'approved', 'rejected', name='returnstatus', native_enum=False), nullable=False),
    sa.Column('owner_note', sa.Text(), nullable=True),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('resolved_by', sa.Integer(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['users.id'], name=op.f('fk_return_requests_customer_id_users')),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_return_requests_order_id_orders')),
    sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], name=op.f('fk_return_requests_resolved_by_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_return_requests')),
    sa.UniqueConstraint('order_id', name=op.f('uq_return_requests_order_id'))
    )
    op.create_index(op.f('ix_return_requests_status'), 'return_requests', ['status'], unique=False)

    op.create_table('reviews',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('customer_id', sa.Integer(), nullable=False),
    sa.Column('restaurant_id', sa.Integer(), nullable=False),
    sa.Column('rating', sa.Integer(), nullable=False),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('rating BETWEEN 1 AND 5', name=op.f('ck_reviews_rating_range')),
    sa.ForeignKeyConstraint(['customer_id'], ['users.id'], name=op.f('fk_reviews_customer_id_users')),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_reviews_order_id_orders')),
    sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], name=op.f('fk_reviews_restaurant_id_restaurants')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_reviews')),
    sa.UniqueConstraint('order_id', name=op.f('uq_reviews_order_id'))
    )
    op.create_index(op.f('ix_reviews_restaurant_id'), 'reviews', ['restaurant_id'], unique=False)



def downgrade() -> None:
    op.drop_index(op.f('ix_reviews_restaurant_id'), table_name='reviews')
    op.drop_table('reviews')

    op.drop_index(op.f('ix_return_requests_status'), table_name='return_requests')
    op.drop_table('return_requests')

    op.drop_index(op.f('ix_payment_ledger_order_id'), table_name='payment_ledger')
    op.drop_table('payment_ledger')

    op.drop_index(op.f('ix_order_status_history_order_id'), table_name='order_status_history')
    op.drop_table('order_status_history')

    op.drop_index(op.f('ix_order_items_order_id'), table_name='order_items')
    op.drop_table('order_items')

    op.drop_index('ix_admin_reminder_logs_restaurant_resolved', table_name='admin_reminder_logs')
    op.drop_index(op.f('ix_admin_reminder_logs_order_id'), table_name='admin_reminder_logs')
    op.drop_table('admin_reminder_logs')

    op.drop_index('ix_orders_restaurant_status_created', table_name='orders')
    op.drop_index('ix_orders_partner_status', table_name='orders')
    op.drop_index('ix_orders_customer_created', table_name='orders')
    op.drop_table('orders')

    op.drop_index(op.f('ix_menu_items_restaurant_id'), table_name='menu_items')
    op.drop_index('ix_menu_items_restaurant_flags', table_name='menu_items')
    op.drop_index(op.f('ix_menu_items_name'), table_name='menu_items')
    op.drop_table('menu_items')

    op.drop_index(op.f('ix_restaurants_name'), table_name='restaurants')
    op.drop_table('restaurants')

    op.drop_index(op.f('ix_users_role'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
