from alembic import context
from sqlalchemy import engine_from_config, pool

from crimestack import models  # noqa: F401
from crimestack.config import settings
from crimestack.db import Base

config = context.config
config.set_main_option("sqlalchemy.url", settings().database_url.replace("%", "%%"))
if context.is_offline_mode():
    context.configure(
        url=settings().database_url, target_metadata=Base.metadata, literal_binds=True
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = engine_from_config(
        config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=Base.metadata,
            render_as_batch=connection.dialect.name == "sqlite",
        )
        with context.begin_transaction():
            context.run_migrations()
