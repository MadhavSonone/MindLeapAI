from sqlalchemy.orm import Session
from db import models
from orchestrator import SignalService
import datetime

class PerformanceAnalyst:
    def __init__(self, db: Session):
        self.db = db

    def analyze_user_progress(self, user_id: int, chapter_id: int):
        """Analyzes recent progress for a chapter and updates mastery & signals."""
        print(f"Analyst: Analyzing progress for User {user_id}, Chapter {chapter_id}...")
        
        # Get all attempts for this user and chapter
        attempts = self.db.query(models.UserProgress).filter(
            models.UserProgress.user_id == user_id,
            models.UserProgress.question_id.in_(
                self.db.query(models.Question.id).filter(models.Question.chapter_id == chapter_id)
            )
        ).all()

        if not attempts:
            return

        total = len(attempts)
        correct = len([a for a in attempts if a.status == "correct"])
        accuracy = (correct / total) * 100 if total > 0 else 0

        # Update Chapter Mastery
        mastery = self.db.query(models.ChapterMastery).filter(
            models.ChapterMastery.user_id == user_id,
            models.ChapterMastery.chapter_id == chapter_id
        ).first()

        if not mastery:
            mastery = models.ChapterMastery(user_id=user_id, chapter_id=chapter_id)
            self.db.add(mastery)

        mastery.recent_accuracy = int(accuracy)
        # Mastery logic: simple average for now, could be more complex
        mastery.mastery_score = int(accuracy) 
        mastery.last_attempted_at = datetime.datetime.now().isoformat()
        
        self.db.commit()

        # Emit Signal if accuracy is low (e.g. < 60%) after at least 5 questions
        if total >= 5 and accuracy < 60:
            SignalService.publish_signal(
                self.db, 
                user_id, 
                "WEAK_TOPIC_DETECTED", 
                "Analyst", 
                {"chapter_id": chapter_id, "accuracy": accuracy, "total_attempts": total}
            )
            print(f"Analyst: Published WEAK_TOPIC_DETECTED for Chapter {chapter_id}")
