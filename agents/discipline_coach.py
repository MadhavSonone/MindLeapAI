from langchain_groq import ChatGroq
from sqlalchemy.orm import Session
from db import models
from config import settings
import datetime

class DisciplineCoach:
    def __init__(self, db: Session):
        self.db = db
        self.llm = ChatGroq(
            temperature=0.7, # A bit more creative for motivation
            groq_api_key=settings.GROQ_API_KEY, 
            model_name="llama-3.1-8b-instant"
        )

    def generate_adherence_report(self, user_id: int):
        """Analyzes 7-day adherence and provides a status report."""
        print(f"Coach: Analyzing adherence for User {user_id}...")
        
        # Check last 7 days
        today = datetime.date.today()
        seven_days_ago = (today - datetime.timedelta(days=7)).isoformat()
        
        tasks = self.db.query(models.StudyPlanTask).filter(
            models.StudyPlanTask.user_id == user_id,
            models.StudyPlanTask.target_date >= seven_days_ago,
            models.StudyPlanTask.target_date <= today.isoformat()
        ).all()

        total = len(tasks)
        completed = len([t for t in tasks if t.is_completed])
        rate = (completed / total * 100) if total > 0 else 0

        prompt = f"""
        You are a Exam Discipline Coach. 
        Recent Plan Adherence (Last 7 Days):
        Total Tasks: {total}
        Completed: {completed}
        Adherence Rate: {rate:.1f}%
        
        Provide a 2-sentence analytical report on the student's consistency.
        Mention their 'Momentum Status' (e.g. CRITICAL, STABLE, or ELITE).
        Give one specific advice based on the data.
        """
        
        try:
            response = self.llm.invoke(prompt)
            report = response.content
            
            # Log in interaction
            interaction = models.AgentInteraction(
                user_id=user_id,
                agent_role="Coach",
                input_query="Adherence Report",
                output_response=report,
                timestamp=datetime.datetime.now().isoformat()
            )
            self.db.add(interaction)
            self.db.commit()
            
            return nudge
        except Exception as e:
            print(f"Coach: Error: {e}")
            return "Keep going! Every question you solve brings you closer to your goal."
