import logging

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate

logger = logging.getLogger(__name__)


def create_client(db: Session, data: ClientCreate) -> Client:
    client = Client(**data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    logger.info("Client created: %s", client.name)
    return client


def get_clients(
    db: Session, page: int = 1, per_page: int = 20, search: str | None = None
) -> tuple[list[Client], int]:
    query = db.query(Client)
    if search:
        query = query.filter(Client.name.ilike(f"%{search}%"))
    total = query.count()
    clients = query.order_by(Client.name).offset((page - 1) * per_page).limit(per_page).all()
    return clients, total


def get_client(db: Session, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise NotFoundError("Client")
    return client


def update_client(db: Session, client_id: int, data: ClientUpdate) -> Client:
    client = get_client(db, client_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client
