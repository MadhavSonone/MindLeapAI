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

    def generate_daily_nudge(self, user_id: int):
        """Generates a daily nudge based on study plan adherence."""
        print(f"Coach: Generating daily nudge for User {user_id}...")
        
        # Check today's tasks
        today = datetime.date.today().isoformat()
        tasks = self.db.query(models.StudyPlanTask).filter(
            models.StudyPlanTask.user_id == user_id,
            models.StudyPlanTask.target_date == today
        ).all()

        total = len(tasks)
        completed = len([t for t in tasks if t.is_completed])

        prompt = f"""
        You are a JEE Discipline Coach. 
        Today's Tasks: {total}
        Completed: {completed}
        
        Provide a short (2-sentence) motivational nudge for the student.
        If they are behind, be firm but encouraging.
        If they are on track, celebrate their consistency.
        """
        
        try:
            response = self.llm.invoke(prompt)
            nudge = response.content
            
            # Log in interaction
            interaction = models.AgentInteraction(
                user_id=user_id,
                agent_role="Coach",
                input_query="Daily Nudge",
                output_response=nudge,
                timestamp=datetime.datetime.now().isoformat()
            )
            self.db.add(interaction)
            self.db.commit()
            
            return nudge
        except Exception as e:
            print(f"Coach: Error: {e}")
            return "Keep going! Every question you solve brings you closer to your goal."
