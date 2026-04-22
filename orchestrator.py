import json
import datetime
from sqlalchemy.orm import Session
from db import models

class SignalService:
    @staticmethod
    def publish_signal(db: Session, user_id: int, signal_type: str, source_agent: str, payload: dict):
        """Publishes a signal to the shared state."""
        db_signal = models.AgentSignal(
            user_id=user_id,
            signal_type=signal_type,
            source_agent=source_agent,
            payload=json.dumps(payload),
            created_at=datetime.datetime.now().isoformat(),
            status="PENDING"
        )
        db.add(db_signal)
        db.commit()
        db.refresh(db_signal)
        print(f"Signal Published: {signal_type} from {source_agent}")
        return db_signal

    @staticmethod
    def get_pending_signals(db: Session):
        """Retrieves all pending signals to be processed by the orchestrator."""
        return db.query(models.AgentSignal).filter(models.AgentSignal.status == "PENDING").all()

    @staticmethod
    def mark_signal_processed(db: Session, signal_id: int):
        """Marks a signal as processed so it won't be picked up again."""
        db_signal = db.query(models.AgentSignal).filter(models.AgentSignal.id == signal_id).first()
        if db_signal:
            db_signal.status = "PROCESSED"
            db.commit()
