import logging
import re
from datetime import datetime

from sqlalchemy import Column
from sqlalchemy.orm import Session

from app.database import Base

logger = logging.getLogger(__name__)

CLIENT_WORD_MAX_LEN = 12


def _client_word(client_name: str) -> str:
    """First word of a client name, alphanumeric-only, uppercased. Falls back to CLIENT."""
    first_token = client_name.strip().split()[0] if client_name and client_name.strip() else ""
    word = re.sub(r"[^A-Za-z0-9]", "", first_token).upper()[:CLIENT_WORD_MAX_LEN]
    return word or "CLIENT"


def generate_client_scoped_number(
    db: Session, client_name: str, number_column: Column, model_class: type[Base]
) -> str:
    """Generate document number scoped to a client: CLIENTWORD-YYYY-NNNN.

    The sequence resets per client word per year. If two clients share the same
    first word, they share one sequence rather than colliding on the same number.
    """
    current_year = datetime.now().year
    prefix = f"{_client_word(client_name)}-{current_year}-"

    last = (
        db.query(model_class)
        .filter(number_column.like(f"{prefix}%"))
        .order_by(number_column.desc())
        .first()
    )

    if last:
        last_num = getattr(last, number_column.key)
        next_seq = int(last_num.split("-")[-1]) + 1
    else:
        next_seq = 1

    result = f"{prefix}{next_seq:04d}"
    logger.info("Generated client-scoped number: %s", result)
    return result


def generate_number(db: Session, prefix: str, number_column: Column, model_class: type[Base]) -> str:
    """Generate sequential document number: PREFIX-YYYY-NNNN"""
    current_year = datetime.now().year
    year_prefix = f"{prefix}-{current_year}-"

    last = (
        db.query(model_class)
        .filter(number_column.like(f"{year_prefix}%"))
        .order_by(number_column.desc())
        .first()
    )

    if last:
        last_num = getattr(last, number_column.key)
        last_seq = int(last_num.split("-")[-1])
        next_seq = last_seq + 1
    else:
        next_seq = 1

    result = f"{year_prefix}{next_seq:04d}"
    logger.info("Generated document number: %s", result)
    return result
