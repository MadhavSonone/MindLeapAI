from sqlalchemy.orm import Session
from db import models
from orchestrator import SignalService
from langchain_groq import ChatGroq
from config import settings
import datetime
import json

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

    def generate_detailed_review(self, user_id: int, report: dict):
        """Generates a qualitative review of the mock test performance."""
        llm = ChatGroq(temperature=0, groq_api_key=settings.GROQ_API_KEY, model_name="llama-3.3-70b-versatile")
        
        prompt = f"""
        Role: Performance Analyst.
        Target: Detailed Review of Mock Test for User {user_id}.
        
        REPORT DATA (Chapter: {{"accuracy": %, "avg_time": seconds}}):
        {json.dumps(report, indent=2)}
        
        TASK:
        Provide a concise analysis using ONLY bullet points. Structure it as follows:
        - OVERALL PERFORMANCE: Strongest/weakest areas.
        - TIME MANAGEMENT: Specific bottlenecks or pacing issues.
        - ACTION PLAN: 3 specific recommendations for the next 48 hours.
        
        Use NO paragraphs. Only bullet points. Keep it professional and highly specific.
        """
        try:
            res = llm.invoke(prompt)
            return res.content
        except Exception as e:
            return f"Review generation failed: {e}"
