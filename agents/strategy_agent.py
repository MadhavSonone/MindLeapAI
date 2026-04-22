from langchain_groq import ChatGroq
from sqlalchemy.orm import Session
from db import models
from config import settings
from orchestrator import SignalService
import datetime
import json

class StrategyAgent:
    def __init__(self, db: Session):
        self.db = db
        self.llm = ChatGroq(
            temperature=0, 
            groq_api_key=settings.GROQ_API_KEY, 
            model_name="llama-3.1-70b-versatile"
        )

    def generate_initial_plan(self, user_id: int):
        """Generates a study plan based on user preferences and total syllabus."""
        print(f"Strategy: Generating initial plan for User {user_id}...")
        
        pref = self.db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
        if not pref:
            print("Strategy: User preferences not found. Cannot generate plan.")
            return

        chapters = self.db.query(models.Chapter).all()
        chapter_names = [c.name for c in chapters]

        prompt = f"""
        You are a JEE Strategy Expert.
        User Goal Date: {pref.goal_date}
        Daily Availability: {pref.daily_availability_hours} hours
        Syllabus Chapters: {', '.join(chapter_names)}

        Generate a high-level study plan for the next 7 days.
        Each day should have one or two chapters to focus on.
        Output format should be a JSON list of tasks, e.g.,
        [
            {{"date": "2024-04-22", "chapter": "Kinematics", "type": "LEARN", "priority": 1}},
            {{"date": "2024-04-23", "chapter": "Laws of Motion", "type": "PRACTICE", "priority": 1}}
        ]
        Respond ONLY with the JSON.
        """
        
        try:
            from schemas import StudyPlanOutput
            structured_llm = self.llm.with_structured_output(StudyPlanOutput)
            result = structured_llm.invoke(prompt)
            
            tasks = result.tasks
            
            # Save to DB
            for task in tasks:
                db_chapter = self.db.query(models.Chapter).filter(models.Chapter.name == task.chapter).first()
                if db_chapter:
                    db_task = models.StudyPlanTask(
                        user_id=user_id,
                        chapter_id=db_chapter.id,
                        task_type=task.type,
                        target_date=task.date,
                        priority=task.priority,
                        is_completed=False
                    )
                    self.db.add(db_task)
            
            self.db.commit()
            print(f"Strategy: Initial plan generated for User {user_id}")
            
            SignalService.publish_signal(
                self.db, 
                user_id, 
                "PLAN_UPDATED", 
                "Strategy", 
                {"message": "Initial 7-day plan created."}
            )

        except Exception as e:
            print(f"Strategy: Error generating plan: {e}")

    def respond_to_weakness(self, user_id: int, chapter_id: int, accuracy: float):
        """Adjusts the plan when a weakness is detected."""
        print(f"Strategy: Adjusting plan due to weakness in Chapter {chapter_id}...")
        
        # Add a REVISE task for tomorrow
        tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        
        db_task = models.StudyPlanTask(
            user_id=user_id,
            chapter_id=chapter_id,
            task_type="REVISE",
            target_date=tomorrow,
            priority=2, # Higher priority
            is_completed=False
        )
        self.db.add(db_task)
        self.db.commit()
        print(f"Strategy: Added REVISE task for Chapter {chapter_id} on {tomorrow}")
        
        SignalService.publish_signal(
            self.db, 
            user_id, 
            "PLAN_UPDATED", 
            "Strategy", 
            {"message": f"Added revision task for weak topic: {chapter_id}"}
        )
