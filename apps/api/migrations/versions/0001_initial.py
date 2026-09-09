"""Initial schema, including safe provenance defaults and audit write protection."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(24), nullable=False),
    )
    op.create_table("bootstrap", sa.Column("id", sa.Integer, primary_key=True))
    op.create_table(
        "datasets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("publisher", sa.String(200), nullable=False),
        sa.Column(
            "provenance", sa.String(32), nullable=False, server_default="uploaded_unverified"
        ),
        sa.Column("quality", sa.JSON, nullable=False),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "dataset_id", sa.String(36), sa.ForeignKey("datasets.id"), nullable=False, index=True
        ),
        sa.Column("incident_id", sa.String(200), nullable=False),
        sa.Column("occurred_at", sa.String(40), nullable=False, index=True),
        sa.Column("category", sa.String(200), nullable=False, index=True),
        sa.Column("district_code", sa.String(200), nullable=False, index=True),
        sa.Column("severity", sa.String(30), nullable=False),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("data", sa.JSON, nullable=False),
        sa.UniqueConstraint("dataset_id", "incident_id"),
    )
    op.create_table(
        "records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("kind", sa.String(40), nullable=False, index=True),
        sa.Column("dataset_id", sa.String(36), sa.ForeignKey("datasets.id"), index=True),
        sa.Column("owner", sa.String(36), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("data", sa.JSON, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "audit_head",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("sequence", sa.Integer, nullable=False),
        sa.Column("digest", sa.String(64), nullable=False),
    )
    op.create_table(
        "audit",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=False),
        sa.Column("payload", sa.JSON, nullable=False),
        sa.Column("previous", sa.String(64), nullable=False),
        sa.Column("digest", sa.String(64), nullable=False),
    )
    op.create_table(
        "dedupe",
        sa.Column("key", sa.String(255), primary_key=True),
        sa.Column("record_id", sa.String(36), nullable=False),
    )
    op.execute(
        sa.text("INSERT INTO audit_head (id, sequence, digest) VALUES (1, 0, '" + "0" * 64 + "')")
    )
    if op.get_bind().dialect.name == "sqlite":
        for action in ("UPDATE", "DELETE"):
            op.execute(
                f"CREATE TRIGGER audit_no_{action.lower()} BEFORE {action} ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END"
            )
    else:
        op.execute(
            "CREATE FUNCTION protect_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit is append-only'; END; $$"
        )
        op.execute(
            "CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit FOR EACH ROW EXECUTE FUNCTION protect_audit()"
        )


def downgrade():
    if op.get_bind().dialect.name != "sqlite":
        op.execute("DROP TRIGGER audit_immutable ON audit")
        op.execute("DROP FUNCTION protect_audit()")
    for table in (
        "dedupe",
        "audit",
        "audit_head",
        "records",
        "incidents",
        "datasets",
        "bootstrap",
        "users",
    ):
        op.drop_table(table)
