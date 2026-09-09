"""Normalize legacy provenance to uploaded_unverified, never official."""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "UPDATE datasets SET provenance = 'uploaded_unverified' WHERE provenance IS NULL OR provenance = ''"
    )


def downgrade():
    # Classification normalization is intentionally not reversed.
    pass
