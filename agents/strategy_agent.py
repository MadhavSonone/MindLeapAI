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
            model_name="llama-3.1-8b-instant"
        )

    def generate_initial_plan(self, user_id: int):
        pref = self.db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
        if not pref:
            print("Strategy: User preferences not found. Cannot generate plan.")
            return

        completed_ids = json.loads(pref.completed_chapters or "[]")
        completed_chapters = self.db.query(models.Chapter).filter(models.Chapter.id.in_(completed_ids)).all()
        completed_names = [c.name for c in completed_chapters]
        print("Completed chapters:", completed_names)
        all_chapters = self.db.query(models.Chapter).all()
        syllabus_list = "\n".join([f"- {c.name}" for c in all_chapters])

        prompt = f"""
        You are a JEE Strategy Expert. 
        User Goal Date: {pref.goal_date}
        Daily Availability: {pref.daily_availability_hours} hours
        
        USER'S CURRENT STATUS:
        Already Completed Chapters: {", ".join(completed_names) if completed_names else "None"}

        AVAILABLE SYLLABUS CHAPTERS:
        {syllabus_list}

        TASK:
        Generate a comprehensive study plan for the NEXT 7 DAYS starting from {datetime.date.today()}.
        
        GUIDELINES:
        1. Mix subjects (Physics, Chemistry, Maths) across the week.
        2. For COMPLETED chapters: Schedule 'REVISE' (quick check) or 'PRACTICE' (problem solving).
        3. For NEW chapters: Schedule 'LEARN' (theory + basic problems).
        4. Each day should have 1-2 tasks.
        5. Ensure at least 2 'REVISE' sessions for completed chapters to ensure retention.

        JSON FORMAT ONLY:
        [
            {{"date": "YYYY-MM-DD", "chapter": "Exact Name", "type": "LEARN" | "PRACTICE" | "REVISE", "priority": 1-3}},
            ...
        ]
        """
        
        try:
            from schemas import StudyPlanOutput
            structured_llm = self.llm.with_structured_output(StudyPlanOutput)
            result = structured_llm.invoke(prompt)
            
            tasks = result.tasks
            
            # Save to DB
            for task in tasks:
                db_chapter = self.db.query(models.Chapter).filter(
                    models.Chapter.name.ilike(task.chapter)
                ).first()
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
